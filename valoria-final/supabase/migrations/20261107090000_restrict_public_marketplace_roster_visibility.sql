-- Restrict the public roster to profiles whose visibility permits public Marketplace discovery.
-- The roster projection also contains registered_only Basic snapshots; those must never
-- become publicly readable merely because they are present in the projection table.
-- A SECURITY DEFINER predicate verifies profile state without exposing private profile rows.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_marketplace_profile_public(p_professional_id uuid)
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

REVOKE ALL ON FUNCTION public.is_marketplace_profile_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_marketplace_profile_public(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.is_marketplace_profile_public(uuid)
  IS 'Boolean-only security-definer predicate for public Marketplace roster visibility. Does not expose professional profile fields.';

DROP POLICY IF EXISTS marketplace_public_read ON public.marketplace_public_roster;

CREATE POLICY marketplace_public_read
  ON public.marketplace_public_roster
  FOR SELECT
  TO anon, authenticated
  USING (public.is_marketplace_profile_public(professional_id));

COMMENT ON POLICY marketplace_public_read ON public.marketplace_public_roster
  IS 'Only public or Marketplace-visible, listed, non-test, non-revoked profiles. Registered-only snapshots are never exposed through the public roster.';

COMMIT;
