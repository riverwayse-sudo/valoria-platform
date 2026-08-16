-- Valoria Listing Governance Protocol
--
-- Business rule:
--   1. Professionals become eligible automatically when platform eligibility
--      requirements are satisfied.
--   2. Listing status is separately governed and may be revoked/restored by admins.
--   3. Eligibility is not the same thing as listing status or availability.
--
-- This migration is intentionally defensive: it only creates the governance
-- primitives when the relevant tables/columns exist, and does not rewrite
-- existing professional records.

create table if not exists public.professional_listing_events (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null,
  event_type text not null check (event_type in (
    'AUTO_ELIGIBLE',
    'AUTO_LISTED',
    'ADMIN_APPROVED',
    'ADMIN_REVOKED',
    'ADMIN_RESTORED',
    'ADMIN_SUSPENDED',
    'ADMIN_UNSUSPENDED',
    'ELIGIBILITY_FAILED',
    'PROFILE_UPDATED',
    'ASSESSMENT_COMPLETED'
  )),
  previous_status text,
  new_status text,
  reason text,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists professional_listing_events_professional_idx
  on public.professional_listing_events (professional_id, created_at desc);

create index if not exists professional_listing_events_event_idx
  on public.professional_listing_events (event_type, created_at desc);

-- Add explicit governance columns when the professional profile table exists.
-- Existing data is left untouched; application/admin migration should populate
-- these fields deliberately after reviewing the current production records.
do $$
begin
  if to_regclass('public.professional_profiles') is not null then
    alter table public.professional_profiles
      add column if not exists eligible_for_listing boolean not null default false;

    alter table public.professional_profiles
      add column if not exists listing_status text not null default 'NOT_LISTED'
        check (listing_status in ('NOT_LISTED','LISTED','SUSPENDED','REVOKED'));

    alter table public.professional_profiles
      add column if not exists availability_status text not null default 'UNAVAILABLE'
        check (availability_status in ('AVAILABLE','LIMITED','UNAVAILABLE'));

    alter table public.professional_profiles
      add column if not exists listed_at timestamptz;

    alter table public.professional_profiles
      add column if not exists revoked_at timestamptz;

    alter table public.professional_profiles
      add column if not exists revoked_by uuid;

    alter table public.professional_profiles
      add column if not exists revocation_reason text;
  end if;
end $$;

-- Central eligibility predicate. This deliberately does not grant listing by
-- itself; it only computes whether the professional satisfies the platform's
-- automatic eligibility prerequisites. Listing remains separately governable.
create or replace function public.compute_professional_listing_eligibility(p_professional_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  a record;
begin
  select * into p
  from public.professional_profiles
  where id = p_professional_id;

  if not found then
    return false;
  end if;

  -- Require an associated completed assessment. The exact scoring threshold
  -- remains a product/business decision and is intentionally not hard-coded.
  select * into a
  from public.valu_assessments
  where id = p.id
     or user_id = p.user_id
  order by completed_at desc nulls last
  limit 1;

  if not found or a.completed_at is null then
    return false;
  end if;

  -- Required professional identity/profile information.
  if nullif(trim(coalesce(p.full_name, '')), '') is null then
    return false;
  end if;

  return true;
exception when undefined_column then
  -- Keep the migration safe across schema variants; deployment must then
  -- complete the missing field mapping before enabling auto-listing.
  return false;
end;
$$;

revoke all on function public.compute_professional_listing_eligibility(uuid) from public, anon, authenticated;

comment on function public.compute_professional_listing_eligibility(uuid) is
  'Server-side eligibility predicate for automatic professional marketplace listing; not an authorization credential.';

-- Marketplace visibility should be derived from platform-controlled state.
-- This index supports the expected discovery query without exposing private data.
do $$
begin
  if to_regclass('public.professional_profiles') is not null then
    create index if not exists professional_profiles_marketplace_visibility_idx
      on public.professional_profiles (listing_status, availability_status)
      where listing_status = 'LISTED';
  end if;
end $$;
