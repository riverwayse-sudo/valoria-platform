-- Close the VALU -> signup -> profile -> capability -> eligibility -> listing -> marketplace lifecycle.
-- The marketplace gate is authoritative in Supabase; profile owners edit profile data only.

create or replace function private.valu_assessment_is_current(p_professional_id uuid)
returns boolean
language sql stable security definer set search_path = public, private
as $$
  select exists (
    select 1 from public.valu_assessments v
    where v.user_id = p_professional_id
      and v.completed_at is not null
      and coalesce(v.total_score,0) >= 35
      and (v.expires_at is null or v.expires_at > now())
  );
$$;
revoke all on function private.valu_assessment_is_current(uuid) from public, anon, authenticated;
grant execute on function private.valu_assessment_is_current(uuid) to service_role;

create or replace function public.enforce_valu_profile_lifecycle()
returns trigger language plpgsql security definer set search_path = public, private
as $$
declare complete boolean;
begin
  if tg_op = 'INSERT' and coalesce(new.listing_status,'pending') = 'pending' then new.listing_status := 'unlisted'; end if;
  complete :=
    nullif(trim(coalesce(new.display_name,'')),'') is not null
    and nullif(trim(coalesce(new.headline,'')),'') is not null
    and nullif(trim(coalesce(new.bio,'')),'') is not null
    and nullif(trim(coalesce(new.photo_url,'')),'') is not null
    and cardinality(coalesce(new.active_tracks,'{}'::text[])) > 0
    and nullif(trim(coalesce(new.industry,'')),'') is not null
    and nullif(trim(coalesce(new.username,'')),'') is not null
    and nullif(trim(coalesce(new.phone,'')),'') is not null
    and nullif(trim(coalesce(new.current_job_title,'')),'') is not null
    and nullif(trim(coalesce(new.location,'')),'') is not null
    and coalesce(array_length(new.languages,1),0) > 0
    and nullif(trim(coalesce(new.cv_url,'')),'') is not null
    and private.valu_assessment_is_current(new.id);
  new.profile_complete := coalesce(complete,false);
  return new;
end;
$$;

drop trigger if exists trg_enforce_valu_profile_lifecycle on public.professional_profiles;
create trigger trg_enforce_valu_profile_lifecycle
before insert or update of
  display_name,headline,bio,photo_url,active_tracks,industry,username,phone,
  current_job_title,location,languages,cv_url,valu_index,assessment_completed_at,
  assessment_expires_at,profile_complete,listing_status
on public.professional_profiles
for each row execute function public.enforce_valu_profile_lifecycle();

create or replace function public.guard_professional_platform_fields()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role',true) <> 'service_role'
     and not public.is_valoria_admin() then
    if new.valu_index is distinct from old.valu_index
       or new.cluster_scores is distinct from old.cluster_scores
       or new.skill_scores is distinct from old.skill_scores
       or new.designation is distinct from old.designation
       or new.assessment_completed_at is distinct from old.assessment_completed_at
       or new.assessment_expires_at is distinct from old.assessment_expires_at
       or new.atb_id is distinct from old.atb_id
       or new.listing_status is distinct from old.listing_status
       or new.eligible_for_listing is distinct from old.eligible_for_listing
       or new.listed_at is distinct from old.listed_at
       or new.visibility is distinct from old.visibility
       or new.speaker_tier is distinct from old.speaker_tier
       or new.revoked_at is distinct from old.revoked_at
       or new.revoked_by is distinct from old.revoked_by
       or new.revocation_reason is distinct from old.revocation_reason then
      raise exception 'platform-managed professional fields cannot be changed by the profile owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_professional_platform_fields on public.professional_profiles;
create trigger trg_guard_professional_platform_fields
before update on public.professional_profiles
for each row execute function public.guard_professional_platform_fields();

