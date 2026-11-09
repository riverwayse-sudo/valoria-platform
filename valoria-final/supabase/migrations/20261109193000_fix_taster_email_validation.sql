-- Repair over-escaped email validation in the public taster registration
-- and submission RPCs. The previous SQL literal stored two backslashes before
-- the dot, which PostgreSQL's regex engine interpreted as a literal backslash.
-- [.] matches the email-domain separator without SQL/string escaping ambiguity.
--
-- This migration is safe to re-run against a database already repaired manually:
-- it only replaces the legacy two-backslash pattern when it is still present.

begin;

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_fixed_definition text;
begin
  foreach v_signature in array array[
    'public.begin_valu_taster_signup(uuid,text,text,text,text,text,text,text,boolean,boolean,text,text,text)'::regprocedure,
    'public.submit_taster_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text,uuid)'::regprocedure
  ]
  loop
    v_definition := pg_catalog.pg_get_functiondef(v_signature);
    v_fixed_definition := pg_catalog.replace(
      v_definition,
      pg_catalog.repeat(pg_catalog.chr(92), 2) || '.',
      '[.]'
    );

    if v_fixed_definition is distinct from v_definition then
      execute v_fixed_definition;
    elsif pg_catalog.strpos(v_definition, '[.]') = 0 then
      raise exception 'Expected legacy email-validation pattern was not found in %', v_signature;
    end if;
  end loop;
end;
$migration$;

commit;
