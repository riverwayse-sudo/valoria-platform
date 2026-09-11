-- General marketplace eligibility is distinct from capability/category readiness.
-- A professional may be publicly listed once their core profile and current
-- VALU threshold are satisfied. Capability-specific evidence controls the
-- individual Talent/Speaker/Facilitator listings separately.

create or replace function private.evaluate_professional_readiness(p_professional_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to public, private
as $$
declare
  missing jsonb := '[]'::jsonb;
  profile_ok boolean := false;
  valu_ok boolean := false;
  blocked boolean := false;
  eligible boolean := false;
begin
  select coalesce(profile_complete,false)
    and nullif(trim(coalesce(display_name,'')),'') is not null
    and nullif(trim(coalesce(bio,'')),'') is not null
    into profile_ok
  from public.professional_profiles
  where id=p_professional_id;

  valu_ok := private.valu_assessment_is_current(p_professional_id);

  select exists(
    select 1 from public.professional_listing_events e
    where e.professional_id=p_professional_id
      and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
      and e.created_at=(
        select max(e2.created_at)
        from public.professional_listing_events e2
        where e2.professional_id=p_professional_id
      )
  ) into blocked;

  if not profile_ok then missing:=missing||'["profile"]'::jsonb; end if;
  if not valu_ok then missing:=missing||'["valu_assessment_score_35_current"]'::jsonb; end if;
  if not exists(
    select 1 from public.professional_profiles
    where id=p_professional_id and cardinality(coalesce(active_tracks,'{}'::text[]))>0
  ) then missing:=missing||'["track"]'::jsonb; end if;

  eligible:=jsonb_array_length(missing)=0 and not blocked;

  return jsonb_build_object(
    'professional_id',p_professional_id,
    'profile_complete',profile_ok,
    'valu_complete',valu_ok,
    'blocked',blocked,
    'eligible',eligible,
    'missing',missing
  );
end;
$$;

create or replace function private.sync_professional_listing_status(p_professional_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to public, private
as $$
declare
  p record;
  readiness jsonb;
  eligible boolean;
  next_status text;
begin
  select * into p from public.professional_profiles where id=p_professional_id for update;
  if not found then return jsonb_build_object('ok',false,'professional_id',p_professional_id); end if;

  readiness:=private.evaluate_professional_readiness(p_professional_id);
  eligible:=coalesce((readiness->>'eligible')::boolean,false);

  next_status:=case
    when eligible then 'listed'
    when p.listing_status in ('listed','pending') then 'unlisted'
    else p.listing_status
  end;

  update public.professional_profiles
  set eligible_for_listing=eligible,
      listing_status=next_status,
      visibility=case
        when eligible then 'public'
        when p.visibility='public' and not eligible then 'registered_only'
        else p.visibility
      end,
      listed_at=case
        when eligible and listed_at is null then now()
        when not eligible then null
        else listed_at
      end,
      updated_at=now()
  where id=p_professional_id;

  return jsonb_build_object('ok',true,'eligible_for_listing',eligible,'listing_status',next_status,'readiness',readiness);
end;
$$;

-- The public wrapper is callable only by an authenticated owner/admin path.
revoke all on function public.sync_professional_listing_status(uuid) from public;
grant execute on function public.sync_professional_listing_status(uuid) to authenticated;
