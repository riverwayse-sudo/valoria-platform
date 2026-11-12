-- Enforce the VALU v4 score contract without changing historical scores.
-- Nullability policy: incomplete rows may have a NULL score; completed rows must
-- have a score; every non-NULL score must be in the inclusive 0..100 range.
-- Validate existing lead-capture foreign keys after the read-only orphan audit.

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.valu_assessments'::regclass
      AND conname = 'valu_assessments_total_score_integrity_check'
  ) THEN
    ALTER TABLE public.valu_assessments
      ADD CONSTRAINT valu_assessments_total_score_integrity_check
      CHECK (
        (total_score IS NULL OR total_score BETWEEN 0 AND 100)
        AND (completed_at IS NULL OR total_score IS NOT NULL)
      ) NOT VALID;
  END IF;
END;
$migration$;

ALTER TABLE public.valu_assessments
  VALIDATE CONSTRAINT valu_assessments_total_score_integrity_check;

ALTER TABLE public.taster_progress
  VALIDATE CONSTRAINT taster_progress_lead_capture_id_fkey;

ALTER TABLE public.taster_sessions
  VALIDATE CONSTRAINT taster_sessions_lead_capture_id_fkey;

ALTER TABLE public.taster_identity_candidates
  VALIDATE CONSTRAINT taster_identity_candidates_lead_capture_id_fkey;

COMMENT ON CONSTRAINT valu_assessments_total_score_integrity_check
  ON public.valu_assessments IS
  'Incomplete rows may have NULL total_score; completed rows require a non-NULL score; all non-NULL scores must be between 0 and 100 inclusive.';

DO $assert$
DECLARE
  v_unvalidated integer;
  v_invalid_scores integer;
  v_orphans integer;
BEGIN
  SELECT count(*) INTO v_unvalidated
  FROM pg_constraint
  WHERE conrelid IN (
    'public.taster_progress'::regclass,
    'public.taster_sessions'::regclass,
    'public.taster_identity_candidates'::regclass
  )
    AND conname IN (
      'taster_progress_lead_capture_id_fkey',
      'taster_sessions_lead_capture_id_fkey',
      'taster_identity_candidates_lead_capture_id_fkey'
    )
    AND NOT convalidated;

  SELECT count(*) INTO v_invalid_scores
  FROM public.valu_assessments
  WHERE (total_score IS NOT NULL AND (total_score < 0 OR total_score > 100))
     OR (completed_at IS NOT NULL AND total_score IS NULL);

  SELECT
    (SELECT count(*) FROM public.taster_progress t
      LEFT JOIN public.lead_captures l ON l.id = t.lead_capture_id
      WHERE t.lead_capture_id IS NOT NULL AND l.id IS NULL)
    +
    (SELECT count(*) FROM public.taster_sessions t
      LEFT JOIN public.lead_captures l ON l.id = t.lead_capture_id
      WHERE t.lead_capture_id IS NOT NULL AND l.id IS NULL)
    +
    (SELECT count(*) FROM public.taster_identity_candidates t
      LEFT JOIN public.lead_captures l ON l.id = t.lead_capture_id
      WHERE t.lead_capture_id IS NOT NULL AND l.id IS NULL)
  INTO v_orphans;

  IF v_unvalidated <> 0 OR v_invalid_scores <> 0 OR v_orphans <> 0 THEN
    RAISE EXCEPTION
      'VALU integrity verification failed: unvalidated lead FKs %, invalid score rows %, orphan lead references %',
      v_unvalidated, v_invalid_scores, v_orphans;
  END IF;
END;
$assert$;