create or replace function private.evaluate_professional_capability(p_professional_id uuid,p_capability text)
returns jsonb language plpgsql security definer set search_path = public, private
as $$
declare missing jsonb := '[]'::jsonb; profile_ok boolean := false; valu_ok boolean := false; blocked boolean := false; eligible boolean := false; cap text := lower(trim(p_capability)); p record;
begin
  if cap='candidate' then cap:='talent'; end if;
  select * into p from public.professional_profiles where id=p_professional_id;
  if not found then return jsonb_build_object('professional_id',p_professional_id,'capability',cap,'eligible',false,'blocked',false,'missing',jsonb_build_array('profile')); end if;

  profile_ok := coalesce(p.profile_complete,false)
    and nullif(trim(coalesce(p.display_name,'')),'') is not null
    and nullif(trim(coalesce(p.headline,'')),'') is not null
    and nullif(trim(coalesce(p.bio,'')),'') is not null
    and nullif(trim(coalesce(p.photo_url,'')),'') is not null
    and cardinality(coalesce(p.active_tracks,'{}'::text[])) > 0;
  valu_ok := private.valu_assessment_is_current(p_professional_id);
  select coalesce((select plc.admin_revoked from public.professional_listing_controls plc where plc.professional_id=p_professional_id),false) into blocked;

  if not exists(select 1 from public.professional_capabilities where professional_id=p_professional_id and capability=cap and is_active) then missing:=missing||jsonb_build_array('capability'); end if;
  if not profile_ok then missing:=missing||jsonb_build_array('profile'); end if;
  if not valu_ok then missing:=missing||jsonb_build_array('valu_assessment_score_35_current'); end if;

  if cap='talent' then
    if nullif(trim(coalesce(p.cv_url,'')),'') is null then missing:=missing||jsonb_build_array('talent_cv'); end if;
  elsif cap='speaker' then
    if coalesce(array_length(p.topics,1),0)=0 then missing:=missing||jsonb_build_array('speaker_topics'); end if;
    if coalesce(array_length(p.format_capabilities,1),0)=0 then missing:=missing||jsonb_build_array('speaker_formats'); end if;
    if coalesce(array_length(p.audience_sizes,1),0)=0 then missing:=missing||jsonb_build_array('speaker_audience_size'); end if;
  elsif cap='facilitator' then
    if coalesce(array_length(p.topics,1),0)=0 and coalesce(array_length(p.facilitation_topics,1),0)=0 then missing:=missing||jsonb_build_array('facilitator_topics'); end if;
    if coalesce(array_length(p.programme_types,1),0)=0 then missing:=missing||jsonb_build_array('facilitator_programme_types'); end if;
  else
    missing:=missing||jsonb_build_array('unsupported_capability');
  end if;

  eligible:=jsonb_array_length(missing)=0 and not blocked;
  return jsonb_build_object('professional_id',p_professional_id,'capability',cap,'eligible',eligible,'blocked',blocked,'missing',missing);
end;
$$;
revoke all on function private.evaluate_professional_capability(uuid,text) from public, anon, authenticated;
grant execute on function private.evaluate_professional_capability(uuid,text) to service_role;

create or replace function private.sync_professional_capability(p_professional_id uuid,p_capability text)
returns jsonb language plpgsql security definer set search_path = public, private
as $$
declare r jsonb; cap text:=lower(trim(p_capability)); eligible boolean; new_status text;
begin
  if cap='candidate' then cap:='talent'; end if;
  insert into public.professional_capabilities(professional_id,capability,is_active) values(p_professional_id,cap,true)
  on conflict (professional_id,capability) do update set is_active=true,updated_at=now();
  r:=private.evaluate_professional_capability(p_professional_id,cap);
  eligible:=coalesce((r->>'eligible')::boolean,false);
  new_status:=case when eligible then 'listed' else 'unlisted' end;
  update public.professional_capabilities
  set eligible_for_listing=eligible,eligibility_status=new_status,missing_requirements=coalesce(r->'missing','[]'::jsonb),
      listed_at=case when eligible and listed_at is null then now() when not eligible then null else listed_at end,updated_at=now()
  where professional_id=p_professional_id and capability=cap;
  return r || jsonb_build_object('listing_status',new_status);
end;
$$;
revoke all on function private.sync_professional_capability(uuid,text) from public, anon, authenticated;
grant execute on function private.sync_professional_capability(uuid,text) to service_role;

create or replace function private.evaluate_professional_readiness(p_professional_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private
as $$
declare missing jsonb := '[]'::jsonb; profile_ok boolean := false; valu_ok boolean := false; blocked boolean := false; eligible boolean := false; p record;
begin
 select * into p from public.professional_profiles where id=p_professional_id;
 if not found then return jsonb_build_object('professional_id',p_professional_id,'profile_complete',false,'full_assessment_complete',false,'full_assessment_required_for_general_listing',true,'blocked',false,'eligible',false,'missing',jsonb_build_array('profile')); end if;
 profile_ok := coalesce(p.profile_complete,false)
   and nullif(trim(coalesce(p.display_name,'')),'') is not null
   and nullif(trim(coalesce(p.headline,'')),'') is not null
   and nullif(trim(coalesce(p.bio,'')),'') is not null
   and nullif(trim(coalesce(p.photo_url,'')),'') is not null
   and cardinality(coalesce(p.active_tracks,'{}'::text[])) > 0
   and nullif(trim(coalesce(p.industry,'')),'') is not null
   and nullif(trim(coalesce(p.username,'')),'') is not null
   and nullif(trim(coalesce(p.phone,'')),'') is not null
   and nullif(trim(coalesce(p.current_job_title,'')),'') is not null
   and nullif(trim(coalesce(p.location,'')),'') is not null
   and coalesce(array_length(p.languages,1),0) > 0
   and nullif(trim(coalesce(p.cv_url,'')),'') is not null;
 valu_ok:=private.valu_assessment_is_current(p_professional_id);
 select exists(select 1 from public.professional_listing_events e where e.professional_id=p_professional_id and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
   and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p_professional_id)) into blocked;
 if not profile_ok then missing:=missing||jsonb_build_array('profile'); end if;
 if not valu_ok then missing:=missing||jsonb_build_array('full_valu_assessment_score_35_current'); end if;
 if cardinality(coalesce(p.active_tracks,'{}'::text[]))=0 then missing:=missing||jsonb_build_array('track'); end if;
 if nullif(trim(coalesce(p.photo_url,'')),'') is null then missing:=missing||jsonb_build_array('photo_url'); end if;
 if nullif(trim(coalesce(p.cv_url,'')),'') is null then missing:=missing||jsonb_build_array('cv_url'); end if;
 eligible:=jsonb_array_length(missing)=0 and not blocked;
 return jsonb_build_object('professional_id',p_professional_id,'profile_complete',profile_ok,'full_assessment_complete',valu_ok,'full_assessment_required_for_general_listing',true,'blocked',blocked,'eligible',eligible,'missing',missing);
