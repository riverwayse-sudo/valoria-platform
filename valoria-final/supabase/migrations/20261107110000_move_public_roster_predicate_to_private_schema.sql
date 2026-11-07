-- Keep the boolean-only roster visibility predicate out of PostgREST's exposed public RPC surface.
-- The RLS policy can invoke the private helper while clients cannot call it as /rpc.
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
    WHERE pp.id = p_professional_id
      AND pp.visibility IN ('public', 'marketplace')
      AND pp.listing_status = 'listed'
      AND COALESCE(pp.is_test, false) = false
      AND pp.revoked_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.professional_listing_events AS e
        WHERE e.professional_id = pp.id
          AND e.event_type IN ('ADMIN_REVOKED', 'ADMIN_SUSPENDED')
          AND e.created_at = (
            SELECT max(e2.created_at)
            FROM public.professional_listing_events AS e2
            WHERE e2.professional_id = pp.id
          )
      )
  );
$function$;

REVOKE ALL ON FUNCTION private.is_marketplace_profile_public(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_marketplace_profile_public(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS marketplace_public_read ON public.marketplace_public_roster;
CREATE POLICY marketplace_public_read
  ON public.marketplace_public_roster
  FOR SELECT
  TO anon, authenticated
  USING (private.is_marketplace_profile_public(professional_id));

DROP FUNCTION IF EXISTS public.is_marketplace_profile_public(uuid);

COMMENT ON FUNCTION private.is_marketplace_profile_public(uuid)
  IS 'Boolean-only security-definer predicate for public Marketplace roster visibility. Kept outside the exposed public RPC schema.';
COMMIT;
