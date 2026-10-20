-- Make the existing report access token mandatory and unique. Public report
-- generation will use this opaque UUID instead of the short deterministic
-- name/role fingerprint as its authorization credential.
ALTER TABLE public.valu_assessments
  ALTER COLUMN report_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS valu_assessments_report_token_uidx
  ON public.valu_assessments (report_token);
