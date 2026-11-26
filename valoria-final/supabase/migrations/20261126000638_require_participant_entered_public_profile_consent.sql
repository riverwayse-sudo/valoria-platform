-- Restore the participant-entered public visibility consent boundary.
-- Administrator attestations may document an operational conversation, but they
-- are not a substitute for the participant choosing public visibility and
-- submitting the consent themselves.

CREATE OR REPLACE FUNCTION private.has_public_profile_consent(p_professional_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
  SELECT COALESCE((
    SELECT acknowledgement.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'
       AND acknowledgement.source IN ('profile_setup', 'profile_edit')
    FROM public.professional_profile_acknowledgements acknowledgement
    WHERE acknowledgement.professional_id = p_professional_id
      AND acknowledgement.acknowledgement_type = 'profile_submission'
    ORDER BY acknowledgement.acknowledged_at DESC NULLS LAST,
             acknowledgement.created_at DESC,
             acknowledgement.id DESC
    LIMIT 1
  ), FALSE);
$function$;

REVOKE ALL ON FUNCTION private.has_public_profile_consent(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_public_profile_consent(uuid) TO service_role;

-- Fail closed for any existing public projection that was supported only by an
-- administrator attestation. Preserve source profiles and acknowledgement rows;
-- participants can opt in later through profile setup/edit.
DO $reconcile$
DECLARE
  affected record;
BEGIN
  FOR affected IN
    SELECT id
    FROM public.professional_profiles
    WHERE visibility IN ('public', 'marketplace')
      AND NOT private.has_public_profile_consent(id)
  LOOP
    UPDATE public.professional_profiles
       SET visibility = 'registered_only',
           updated_at = now()
     WHERE id = affected.id;

    -- The writer deletes the cached public row first and only recreates it when
    -- the participant-entered consent predicate, assessment and listing gates pass.
    PERFORM public.refresh_marketplace_public_roster(affected.id);
  END LOOP;
END;
$reconcile$;

DO $assert$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.professional_profiles
    WHERE visibility IN ('public', 'marketplace')
      AND NOT private.has_public_profile_consent(id)
  ) THEN
    RAISE EXCEPTION 'Profiles without participant-entered public consent remain publicly visible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.marketplace_public_roster roster
    WHERE NOT private.has_public_profile_consent(roster.professional_id)
  ) THEN
    RAISE EXCEPTION 'Marketplace public roster contains a profile without participant-entered consent';
  END IF;
END;
$assert$;
