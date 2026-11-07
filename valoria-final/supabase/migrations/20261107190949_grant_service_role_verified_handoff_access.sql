-- Allow the authenticated handoff API to read and safely attach verified
-- taster/full-assessment identity, record journey events, and issue short-lived
-- dashboard-to-assessment re-entry links. The service role is server-only.
GRANT UPDATE ON public.taster_identity_candidates TO service_role;
GRANT SELECT ON public.professional_profiles TO service_role;
GRANT SELECT, UPDATE ON public.valu_assessments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.assessment_identity_links TO service_role;
GRANT SELECT, INSERT ON public.valoria_journey_events TO service_role;
GRANT INSERT ON public.valoria_reentry_links TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_professional_journey(uuid) TO service_role;
