-- Valoria marketplace introduction protocol.
--
-- This migration intentionally depends only on auth.users so it can be introduced
-- without guessing the shape of the existing users/profiles tables. Existing
-- application tables should be mapped to these actor IDs in a follow-up migration
-- after production schema/RLS verification.

create table if not exists public.introduction_requests (
  id uuid primary key default gen_random_uuid(),
  organization_user_id uuid not null references auth.users(id) on delete restrict,
  professional_user_id uuid not null references auth.users(id) on delete restrict,
  request_type text not null default 'general',
  message text,
  status text not null default 'PENDING',
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  approved_at timestamptz,
  introduction_sent_at timestamptz,
  completed_at timestamptz,
  paused_at timestamptz,
  pause_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introduction_requests_status_chk check (
    status in ('PENDING','UNDER_REVIEW','APPROVED','DECLINED','INTRODUCTION_SENT','COMPLETED','PAUSED')
  ),
  constraint introduction_requests_type_chk check (
    request_type in ('talent','speaker','facilitator','general')
  ),
  constraint introduction_requests_distinct_actors_chk check (
    organization_user_id <> professional_user_id
  )
);

create index if not exists introduction_requests_org_idx
  on public.introduction_requests (organization_user_id, created_at desc);
create index if not exists introduction_requests_professional_idx
  on public.introduction_requests (professional_user_id, created_at desc);
create index if not exists introduction_requests_status_idx
  on public.introduction_requests (status, created_at desc);

-- Prevent duplicate active requests for the same organization/professional/type.
create unique index if not exists introduction_requests_active_unique_idx
  on public.introduction_requests (organization_user_id, professional_user_id, request_type)
  where status in ('PENDING','UNDER_REVIEW','APPROVED','INTRODUCTION_SENT');

-- Keep updated_at database-owned.
create or replace function public.touch_introduction_request_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_introduction_request_updated_at() from public, anon, authenticated;

drop trigger if exists trg_introduction_requests_updated_at on public.introduction_requests;
create trigger trg_introduction_requests_updated_at
before update on public.introduction_requests
for each row execute function public.touch_introduction_request_updated_at();

alter table public.introduction_requests enable row level security;

-- Actors may see only requests involving themselves. Admin policies are deliberately
-- deferred until the existing canonical admin-role source is verified; do not infer
-- admin from a client-supplied column.
drop policy if exists introduction_requests_self_select on public.introduction_requests;
create policy introduction_requests_self_select
on public.introduction_requests
for select
to authenticated
using (
  organization_user_id = auth.uid()
  or professional_user_id = auth.uid()
);

-- Organizations may create requests only as themselves. They cannot impersonate a
-- professional or set an administrative status during insertion.
drop policy if exists introduction_requests_org_insert on public.introduction_requests;
create policy introduction_requests_org_insert
on public.introduction_requests
for insert
to authenticated
with check (
  organization_user_id = auth.uid()
  and status = 'PENDING'
  and reviewed_by is null
  and reviewed_at is null
  and approved_at is null
  and introduction_sent_at is null
  and completed_at is null
);

-- No client-side UPDATE policy is intentionally provided. Status transitions,
-- admin decisions, and introduction completion must go through trusted server-side
-- operations after the canonical role/RLS model is verified.

-- No DELETE policy is intentionally provided. Introduction history is an audit
-- record and should not be deletable by marketplace participants.
