begin;

-- Isolated, server-only storage for the historical Taster-first entry.
-- No existing taster_progress or taster_sessions rows are modified.
create table if not exists public.valu_preaccount_taster_progress (
  id uuid primary key default gen_random_uuid(),
  resume_token_hash text not null unique check (resume_token_hash ~ '^[0-9a-f]{64}$'),
  signup_key uuid not null unique,
  name text not null check (length(btrim(name)) between 1 and 200),
  role text not null check (length(btrim(role)) between 1 and 160),
  experience text not null check (length(btrim(experience)) between 1 and 80),
  email text not null check (length(email) between 3 and 254),
  organisation text,
  interest text,
  marketing_consent boolean not null default false,
  privacy_acknowledged boolean not null default false check (privacy_acknowledged = true),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  current_question smallint not null default 0 check (current_question between 0 and 9),
  submission_key uuid not null,
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  taster_id uuid references public.taster_sessions(id) on delete set null,
  lead_capture_id uuid references public.lead_captures(id) on delete restrict,
  taster_version text not null default '4.2',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists valu_preaccount_taster_expiry_idx
  on public.valu_preaccount_taster_progress(status, expires_at);

alter table public.valu_preaccount_taster_progress enable row level security;
revoke all on table public.valu_preaccount_taster_progress from public, anon, authenticated;
grant all on table public.valu_preaccount_taster_progress to service_role;

comment on table public.valu_preaccount_taster_progress is
  'Isolated pre-account VALU Taster-first sessions. Accessed only by the assessment API using service_role; resume tokens are SHA-256 hashed.';

commit;
