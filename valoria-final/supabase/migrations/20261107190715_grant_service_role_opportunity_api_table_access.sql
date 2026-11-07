-- The site API uses the server-only service role for public job reads,
-- employer submission RPCs, and administrator review workflows.
-- Do not grant these privileges to anon or authenticated.
GRANT SELECT ON public.admin_users TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.opportunities TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.opportunity_submissions TO service_role;
