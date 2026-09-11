create or replace function private.valu_assessment_is_current(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $function$
  select exists (
    select 1 from public.taster_sessions t
    where t.user_id = p_professional_id and t.completed_at is not null
  )
  or exists (
    select 1 from public.valu_assessments v
    where v.user_id=p_professional_id
      and v.completed_at is not null
      and coalesce(v.total_score,0)>=35
      and (v.expires_at is null or v.expires_at>now())
  );
$function$;

create or replace function private.evaluate_professional_readiness(p_professional_id uuid)
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
  initial_assessment_type text := null;
begin
  select coalesce(profile_complete,false)
    and nullif(trim(coalesce(display_name,'')),'') is not null
    and nullif(trim(coalesce(bio,'')),'') is not null
    into profile_ok
  from public.professional_profiles where id=p_professional_id;

  select case
    when exists (select 1 from public.taster_sessions t where t.user_id=p_professional_id and t.completed_at is not null) then 'initial_15_question'
    when exists (select 1 from public.valu_assessments v where v.user_id=p_professional_id and v.completed_at is not null and coalesce(v.total_score,0)>=35 and (v.expires_at is null or v.expires_at>now())) then 'legacy_full_assessment'
    else null
  end into initial_assessment_type;

  valu_ok := initial_assessment_type is not null;

  select exists(
    select 1 from public.professional_listing_events e
    where e.professional_id=p_professional_id
      and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
      and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p_professional_id)
  ) into blocked;

  if not profile_ok then missing:=missing||'["profile"]'::jsonb; end if;
  if not valu_ok then missing:=missing||'["initial_valu_assessment"]'::jsonb; end if;
  if not exists (select 1 from public.professional_profiles where id=p_professional_id and cardinality(coalesce(active_tracks,'{}'::text[]))>0) then missing:=missing||'["track"]'::jsonb; end if;

  eligible:=jsonb_array_length(missing)=0 and not blocked;
  return jsonb_build_object(
    'professional_id',p_professional_id,
    'profile_complete',profile_ok,
    'initial_assessment_complete',valu_ok,
    'initial_assessment_type',initial_assessment_type,
    'full_assessment_required_for_general_listing',false,
    'blocked',blocked,
    'eligible',eligible,
    'missing',missing
  );
end;
$function$;

create or replace function private.sync_professional_listing_status(p_professional_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  p record;
  readiness jsonb;
  eligible boolean;
  next_status text;
begin
  if (select auth.uid()) is distinct from p_professional_id and not public.is_valoria_admin() then
    raise exception 'You may only refresh your own marketplace listing status';
  end if;
  select * into p from public.professional_profiles where id=p_professional_id for update;
  if not found then return jsonb_build_object('ok',false,'professional_id',p_professional_id); end if;
  readiness:=private.evaluate_professional_readiness(p_professional_id);
  eligible:=coalesce((readiness->>'eligible')::boolean,false);
  next_status:=case when eligible then 'listed' when p.listing_status in ('listed','pending') then 'unlisted' else p.listing_status end;
  update public.professional_profiles set eligible_for_listing=eligible, listing_status=next_status, visibility=case when eligible then 'public' when p.visibility='public' and not eligible then 'registered_only' else p.visibility end, listed_at=case when eligible and listed_at is null then now() when not eligible then null else listed_at end, updated_at=now() where id=p_professional_id;
  return jsonb_build_object('ok',true,'eligible_for_listing',eligible,'listing_status',next_status,'readiness',readiness);
end;
$function$;
