-- The site serves a deliberately sanitized marketplace response from its server-only route.
-- Do not expose the internal basic/full assessment-access classification through PostgREST.
-- The public roster table itself has no anon/authenticated table grants; this closes the
-- remaining direct RPC path while preserving trusted server-side use.

REVOKE ALL ON FUNCTION public.get_marketplace_public_roster_v1(uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_marketplace_public_roster_v1(uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.get_marketplace_public_roster_v1(uuid, text) IS
  'Server-only roster helper. Public marketplace access is served through the Valoria site route, which removes internal assessment-access fields.';

DO $assert$
BEGIN
  IF has_function_privilege('anon', 'public.get_marketplace_public_roster_v1(uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.get_marketplace_public_roster_v1(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Public marketplace roster RPC still exposes internal assessment-access fields to client roles';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.get_marketplace_public_roster_v1(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Service role lost access to the internal marketplace roster helper';
  END IF;
END;
$assert$;
