-- Prevent new taster records from becoming detached from the registration
-- captured before the nine-question snapshot. NOT VALID preserves any legacy
-- rows for controlled reconciliation while enforcing every new reference.

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'taster_progress_lead_capture_id_fkey'
      AND conrelid = 'public.taster_progress'::regclass
  ) THEN
    ALTER TABLE public.taster_progress
      ADD CONSTRAINT taster_progress_lead_capture_id_fkey
      FOREIGN KEY (lead_capture_id)
      REFERENCES public.lead_captures(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'taster_sessions_lead_capture_id_fkey'
      AND conrelid = 'public.taster_sessions'::regclass
  ) THEN
    ALTER TABLE public.taster_sessions
      ADD CONSTRAINT taster_sessions_lead_capture_id_fkey
      FOREIGN KEY (lead_capture_id)
      REFERENCES public.lead_captures(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'taster_identity_candidates_lead_capture_id_fkey'
      AND conrelid = 'public.taster_identity_candidates'::regclass
  ) THEN
    ALTER TABLE public.taster_identity_candidates
      ADD CONSTRAINT taster_identity_candidates_lead_capture_id_fkey
      FOREIGN KEY (lead_capture_id)
      REFERENCES public.lead_captures(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'taster_identity_candidates_taster_id_fkey'
      AND conrelid = 'public.taster_identity_candidates'::regclass
  ) THEN
    ALTER TABLE public.taster_identity_candidates
      ADD CONSTRAINT taster_identity_candidates_taster_id_fkey
      FOREIGN KEY (taster_id)
      REFERENCES public.taster_sessions(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'taster_progress_taster_id_fkey'
      AND conrelid = 'public.taster_progress'::regclass
  ) THEN
    ALTER TABLE public.taster_progress
      ADD CONSTRAINT taster_progress_taster_id_fkey
      FOREIGN KEY (taster_id)
      REFERENCES public.taster_sessions(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'taster_sessions_user_id_fkey'
      AND conrelid = 'public.taster_sessions'::regclass
  ) THEN
    ALTER TABLE public.taster_sessions
      ADD CONSTRAINT taster_sessions_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'taster_identity_candidates_linked_user_id_fkey'
      AND conrelid = 'public.taster_identity_candidates'::regclass
  ) THEN
    ALTER TABLE public.taster_identity_candidates
      ADD CONSTRAINT taster_identity_candidates_linked_user_id_fkey
      FOREIGN KEY (linked_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END
$migration$;

-- A progress row may be created only after a lead has been registered. Legacy
-- rows can still be reconciled/updated without changing their existing link.
CREATE OR REPLACE FUNCTION public.require_taster_lead_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.lead_capture_id IS NULL THEN
    RAISE EXCEPTION 'A registered lead is required before creating taster data'
      USING ERRCODE = '23502';
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.lead_capture_id IS DISTINCT FROM OLD.lead_capture_id
    AND NEW.lead_capture_id IS NULL THEN
    RAISE EXCEPTION 'A taster record cannot be detached from its registration'
      USING ERRCODE = '23502';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.require_taster_lead_identity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_taster_lead_identity() TO service_role;

DROP TRIGGER IF EXISTS taster_progress_require_lead_identity ON public.taster_progress;
CREATE TRIGGER taster_progress_require_lead_identity
  BEFORE INSERT OR UPDATE OF lead_capture_id
  ON public.taster_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.require_taster_lead_identity();

DROP TRIGGER IF EXISTS taster_sessions_require_lead_identity ON public.taster_sessions;
CREATE TRIGGER taster_sessions_require_lead_identity
  BEFORE INSERT OR UPDATE OF lead_capture_id
  ON public.taster_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.require_taster_lead_identity();

DROP TRIGGER IF EXISTS taster_identity_candidates_require_lead_identity ON public.taster_identity_candidates;
CREATE TRIGGER taster_identity_candidates_require_lead_identity
  BEFORE INSERT OR UPDATE OF lead_capture_id
  ON public.taster_identity_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.require_taster_lead_identity();

-- Submission keys are scoped to one in-progress taster and must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS taster_progress_submission_key_key
  ON public.taster_progress (submission_key)
  WHERE submission_key IS NOT NULL;
