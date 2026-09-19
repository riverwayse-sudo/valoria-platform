-- Recovered production migration: one row per professional capability for
-- category discovery while preserving one canonical identity for general discovery.
drop view if exists public.marketplace_professionals_general;
drop view if exists public.marketplace_professionals;

create view public.marketplace_professionals
with (security_invoker = false)
as
select
  p.id as professional_id,
  p.display_name as full_name,
  p.bio,
  p.location,
  p.languages,
  p.headline,
  case when c.capability='talent' then 'candidate' else c.capability end as capability,
  case when c.capability='talent' then 'candidate' else c.capability end as track,
  caps.capabilities,
  p.atb_id,
  p.display_initials,
  p.photo_url,
  p.industry,
  p.skills,
  p.topics,
  p.programme_types,
  p.availability,
  p.valu_index,
  p.cluster_scores,
  p.designation,
  p.fee_range,
  p.salary_expectation,
  p.availability_status,
  p.listing_status,
  c.eligible_for_listing,
  c.listed_at
from public.professional_profiles p
join public.professional_capabilities c
  on c.professional_id=p.id
  and c.is_active=true
  and c.eligible_for_listing=true
  and c.eligibility_status='listed'
join lateral (
  select array_agg(
    case when c2.capability='talent' then 'candidate' else c2.capability end
    order by case c2.capability when 'talent' then 1 when 'speaker' then 2 when 'facilitator' then 3 else 9 end
  ) capabilities
  from public.professional_capabilities c2
  where c2.professional_id=p.id and c2.is_active=true
    and c2.eligible_for_listing=true and c2.eligibility_status='listed'
) caps on true
where p.listing_status='listed' and p.eligible_for_listing=true
  and p.visibility='public' and p.profile_complete=true
  and nullif(trim(coalesce(p.photo_url,'')),'') is not null
  and cardinality(coalesce(caps.capabilities,'{}'::text[])) > 0;

create view public.marketplace_professionals_general
with (security_invoker = false)
as
select
  p.id as professional_id,
  p.display_name as full_name,
  p.bio,
  p.location,
  p.languages,
  p.headline,
  caps.capabilities[1] capability,
  caps.capabilities[1] track,
  caps.capabilities capabilities,
  p.atb_id,
  p.display_initials,
  p.photo_url,
  p.industry,
  p.skills,
  p.topics,
  p.programme_types,
  p.availability,
  p.valu_index,
  p.cluster_scores,
  p.designation,
  p.fee_range,
  p.salary_expectation,
  p.availability_status,
  p.listing_status,
  p.eligible_for_listing,
  p.listed_at
from public.professional_profiles p
join lateral (
  select array_agg(
    case when c.capability='talent' then 'candidate' else c.capability end
    order by case c.capability when 'talent' then 1 when 'speaker' then 2 when 'facilitator' then 3 else 9 end
  ) capabilities
  from public.professional_capabilities c
  where c.professional_id=p.id and c.is_active=true
    and c.eligible_for_listing=true and c.eligibility_status='listed'
) caps on cardinality(coalesce(caps.capabilities,'{}'::text[])) > 0
where p.listing_status='listed' and p.eligible_for_listing=true
  and p.visibility='public' and p.profile_complete=true
  and nullif(trim(coalesce(p.photo_url,'')),'') is not null;

grant select on public.marketplace_professionals to anon, authenticated;
grant select on public.marketplace_professionals_general to anon, authenticated;