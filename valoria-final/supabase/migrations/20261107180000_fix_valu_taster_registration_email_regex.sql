begin;

-- Correct the double-escaped dot in both registration RPC email patterns.
-- Recreate the existing functions from their current definitions, changing
-- only the regex escape so valid email addresses pass database validation.
do $migration$
declare
  v_function record;
  v_definition text;
begin
  for v_function in
    select p.oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'begin_valu_taster_signup',
        'submit_taster_with_identity_candidate'
      )
  loop
    v_definition := pg_catalog.pg_get_functiondef(v_function.oid);

    if pg_catalog.strpos(v_definition, E'\\\\.') = 0 then
      raise exception 'Expected escaped email dot not found in function %', v_function.oid;
    end if;

    v_definition := pg_catalog.replace(v_definition, E'\\\\.', E'\\.');
    execute v_definition;
  end loop;
end;
$migration$;

commit;
