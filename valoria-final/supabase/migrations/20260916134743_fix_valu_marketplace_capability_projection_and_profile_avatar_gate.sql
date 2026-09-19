-- Recovered production migration: profile completeness and capability readiness
-- explicitly require a public avatar before marketplace discovery.
create or replace function public.enforce_valu_profile_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.listing_status,'pending') = 'pending' then
      new.listing_status := 'listed';
    end if;
    new.profile_complete := false;
  end if;

  if new.valu_index is null or new.assessment_completed_at is null then
    new.profile_complete := false;
  end if;

  if nullif(trim(coalesce(new.photo_url,'')),'') is null then
    new.profile_complete := false;
  end if;

  return new;
end;
$function$;

create or replace function private.evaluate_professional_capability(p_professional_id uuid, p_capability text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  missing jsonb := '[]'::jsonb;
  profile_ok boolean := false;
  valu_ok boolean := false;
  blocked boolean := false;
  eligible boolean := false;
  cap text := lower(trim(p_capability));
begin
  if cap='candidate' then cap:='talent'; end if;

  select coalesce(profile_complete,false)
    and nullif(trim(coalesce(display_name,'')),'') is not null
    and nullif(trim(coalesce(bio,'')),'') is not null
    and nullif(trim(coalesce(photo_url,'')),'') is not null
    into profile_ok
  from public.professional_profiles
  where id=p_professional_id;

  valu_ok := private.valu_assessment_is_current(p_professional_id);
  select coalesce((select admin_revoked from public.professional_listing_controls where professional_id=p_professional_id),false) into blocked;

  if not exists (select 1 from public.professional_capabilities where professional_id=p_professional_id and capability=cap and is_active) then
    missing:=missing||jsonb_build_array('capability');
  end if;
  if not profile_ok then missing:=missing||jsonb_build_array('profile'); end if;
  if not valu_ok then missing:=missing||jsonb_build_array('valu_assessment_score_35_current'); end if;

  if cap='talent' then
    if not exists (select 1 from public.professional_profiles where id=p_professional_id and nullif(trim(coalesce(cv_url,'')),'') is not null) then
      missing:=missing||jsonb_build_array('talent_cv');
    end if;
  elsif cap='speaker' then
    if not exists (select 1 from public.speaking_history where professional_id=p_professional_id) then
      missing:=missing||jsonb_build_array('speaking_history');
    end if;
    if not exists (select 1 from public.speaking_engagements where professional_id=p_professional_id) then
      missing:=missing||jsonb_build_array('speaking_engagement');
    end if;
  elsif cap='facilitator' then
    if not exists (select 1 from public.facilitation_history where professional_id=p_professional_id) then
      missing:=missing||jsonb_build_array('facilitation_history');
    end if;
    if not exists (select 1 from public.facilitation_engagements where professional_id=p_professional_id) then
      missing:=missing||jsonb_build_array('facilitation_engagement');
    end if;
  end if;

  eligible:=jsonb_array_length(missing)=0 and not blocked;
  return jsonb_build_object('professional_id',p_professional_id,'capability',cap,'eligible',eligible,'blocked',blocked,'missing',missing);
end;
$function$;