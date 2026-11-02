begin;

create table if not exists public.professional_profile_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  acknowledgement_type text not null check (acknowledgement_type = 'profile_submission'),
  acknowledgement_version text not null check (length(btrim(acknowledgement_version)) > 0),
  acknowledgement_text text not null check (length(btrim(acknowledgement_text)) > 0),
  source text not null default 'profile_setup',
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists professional_profile_acknowledgements_professional_time_idx
  on public.professional_profile_acknowledgements (professional_id, acknowledged_at desc);

alter table public.professional_profile_acknowledgements enable row level security;
revoke all on table public.professional_profile_acknowledgements from public, anon, authenticated;
grant all on table public.professional_profile_acknowledgements to service_role;

commit;
