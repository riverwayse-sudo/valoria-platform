-- Backfill only one-to-one links supported by exact authenticated user ownership.
-- This intentionally leaves ambiguous or evidence-poor legacy assessments unlinked.
WITH unique_pairs AS (
  SELECT
    v.id AS assessment_id,
    min(t.id::text)::uuid AS taster_id
  FROM public.valu_assessments v
  JOIN public.taster_sessions t
    ON t.user_id = v.user_id
   AND t.completed_at IS NOT NULL
  WHERE v.taster_id IS NULL
    AND v.user_id IS NOT NULL
  GROUP BY v.id
  HAVING count(DISTINCT t.id) = 1
)
UPDATE public.valu_assessments v
SET taster_id = u.taster_id
FROM unique_pairs u
WHERE v.id = u.assessment_id
  AND v.taster_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.valu_assessments other
    WHERE other.taster_id = u.taster_id
      AND other.id <> v.id
  );
