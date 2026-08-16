-- Valoria canonical administrative governance foundation.
-- Admin authority is deliberately separate from organization/professional capabilities.

create table if not exists public.platform_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (lower(role) in ('admin','super_admin')),
  is_active boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  granted_by uuid references auth.users(id),
  revoked_by uuid references auth.users(id),
  unique (user_id, role)
);

alter table public.platform_roles enable row level security;
revoke all on public.platform_roles from anon, authenticated;

-- No self-service role assignment. Reads are intentionally denied until a trusted
-- administrative read path is wired into the application.

create or replace function public.has_platform_role(p_user_id uuid, p_required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_roles r
    where r.user_id = p_user_id
      and r.is_active = true
      and lower(r.role) = lower(p_required_role)
      and r.revoked_at is null
  );
$$;

revoke execute on function public.has_platform_role(uuid,text) from public, anon, authenticated;
grant execute on function public.has_platform_role(uuid,text) to service_role;

create or replace function public.require_platform_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(auth.uid(), 'admin')
     and not public.has_platform_role(auth.uid(), 'super_admin') then
    raise exception 'Platform administrator authorization required';
  end if;

  return true;
end;
$$;

revoke execute on function public.require_platform_admin() from public, anon, authenticated;
grant execute on function public.require_platform_admin() to service_role;

comment on table public.platform_roles is
'Canonical platform authority roles. Separate from Employer/Event Organizer and Talent/Speaker/Facilitator capabilities. Role assignment is trusted-admin only.';
