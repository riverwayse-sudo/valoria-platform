alter table public.professional_standard_event_registrations
  add column if not exists brevo_last_attempt_at timestamptz,
  add column if not exists brevo_attempt_count integer not null default 0,
  add column if not exists brevo_last_error text;

insert into public.professional_standard_event_registrations (
  session_id,full_name,email,role,organisation,created_at,whatsapp,consent,brevo_synced,confirmation_email_sent
)
select '02',w.full_name,lower(trim(w.email)),w.role,null,w.created_at,w.phone,true,false,false
from public.waitlist w
where w.type='event' and coalesce(w.source,'')='event_session_02' and w.email is not null
on conflict (session_id,email) do update set
  full_name=excluded.full_name,
  role=coalesce(excluded.role,public.professional_standard_event_registrations.role),
  whatsapp=coalesce(excluded.whatsapp,public.professional_standard_event_registrations.whatsapp);

create index if not exists professional_standard_event_registrations_brevo_idx
  on public.professional_standard_event_registrations (brevo_synced,created_at);
