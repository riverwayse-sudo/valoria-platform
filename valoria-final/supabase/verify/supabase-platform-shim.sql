-- Test fixture — NOT a migration. Do not apply to staging or production.
--
-- Emulates the objects a Supabase project provides out of the box, so the
-- tracked migration sequence can be replayed on a bare PostgreSQL server to
-- verify that a clean environment is reproducible from source.
--
-- The tracked migrations depend on platform-provided objects they do not create:
--   schemas   auth, vault, net, extensions
--   roles     anon, authenticated, service_role
--   functions auth.uid(), vault.create_secret(), net.http_get(), net.http_post()
--   tables    auth.users, vault.secrets
--   extension pgcrypto (gen_random_uuid, crypt, gen_random_bytes, encode),
--             pg_trgm (similarity)
--
-- These are supplied by the platform, not by this repository, so they are
-- emulated here rather than being added to supabase/migrations/. Anything the
-- repository itself must create belongs in a migration, and a table missing from
-- the migration sequence is a finding — see scripts/verify-migration-reproducibility.mjs.
--
-- The emulation is deliberately minimal: only what the migrations reference.
-- It is not a faithful copy of Supabase's internals and must never be applied
-- anywhere other than a disposable verification database.

-- ── roles ────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

-- ── extensions ───────────────────────────────────────────────────────────────
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- pgcrypto lives in `extensions` on Supabase. Supabase sets the database
-- search_path to include it, so mirror that rather than schema-qualifying every
-- call in the migrations.
alter database postgres set search_path to public, extensions, auth;

-- ── auth ─────────────────────────────────────────────────────────────────────
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Supabase resolves the caller from the request JWT. In a bare database there is
-- no request, so this returns null unless a test sets the setting explicitly.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;

-- ── vault ────────────────────────────────────────────────────────────────────
create schema if not exists vault;

create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  secret text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Supabase exposes decryption through a view. The emulation stores plaintext, so
-- the view is a straight projection; the column names match the real one because
-- the migrations select by name.
create or replace view vault.decrypted_secrets as
  select id, name, secret as decrypted_secret, description, created_at from vault.secrets;

create or replace function vault.create_secret(
  new_secret text,
  new_name text default null,
  new_description text default null
) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into vault.secrets (name, secret, description)
  values (new_name, new_secret, new_description)
  returning id into v_id;
  return v_id;
end $$;

-- ── net (pg_net) ─────────────────────────────────────────────────────────────
create schema if not exists net;

-- Real pg_net queues an async HTTP request and returns a request id. The
-- emulation records the call and returns a synthetic id, which is enough for
-- migrations that only need the function to exist and be callable.
create table if not exists net._emulated_requests (
  id bigserial primary key,
  method text,
  url text,
  body text,
  headers jsonb,
  created_at timestamptz not null default now()
);

create or replace function net.http_get(
  url text,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint language plpgsql as $$
declare v_id bigint;
begin
  insert into net._emulated_requests (method, url, headers) values ('GET', url, headers) returning id into v_id;
  return v_id;
end $$;

create or replace function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint language plpgsql as $$
declare v_id bigint;
begin
  insert into net._emulated_requests (method, url, body, headers)
  values ('POST', url, body::text, headers) returning id into v_id;
  return v_id;
end $$;

-- ── grants Supabase applies to the client roles ──────────────────────────────
-- Supabase grants broad schema usage to anon/authenticated and lets RLS do the
-- restricting. The migrations then revoke specific privileges. Without these
-- baseline grants the revokes would be no-ops and the privilege checks below
-- would pass for the wrong reason.
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
grant execute on function auth.email() to anon, authenticated, service_role;
