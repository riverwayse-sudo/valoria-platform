create or replace function public.sync_valu_assessment_to_profile()
returns trigger language plpgsql security definer set search_path=public,private as $function$
begin
  if new.user_id is null then return new; end if;
  if not exists(select 1 from public.users where id=new.user_id) then return new; end if;
  insert into public.professional_profiles(id,display_name,headline,listing_status,profile_complete,visibility,active_tracks,eligible_for_listing,availability_status,valu_index,cluster_scores,designation,assessment_completed_at,created_at,updated_at)
  values(new.user_id,nullif(trim(new.name),''),nullif(trim(new.role),''),'unlisted',false,'registered_only',array['candidate']::text[],false,'available',new.total_score,new.cluster_scores,new.designation,new.completed_at,now(),now())
  on conflict(id) do update set valu_index=excluded.valu_index,cluster_scores=excluded.cluster_scores,designation=excluded.designation,assessment_completed_at=excluded.assessment_completed_at,display_name=coalesce(public.professional_profiles.display_name,excluded.display_name),headline=coalesce(public.professional_profiles.headline,excluded.headline),updated_at=now();
  return new;
end;
$function$;

create or replace function public.link_existing_valu_assessment_to_user()
returns trigger language plpgsql security definer set search_path=public as $function$
declare matched_id uuid;
begin
  select v.id into matched_id from public.valu_assessments v where v.user_id is null and v.completed_at is not null and v.email is not null and lower(trim(v.email))=lower(trim(new.email)) order by v.completed_at desc limit 1;
  if matched_id is not null then update public.valu_assessments set user_id=new.id where id=matched_id and user_id is null; end if;
  return new;
end;
$function$;

drop trigger if exists trg_link_existing_valu_assessment_to_user on public.users;
create trigger trg_link_existing_valu_assessment_to_user after insert on public.users for each row execute function public.link_existing_valu_assessment_to_user();

create or replace view public.marketplace_professionals as
select p.id as professional_id,p.display_name as full_name,p.bio,p.location,p.languages,p.headline,
  case when c.capability='talent' then 'candidate' else c.capability end as capability,
  case when c.capability='talent' then 'candidate' else c.capability end as track,
  array[case when c.capability='talent' then 'candidate' else c.capability end] as capabilities,
  p.atb_id,p.display_initials,p.photo_url,p.industry,p.skills,p.topics,p.programme_types,p.availability,p.valu_index,p.cluster_scores,p.designation,p.fee_range,p.salary_expectation,p.availability_status,
  c.eligibility_status as listing_status,c.eligible_for_listing,c.listed_at
from public.professional_profiles p join public.professional_capabilities c on c.professional_id=p.id
where c.is_active=true and c.eligibility_status='listed' and c.eligible_for_listing=true and p.listing_status='listed' and p.eligible_for_listing=true and p.visibility='public'
  and not exists(select 1 from public.professional_listing_events e where e.professional_id=p.id and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED') and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p.id));
grant select on public.marketplace_professionals to anon,authenticated;

create or replace function private.evaluate_professional_readiness(p_professional_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private as $function$
declare missing jsonb:='[]'::jsonb; profile_ok boolean:=false; valu_ok boolean:=false; blocked boolean:=false; eligible boolean:=false; initial_assessment_type text:=null;
begin
  select coalesce(profile_complete,false) and nullif(trim(coalesce(display_name,'')),'') is not null and nullif(trim(coalesce(bio,'')),'') is not null into profile_ok from public.professional_profiles where id=p_professional_id;
  select case when exists(select 1 from public.taster_sessions t where t.user_id=p_professional_id and t.completed_at is not null) then 'initial_15_question' when exists(select 1 from public.valu_assessments v where v.user_id=p_professional_id and v.completed_at is not null and coalesce(v.total_score,0)>=35 and (v.expires_at is null or v.expires_at>now())) then 'full_assessment' else null end into initial_assessment_type;
  valu_ok:=initial_assessment_type is not null;
  select exists(select 1 from public.professional_listing_events e where e.professional_id=p_professional_id and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED') and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p_professional_id)) into blocked;
  if not profile_ok then missing:=missing||jsonb_build_array('profile'); end if;
  if not valu_ok then missing:=missing||jsonb_build_array('initial_valu_assessment'); end if;
  if not exists(select 1 from public.professional_profiles where id=p_professional_id and cardinality(coalesce(active_tracks,'{}'::text[]))>0) then missing:=missing||jsonb_build_array('track'); end if;
  eligible:=jsonb_array_length(missing)=0 and not blocked;
  return jsonb_build_object('professional_id',p_professional_id,'profile_complete',profile_ok,'initial_assessment_complete',valu_ok,'initial_assessment_type',initial_assessment_type,'full_assessment_required_for_general_listing',false,'blocked',blocked,'eligible',eligible,'missing',missing);
end;
$function$;

create or replace function private.reconcile_professional_listing_status(p_professional_id uuid)
returns void language plpgsql security definer set search_path=public,private as $function$
declare p record; readiness jsonb; eligible boolean; next_status text;
begin
  select * into p from public.professional_profiles where id=p_professional_id for update; if not found then return; end if;
  readiness:=private.evaluate_professional_readiness(p_professional_id); eligible:=coalesce((readiness->>'eligible')::boolean,false);
  next_status:=case when eligible then 'listed' when p.listing_status in ('listed','pending') then 'unlisted' else p.listing_status end;
  update public.professional_profiles set eligible_for_listing=eligible,listing_status=next_status,visibility=case when eligible then 'public' when p.visibility='public' and not eligible then 'registered_only' else p.visibility end,listed_at=case when eligible and listed_at is null then now() when not eligible then null else listed_at end,updated_at=now() where id=p_professional_id;
end;
$function$;

do $$declare r record;begin
  for r in (select distinct on(a.user_id) a.user_id,a.name,a.role,a.total_score,a.cluster_scores,a.designation,a.completed_at from public.valu_assessments a join public.users u on u.id=a.user_id where a.user_id is not null and a.completed_at is not null order by a.user_id,a.completed_at desc) loop
    insert into public.professional_profiles(id,display_name,headline,listing_status,profile_complete,visibility,active_tracks,eligible_for_listing,availability_status,valu_index,cluster_scores,designation,assessment_completed_at,created_at,updated_at)
    values(r.user_id,nullif(trim(r.name),''),nullif(trim(r.role),''),'unlisted',false,'registered_only',array['candidate']::text[],false,'available',r.total_score,r.cluster_scores,r.designation,r.completed_at,now(),now())
    on conflict(id) do update set valu_index=excluded.valu_index,cluster_scores=excluded.cluster_scores,designation=excluded.designation,assessment_completed_at=excluded.assessment_completed_at,updated_at=now();
  end loop;
end$$;

do $$declare r record;begin
  for r in select id from public.professional_profiles loop
    perform private.sync_profile_capability_paths_for_reconcile(r.id);
    perform private.reconcile_professional_listing_status(r.id);
  end loop;
end$$;