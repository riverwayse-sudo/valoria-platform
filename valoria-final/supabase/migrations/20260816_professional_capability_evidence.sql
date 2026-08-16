-- Valoria capability-specific professional evidence
-- Talent requires a CV; Speakers require speaking history and at least one engagement;
-- Facilitators require facilitation history and at least one engagement before listing.

create table if not exists public.professional_capabilities (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  capability text not null check (capability in ('talent','speaker','facilitator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, capability)
);

create table if not exists public.professional_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  document_type text not null check (document_type in ('cv','credential','portfolio','other')),
  storage_path text not null,
  is_current boolean not null default true,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.speaking_history (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  title text not null,
  summary text,
  years_experience numeric(4,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.speaking_engagements (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  event_name text not null,
  organizer_name text,
  engagement_type text,
  topic text,
  event_date date,
  location text,
  audience_size integer,
  virtual boolean,
  evidence_url text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facilitation_history (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  title text not null,
  summary text,
  years_experience numeric(4,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facilitation_engagements (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  programme_name text not null,
  organization_name text,
  engagement_type text,
  topic text,
  engagement_date date,
  location text,
  participant_count integer,
  virtual boolean,
  evidence_url text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_professional_capabilities_professional on public.professional_capabilities(professional_id);
create index if not exists idx_professional_documents_cv on public.professional_documents(professional_id, document_type, is_current);
create index if not exists idx_speaking_history_professional on public.speaking_history(professional_id);
create index if not exists idx_speaking_engagements_professional on public.speaking_engagements(professional_id);
create index if not exists idx_facilitation_history_professional on public.facilitation_history(professional_id);
create index if not exists idx_facilitation_engagements_professional on public.facilitation_engagements(professional_id);

-- Defense-in-depth: browser roles cannot directly write governance evidence through arbitrary SQL/RPC.
alter table public.professional_capabilities enable row level security;
alter table public.professional_documents enable row level security;
alter table public.speaking_history enable row level security;
alter table public.speaking_engagements enable row level security;
alter table public.facilitation_history enable row level security;
alter table public.facilitation_engagements enable row level security;

comment on table public.professional_documents is 'Private professional documents; CVs must not be exposed through marketplace projections.';
comment on table public.speaking_history is 'Structured speaker experience evidence required for speaker marketplace readiness.';
comment on table public.speaking_engagements is 'Structured speaking engagement evidence required for speaker marketplace readiness.';
comment on table public.facilitation_history is 'Structured facilitator experience evidence required for facilitator marketplace readiness.';
comment on table public.facilitation_engagements is 'Structured facilitation engagement evidence required for facilitator marketplace readiness.';
