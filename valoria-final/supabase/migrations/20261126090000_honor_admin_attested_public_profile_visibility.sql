-- Honour the existing administrator attestation as the recorded evidence that
-- the individual's agreement to public profile display was obtained.
-- Profile owners do not need a second visibility approval in the product.
-- Keep assessment, listing eligibility, test-account and revocation gates intact.

CREATE OR REPLACE FUNCTION private.has_public_profile_consent(p_professional_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
  SELECT COALESCE((
    SELECT acknowledgement.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'
       AND acknowledgement.source IN ('profile_setup', 'profile_edit', 'admin_attestation')
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

-- Restore public visibility only for records already marked listed and eligible,
-- with the current admin attestation and no test/revocation restriction.
-- The existing trigger refreshes the canonical public roster projection.
UPDATE public.professional_profiles p
   SET visibility = 'public',
       updated_at = now()
  FROM public.professional_profile_acknowledgements a,
       public.users u
 WHERE a.professional_id = p.id
   AND u.id = p.id
   AND a.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'
   AND a.source = 'admin_attestation'
   AND a.acknowledgement_type = 'profile_submission'
   AND a.id = (
     SELECT a2.id
       FROM public.professional_profile_acknowledgements a2
      WHERE a2.professional_id = p.id
      ORDER BY a2.acknowledged_at DESC NULLS LAST,
               a2.created_at DESC,
               a2.id DESC
      LIMIT 1
   )
   AND p.listing_status = 'listed'
   AND p.eligible_for_listing IS TRUE
   AND COALESCE(p.is_test, false) IS FALSE
   AND p.revoked_at IS NULL
   AND coalesce(u.user_type, 'professional') = 'professional'
   AND NOT COALESCE((
     SELECT c.admin_revoked
       FROM public.professional_listing_controls c
      WHERE c.professional_id = p.id
   ), false)
   AND NOT EXISTS (
     SELECT 1
       FROM public.professional_listing_events e
      WHERE e.professional_id = p.id
        AND e.event_type IN ('ADMIN_REVOKED','ADMIN_SUSPENDED')
        AND e.created_at = (
          SELECT max(e2.created_at)
            FROM public.professional_listing_events e2
           WHERE e2.professional_id = p.id
        )
   );

DO $assert$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.marketplace_public_roster roster
     WHERE NOT private.has_public_profile_consent(roster.professional_id)
  ) THEN
    RAISE EXCEPTION 'Public marketplace roster contains a profile without the accepted attestation';
  END IF;

  IF has_function_privilege('anon', 'private.has_public_profile_consent(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.has_public_profile_consent(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client roles must not execute the private consent helper directly';
  END IF;
END;
$assert$;
