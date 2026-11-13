begin;
create or replace function public.submit_taster_with_identity_candidate(
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
  v_lead public.lead_captures%rowtype;
  v_candidate_lead_id uuid;
begin
  if p_submission_key is null then
    raise exception 'submission key is required' using errcode = '22023';
  end if;
  if p_lead_capture_id is null then
    raise exception 'lead registration is required before a snapshot can be submitted' using errcode = '22023';
  end if;
  if pg_catalog.btrim(coalesce(p_name, '')) = '' or pg_catalog.length(pg_catalog.btrim(p_name)) > 200 then
    raise exception 'valid name is required' using errcode = '22023';
  end if;
  if pg_catalog.btrim(coalesce(p_role, '')) = '' or pg_catalog.length(pg_catalog.btrim(p_role)) > 160 then
    raise exception 'valid role is required' using errcode = '22023';
  end if;
  if pg_catalog.length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'valid email is required' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_answers) <> 'object' or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_answers)) <> 15 then
    raise exception 'all 15 snapshot answers are required' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_cluster_scores) <> 'object' then
    raise exception 'cluster scores must be an object' using errcode = '22023';
  end if;

  select * into v_lead
  from public.lead_captures
  where id = p_lead_capture_id
    and pg_catalog.lower(coalesce(email, '')) = v_email
    and full_name = pg_catalog.btrim(p_name)
    and role = pg_catalog.btrim(p_role)
    and raw_payload ->> 'experience' = p_experience
  for share;

  if not found then
    raise exception 'registered lead does not match the snapshot identity' using errcode = '23503';
  end if;

  insert into public.taster_sessions (
    name, role, experience, taster_answers, cluster_scores,
    strongest_cluster, weakest_cluster, taster_version,
    taster_version_source, submission_key, completed_at, lead_capture_id
  ) values (
    pg_catalog.btrim(p_name), pg_catalog.btrim(p_role), p_experience, p_answers, p_cluster_scores,
    p_strongest_cluster, p_weakest_cluster, p_taster_version,
    'server_stamped', p_submission_key, pg_catalog.now(), p_lead_capture_id
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
      raise exception 'submission retry could not be reconciled' using errcode = '40001';
    end if;
    if v_existing.name is distinct from pg_catalog.btrim(p_name)
      or v_existing.role is distinct from pg_catalog.btrim(p_role)
      or v_existing.experience is distinct from p_experience
      or v_existing.taster_answers is distinct from p_answers
      or v_existing.lead_capture_id is distinct from p_lead_capture_id then
      raise exception 'submission key was reused with different snapshot or registration data' using errcode = '22023';
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
    'Registered lead ID anchors this new snapshot. Account ownership is established only after authenticated email confirmation.',
    pg_catalog.now()
  )
  on conflict on constraint taster_identity_candidates_pkey do nothing;

  select c.lead_capture_id into v_candidate_lead_id
  from public.taster_identity_candidates as c
  where c.taster_id = v_id;

  if v_candidate_lead_id is distinct from p_lead_capture_id then
    raise exception 'snapshot identity candidate is linked to a different registration' using errcode = '23505';
  end if;

  return query select v_id, v_created;
end;
$function$;

revoke all on function public.submit_taster_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.submit_taster_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text,uuid) to service_role;
commit;
