-- Curated marketplace projection. Never expose the underlying professional row directly.
-- Organizations can discover only currently listed + available + eligible professionals.

create or replace view public.marketplace_professionals
with (security_invoker = true)
as
select
  p.id as professional_id,
  p.full_name,
  p.bio,
  p.location,
  p.languages,
  p.headline,
  p.listing_status,
  p.availability_status,
  p.profile_visibility,
  coalesce(c.capabilities, '{}'::text[]) as capabilities
from public.professional_profiles p
left join lateral (
  select array_agg(distinct lower(pc.capability) order by lower(pc.capability)) as capabilities
  from public.professional_capabilities pc
  where pc.professional_id = p.id
    and pc.is_active = true
) c on true
where p.listing_status = 'LISTED'
  and p.availability_status in ('AVAILABLE', 'LIMITED')
  and p.profile_visibility = 'PUBLIC'
  and coalesce(p.eligible_for_listing, false) = true;

comment on view public.marketplace_professionals is
'Organization-facing curated projection. Excludes private contact data, raw assessment data, admin notes and internal scoring metadata.';

revoke all on public.marketplace_professionals from public, anon;
grant select on public.marketplace_professionals to authenticated;
