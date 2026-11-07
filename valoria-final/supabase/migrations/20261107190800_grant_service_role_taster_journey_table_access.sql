-- The taster journey APIs use the server-only service role and invoke
-- SECURITY INVOKER RPCs. Grant only the operations those server-side flows need.
-- Never grant these table privileges to anon or authenticated.
GRANT SELECT, INSERT, UPDATE ON public.lead_captures TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.taster_progress TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.taster_sessions TO service_role;
GRANT SELECT, INSERT ON public.taster_identity_candidates TO service_role;
