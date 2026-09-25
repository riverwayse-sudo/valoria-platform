-- Align the legacy public marketplace projection with the canonical 11-person roster.
-- Keep governance blocks as the only exclusion at the projection layer.

create or replace view public.public_marketplace_professionals with (security_invoker=true) as
select
  p.id,
  p.display_name,
  p.headline,
  p.bio,
  p.location,
  p.photo_url,
  p.cover_url,
  p.industry,
  p.experience_years,
  p.active_tracks,
  p.speaker_tier,
  p.valu_index,
  p.cluster_scores,
  p.skill_scores,
  p.designation,
  p.created_at,
  p.updated_at,
  caps.capabilities
from public.professional_profiles p
join lateral (
  select array_agg(
    pc.capability
    order by case pc.capability
      when 'talent' then 1
      when 'speaker' then 2
      when 'facilitator' then 3
      else 9
    end
  ) as capabilities
  from public.professional_capabilities pc
  where pc.professional_id=p.id
    and pc.is_active=true
) caps on cardinality(coalesce(caps.capabilities,'{}'::text[])) > 0
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

grant select on public.public_marketplace_professionals to anon,authenticated;
