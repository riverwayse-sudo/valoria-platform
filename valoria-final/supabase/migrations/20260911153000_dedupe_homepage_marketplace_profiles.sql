create or replace function public.get_homepage_professional_count()
returns bigint language sql stable set search_path = public as $function$
  select count(*)::bigint from public.professional_profiles p
  where p.listing_status = 'listed' and p.visibility = 'public'
    and exists (select 1 from public.professional_capabilities c where c.professional_id=p.id and c.is_active=true)
    and not exists (select 1 from public.professional_listing_events e where e.professional_id=p.id and e.event_type=any(array['ADMIN_REVOKED','ADMIN_SUSPENDED']) and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p.id));
$function$;

create or replace function public.get_homepage_professional_previews()
returns table(id uuid, atb_id text, display_initials text, headline text, photo_url text, active_tracks text[], valu_index integer, listing_track text)
language sql stable set search_path = public as $function$
  select p.id,p.atb_id,p.display_initials,p.headline,p.photo_url,p.active_tracks,p.valu_index,
    coalesce(cap.listing_track, case when 'candidate'=any(coalesce(p.active_tracks,'{}'::text[])) then 'candidate' when 'speaker'=any(coalesce(p.active_tracks,'{}'::text[])) then 'speaker' when 'facilitator'=any(coalesce(p.active_tracks,'{}'::text[])) then 'facilitator' else 'candidate' end)
  from public.professional_profiles p
  left join lateral (
    select case when c.capability='talent' then 'candidate' else c.capability end as listing_track
    from public.professional_capabilities c where c.professional_id=p.id and c.is_active=true and (c.eligible_for_listing=true or c.eligibility_status='listed')
    order by case c.capability when 'talent' then 1 when 'speaker' then 2 when 'facilitator' then 3 else 9 end limit 1
  ) cap on true
  where p.listing_status='listed' and p.visibility='public'
    and exists (select 1 from public.professional_capabilities c2 where c2.professional_id=p.id and c2.is_active=true)
    and not exists (select 1 from public.professional_listing_events e where e.professional_id=p.id and e.event_type=any(array['ADMIN_REVOKED','ADMIN_SUSPENDED']) and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p.id))
  order by p.valu_index desc nulls last,p.atb_id limit 24;
$function$;
