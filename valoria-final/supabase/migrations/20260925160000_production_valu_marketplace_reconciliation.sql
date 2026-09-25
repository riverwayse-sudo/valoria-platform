-- Production reconciliation: enforce the live VALU -> profile -> capability -> marketplace contract.
-- General marketplace entry requires a completed initial 15-question assessment, a complete professional profile,
-- at least one active capability, and no governance block.

create or replace function private.evaluate_professional_readiness(p_professional_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare missing jsonb:='[]'::jsonb; profile_ok boolean:=false; valu_ok boolean:=false; blocked boolean:=false; eligible boolean:=false; initial_assessment_type text:=null;
begin
  select coalesce(profile_complete,false)
    and nullif(trim(coalesce(display_name,'')),'') is not null
    and nullif(trim(coalesce(bio,'')),'') is not null
    into profile_ok
  from public.professional_profiles where id=p_professional_id;

  select case
    when exists(select 1 from public.taster_sessions t where t.user_id=p_professional_id and t.completed_at is not null)
      then 'initial_15_question'
    when exists(select 1 from public.valu_assessments v where v.user_id=p_professional_id and v.completed_at is not null
      and coalesce(v.total_score,0)>=35 and (v.expires_at is null or v.expires_at>now()))
      then 'full_assessment'
    else null end
    into initial_assessment_type;

  valu_ok:=initial_assessment_type is not null;

  select exists(
    select 1 from public.professional_listing_events e
    where e.professional_id=p_professional_id
      and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
      and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p_professional_id)
  ) into blocked;

  if not profile_ok then missing:=missing||jsonb_build_array('profile'); end if;
  if not valu_ok then missing:=missing||jsonb_build_array('initial_valu_assessment'); end if;
  if not exists(select 1 from public.professional_profiles where id=p_professional_id and cardinality(coalesce(active_tracks,'{}'::text[]))>0)
    then missing:=missing||jsonb_build_array('track'); end if;

  eligible:=jsonb_array_length(missing)=0 and not blocked;

  return jsonb_build_object(
    'professional_id',p_professional_id,
    'profile_complete',profile_ok,
    'initial_assessment_complete',valu_ok,
    'initial_assessment_type',initial_assessment_type,
    'full_assessment_required_for_general_listing',false,
    'blocked',blocked,'eligible',eligible,'missing',missing
  );
end $$;

revoke all on function private.evaluate_professional_readiness(uuid) from public,anon,authenticated;
grant execute on function private.evaluate_professional_readiness(uuid) to service_role;

create or replace function private.sync_professional_listing_status(p_professional_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare p record; cap record; readiness jsonb; any_eligible boolean:=false; next_status text;
begin
  select * into p from public.professional_profiles where id=p_professional_id for update;
  if not found then return jsonb_build_object('ok',false,'professional_id',p_professional_id); end if;

  for cap in select capability from public.professional_capabilities
    where professional_id=p_professional_id and is_active=true order by capability loop
    perform private.sync_professional_capability(p_professional_id,cap.capability);
  end loop;

  readiness:=private.evaluate_professional_readiness(p_professional_id);

  select exists(
    select 1 from public.professional_capabilities
    where professional_id=p_professional_id and is_active=true
      and eligible_for_listing=true and eligibility_status='listed'
  ) into any_eligible;

  if coalesce((readiness->>'eligible')::boolean,false) and any_eligible then
    next_status:='listed';
  elsif p.listing_status in ('listed','pending') then
    next_status:='unlisted';
  else
    next_status:=p.listing_status;
  end if;

  update public.professional_profiles
  set eligible_for_listing=(next_status='listed'),
      listing_status=next_status,
      visibility=case when next_status='listed' then 'public'
                      when visibility='public' then 'registered_only' else visibility end,
      listed_at=case when next_status='listed' and listed_at is null then now()
                    when next_status<>'listed' then null else listed_at end,
      updated_at=now()
  where id=p_professional_id;

  return jsonb_build_object('ok',true,'eligible_for_listing',(next_status='listed'),
    'listing_status',next_status,'readiness',readiness);
end $$;

revoke all on function private.sync_professional_listing_status(uuid) from public,anon,authenticated;
grant execute on function private.sync_professional_listing_status(uuid) to service_role;

drop view if exists public.marketplace_professionals_general;
drop view if exists public.marketplace_professionals;

create view public.marketplace_professionals with (security_invoker=true) as
select p.id professional_id,p.display_name full_name,p.bio,p.location,p.languages,p.headline,
  case when c.capability='talent' then 'candidate' else c.capability end capability,
  case when c.capability='talent' then 'candidate' else c.capability end track,
  caps.capabilities,p.atb_id,p.display_initials,p.photo_url,p.industry,p.skills,p.topics,p.programme_types,
  p.availability,p.valu_index,p.cluster_scores,p.designation,p.fee_range,p.salary_expectation,
  p.availability_status,p.listing_status,c.eligible_for_listing,c.listed_at
from public.professional_profiles p
join public.professional_capabilities c on c.professional_id=p.id and c.is_active=true
  and c.eligible_for_listing=true and c.eligibility_status='listed'
join lateral (
  select array_agg(case when c2.capability='talent' then 'candidate' else c2.capability end
    order by case c2.capability when 'talent' then 1 when 'speaker' then 2 when 'facilitator' then 3 else 9 end) capabilities
  from public.professional_capabilities c2
  where c2.professional_id=p.id and c2.is_active=true
    and c2.eligible_for_listing=true and c2.eligibility_status='listed'
) caps on true
where p.listing_status='listed' and p.eligible_for_listing=true and p.visibility='public'
  and p.profile_complete=true and nullif(trim(coalesce(p.photo_url,'')),'') is not null
  and not exists(select 1 from public.professional_listing_events e where e.professional_id=p.id
    and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
    and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p.id));

create view public.marketplace_professionals_general with (security_invoker=true) as
select p.id professional_id,p.display_name full_name,p.bio,p.location,p.languages,p.headline,
  caps.capabilities[1] capability,caps.capabilities[1] track,caps.capabilities,
  p.atb_id,p.display_initials,p.photo_url,p.industry,p.skills,p.topics,p.programme_types,p.availability,
  p.valu_index,p.cluster_scores,p.designation,p.fee_range,p.salary_expectation,p.availability_status,
  p.listing_status,p.eligible_for_listing,p.listed_at
from public.professional_profiles p
join lateral (
  select array_agg(case when c.capability='talent' then 'candidate' else c.capability end
    order by case c.capability when 'talent' then 1 when 'speaker' then 2 when 'facilitator' then 3 else 9 end) capabilities
  from public.professional_capabilities c
  where c.professional_id=p.id and c.is_active=true
    and c.eligible_for_listing=true and c.eligibility_status='listed'
) caps on cardinality(coalesce(caps.capabilities,'{}'::text[]))>0
where p.listing_status='listed' and p.eligible_for_listing=true and p.visibility='public'
  and p.profile_complete=true and nullif(trim(coalesce(p.photo_url,'')),'') is not null
  and not exists(select 1 from public.professional_listing_events e where e.professional_id=p.id
    and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
    and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p.id));

grant select on public.marketplace_professionals to anon,authenticated;
grant select on public.marketplace_professionals_general to anon,authenticated;

do $$ declare r record; begin
  for r in select id from public.professional_profiles order by id loop
    perform private.sync_profile_capability_paths_for_reconcile(r.id);
    perform private.sync_professional_listing_status(r.id);
  end loop;
end $$;
