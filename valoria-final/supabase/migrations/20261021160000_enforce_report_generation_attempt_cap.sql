-- Enforce the report-generation retry ceiling inside the database claim function.
-- The sweep query already limits selection to report_attempts < 5, but the RPC
-- can also be called directly by the trusted report endpoint. Keep the guard
-- here so all callers share the same ceiling.
CREATE OR REPLACE FUNCTION public.claim_report_generation(
  p_identity_hash text,
  p_idempotency_key text
)
RETURNS TABLE(claimed boolean, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.valu_assessments%rowtype;
BEGIN
  SELECT *
    INTO v_row
    FROM public.valu_assessments
   WHERE identity_hash = p_identity_hash
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'NOT_FOUND'::text;
    RETURN;
  END IF;

  IF v_row.report_email_sent_at IS NOT NULL OR v_row.report_status = 'SENT' THEN
    RETURN QUERY SELECT false, 'SENT'::text;
    RETURN;
  END IF;

  -- Existing canonical reports may still need email finalization. Only stop
  -- further generation when there is no saved report and the attempt cap hit.
  IF v_row.ai_report IS NULL AND COALESCE(v_row.report_attempts, 0) >= 5 THEN
    RETURN QUERY SELECT false, 'RETRY_LIMIT'::text;
    RETURN;
  END IF;

  IF v_row.report_locked_at IS NOT NULL
     AND v_row.report_locked_at > now() - interval '10 minutes' THEN
    RETURN QUERY SELECT false, COALESCE(v_row.report_status, 'IN_PROGRESS')::text;
    RETURN;
  END IF;

  UPDATE public.valu_assessments
     SET report_status = 'PROCESSING',
         report_attempts = COALESCE(report_attempts, 0) + 1,
         report_locked_at = now(),
         report_idempotency_key = p_idempotency_key
   WHERE id = v_row.id;

  RETURN QUERY SELECT true, 'PROCESSING'::text;
END;
$function$;

-- Preserve the existing service-role-only execution contract.
REVOKE ALL ON FUNCTION public.claim_report_generation(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_report_generation(text, text) TO service_role;
