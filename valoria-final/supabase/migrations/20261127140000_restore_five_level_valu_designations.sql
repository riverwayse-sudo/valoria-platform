-- Restore the fifth source-approved VALU designation.
-- The 4 November Website Review (pages 9–10) defines scores below 35 as
-- "At the Starting Point". This is a merit designation, not listing eligibility.
-- Marketplace score eligibility remains >= 35. No historical rows are rewritten.
--
-- This migration accepts either the four-band staging function definitions or
-- the retired four-band production definitions. It changes function bodies only;
-- it does not alter schema, participant scores, reports, profiles or consent.

begin;

do $migration$
declare
  v_definition text;
  v_old_current text;
  v_old_legacy text;
  v_new text;
begin
  v_old_current := $old_current$
  ELSIF NEW.total_score BETWEEN 80 AND 100 THEN
    NEW.designation := 'Force to Align With';
  ELSIF NEW.total_score BETWEEN 65 AND 79 THEN
    NEW.designation := 'Emerging Force';
  ELSIF NEW.total_score BETWEEN 50 AND 64 THEN
    NEW.designation := 'Developing Professional';
  ELSIF NEW.total_score BETWEEN 35 AND 49 THEN
    NEW.designation := 'Building Foundations';
  ELSE
    NEW.designation := NULL;
  END IF;
$old_current$;

  v_old_legacy := $old_legacy$
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
$old_legacy$;

  v_new := $new$
  ELSIF NEW.total_score BETWEEN 80 AND 100 THEN
    NEW.designation := 'Force to Align With';
  ELSIF NEW.total_score BETWEEN 65 AND 79 THEN
    NEW.designation := 'Emerging Force';
  ELSIF NEW.total_score BETWEEN 50 AND 64 THEN
    NEW.designation := 'Developing Professional';
  ELSIF NEW.total_score BETWEEN 35 AND 49 THEN
    NEW.designation := 'Building Foundations';
  ELSE
    NEW.designation := 'At the Starting Point';
  END IF;
$new$;

  v_definition := pg_catalog.pg_get_functiondef('private.canonicalize_valu_designation_before_write()'::regprocedure);
  if pg_catalog.strpos(v_definition, v_old_current) > 0 then
    execute pg_catalog.replace(v_definition, v_old_current, v_new);
  elsif pg_catalog.strpos(v_definition, v_old_legacy) > 0 then
    execute pg_catalog.replace(v_definition, v_old_legacy, v_new);
  elsif pg_catalog.strpos(v_definition, 'NEW.designation := ''At the Starting Point''') = 0 then
    raise exception 'Unexpected canonical designation trigger definition; refusing to overwrite it';
  end if;

  v_old_current := $old_current$
    canonical_designation := case
      when canonical_valu_index between 80 and 100 then 'Force to Align With'
      when canonical_valu_index between 65 and 79 then 'Emerging Force'
      when canonical_valu_index between 50 and 64 then 'Developing Professional'
      when canonical_valu_index between 35 and 49 then 'Building Foundations'
      else null
    end;
$old_current$;

  v_old_legacy := $old_legacy$
    canonical_designation := case
      when canonical_valu_index between 90 and 100 then 'Elite'
      when canonical_valu_index between 75 and 89 then 'Distinguished'
      when canonical_valu_index between 55 and 74 then 'Proficient'
      when canonical_valu_index between 35 and 54 then 'Standard'
      else null
    end;
$old_legacy$;

  v_new := $new$
    canonical_designation := case
      when canonical_valu_index is null then null
      when canonical_valu_index between 80 and 100 then 'Force to Align With'
      when canonical_valu_index between 65 and 79 then 'Emerging Force'
      when canonical_valu_index between 50 and 64 then 'Developing Professional'
      when canonical_valu_index between 35 and 49 then 'Building Foundations'
      else 'At the Starting Point'
    end;
$new$;

  v_definition := pg_catalog.pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);
  if pg_catalog.strpos(v_definition, v_old_current) > 0 then
    execute pg_catalog.replace(v_definition, v_old_current, v_new);
  elsif pg_catalog.strpos(v_definition, v_old_legacy) > 0 then
    execute pg_catalog.replace(v_definition, v_old_legacy, v_new);
  elsif pg_catalog.strpos(v_definition, 'At the Starting Point') = 0 then
    raise exception 'Unexpected marketplace designation projection; refusing to overwrite it';
  end if;

  v_definition := pg_catalog.pg_get_functiondef('private.canonicalize_valu_designation_before_write()'::regprocedure);
  if pg_catalog.strpos(v_definition, 'At the Starting Point') = 0
     or pg_catalog.strpos(v_definition, 'Force to Align With') = 0
     or pg_catalog.strpos(v_definition, 'Elite') > 0 then
    raise exception 'Assessment designation trigger verification failed';
  end if;

  v_definition := pg_catalog.pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);
  if pg_catalog.strpos(v_definition, 'At the Starting Point') = 0
     or pg_catalog.strpos(v_definition, 'Force to Align With') = 0
     or pg_catalog.strpos(v_definition, 'Elite') > 0 then
    raise exception 'Marketplace designation projection verification failed';
  end if;
end;
$migration$;

commit;
