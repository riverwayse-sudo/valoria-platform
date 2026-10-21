-- Store a non-sensitive machine-readable failure code for failed report generation.
-- This allows retries and alerts to distinguish provider, timeout, validation,
-- lookup, and email-delivery failures without exposing error text to clients.
ALTER TABLE public.valu_assessments
  ADD COLUMN IF NOT EXISTS report_failure_code text;
