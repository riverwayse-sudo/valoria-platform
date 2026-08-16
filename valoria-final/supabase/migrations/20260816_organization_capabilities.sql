-- Organization-side capability model for Valoria marketplace governance.
-- Employers and Event Organizers are capabilities of an organization account,
-- not mutually-exclusive platform roles.

create table if not exists public.organization_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  legal_name text,
  display_name text,
  description text,
  website text,
  country text,
  city text,
  profile_visibility text not null default 'PRIVATE'
    check (profile_visibility in ('PRIVATE','PUBLIC')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization_profiles(id) on delete cascade,
  capability text not null check (lower(capability) in ('employer','event_organizer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, capability)
);

alter table public.organization_profiles enable row level security;
alter table public.organization_capabilities enable row level security;

revoke all on public.organization_profiles from anon;
revoke all on public.organization_capabilities from anon;

grant select, insert, update on public.organization_profiles to authenticated;
grant select, insert, update on public.organization_capabilities to authenticated;

-- Users can manage only their own organization record.
drop policy if exists organization_profiles_self_select on public.organization_profiles;
create policy organization_profiles_self_select
on public.organization_profiles for select to authenticated
using (id = auth.uid());

drop policy if exists organization_profiles_self_insert on public.organization_profiles;
create policy organization_profiles_self_insert
on public.organization_profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists organization_profiles_self_update on public.organization_profiles;
create policy organization_profiles_self_update
on public.organization_profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists organization_capabilities_self_select on public.organization_capabilities;
create policy organization_capabilities_self_select
on public.organization_capabilities for select to authenticated
using (organization_id = auth.uid());

drop policy if exists organization_capabilities_self_insert on public.organization_capabilities;
create policy organization_capabilities_self_insert
on public.organization_capabilities for insert to authenticated
with check (organization_id = auth.uid());

drop policy if exists organization_capabilities_self_update on public.organization_capabilities;
create policy organization_capabilities_self_update
on public.organization_capabilities for update to authenticated
using (organization_id = auth.uid())
with check (organization_id = auth.uid());

comment on table public.organization_capabilities is
'Organization marketplace capabilities. Employer and Event Organizer can coexist on one organization account.';
