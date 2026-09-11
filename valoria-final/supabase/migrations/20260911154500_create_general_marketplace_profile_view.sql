create or replace view public.marketplace_professionals_general as
select p.id as professional_id,p.display_name as full_name,p.bio,p.location,p.languages,p.headline,
  case when c.capability='talent' then 'candidate' else c.capability end as capability,
  case when c.capability='talent' then 'candidate' else c.capability end as track,
  array[case when c.capability='talent' then 'candidate' else c.capability end] as capabilities,
  p.atb_id,p.display_initials,p.photo_url,p.industry,p.skills,p.topics,p.programme_types,p.availability,p.valu_index,p.cluster_scores,p.designation,p.fee_range,p.salary_expectation,p.availability_status,p.listing_status,p.eligible_for_listing,p.listed_at
from public.professional_profiles p
join lateral (select c.* from public.professional_capabilities c where c.professional_id=p.id and c.is_active=true order by case when c.eligible_for_listing=true or c.eligibility_status='listed' then 0 else 1 end,case c.capability when 'talent' then 1 when 'speaker' then 2 when 'facilitator' then 3 else 9 end limit 1) c on true
where p.listing_status='listed' and p.visibility='public'
  and not exists (select 1 from public.professional_listing_events e where e.professional_id=p.id and e.event_type=any(array['ADMIN_REVOKED','ADMIN_SUSPENDED']) and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p.id));
grant select on public.marketplace_professionals_general to anon, authenticated;
