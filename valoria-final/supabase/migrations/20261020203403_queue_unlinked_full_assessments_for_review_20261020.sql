-- Ensure each completed full assessment without a verified taster link has
-- an explicit reconciliation ledger entry. This records an unresolved state;
-- it does not claim a match or modify assessment data.
INSERT INTO public.identity_reconciliation_reviews (
  source_record_type,
  source_record_id,
  candidate_record_type,
  candidate_record_id,
  decision,
  evidence_type,
  evidence_reference,
  notes,
  review_actor_type
)
SELECT
  'assessment',
  a.id,
  NULL,
  NULL,
  'unmatched',
  'manual_review',
  NULL,
  'Automated reconciliation found no unique, verified taster link. Preserve the assessment and score; require participant confirmation or stronger evidence before linking.',
  'system'
FROM public.valu_assessments a
WHERE a.completed_at IS NOT NULL
  AND a.taster_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.identity_reconciliation_reviews r
    WHERE r.source_record_type = 'assessment'
      AND r.source_record_id = a.id
  );
