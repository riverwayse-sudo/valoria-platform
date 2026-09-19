-- Final close-out migration.
create or replace function public.enforce_valu_profile_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.listing_status,'pending') = 'pending' then new.listing_status := 'listed'; end if;
    new.profile_complete := false;
  end if;

  if new.valu_index is null or new.assessment_completed_at is null
     or nullif(trim(coalesce(new.display_name,'')),'') is null
     or nullif(trim(coalesce(new.headline,'')),'') is null
     or nullif(trim(coalesce(new.bio,'')),'') is null
     or nullif(trim(coalesce(new.photo_url,'')),'') is null
     or cardinality(coalesce(new.active_tracks,'{}'::text[]))=0
     or nullif(trim(coalesce(new.industry,'')),'') is null
     or nullif(trim(coalesce(new.username,'')),'') is null
     or nullif(trim(coalesce(new.phone,'')),'') is null
     or nullif(trim(coalesce(new.current_job_title,'')),'') is null
  then new.profile_complete := false;
  end if;
  return new;
end;
$function$;

revoke execute on function public.link_existing_valu_assessment_to_user() from public, anon, authenticated;

drop view if exists public.marketplace_professionals_general;
drop view if exists public.marketplace_professionals;

create view public.marketplace_professionals
with (security_invoker = false)
as
select
  p.id professional_id,p.display_name full_name,p.bio,p.location,p.languages,p.headline,
  case when c.capability='talent' then 'candidate' else c.capability end capability,
  case when c.capability='talent' then 'candidate' else c.capability end track,
  caps.capabilities,
  p.atb_id,p.display_initials,p.photo_url,p.industry,p.skills,p.topics,p.programme_types,
  p.availability,p.valu_index,p.cluster_scores,p.designation,p.fee_range,p.salary_expectation,
  p.availability_status,p.listing_status,c.eligible_for_listing,c.listed_at
from public.professional_profiles p
join public.professional_capabilities c
  on c.professional_id=p.id and c.is_active=true
  and c.eligible_for_listing=true and c.eligibility_status='listed'
join lateral (
  select array_agg(case when c2.capability='talent' then 'candidate' else c2.capability end
    order by case c2.capability when 'talent' then 1 when 'speaker' then 2 when 'facilitator' then 3 else 9 end) capabilities
  from public.professional_capabilities c2
  where c2.professional_id=p.id and c2.is_active=true and c2.eligible_for_listing=true and c2.eligibility_status='listed'
) caps on true
where p.listing_status='listed' and p.eligible_for_listing=true and p.visibility='public'
  and p.profile_complete=true and nullif(trim(coalesce(p.photo_url,'')),'') is not null
  and not exists(select 1 from public.professional_listing_events e where e.professional_id=p.id
    and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
    and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p.id));

create view public.marketplace_professionals_general
with (security_invoker = false)
as
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
  where c.professional_id=p.id and c.is_active=true and c.eligible_for_listing=true and c.eligibility_status='listed'
) caps on cardinality(coalesce(caps.capabilities,'{}'::text[])) > 0
where p.listing_status='listed' and p.eligible_for_listing=true and p.visibility='public'
  and p.profile_complete=true and nullif(trim(coalesce(p.photo_url,'')),'') is not null
  and not exists(select 1 from public.professional_listing_events e where e.professional_id=p.id
    and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
    and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p.id));

grant select on public.marketplace_professionals to anon, authenticated;
grant select on public.marketplace_professionals_general to anon, authenticated;

create or replace function public.admin_set_professional_listing(p_professional_id uuid,p_listed boolean,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,private
as $function$
declare readiness jsonb; result jsonb;
begin
  if not public.is_valoria_admin() then raise exception 'Administrator authorization required'; end if;
  if not exists(select 1 from public.professional_profiles where id=p_professional_id) then
    return jsonb_build_object('ok',false,'error','Professional profile not found.');
  end if;

  if p_listed then
    insert into public.professional_listing_controls(professional_id,admin_revoked,revoke_reason,revoked_at,revoked_by,updated_at)
    values(p_professional_id,false,null,null,null,now())
    on conflict(professional_id) do update set admin_revoked=false,revoke_reason=null,revoked_at=null,revoked_by=null,updated_at=now();
    select private.evaluate_professional_readiness(p_professional_id) into readiness;
    if not coalesce((readiness->>'eligible')::boolean,false) then
      return jsonb_build_object('ok',false,'error','Professional does not currently satisfy the marketplace eligibility gates.','readiness',readiness);
    end if;
    select private.sync_professional_listing_status(p_professional_id) into result;
    insert into public.professional_listing_events(professional_id,event_type,reason,actor_id,metadata)
    values(p_professional_id,'ADMIN_RESTORED','Administrator restored marketplace listing.',auth.uid(),readiness);
    return jsonb_build_object('ok',true,'action','list','result',result);
  end if;

  insert into public.professional_listing_controls(professional_id,admin_revoked,revoke_reason,revoked_at,revoked_by,updated_at)
  values(p_professional_id,true,nullif(trim(p_reason),''),now(),auth.uid(),now())
  on conflict(professional_id) do update set admin_revoked=true,revoke_reason=excluded.revoke_reason,revoked_at=excluded.revoked_at,revoked_by=excluded.revoked_by,updated_at=now();
  update public.professional_profiles set listing_status='unlisted',visibility='registered_only',updated_at=now() where id=p_professional_id;
  update public.professional_capabilities set eligibility_status='unlisted',listed_at=null,updated_at=now()
    where professional_id=p_professional_id and is_active=true;
  insert into public.professional_listing_events(professional_id,event_type,previous_status,new_status,reason,actor_id,metadata)
  values(p_professional_id,'ADMIN_REVOKED','listed','unlisted',coalesce(nullif(trim(p_reason),''),'Administrator removed the professional from marketplace discovery.'),auth.uid(),'{}'::jsonb);
  return jsonb_build_object('ok',true,'action','unlist','listing_status','unlisted');
end;
$function$;

revoke all on function public.admin_set_professional_listing(uuid,boolean,text) from public, anon;
grant execute on function public.admin_set_professional_listing(uuid,boolean,text) to authenticated;