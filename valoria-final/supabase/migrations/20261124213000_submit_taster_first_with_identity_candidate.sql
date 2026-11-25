begin;

-- Keep the existing submit_taster_with_identity_candidate contract intact.
-- The staging environment still has participants on its historical 15-answer
-- path. The new 9-answer Taster-first route gets its own isolated RPC so neither
-- format can break the other's submissions.
create or replace function public.submit_taster_first_with_identity_candidate(
  p_submission_key uuid,
  p_name text,
  p_role text,
  p_experience text,
  p_email text,
  p_answers jsonb,
  p_cluster_scores jsonb,
  p_strongest_cluster text,
  p_weakest_cluster text,
  p_taster_version text,
  p_lead_capture_id uuid
)
returns table(taster_id uuid, created boolean)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_id uuid;
  v_created boolean := false;
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_existing public.taster_sessions%rowtype;
  v_candidate_lead_id uuid;
begin
  if p_submission_key is null or p_lead_capture_id is null then
    raise exception 'submission and lead references are required' using errcode = '22023';
  end if;
  if pg_catalog.btrim(coalesce(p_name, '')) = '' or pg_catalog.length(pg_catalog.btrim(p_name)) > 200 then
    raise exception 'valid name is required' using errcode = '22023';
  end if;
  if pg_catalog.btrim(coalesce(p_role, '')) = '' or pg_catalog.length(pg_catalog.btrim(p_role)) > 160 then
    raise exception 'valid role is required' using errcode = '22023';
  end if;
  if pg_catalog.length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'valid email is required' using errcode = '22023';
  end if;
  if p_taster_version is distinct from '4.2' then
    raise exception 'this endpoint accepts only the approved 4.2 Taster format' using errcode = '22023';
  end if;
  if p_strongest_cluster is distinct from 'I' or p_weakest_cluster is distinct from 'I' then
    raise exception 'the 4.2 Taster reports Intelligence only' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_answers) <> 'object'
    or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_answers)) <> 9
    or exists (
      select 1
      from pg_catalog.jsonb_each(p_answers) answer
      where answer.key !~ '^[0-8]$'
        or pg_catalog.jsonb_typeof(answer.value) <> 'number'
        or (answer.value #>> '{}') !~ '^[0-3]$'
    ) then
    raise exception 'all nine valid Taster answers are required' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_cluster_scores) <> 'object'
    or pg_catalog.jsonb_typeof(p_cluster_scores -> 'I') <> 'number' then
    raise exception 'valid Intelligence points are required' using errcode = '22023';
  end if;

  perform 1
  from public.lead_captures
  where id = p_lead_capture_id
    and pg_catalog.lower(coalesce(email, '')) = v_email
    and full_name = pg_catalog.btrim(p_name)
    and role = pg_catalog.btrim(p_role)
    and raw_payload ->> 'experience' = p_experience
  for share;
  if not found then
    raise exception 'registered lead does not match the Taster identity' using errcode = '23503';
  end if;

  insert into public.taster_sessions (
    name, role, experience, taster_answers, cluster_scores,
    strongest_cluster, weakest_cluster, taster_version,
    taster_version_source, submission_key, completed_at, lead_capture_id
  ) values (
    pg_catalog.btrim(p_name), pg_catalog.btrim(p_role), p_experience, p_answers, p_cluster_scores,
    'I', 'I', '4.2', 'server_stamped', p_submission_key, pg_catalog.now(), p_lead_capture_id
  )
  on conflict (submission_key) where submission_key is not null do nothing
  returning id into v_id;

  if v_id is not null then
    v_created := true;
  else
    select * into v_existing
    from public.taster_sessions
    where submission_key = p_submission_key
    for update;
    if not found then
      raise exception 'Taster submission retry could not be reconciled' using errcode = '40001';
    end if;
    if v_existing.name is distinct from pg_catalog.btrim(p_name)
      or v_existing.role is distinct from pg_catalog.btrim(p_role)
      or v_existing.experience is distinct from p_experience
      or v_existing.taster_answers is distinct from p_answers
      or v_existing.lead_capture_id is distinct from p_lead_capture_id
      or v_existing.taster_version is distinct from '4.2' then
      raise exception 'submission key was reused with different Taster data' using errcode = '22023';
    end if;
    v_id := v_existing.id;
  end if;

  insert into public.taster_identity_candidates (
    taster_id, lead_capture_id, candidate_name, candidate_role, candidate_email,
    evidence_source_count, evidence_sources, evidence_refs,
    same_contact_taster_count, identity_status, linked_user_id,
    resolution_notes, last_reconciled_at
  ) values (
    v_id, p_lead_capture_id, pg_catalog.btrim(p_name), pg_catalog.btrim(p_role), v_email,
    0, array[]::text[], '[]'::jsonb, 1, 'unresolved', null,
    'Pre-account Taster-first session. Account ownership is established only after authenticated email confirmation.',
    pg_catalog.now()
  )
  on conflict on constraint taster_identity_candidates_pkey do nothing;

  select candidate.lead_capture_id into v_candidate_lead_id
  from public.taster_identity_candidates as candidate
  where candidate.taster_id = v_id;

  if v_candidate_lead_id is distinct from p_lead_capture_id then
    raise exception 'Taster identity candidate is linked to a different registration' using errcode = '23505';
  end if;

  return query select v_id, v_created;
end;
$function$;

revoke all on function public.submit_taster_first_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.submit_taster_first_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text,uuid) to service_role;

commit;
