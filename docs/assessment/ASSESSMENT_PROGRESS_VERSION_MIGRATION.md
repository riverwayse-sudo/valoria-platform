# Staging migration: version formal assessment progress

## Purpose

The nine-question VALU taster and the 58-question formal VALU assessment have separate answer maps and separate lifecycle states. Existing rows in `public.valu_assessment_progress` were created under the former combined 9 + 49 model. They must not be restored into the new formal instrument.

The staging API now writes and queries `assessment_version = 'FULL_VALU_V2_SEPARATE_TASTER'`. This nullable column is required before the new progress API can persist or restore formal answers.

## SQL to apply to the isolated staging database only

```sql
ALTER TABLE public.valu_assessment_progress
  ADD COLUMN IF NOT EXISTS assessment_version text;

CREATE INDEX IF NOT EXISTS idx_valu_assessment_progress_version_taster_status_activity
  ON public.valu_assessment_progress
  (assessment_version, taster_id, status, last_activity_at DESC);
```

## Data-safety properties

- Do not backfill existing rows.
- Do not set a default value.
- Existing combined-model progress rows remain unchanged and have a null version.
- The new API writes the explicit `FULL_VALU_V2_SEPARATE_TASTER` value on new rows.
- Restore, resume-token lookup, session lookup, and reminder sweeps are scoped to the new version.
- No `taster_answers` are read or copied into formal progress.
- No existing assessment, taster, profile, report, identity link, or participant record is updated or deleted.
- RLS policies and existing ownership constraints remain unchanged.

## Verification required after applying

1. Confirm the column and index exist on the staging branch only.
2. Confirm legacy progress rows retain null `assessment_version`.
3. Create a fresh taster record, link it to a staging test account, and begin the separate 58-question assessment.
4. Save 1, 9, 10, 57, and 58 formal answers and verify the stored answer keys/counts.
5. Refresh and resume; verify the next unanswered formal question is restored.
6. Confirm the formal answer map never contains taster answers.
7. Submit all 58 formal answers and verify the resulting assessment row is tagged `FULL_VALU_V2_SEPARATE_TASTER`.

This migration is not applied to production. A staging database branch must exist before execution.
