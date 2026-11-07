-- Multi-model data foundation using the existing Supabase Postgres and Storage plan.
-- Relational tables and JSONB already power the core platform; this adds private
-- key-value and graph-edge primitives without introducing another paid database.

create schema if not exists private;
grant usage on schema private to service_role;

create table if not exists private.platform_kv (
  namespace text not null default 'platform'
    check (length(btrim(namespace)) between 1 and 64),
  key text not null
    check (length(btrim(key)) between 1 and 128),
  value jsonb not null,
  description text,
  expires_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (namespace, key)
);

comment on table private.platform_kv is
  'Private key-value configuration and operational metadata. Do not store secrets; use Cloudflare Worker secrets for credentials.';
comment on column private.platform_kv.value is
  'JSONB value for non-secret feature flags, matching configuration, workflow settings, and small operational state.';
create index if not exists platform_kv_expiry_idx
  on private.platform_kv (expires_at)
  where expires_at is not null;

alter table private.platform_kv enable row level security;
revoke all on table private.platform_kv from public, anon, authenticated;
grant select, insert, update, delete on table private.platform_kv to service_role;

create table if not exists private.professional_relationships (
  id uuid primary key default gen_random_uuid(),
  source_profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  target_profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  relationship_type text not null
    check (length(btrim(relationship_type)) between 1 and 64),
  relationship_status text not null default 'pending'
    check (relationship_status in ('pending', 'active', 'blocked', 'revoked')),
  evidence_source text not null default 'participant_declared'
    check (evidence_source in ('participant_declared', 'platform_activity', 'admin_verified', 'imported')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_relationships_no_self_edge
    check (source_profile_id <> target_profile_id),
  constraint professional_relationships_unique_edge
    unique (source_profile_id, target_profile_id, relationship_type)
);

comment on table private.professional_relationships is
  'Private graph-edge store for verified mentorship, referrals, collaboration, programme, and employer relationships. Public profile visibility is governed separately by consent and eligibility.';
create index if not exists professional_relationships_source_idx
  on private.professional_relationships (source_profile_id, relationship_status, relationship_type);
create index if not exists professional_relationships_target_idx
  on private.professional_relationships (target_profile_id, relationship_status, relationship_type);
create index if not exists professional_relationships_metadata_idx
  on private.professional_relationships using gin (metadata);

alter table private.professional_relationships enable row level security;
revoke all on table private.professional_relationships from public, anon, authenticated;
grant select, insert, update, delete on table private.professional_relationships to service_role;

create or replace function private.traverse_professional_network(
  p_profile_id uuid,
  p_max_depth integer default 2,
  p_limit integer default 100
)
returns table (
  profile_id uuid,
  depth integer,
  path uuid[],
  relationship_types text[]
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with recursive walk(profile_id, depth, path, relationship_types) as (
    select
      p_profile_id,
      0,
      array[p_profile_id]::uuid[],
      array[]::text[]
    where p_profile_id is not null

    union all

    select
      case
        when edge.source_profile_id = walk.profile_id then edge.target_profile_id
        else edge.source_profile_id
      end,
      walk.depth + 1,
      walk.path || case
        when edge.source_profile_id = walk.profile_id then edge.target_profile_id
        else edge.source_profile_id
      end,
      walk.relationship_types || edge.relationship_type
    from walk
    join private.professional_relationships as edge
      on edge.source_profile_id = walk.profile_id
      or edge.target_profile_id = walk.profile_id
    where edge.relationship_status = 'active'
      and walk.depth < greatest(1, least(coalesce(p_max_depth, 2), 4))
      and not (
        case
          when edge.source_profile_id = walk.profile_id then edge.target_profile_id
          else edge.source_profile_id
        end = any(walk.path)
      )
  )
  select distinct on (walk.profile_id)
    walk.profile_id,
    walk.depth,
    walk.path,
    walk.relationship_types
  from walk
  where walk.depth > 0
  order by walk.profile_id, walk.depth
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

comment on function private.traverse_professional_network(uuid, integer, integer) is
  'Returns profile IDs and relationship paths only; callers must separately enforce profile consent and listing eligibility before resolving public profile data.';
revoke all on function private.traverse_professional_network(uuid, integer, integer) from public, anon, authenticated;
grant execute on function private.traverse_professional_network(uuid, integer, integer) to service_role;
