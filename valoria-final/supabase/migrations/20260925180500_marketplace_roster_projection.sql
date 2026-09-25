-- Marketplace roster projection: expose the canonical 11-person roster by active capability.
-- Governance blocks (ADMIN_REVOKED / ADMIN_SUSPENDED) still exclude a professional.
-- Listing/readiness state remains stored on professional_profiles; this projection is the
-- discovery source used by the public marketplace and intentionally does not require
-- profile_complete/photo/listing_status so the roster and capability counts stay consistent.

drop view if exists public.marketplace_professionals_general;
drop view if exists public.marketplace_professionals;

create view public.marketplace_professionals with (security_invoker=true) as
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
join lateral (
  select array_agg(
    case when c2.capability='talent' then 'candidate' else c2.capability end
    order by case c2.capability
      when 'talent' then 1
      when 'speaker' then 2
      when 'facilitator' then 3
      else 9
    end
  ) as capabilities
  from public.professional_capabilities c2
  where c2.professional_id=p.id
    and c2.is_active=true
) caps on true
where not exists (
  select 1
  from public.professional_listing_events e
  where e.professional_id=p.id
    and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
    and e.created_at=(
      select max(e2.created_at)
      from public.professional_listing_events e2
      where e2.professional_id=p.id
    )
);

create view public.marketplace_professionals_general with (security_invoker=true) as
select
  p.id as professional_id,
  p.display_name as full_name,
  p.bio,
  p.location,
  p.languages,
  p.headline,
  caps.capabilities[1] as capability,
  caps.capabilities[1] as track,
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
  p.eligible_for_listing,
  p.listed_at
from public.professional_profiles p
join lateral (
  select array_agg(
    case when c.capability='talent' then 'candidate' else c.capability end
    order by case c.capability
      when 'talent' then 1
      when 'speaker' then 2
      when 'facilitator' then 3
      else 9
    end
  ) as capabilities
  from public.professional_capabilities c
  where c.professional_id=p.id
    and c.is_active=true
) caps on cardinality(coalesce(caps.capabilities,'{}'::text[]))>0
where not exists (
  select 1
  from public.professional_listing_events e
  where e.professional_id=p.id
    and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
    and e.created_at=(
      select max(e2.created_at)
      from public.professional_listing_events e2
      where e2.professional_id=p.id
    )
);

grant select on public.marketplace_professionals to anon,authenticated;
grant select on public.marketplace_professionals_general to anon,authenticated;
