-- Dedicated server-to-server credential for scheduled Edge Function invocations.
-- Generate the value inside Vault; never commit or return the secret itself.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets
    WHERE name = 'valoria_privileged_function_invoke_key'
  ) THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'valoria_privileged_function_invoke_key',
      'Private pg_cron-to-Edge-Function invocation credential'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_valid_valoria_function_invoke_key(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, vault
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'valoria_privileged_function_invoke_key'
      AND decrypted_secret = p_key
  );
$$;

REVOKE ALL ON FUNCTION public.is_valid_valoria_function_invoke_key(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_valoria_function_invoke_key(text)
  TO service_role;
