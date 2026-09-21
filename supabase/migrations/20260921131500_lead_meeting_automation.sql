begin;

alter table public.lead_captures
  add column if not exists event_session_id text,
  add column if not exists automation_sent boolean not null default false,
  add column if not exists automation_attempt_count integer not null default 0,
  add column if not exists automation_last_attempt_at timestamptz,
  add column if not exists automation_next_attempt_at timestamptz not null default now(),
  add column if not exists automation_last_error text,
  add column if not exists automation_sent_at timestamptz;

create index if not exists lead_captures_automation_queue_idx
on public.lead_captures(automation_sent, automation_next_attempt_at, event_session_id, created_at);

create table if not exists public.lead_automation_configs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_session_id text not null,
  event_title text not null,
  event_start timestamptz not null,
  event_end timestamptz,
  meeting_link text,
  brevo_list_id bigint,
  enabled boolean not null default false,
  send_delay_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, event_session_id)
);

alter table public.lead_automation_configs enable row level security;
drop policy if exists lead_automation_configs_admin_select on public.lead_automation_configs;
create policy lead_automation_configs_admin_select
on public.lead_automation_configs for select
to authenticated
using ((select public.is_valoria_admin()));

insert into public.lead_automation_configs
  (source,event_session_id,event_title,event_start,event_end,enabled,send_delay_seconds,brevo_list_id)
values
  ('meta_lead_ads','02','Strategic Thinking: You Are Solving the Wrong Problems',
   '2026-09-26T10:00:00+01:00','2026-09-26T11:30:00+01:00',false,0,3),
  ('event_registration','02','Strategic Thinking: You Are Solving the Wrong Problems',
   '2026-09-26T10:00:00+01:00','2026-09-26T11:30:00+01:00',false,0,null)
on conflict (source,event_session_id) do update set
  event_title=excluded.event_title,
  event_start=excluded.event_start,
  event_end=excluded.event_end,
  brevo_list_id=excluded.brevo_list_id,
  updated_at=now();

delete from cron.job where jobname = 'valoria-send-lead-meeting-link';

select cron.schedule(
  'valoria-send-lead-meeting-link','* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='valoria_project_url')
      || '/functions/v1/send-lead-meeting-link',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key')
    ),
    body := '{"limit":20}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

commit;