-- Restrict the public roster to profiles whose visibility permits public marketplace discovery.
-- This closes the gap where registered-only Basic snapshots could be read through the public roster RLS policy.
BEGIN;

DROP POLICY IF EXISTS marketplace_public_read ON public.marketplace_public_roster;

CREATE POLICY marketplace_public_read
  ON public.marketplace_public_roster
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.professional_profiles pp
      WHERE pp.id = marketplace_public_roster.professional_id
        AND pp.visibility IN ('public', 'marketplace')
        AND pp.listing_status IN ('listed', 'active')
        AND COALESCE(pp.is_test, false) = false
    )
  );

COMMENT ON POLICY marketplace_public_read ON public.marketplace_public_roster
  IS 'Public and marketplace-visible, listed non-test profiles only. Registered-only profiles are never exposed through the public roster.';

COMMIT;
