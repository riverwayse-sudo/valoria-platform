-- Canonicalize designation metadata at the database write boundary.
-- This affects only new rows and updates that explicitly change total_score or
-- designation. Existing historical rows are not rewritten.

CREATE OR REPLACE FUNCTION private.canonicalize_valu_designation_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $function$
BEGIN
  IF NEW.total_score IS NULL THEN
    NEW.designation := NULL;
  ELSIF NEW.total_score BETWEEN 90 AND 100 THEN
    NEW.designation := 'Elite';
  ELSIF NEW.total_score BETWEEN 75 AND 89 THEN
    NEW.designation := 'Distinguished';
  ELSIF NEW.total_score BETWEEN 55 AND 74 THEN
    NEW.designation := 'Proficient';
  ELSIF NEW.total_score BETWEEN 35 AND 54 THEN
    NEW.designation := 'Standard';
  ELSE
    NEW.designation := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.canonicalize_valu_designation_before_write()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_canonicalize_valu_designation_before_write
  ON public.valu_assessments;

CREATE TRIGGER trg_canonicalize_valu_designation_before_write
BEFORE INSERT OR UPDATE OF total_score, designation
ON public.valu_assessments
FOR EACH ROW
EXECUTE FUNCTION private.canonicalize_valu_designation_before_write();

COMMENT ON FUNCTION private.canonicalize_valu_designation_before_write() IS
  'Derives VALU v4 merit designation from total_score for new assessments and explicit score/designation updates. Does not rewrite untouched historical rows.';

DO $assert$
DECLARE
  v_trigger_exists boolean;
  v_function_definition text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.valu_assessments'::regclass
      AND tgname = 'trg_canonicalize_valu_designation_before_write'
      AND NOT tgisinternal
  ) INTO v_trigger_exists;

  v_function_definition := pg_get_functiondef(
    'private.canonicalize_valu_designation_before_write()'::regprocedure
  );

  IF NOT v_trigger_exists
     OR position('NEW.total_score BETWEEN 90 AND 100' IN v_function_definition) = 0
     OR position('NEW.total_score BETWEEN 75 AND 89' IN v_function_definition) = 0
     OR position('NEW.total_score BETWEEN 55 AND 74' IN v_function_definition) = 0
     OR position('NEW.total_score BETWEEN 35 AND 54' IN v_function_definition) = 0 THEN
    RAISE EXCEPTION 'Canonical VALU designation write guard was not installed correctly';
  END IF;

  IF has_function_privilege('anon', 'private.canonicalize_valu_designation_before_write()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.canonicalize_valu_designation_before_write()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client roles must not directly execute the canonical designation trigger function';
  END IF;
END;
$assert$;
