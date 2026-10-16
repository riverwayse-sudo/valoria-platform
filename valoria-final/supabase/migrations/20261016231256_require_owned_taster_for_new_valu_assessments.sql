-- Prevent new full VALU records from becoming detached from their verified snapshot.
-- Enforcement applies to new inserts; historical repair remains possible.
CREATE OR REPLACE FUNCTION private.require_owned_taster_for_new_valu_assessment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  snapshot public.taster_sessions%ROWTYPE;
BEGIN
  IF NEW.taster_id IS NULL THEN
    RAISE EXCEPTION 'A completed VALU snapshot reference is required for a full assessment.'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
    INTO snapshot
    FROM public.taster_sessions
   WHERE id = NEW.taster_id
   FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The referenced VALU snapshot does not exist.'
      USING ERRCODE = '23503';
  END IF;

  IF snapshot.completed_at IS NULL THEN
    RAISE EXCEPTION 'The referenced VALU snapshot is not complete.'
      USING ERRCODE = '23514';
  END IF;

  IF snapshot.user_id IS NULL THEN
    RAISE EXCEPTION 'The VALU snapshot must be linked to an authenticated account before full assessment submission.'
      USING ERRCODE = '23514';
  END IF;

  IF lower(trim(coalesce(NEW.name, ''))) <> lower(trim(coalesce(snapshot.name, '')))
     OR lower(trim(coalesce(NEW.role, ''))) <> lower(trim(coalesce(snapshot.role, ''))) THEN
    RAISE EXCEPTION 'Full assessment identity must match the referenced VALU snapshot.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.user_id IS NULL THEN
    NEW.user_id := snapshot.user_id;
  ELSIF NEW.user_id <> snapshot.user_id THEN
    RAISE EXCEPTION 'Full assessment owner must match the referenced VALU snapshot owner.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.require_owned_taster_for_new_valu_assessment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_00_require_owned_taster_for_valu_assessment ON public.valu_assessments;
CREATE TRIGGER trg_00_require_owned_taster_for_valu_assessment
BEFORE INSERT ON public.valu_assessments
FOR EACH ROW
EXECUTE FUNCTION private.require_owned_taster_for_new_valu_assessment();

-- Prevent deletion of source records/accounts from silently nulling or cascading away assessment history.
ALTER TABLE public.valu_assessments
  DROP CONSTRAINT IF EXISTS valu_assessments_taster_id_fkey;
ALTER TABLE public.valu_assessments
  ADD CONSTRAINT valu_assessments_taster_id_fkey
  FOREIGN KEY (taster_id) REFERENCES public.taster_sessions(id) ON DELETE RESTRICT;

ALTER TABLE public.valu_assessments
  DROP CONSTRAINT IF EXISTS valu_assessments_user_id_fkey;
ALTER TABLE public.valu_assessments
  ADD CONSTRAINT valu_assessments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
