begin;

-- New Taster registrations must use the active v4.2 nine-answer instrument.
-- Existing rows keep their stored version, answer map and progress unchanged.
alter table public.taster_progress
  alter column taster_version set default '4.2',
  alter column total_questions set default 9;

-- Preserve the historical 15-answer format only for already-started legacy
-- sessions. Current v4.1/v4.2 sessions remain nine-answer sessions.
-- Rewrite the existing function definition in place so its ownership checks,
-- identity verification, idempotency and grants remain unchanged.
do $migration$
declare
  v_signature regprocedure :=
    'public.submit_taster_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text,uuid)'::regprocedure;
  v_definition text;
  v_original text;
begin
  v_definition := pg_catalog.pg_get_functiondef(v_signature);
  v_original := v_definition;

  v_definition := pg_catalog.replace(
    v_definition,
    ')) <> 15 then',
    ')) <> (CASE WHEN p_taster_version IN (''legacy-15'', ''4.0'') THEN 15 ELSE 9 END) then'
  );
  v_definition := pg_catalog.replace(
    v_definition,
    ')) <> 9 THEN',
    ')) <> (CASE WHEN p_taster_version IN (''legacy-15'', ''4.0'') THEN 15 ELSE 9 END) THEN'
  );
  v_definition := pg_catalog.replace(
    v_definition,
    'all 15 snapshot answers are required',
    'the saved snapshot answer set is incomplete'
  );
  v_definition := pg_catalog.replace(
    v_definition,
    'all 9 snapshot answers are required',
    'the saved snapshot answer set is incomplete'
  );

  if pg_catalog.strpos(v_definition, 'CASE WHEN p_taster_version IN') = 0 then
    raise exception 'Could not identify the existing Taster answer-count guard; no function change was applied';
  end if;

  if v_definition is distinct from v_original then
    execute v_definition;
  end if;

  v_definition := pg_catalog.pg_get_functiondef(v_signature);
  if pg_catalog.strpos(v_definition, 'CASE WHEN p_taster_version IN') = 0 then
    raise exception 'Version-aware Taster answer-count guard was not installed';
  end if;
end;
$migration$;

commit;
