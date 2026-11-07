-- The full-assessment APIs use the server-only service role to consume
-- one-time dashboard handoffs, save/resume formal progress, and persist results.
-- Browser roles receive no direct access through these grants.
GRANT SELECT, INSERT, UPDATE ON public.valoria_reentry_links TO service_role;
GRANT INSERT ON public.valu_assessments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.valu_assessment_progress TO service_role;
GRANT INSERT, UPDATE ON public.notifications TO service_role;
