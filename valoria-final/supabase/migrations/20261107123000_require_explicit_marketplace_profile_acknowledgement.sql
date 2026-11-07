-- Public visibility is not treated as a substitute for a separately recorded acknowledgement.
-- Until the professional explicitly acknowledges marketplace_public_listing, the row remains hidden.
BEGIN;

CREATE OR REPLACE FUNCTION private.is_marketplace_profile_public(p_professional_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.professional_profiles AS pp
    JOIN public.marketplace_public_roster AS roster
      ON roster.professional_id = pp.id
    WHERE pp.id = p_professional_id
      AND pp.visibility IN ('public', 'marketplace')
      AND pp.listing_status = 'listed'
      AND COALESCE(pp.is_test, false) = false
      AND pp.revoked_at IS NULL
      AND NOT private.is_professional_listing_blocked(pp.id)
      AND EXISTS (
        SELECT 1
        FROM public.professional_profile_acknowledgements AS acknowledgement
        WHERE acknowledgement.professional_id = pp.id
          AND acknowledgement.acknowledgement_type = 'marketplace_public_listing'
          AND acknowledgement.acknowledged_at IS NOT NULL
          AND length(trim(acknowledgement.acknowledgement_text)) > 0
      )
      AND (
        (
          roster.assessment_access = 'basic'
          AND EXISTS (
            SELECT 1
            FROM public.taster_sessions AS t
            WHERE t.user_id = pp.id
              AND t.completed_at IS NOT NULL
          )
        )
        OR
        (
          roster.assessment_access = 'full'
          AND pp.profile_complete IS TRUE
          AND COALESCE(pp.valu_index, 0) >= 35
          AND private.valu_assessment_is_current(pp.id)
          AND EXISTS (
            SELECT 1
            FROM public.professional_capabilities AS capability
            WHERE capability.professional_id = pp.id
              AND capability.is_active IS TRUE
              AND capability.eligible_for_listing IS TRUE
              AND capability.eligibility_status = 'listed'
              AND jsonb_array_length(COALESCE(capability.missing_requirements, '[]'::jsonb)) = 0
          )
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION private.is_marketplace_profile_public(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_marketplace_profile_public(uuid) TO anon, authenticated;

COMMENT ON FUNCTION private.is_marketplace_profile_public(uuid)
  IS 'Public roster predicate requires separate marketplace_public_listing acknowledgement, explicit public visibility, no test/revoked/admin-blocked profile, and the appropriate Basic or Full listing gate.';

COMMIT;
