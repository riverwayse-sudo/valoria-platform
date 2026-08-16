-- Atomic server-side creation of a Valoria introduction request.
-- Performs authorization, target-state validation and duplicate protection in one transaction.

create or replace function public.create_introduction_request(
  p_organization_id uuid,
  p_professional_id uuid,
  p_professional_capability text,
  p_message text default null,
  p_request_type text default 'GENERAL'
) returns public.introduction_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.introduction_requests;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> p_organization_id then
    raise exception 'Organization ownership check failed';
  end if;

  if not public.can_request_introduction(
    p_organization_id,
    p_professional_id,
    p_professional_capability
  ) then
    raise exception 'Introduction request is not permitted for this organization and professional';
  end if;

  if exists (
    select 1
    from public.introduction_requests ir
    where ir.organization_id = p_organization_id
      and ir.professional_id = p_professional_id
      and lower(coalesce(ir.professional_capability, '')) = lower(p_professional_capability)
      and ir.status in ('PENDING','UNDER_REVIEW','APPROVED','INTRODUCTION_SENT')
  ) then
    raise exception 'An active introduction request already exists';
  end if;

  insert into public.introduction_requests (
    organization_id,
    professional_id,
    professional_capability,
    request_type,
    message,
    status
  ) values (
    p_organization_id,
    p_professional_id,
    lower(p_professional_capability),
    upper(p_request_type),
    nullif(trim(p_message), ''),
    'PENDING'
  )
  returning * into r;

  return r;
end;
$$;

revoke execute on function public.create_introduction_request(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.create_introduction_request(uuid,uuid,text,text,text) to authenticated;

comment on function public.create_introduction_request(uuid,uuid,text,text,text) is
'Atomic organization-side introduction request creation. Enforces ownership, capability policy, target listing/availability and active-request deduplication.';
