-- VALU v4 marketplace boundary.
-- 35+ is a score eligibility condition only.
-- It does not equal listing, availability, verification, or profile completeness.

create or replace function public.compute_professional_listing_eligibility(p_professional_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  a record;
  has_capability boolean;
begin
  select * into p
  from public.professional_profiles
  where id = p_professional_id;

  if not found then
    return false;
  end if;

  select * into a
  from public.valu_assessments
  where id = p.id
     or user_id = p.user_id
  order by completed_at desc nulls last
  limit 1;

  -- A completed authoritative VALU result must exist and meet the v4
  -- marketplace score threshold. This is score eligibility, not listing state.
  if not found or a.completed_at is null or coalesce(a.total_score, 0) < 35 then
    return false;
  end if;

  -- Required professional identity.
  if nullif(trim(coalesce(p.full_name, '')), '') is null then
    return false;
  end if;

  -- At least one explicitly selected marketplace capability is required.
  select exists (
    select 1
    from public.professional_capabilities pc
    where pc.professional_id = p.id
      and pc.is_active = true
      and pc.capability in ('talent', 'speaker', 'facilitator')
  ) into has_capability;

  if not has_capability then
    return false;
  end if;

  return true;
exception when undefined_column then
  -- Schema variants must fail closed until their field mapping is completed.
  return false;
end;
$$;

revoke all on function public.compute_professional_listing_eligibility(uuid) from public, anon, authenticated;

comment on function public.compute_professional_listing_eligibility(uuid) is
  'VALU v4 automated score eligibility predicate. A score >= 35 is necessary but not sufficient for marketplace listing; listing_status, availability, visibility, verification and governance remain separate controls.';
