-- Align all live designation writers with the approved VALU points bands.
-- 80-100 Force to Align With
-- 65-79 Emerging Force
-- 50-64 Developing Professional
-- 35-49 Building Foundations
-- Below 35: no merit designation.
--
-- Marketplace score eligibility remains 35 points and is separate from listing
-- approval. This migration changes function definitions only; it does not
-- rewrite participant scores, answers, reports, or existing designation rows.
-- Existing records are audited separately before any historical reclassification.

begin;

do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  -- Canonicalize designation whenever a full VALU assessment is written.
  v_old := $old$
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
$old$;

  v_new := $new$
  IF NEW.total_score IS NULL THEN
    NEW.designation := NULL;
  ELSIF NEW.total_score >= 80 THEN
    NEW.designation := 'Force to Align With';
  ELSIF NEW.total_score >= 65 THEN
    NEW.designation := 'Emerging Force';
  ELSIF NEW.total_score >= 50 THEN
    NEW.designation := 'Developing Professional';
  ELSIF NEW.total_score >= 35 THEN
    NEW.designation := 'Building Foundations';
  ELSE
    NEW.designation := NULL;
  END IF;
$new$;

  v_definition := pg_catalog.pg_get_functiondef('private.canonicalize_valu_designation_before_write()'::regprocedure);
  if pg_catalog.strpos(v_definition, v_old) > 0 then
    execute pg_catalog.replace(v_definition, v_old, v_new);
  elsif pg_catalog.strpos(v_definition, v_new) = 0 then
    raise exception 'Unexpected canonicalize_valu_designation_before_write definition; refusing to overwrite it';
  end if;

  -- The public roster writer derives its label from the canonical points too.
  v_old := $old$
    canonical_designation := case
      when canonical_valu_index between 90 and 100 then 'Elite'
      when canonical_valu_index between 75 and 89 then 'Distinguished'
      when canonical_valu_index between 55 and 74 then 'Proficient'
      when canonical_valu_index between 35 and 54 then 'Standard'
      else null
    end;
$old$;

  v_new := $new$
    canonical_designation := case
      when canonical_valu_index between 80 and 100 then 'Force to Align With'
      when canonical_valu_index between 65 and 79 then 'Emerging Force'
      when canonical_valu_index between 50 and 64 then 'Developing Professional'
      when canonical_valu_index between 35 and 49 then 'Building Foundations'
      else null
    end;
$new$;

  v_definition := pg_catalog.pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);
  if pg_catalog.strpos(v_definition, v_old) > 0 then
    execute pg_catalog.replace(v_definition, v_old, v_new);
  elsif pg_catalog.strpos(v_definition, v_new) = 0 then
    raise exception 'Unexpected refresh_marketplace_public_roster definition; refusing to overwrite it';
  end if;

  -- Fail closed if either writer does not now contain the complete contract.
  v_definition := pg_catalog.pg_get_functiondef('private.canonicalize_valu_designation_before_write()'::regprocedure);
  if pg_catalog.strpos(v_definition, 'Force to Align With') = 0
     or pg_catalog.strpos(v_definition, 'Emerging Force') = 0
     or pg_catalog.strpos(v_definition, 'Developing Professional') = 0
     or pg_catalog.strpos(v_definition, 'Building Foundations') = 0
     or pg_catalog.strpos(v_definition, 'Elite') > 0 then
    raise exception 'Canonical assessment designation trigger verification failed';
  end if;

  v_definition := pg_catalog.pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);
  if pg_catalog.strpos(v_definition, 'Force to Align With') = 0
     or pg_catalog.strpos(v_definition, 'Emerging Force') = 0
     or pg_catalog.strpos(v_definition, 'Developing Professional') = 0
     or pg_catalog.strpos(v_definition, 'Building Foundations') = 0
     or pg_catalog.strpos(v_definition, 'Elite') > 0 then
    raise exception 'Canonical marketplace roster designation verification failed';
  end if;
end;
$migration$;

commit;
