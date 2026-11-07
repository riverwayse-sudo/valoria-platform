-- Restrict the public roster to profiles whose visibility permits public Marketplace discovery.
-- A SECURITY DEFINER predicate is required because professional_profiles intentionally denies
-- anonymous table reads; the policy must verify visibility without exposing that table.
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
      AND pp.listing_status IN ('listed', 'active')
      AND COALESCE(pp.is_test, false) = false
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
  IS 'Public and Marketplace-visible, listed non-test profiles only. Registered-only profiles are never exposed through the public roster.';

COMMIT;
