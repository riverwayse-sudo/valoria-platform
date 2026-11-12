-- Harden the public marketplace RPC against stale visibility, consent and identity data.
-- Keep the existing RPC return shape for compatibility, but never return personal names
-- or initials. The public wrapper is the only callable entry point; its private helper
-- is no longer directly executable by anon/authenticated roles.

CREATE OR REPLACE FUNCTION private.is_basic_public_profile_ready(p_professional_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.professional_profiles p
    WHERE p.id = p_professional_id
      AND p.is_test IS FALSE
      AND p.revoked_at IS NULL
      AND NULLIF(BTRIM(p.display_name), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(p.headline, p.current_job_title)), '') IS NOT NULL
      AND NULLIF(BTRIM(p.atb_id), '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.professional_capabilities c
        WHERE c.professional_id = p.id
          AND c.is_active IS TRUE
      )
      AND (
        (
          COALESCE(p.valu_index, 0) >= 35
          AND private.valu_assessment_is_current(p.id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.taster_sessions t
          WHERE t.user_id = p.id
            AND t.completed_at IS NOT NULL
        )
      )
      AND private.has_public_profile_consent(p.id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.professional_listing_events e
        WHERE e.professional_id = p.id
          AND e.event_type IN ('ADMIN_REVOKED', 'ADMIN_SUSPENDED')
          AND e.created_at = (
            SELECT MAX(e2.created_at)
            FROM public.professional_listing_events e2
            WHERE e2.professional_id = p.id
          )
      )
      AND NOT COALESCE((
        SELECT c.admin_revoked
        FROM public.professional_listing_controls c
        WHERE c.professional_id = p.id
      ), FALSE)
  );
$function$;

REVOKE ALL ON FUNCTION private.is_basic_public_profile_ready(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_basic_public_profile_ready(uuid) TO service_role;

-- Patch the existing roster writer rather than replacing its unrelated scoring,
-- capability-selection and projection logic. Fail closed if its known contract drifts.
DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
  v_count integer;
BEGIN
  v_definition := pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);

  v_old := '  assessment_ok boolean := false;';
  v_new := '  assessment_ok boolean := false;
  public_consent_ok boolean := false;';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace writer declaration changed; refusing an unsafe patch';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '  assessment_ok := private.valu_assessment_is_current(p_professional_id);';
  v_new := v_old || E'\n\n  public_consent_ok := private.has_public_profile_consent(p_professional_id);';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace writer assessment check changed; refusing an unsafe patch';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$p.visibility in ('public','marketplace','registered_only')$old$;
  v_new := $new$p.visibility in ('public','marketplace')$new$;
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly two public-roster visibility gates, found %', v_count;
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$  if assessment_ok and p.visibility in ('public','marketplace') and p.listing_status = 'listed' then$old$;
  v_new := $new$  if assessment_ok and public_consent_ok and p.visibility in ('public','marketplace') and p.listing_status = 'listed' then$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace writer full-assessment gate changed; refusing an unsafe patch';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$migration$;

ALTER FUNCTION public.refresh_marketplace_public_roster(uuid)
  SET search_path TO pg_catalog, public, private;

