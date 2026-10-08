-- Valoria Excellence: security hardening
-- Applied to the production project before being committed here.
-- Trigger-only marketplace synchronization functions must not be callable through PostgREST.

REVOKE EXECUTE ON FUNCTION public.enforce_assessment_marketplace_presence() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_profile_marketplace_presence() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_assessment_marketplace_presence() IS
'Internal trigger function. EXECUTE is intentionally revoked from API roles; invoked only by database triggers.';

COMMENT ON FUNCTION public.enforce_profile_marketplace_presence() IS
'Internal trigger function. EXECUTE is intentionally revoked from API roles; invoked only by database triggers.';
