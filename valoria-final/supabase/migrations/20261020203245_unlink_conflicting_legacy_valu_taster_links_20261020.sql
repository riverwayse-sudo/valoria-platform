-- Undo any legacy assessment-to-taster link that fails the full ownership contract.
-- A matching user_id alone is insufficient: owner, normalized name, and role
-- must all agree before a link is retained.
UPDATE public.valu_assessments a
SET taster_id = NULL
FROM public.taster_sessions t
WHERE a.taster_id = t.id
  AND a.completed_at IS NOT NULL
  AND (
    a.user_id IS DISTINCT FROM t.user_id
    OR lower(trim(coalesce(a.name, ''))) IS DISTINCT FROM lower(trim(coalesce(t.name, '')))
    OR lower(trim(coalesce(a.role, ''))) IS DISTINCT FROM lower(trim(coalesce(t.role, '')))
  );
