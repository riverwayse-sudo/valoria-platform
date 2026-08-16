-- Valoria capability-aware marketplace readiness engine
-- Hard gates: complete profile + VALU + capability evidence + no active governance block.
-- This migration intentionally does not auto-list existing professionals until production
-- eligibility rules are validated against real records.

create or replace function public.evaluate_professional_readiness(p_professional_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  capability_count integer := 0;
  missing jsonb := '[]'::jsonb;
  profile_complete boolean := false;
  valu_complete boolean := false;
  eligible boolean := false;
  blocked boolean := false;
  cv_present boolean := false;
  evidence_present boolean := false;
  cap text;
begin
  select exists (
    select 1 from public.professional_profiles p
    where p.id = p_professional_id
      and coalesce(p.full_name, '') <> ''
      and coalesce(p.bio, '') <> ''
  ) into profile_complete;

  select exists (
    select 1 from public.valu_assessments v
    where v.user_id = p_professional_id
      and coalesce(v.status::text, '') in ('completed','COMPLETE','COMPLETED')
  ) into valu_complete;

  select exists (
    select 1 from public.professional_listing_events e
    where e.professional_id = p_professional_id
      and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
      and e.created_at = (
        select max(e2.created_at) from public.professional_listing_events e2
        where e2.professional_id = p_professional_id
      )
  ) into blocked;

  select count(*) into capability_count
  from public.professional_capabilities c
  where c.professional_id = p_professional_id and c.is_active = true;

  if capability_count = 0 then
    missing := missing || '["capability"]'::jsonb;
  end if;

  if not profile_complete then
    missing := missing || '["profile"]'::jsonb;
  end if;

  if not valu_complete then
    missing := missing || '["valu_assessment"]'::jsonb;
  end if;

  select exists (
    select 1 from public.professional_capabilities c
    join public.professional_documents d on d.professional_id = c.professional_id
    where c.professional_id = p_professional_id
      and c.is_active = true
      and lower(c.capability) = 'talent'
      and d.document_type = 'cv'
  ) into cv_present;

  if exists (select 1 from public.professional_capabilities where professional_id=p_professional_id and is_active=true and lower(capability)='talent') and not cv_present then
    missing := missing || '["cv"]'::jsonb;
  end if;

  select exists (
    select 1 from public.speaking_engagements where professional_id=p_professional_id
  ) into evidence_present;

  if exists (select 1 from public.professional_capabilities where professional_id=p_professional_id and is_active=true and lower(capability)='speaker') and not evidence_present then
    missing := missing || '["speaking_engagement"]'::jsonb;
  end if;

  select exists (
    select 1 from public.facilitation_engagements where professional_id=p_professional_id
  ) into evidence_present;

  if exists (select 1 from public.professional_capabilities where professional_id=p_professional_id and is_active=true and lower(capability)='facilitator') and not evidence_present then
    missing := missing || '["facilitation_engagement"]'::jsonb;
  end if;

  eligible := jsonb_array_length(missing) = 0 and not blocked;

  result := jsonb_build_object(
    'professional_id', p_professional_id,
    'profile_complete', profile_complete,
    'valu_complete', valu_complete,
    'cv_present', cv_present,
    'eligible', eligible,
    'blocked', blocked,
    'missing', missing
  );

  return result;
end;
$$;

revoke execute on function public.evaluate_professional_readiness(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_professional_readiness(uuid) to service_role;
