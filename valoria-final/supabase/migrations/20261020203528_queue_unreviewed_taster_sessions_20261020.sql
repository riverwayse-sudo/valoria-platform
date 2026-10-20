-- Ensure every legacy taster session has an explicit reconciliation ledger
-- state. Unmatched means unresolved; it does not authorize an identity link.
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
  'taster',
  t.id,
  NULL,
  NULL,
  'unmatched',
  'manual_review',
  NULL,
  'Automated reconciliation found no verified account link for this taster. Preserve the snapshot and score; require participant confirmation or stronger evidence before linking.',
  'system'
FROM public.taster_sessions t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.identity_reconciliation_reviews r
  WHERE r.source_record_type = 'taster'
    AND r.source_record_id = t.id
);
