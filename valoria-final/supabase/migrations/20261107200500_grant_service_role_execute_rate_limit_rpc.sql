-- Keep the SECURITY DEFINER rate-limit primitive callable only by the
-- trusted server-side service role. Do not grant PUBLIC, anon or authenticated.
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
