begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.lead_captures (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text,
  full_name text,
  email text,
  phone text,
  role text,
  interest text,
  organisation text,
  source_detail text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  meta_page_id text,
  meta_form_id text,
  meta_leadgen_id text,
  meta_ad_id text,
  meta_adset_id text,
  meta_campaign_id text,
  meta_field_data jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  consent boolean not null default false,
  consent_basis text,
  created_at timestamptz not null default now(),
  brevo_synced boolean not null default false,
  brevo_attempt_count integer not null default 0,
  brevo_last_attempt_at timestamptz,
  brevo_next_attempt_at timestamptz not null default now(),
  brevo_last_error text,
  brevo_synced_at timestamptz,
  brevo_contact_id text,
  meta_processed_at timestamptz,
  constraint lead_captures_source_external_key unique (source, external_id)
);

create unique index if not exists lead_captures_meta_leadgen_uidx
  on public.lead_captures(meta_leadgen_id) where meta_leadgen_id is not null;
create index if not exists lead_captures_brevo_queue_idx
  on public.lead_captures(brevo_synced, brevo_next_attempt_at, created_at);
create index if not exists lead_captures_email_idx
  on public.lead_captures(lower(email));

alter table public.lead_captures enable row level security;
drop policy if exists lead_captures_admin_select on public.lead_captures;
create policy lead_captures_admin_select on public.lead_captures
for select to authenticated using ((select public.is_valoria_admin()));

create table if not exists public.meta_lead_events (
  id uuid primary key default gen_random_uuid(),
  leadgen_id text not null unique,
  page_id text,
  form_id text,
  ad_id text,
  adset_id text,
  created_time timestamptz,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.meta_lead_events enable row level security;
drop policy if exists meta_lead_events_admin_select on public.meta_lead_events;
create policy meta_lead_events_admin_select on public.meta_lead_events
for select to authenticated using ((select public.is_valoria_admin()));

create or replace function private.capture_waitlist_lead()
returns trigger language plpgsql security definer set search_path=public,private as $$
begin
  insert into public.lead_captures
    (source,external_id,full_name,email,phone,role,interest,source_detail,created_at,consent,consent_basis,raw_payload)
  values
    ('website_waitlist','waitlist:'||new.id::text,new.full_name,lower(trim(new.email)),new.phone,new.role,new.interest,new.source,
     coalesce(new.created_at,now()),true,'waitlist_submission',to_jsonb(new))
  on conflict (source,external_id) do update set
    full_name=excluded.full_name,email=excluded.email,phone=excluded.phone,role=excluded.role,
    interest=excluded.interest,source_detail=excluded.source_detail,raw_payload=excluded.raw_payload;
  return new;
end $$;

drop trigger if exists trg_capture_waitlist_lead on public.waitlist;
create trigger trg_capture_waitlist_lead
after insert or update of full_name,email,phone,role,interest,source on public.waitlist
for each row execute function private.capture_waitlist_lead();

create or replace function private.capture_event_registration_lead()
returns trigger language plpgsql security definer set search_path=public,private as $$
begin
  insert into public.lead_captures
    (source,external_id,full_name,email,phone,role,organisation,source_detail,created_at,consent,consent_basis,raw_payload)
  values
    ('event_registration','event:'||new.id::text,new.full_name,lower(trim(new.email)),new.whatsapp,new.role,new.organisation,new.session_id,
     coalesce(new.created_at,now()),coalesce(new.consent,false),
     case when coalesce(new.consent,false) then 'event_registration_consent' end,to_jsonb(new))
  on conflict (source,external_id) do update set
    full_name=excluded.full_name,email=excluded.email,phone=excluded.phone,role=excluded.role,
    organisation=excluded.organisation,source_detail=excluded.source_detail,consent=excluded.consent,
    consent_basis=excluded.consent_basis,raw_payload=excluded.raw_payload;
  return new;
end $$;

drop trigger if exists trg_capture_event_registration_lead on public.professional_standard_event_registrations;
create trigger trg_capture_event_registration_lead
after insert or update of full_name,email,whatsapp,role,organisation,session_id,consent
on public.professional_standard_event_registrations
for each row execute function private.capture_event_registration_lead();

do $
begin
  delete from cron.job where jobname in ('valoria-sync-leads-to-brevo','valoria-process-meta-leads');
end;
$;

select cron.schedule(
  'valoria-sync-leads-to-brevo','* * * * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='valoria_project_url') || '/functions/v1/sync-leads-to-brevo',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key')
    ),
    body := '{"limit":20}'::jsonb,
    timeout_milliseconds := 10000
  );$$
);

select cron.schedule(
  'valoria-process-meta-leads','* * * * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='valoria_project_url') || '/functions/v1/process-meta-leads',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key')
    ),
    body := '{"limit":20}'::jsonb,
    timeout_milliseconds := 10000
  );$$
);

commit;