end;
$$;
revoke all on function private.evaluate_professional_readiness(uuid) from public, anon, authenticated;
grant execute on function private.evaluate_professional_readiness(uuid) to service_role;

create or replace function private.sync_professional_listing_status(p_professional_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private
as $$
declare p record; cap record; readiness jsonb; any_eligible boolean := false; next_status text;
begin
 select * into p from public.professional_profiles where id=p_professional_id for update;
 if not found then return jsonb_build_object('ok',false,'professional_id',p_professional_id); end if;
 for cap in select capability from public.professional_capabilities where professional_id=p_professional_id and is_active=true order by capability loop
   perform private.sync_professional_capability(p_professional_id,cap.capability);
 end loop;
 readiness:=private.evaluate_professional_readiness(p_professional_id);
 select exists(select 1 from public.professional_capabilities where professional_id=p_professional_id and is_active=true and eligible_for_listing=true and eligibility_status='listed') into any_eligible;
 if coalesce((readiness->>'eligible')::boolean,false) and any_eligible then next_status:='listed';
 elsif p.listing_status in ('listed','pending') then next_status:='unlisted';
 else next_status:=p.listing_status; end if;
 update public.professional_profiles
 set eligible_for_listing=(next_status='listed'),
     listing_status=next_status,
     visibility=case when next_status='listed' then 'public' when visibility='public' then 'registered_only' else visibility end,
     listed_at=case when next_status='listed' and listed_at is null then now() when next_status<>'listed' then null else listed_at end,
     updated_at=now()
 where id=p_professional_id;
 return jsonb_build_object('ok',true,'eligible_for_listing',(next_status='listed'),'listing_status',next_status,'readiness',readiness);
end;
$$;
revoke all on function private.sync_professional_listing_status(uuid) from public, anon, authenticated;
grant execute on function private.sync_professional_listing_status(uuid) to service_role;

drop trigger if exists trg_professional_profile_readiness_refresh on public.professional_profiles;
create trigger trg_professional_profile_readiness_refresh
after update of display_name,headline,bio,photo_url,active_tracks,industry,username,phone,current_job_title,
  location,languages,cv_url,visibility,valu_index,assessment_completed_at,assessment_expires_at,
  topics,facilitation_topics,programme_types,format_capabilities,audience_sizes,profile_complete
on public.professional_profiles
for each row
when (
  new.display_name is distinct from old.display_name or new.headline is distinct from old.headline
  or new.bio is distinct from old.bio or new.photo_url is distinct from old.photo_url
  or new.active_tracks is distinct from old.active_tracks or new.industry is distinct from old.industry
  or new.username is distinct from old.username or new.phone is distinct from old.phone
  or new.current_job_title is distinct from old.current_job_title or new.location is distinct from old.location
  or new.languages is distinct from old.languages or new.cv_url is distinct from old.cv_url
  or new.visibility is distinct from old.visibility or new.valu_index is distinct from old.valu_index
  or new.assessment_completed_at is distinct from old.assessment_completed_at
  or new.assessment_expires_at is distinct from old.assessment_expires_at
  or new.topics is distinct from old.topics or new.facilitation_topics is distinct from old.facilitation_topics
  or new.programme_types is distinct from old.programme_types or new.format_capabilities is distinct from old.format_capabilities
  or new.audience_sizes is distinct from old.audience_sizes or new.profile_complete is distinct from old.profile_complete
)
execute function private.queue_readiness_from_profile();

drop trigger if exists trg_capability_readiness_refresh on public.professional_capabilities;
create trigger trg_capability_readiness_refresh
after insert or update or delete on public.professional_capabilities
for each row execute function private.request_professional_readiness_refresh();

-- Repair known data quality drift that is directly inferable from the same profile record.
update public.professional_profiles
set current_job_title=headline
where id='2982e8e9-379f-4f62-9a50-c58b83aea01b'
  and current_job_title is null
  and headline is not null;

update public.professional_readiness_refresh_queue
set next_attempt_at=now(), processed_at=null, last_error=null;

do $$
declare r record;
begin
  for r in select id from public.professional_profiles order by id loop
    perform private.sync_profile_capability_paths_for_reconcile(r.id);
    perform private.sync_professional_listing_status(r.id);
  end loop;
end
$$;
