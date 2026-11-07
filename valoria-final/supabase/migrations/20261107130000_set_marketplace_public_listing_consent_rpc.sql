-- Explicit, owner-controlled consent for public Marketplace visibility.
-- Public visibility is opt-in. A profile can still be saved privately without consent.

create or replace function public.set_marketplace_public_listing_consent(
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professional_id uuid := auth.uid();
  v_consent_text text := 'I agree to make my professional profile visible in Valoria’s public Marketplace. I understand that my name, professional headline, selected capabilities and profile details marked for public display may be shown to organisations and people exploring the Marketplace. If I complete the full VALU assessment and meet the relevant eligibility requirements, my VALU Index result and approved capability summary may also appear. I can withdraw this permission at any time by changing my Marketplace visibility in Profile settings.';
begin
  if v_professional_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.professional_profiles p
    where p.id = v_professional_id
  ) then
    raise exception 'Complete your professional profile before changing Marketplace visibility';
  end if;

  if coalesce(p_enabled, false) then
    insert into public.professional_profile_acknowledgements (
      professional_id,
      acknowledgement_type,
      acknowledgement_version,
      acknowledgement_text,
      source,
      acknowledged_at
    )
    values (
      v_professional_id,
      'marketplace_public_listing',
      'marketplace-public-listing-v1-2026-11-07',
      v_consent_text,
      'marketplace_visibility',
      pg_catalog.now()
    );

    update public.professional_profiles
    set visibility = 'public',
        updated_at = pg_catalog.now()
    where id = v_professional_id;
  else
    update public.professional_profiles
    set visibility = 'registered_only',
        updated_at = pg_catalog.now()
    where id = v_professional_id;
  end if;

  perform public.refresh_marketplace_public_roster(v_professional_id);

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'visibility', case when coalesce(p_enabled, false) then 'public' else 'registered_only' end
  );
end;
$$;

revoke all on function public.set_marketplace_public_listing_consent(boolean) from public, anon;
grant execute on function public.set_marketplace_public_listing_consent(boolean) to authenticated;
