-- Restore the fifth source-approved VALU designation.
-- The 4 November Website Review (page 10) defines scores below 35 as
-- "At the Starting Point". This is a merit designation, not listing eligibility.
-- Marketplace score eligibility remains >= 35. No historical rows are rewritten.

begin;

do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  v_old := $old$
  ELSIF NEW.total_score BETWEEN 35 AND 49 THEN
    NEW.designation := 'Building Foundations';
  ELSE
    NEW.designation := NULL;
  END IF;
$old$;

  v_new := $new$
  ELSIF NEW.total_score BETWEEN 35 AND 49 THEN
    NEW.designation := 'Building Foundations';
  ELSE
    NEW.designation := 'At the Starting Point';
  END IF;
$new$;

  v_definition := pg_catalog.pg_get_functiondef('private.canonicalize_valu_designation_before_write()'::regprocedure);
  if pg_catalog.strpos(v_definition, v_old) > 0 then
    execute pg_catalog.replace(v_definition, v_old, v_new);
  elsif pg_catalog.strpos(v_definition, v_new) = 0 then
    raise exception 'Unexpected canonical designation trigger definition; refusing to overwrite it';
  end if;

  v_old := $old$
      when canonical_valu_index between 35 and 49 then 'Building Foundations'
      else null
    end;
$old$;

  v_new := $new$
      when canonical_valu_index between 35 and 49 then 'Building Foundations'
      else 'At the Starting Point'
    end;
$new$;

  v_definition := pg_catalog.pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);
  if pg_catalog.strpos(v_definition, v_old) > 0 then
    execute pg_catalog.replace(v_definition, v_old, v_new);
  elsif pg_catalog.strpos(v_definition, v_new) = 0 then
    raise exception 'Unexpected marketplace designation projection; refusing to overwrite it';
  end if;

  v_definition := pg_catalog.pg_get_functiondef('private.canonicalize_valu_designation_before_write()'::regprocedure);
  if pg_catalog.strpos(v_definition, 'At the Starting Point') = 0 then
    raise exception 'Assessment designation trigger did not adopt the fifth designation';
  end if;

  v_definition := pg_catalog.pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);
  if pg_catalog.strpos(v_definition, 'At the Starting Point') = 0 then
    raise exception 'Marketplace designation projection did not adopt the fifth designation';
  end if;
end;
$migration$;

commit;
