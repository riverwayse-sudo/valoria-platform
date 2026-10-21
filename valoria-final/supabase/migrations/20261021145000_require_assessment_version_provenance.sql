-- Preserve honest provenance for historical VALU assessments whose assessment version
-- was never recorded. Do not infer a version from the scoring/rubric version.
UPDATE public.valu_assessments
SET assessment_version = 'LEGACY_UNVERSIONED'
WHERE assessment_version IS NULL;

-- Future assessment writes must explicitly persist their assessment version.
ALTER TABLE public.valu_assessments
  ALTER COLUMN assessment_version SET NOT NULL;

COMMENT ON COLUMN public.valu_assessments.assessment_version IS
  'Assessment instrument version used at completion. LEGACY_UNVERSIONED identifies historical rows whose original instrument version cannot be verified.';