-- Preserve the RPC shape for existing clients, but null personal identity fields
-- and revalidate consent, visibility, listing state, assessment validity and revocation
-- against the source profile at read time.
CREATE OR REPLACE FUNCTION private.get_marketplace_public_roster_v1_impl(
  p_professional_id uuid DEFAULT NULL::uuid,
  p_atb_id text DEFAULT NULL::text
)
RETURNS TABLE(
  professional_id uuid,
  full_name text,
  location text,
  languages text[],
  headline text,
  current_job_title text,
  capability text,
  track text,
  capabilities text[],
  selected_capabilities text[],
  atb_id text,
  display_initials text,
  photo_url text,
  industry text,
  skills text[],
  topics text[],
  programme_types text[],
  availability text[],
  valu_index integer,
  cluster_scores jsonb,
  assessment_summary text,
  designation text,
  availability_status text,
  assessment_access text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    r.professional_id,
    NULL::text AS full_name,
    r.location,
    r.languages,
    r.headline,
    r.current_job_title,
    r.capability,
    r.track,
    r.capabilities,
    r.selected_capabilities,
    r.atb_id,
    NULL::text AS display_initials,
    r.photo_url,
    r.industry,
    r.skills,
    r.topics,
    r.programme_types,
    r.availability,
    r.valu_index,
    r.cluster_scores,
    r.assessment_summary,
    r.designation,
    r.availability_status,
    r.assessment_access
  FROM public.marketplace_public_roster AS r
  JOIN public.professional_profiles AS p
    ON p.id = r.professional_id
  WHERE (p_professional_id IS NULL OR r.professional_id = p_professional_id)
    AND (p_atb_id IS NULL OR r.atb_id = p_atb_id)
    AND NOT (p_professional_id IS NOT NULL AND p_atb_id IS NOT NULL)
    AND r.assessment_access IN ('full', 'basic')
    AND p.is_test IS FALSE
    AND p.visibility IN ('public', 'marketplace')
    AND p.listing_status = 'listed'
    AND p.revoked_at IS NULL
    AND private.has_public_profile_consent(p.id)
    AND (
      (
        r.assessment_access = 'full'
        AND COALESCE(p.valu_index, 0) >= 35
        AND private.valu_assessment_is_current(p.id)
      )
      OR
      (
        r.assessment_access = 'basic'
        AND private.is_basic_public_profile_ready(p.id)
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.professional_listing_events e
      WHERE e.professional_id = p.id
        AND e.event_type IN ('ADMIN_REVOKED', 'ADMIN_SUSPENDED')
        AND e.created_at = (
          SELECT MAX(e2.created_at)
          FROM public.professional_listing_events e2
          WHERE e2.professional_id = p.id
        )
    )
    AND NOT COALESCE((
      SELECT controls.admin_revoked
      FROM public.professional_listing_controls controls
      WHERE controls.professional_id = p.id
    ), FALSE)
  ORDER BY r.valu_index DESC NULLS LAST, r.atb_id ASC;
$function$;

REVOKE ALL ON FUNCTION private.get_marketplace_public_roster_v1_impl(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_marketplace_public_roster_v1_impl(uuid, text) TO service_role;

-- The public RPC runs with its trusted owner so it can call the private helper.
-- All output filtering is enforced inside that helper.
CREATE OR REPLACE FUNCTION public.get_marketplace_public_roster_v1(
  p_professional_id uuid DEFAULT NULL::uuid,
  p_atb_id text DEFAULT NULL::text
)
RETURNS TABLE(
  professional_id uuid,
  full_name text,
  location text,
  languages text[],
  headline text,
  current_job_title text,
  capability text,
  track text,
  capabilities text[],
  selected_capabilities text[],
  atb_id text,
  display_initials text,
  photo_url text,
  industry text,
  skills text[],
  topics text[],
  programme_types text[],
  availability text[],
  valu_index integer,
  cluster_scores jsonb,
  assessment_summary text,
  designation text,
  availability_status text,
  assessment_access text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT *
  FROM private.get_marketplace_public_roster_v1_impl(p_professional_id, p_atb_id);
$function$;

REVOKE ALL ON FUNCTION public.get_marketplace_public_roster_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketplace_public_roster_v1(uuid, text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_marketplace_public_roster_v1(uuid, text) IS
'Consent-verified public marketplace roster. Preserves the legacy response shape but returns no personal name or initials fields.';

-- Migration-time assertions: fail the migration if the intended boundary is not installed.
DO $assert$
BEGIN
  IF has_function_privilege('anon', 'private.get_marketplace_public_roster_v1_impl(uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.get_marketplace_public_roster_v1_impl(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Private marketplace roster helper remains directly executable by client roles';
  END IF;

  IF NOT has_function_privilege('anon', 'public.get_marketplace_public_roster_v1(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_marketplace_public_roster_v1(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Public marketplace roster wrapper is not executable by intended client roles';
  END IF;

  IF NOT (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.get_marketplace_public_roster_v1(uuid,text)'::regprocedure
  ) THEN
    RAISE EXCEPTION 'Public marketplace roster wrapper must execute as its trusted owner';
  END IF;

  IF position('NULL::text AS full_name' IN pg_get_functiondef('private.get_marketplace_public_roster_v1_impl(uuid,text)'::regprocedure)) = 0
     OR position('NULL::text AS display_initials' IN pg_get_functiondef('private.get_marketplace_public_roster_v1_impl(uuid,text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Public marketplace roster helper is not suppressing personal identity fields';
  END IF;
END;
$assert$;
