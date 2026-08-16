-- Trusted Admin governance operations for professional listings and introductions.
-- These functions are intentionally callable only by service_role until the application
-- has a verified server-side admin session that can safely establish auth.uid().

create or replace function public.admin_set_listing_status(
  p_professional_id uuid,
  p_new_status text,
  p_reason text default null
) returns public.professional_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status text;
  result public.professional_profiles;
begin
  if not public.require_platform_admin() then
    raise exception 'Administrator authorization required';
  end if;

  if upper(p_new_status) not in ('LISTED','SUSPENDED','REVOKED','NOT_LISTED') then
    raise exception 'Invalid listing status';
  end if;

  select listing_status::text into old_status
  from public.professional_profiles
  where id = p_professional_id
  for update;

  if old_status is null then raise exception 'Professional not found'; end if;

  update public.professional_profiles
  set listing_status = upper(p_new_status),
      updated_at = now()
  where id = p_professional_id
  returning * into result;

  insert into public.professional_listing_events (
    professional_id, event_type, previous_status, new_status, reason, actor_id, created_at
  ) values (
    p_professional_id,
    case upper(p_new_status)
      when 'LISTED' then 'ADMIN_APPROVED'
      when 'SUSPENDED' then 'ADMIN_SUSPENDED'
      when 'REVOKED' then 'ADMIN_REVOKED'
      else 'ADMIN_UNLISTED'
    end,
    old_status,
    upper(p_new_status),
    p_reason,
    auth.uid(),
    now()
  );

  return result;
end;
$$;

create or replace function public.admin_transition_introduction(
  p_request_id uuid,
  p_new_status text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.introduction_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status text;
  result public.introduction_requests;
  allowed boolean := false;
begin
  if not public.require_platform_admin() then
    raise exception 'Administrator authorization required';
  end if;

  if upper(p_new_status) not in ('UNDER_REVIEW','APPROVED','DECLINED','PAUSED','INTRODUCTION_SENT','COMPLETED') then
    raise exception 'Invalid introduction governance status';
  end if;

  select status into old_status
  from public.introduction_requests
  where id = p_request_id
  for update;

  if old_status is null then raise exception 'Introduction request not found'; end if;

  allowed := case
    when old_status = 'PENDING' and upper(p_new_status) in ('UNDER_REVIEW','APPROVED','DECLINED','PAUSED') then true
    when old_status = 'UNDER_REVIEW' and upper(p_new_status) in ('APPROVED','DECLINED','PAUSED') then true
    when old_status = 'APPROVED' and upper(p_new_status) in ('INTRODUCTION_SENT','PAUSED') then true
    when old_status = 'INTRODUCTION_SENT' and upper(p_new_status) in ('COMPLETED','PAUSED') then true
    when old_status = 'PAUSED' and upper(p_new_status) in ('UNDER_REVIEW','DECLINED') then true
    else false
  end;

  if not allowed then raise exception 'Invalid introduction state transition: % -> %', old_status, upper(p_new_status); end if;

  update public.introduction_requests
  set status = upper(p_new_status),
      admin_note = coalesce(p_reason, admin_note),
      updated_at = now()
  where id = p_request_id
  returning * into result;

  insert into public.introduction_request_events (
    introduction_request_id, previous_status, new_status, actor_id, actor_type, reason, metadata
  ) values (
    p_request_id, old_status, upper(p_new_status), auth.uid(), 'ADMIN', p_reason, coalesce(p_metadata,'{}'::jsonb)
  );

  return result;
end;
$$;

revoke execute on function public.admin_set_listing_status(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.admin_transition_introduction(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.admin_set_listing_status(uuid,text,text) to service_role;
grant execute on function public.admin_transition_introduction(uuid,text,text,jsonb) to service_role;
