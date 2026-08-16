-- Durable report state machine for VALU reports.
-- Safe to run once; existing rows default to READY when an AI report exists,
-- otherwise PENDING. The state columns are intentionally server-managed.

alter table public.valu_assessments
  add column if not exists report_status text not null default 'PENDING',
  add column if not exists report_attempts integer not null default 0,
  add column if not exists report_locked_at timestamptz,
  add column if not exists report_idempotency_key text;

alter table public.valu_assessments
  drop constraint if exists valu_assessments_report_status_check;

alter table public.valu_assessments
  add constraint valu_assessments_report_status_check
  check (report_status in ('PENDING','GENERATING','READY','EMAIL_PENDING','SENT','FAILED'));

create unique index if not exists valu_assessments_report_idempotency_key_idx
  on public.valu_assessments(report_idempotency_key)
  where report_idempotency_key is not null;

create index if not exists valu_assessments_report_status_idx
  on public.valu_assessments(report_status, report_locked_at);

update public.valu_assessments
set report_status = case
  when report_email_sent_at is not null then 'SENT'
  when ai_report is not null then 'READY'
  else 'PENDING'
end
where report_status = 'PENDING';

create or replace function public.claim_report_generation(p_identity_hash text, p_idempotency_key text)
returns table(claimed boolean, status text, attempts integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.valu_assessments%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_identity_hash is null or length(p_identity_hash) < 3 or length(p_identity_hash) > 128 then
    raise exception 'invalid identity hash';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 128 then
    raise exception 'invalid idempotency key';
  end if;

  update public.valu_assessments
  set report_status = 'GENERATING',
      report_locked_at = v_now,
      report_attempts = report_attempts + 1,
      report_idempotency_key = p_idempotency_key
  where identity_hash = p_identity_hash
    and report_email_sent_at is null
    and (
      report_status in ('PENDING','FAILED')
      or (report_status = 'GENERATING' and report_locked_at < v_now - interval '10 minutes')
    )
  returning * into v_row;

  if not found then
    select * into v_row from public.valu_assessments where identity_hash = p_identity_hash limit 1;
    if not found then
      return query select false, 'NOT_FOUND'::text, 0;
    end if;
    return query select false, v_row.report_status, v_row.report_attempts;
    return;
  end if;

  return query select true, v_row.report_status, v_row.report_attempts;
end;
$$;

revoke all on function public.claim_report_generation(text,text) from public, anon, authenticated;
grant execute on function public.claim_report_generation(text,text) to service_role;
