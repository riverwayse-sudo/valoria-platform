-- Expose a consent-safe experience band on the already-approved public roster.
-- Exact years remain private; only the broad band is projected for directory filtering.

ALTER TABLE public.marketplace_public_roster
  ADD COLUMN IF NOT EXISTS seniority_band text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'marketplace_public_roster_seniority_band_check'
       AND conrelid = 'public.marketplace_public_roster'::regclass
  ) THEN
    ALTER TABLE public.marketplace_public_roster
      ADD CONSTRAINT marketplace_public_roster_seniority_band_check
      CHECK (
        seniority_band IS NULL OR seniority_band IN (
          '0_3_years',
          '4_8_years',
          '9_14_years',
          '15_plus_years'
        )
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_marketplace_public_roster_seniority_band()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  years integer;
BEGIN
  SELECT pp.experience_years
    INTO years
    FROM public.professional_profiles pp
   WHERE pp.id = NEW.professional_id;

  NEW.seniority_band := CASE
    WHEN years IS NULL OR years < 0 THEN NULL
    WHEN years <= 3 THEN '0_3_years'
    WHEN years <= 8 THEN '4_8_years'
    WHEN years <= 14 THEN '9_14_years'
    ELSE '15_plus_years'
  END;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_marketplace_public_roster_seniority_band() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_marketplace_public_roster_seniority_band() FROM anon;
REVOKE ALL ON FUNCTION public.set_marketplace_public_roster_seniority_band() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_marketplace_public_roster_seniority_band() TO service_role;

DROP TRIGGER IF EXISTS set_marketplace_public_roster_seniority_band
  ON public.marketplace_public_roster;

CREATE TRIGGER set_marketplace_public_roster_seniority_band
BEFORE INSERT OR UPDATE OF professional_id
ON public.marketplace_public_roster
FOR EACH ROW
EXECUTE FUNCTION public.set_marketplace_public_roster_seniority_band();

UPDATE public.marketplace_public_roster r
   SET seniority_band = CASE
     WHEN pp.experience_years IS NULL OR pp.experience_years < 0 THEN NULL
     WHEN pp.experience_years <= 3 THEN '0_3_years'
     WHEN pp.experience_years <= 8 THEN '4_8_years'
     WHEN pp.experience_years <= 14 THEN '9_14_years'
     ELSE '15_plus_years'
   END
  FROM public.professional_profiles pp
 WHERE pp.id = r.professional_id;

CREATE INDEX IF NOT EXISTS marketplace_public_roster_seniority_band_idx
  ON public.marketplace_public_roster (seniority_band);

COMMENT ON COLUMN public.marketplace_public_roster.seniority_band IS
  'Broad experience band derived from the professional profile; only projected for approved public roster entries.';
