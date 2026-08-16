-- Valoria introduction governance and immutable audit trail.

create table if not exists public.introduction_request_events (
  id uuid primary key default gen_random_uuid(),
  introduction_request_id uuid not null references public.introduction_requests(id) on delete restrict,
  previous_status text,
  new_status text not null,
  actor_id uuid,
  actor_type text not null check (actor_type in ('SYSTEM','ADMIN','ORGANIZATION','PROFESSIONAL')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.introduction_request_events enable row level security;
revoke all on public.introduction_request_events from anon, authenticated;

grant select on public.introduction_request_events to authenticated;

drop policy if exists introduction_events_participant_read on public.introduction_request_events;
create policy introduction_events_participant_read
on public.introduction_request_events for select to authenticated
using (
  exists (
    select 1 from public.introduction_requests r
    where r.id = introduction_request_id
      and (r.organization_id = auth.uid() or r.professional_id = auth.uid())
  )
);

create or replace function public.transition_introduction_request(
  p_request_id uuid,
  p_new_status text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.introduction_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_request public.introduction_requests;
  updated_request public.introduction_requests;
  actor_type text;
  allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into current_request
  from public.introduction_requests
  where id = p_request_id
  for update;

  if current_request.id is null then raise exception 'Introduction request not found'; end if;

  -- Organization may only withdraw a pending request. Professional may decline/accept
  -- only where those statuses are part of the current schema. Governance states remain admin-controlled.
  if auth.uid() = current_request.organization_id and p_new_status in ('WITHDRAWN') then
    allowed := current_request.status in ('PENDING','UNDER_REVIEW');
    actor_type := 'ORGANIZATION';
  elsif auth.uid() = current_request.professional_id and p_new_status in ('PROFESSIONAL_ACCEPTED','PROFESSIONAL_DECLINED') then
    allowed := current_request.status in ('APPROVED','INTRODUCTION_SENT');
    actor_type := 'PROFESSIONAL';
  else
    -- Admin/system transitions must be executed through a trusted service path until the
    -- canonical Valoria admin authorization source is wired into this function.
    raise exception 'Administrative transition requires trusted governance path';
  end if;

  if not allowed then raise exception 'Invalid introduction state transition'; end if;

  update public.introduction_requests
  set status = p_new_status,
      admin_note = case when actor_type = 'ADMIN' then p_reason else admin_note end,
      updated_at = now()
  where id = p_request_id
  returning * into updated_request;

  insert into public.introduction_request_events (
    introduction_request_id, previous_status, new_status, actor_id, actor_type, reason, metadata
  ) values (
    p_request_id, current_request.status, p_new_status, auth.uid(), actor_type, p_reason, coalesce(p_metadata,'{}'::jsonb)
  );

  return updated_request;
end;
$$;

revoke execute on function public.transition_introduction_request(uuid,text,text,jsonb) from public, anon;
grant execute on function public.transition_introduction_request(uuid,text,text,jsonb) to authenticated;

comment on table public.introduction_request_events is
'Immutable governance/audit events for introduction lifecycle transitions. Historical events are retained.';
