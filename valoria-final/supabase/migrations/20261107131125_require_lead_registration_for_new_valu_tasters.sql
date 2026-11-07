begin;

alter table public.taster_progress
  add column if not exists lead_capture_id uuid;

alter table public.taster_sessions
  add column if not exists lead_capture_id uuid;

alter table public.taster_identity_candidates
  add column if not exists lead_capture_id uuid;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'taster_progress_lead_capture_id_fkey'
      and conrelid = 'public.taster_progress'::regclass
  ) then
    alter table public.taster_progress
      add constraint taster_progress_lead_capture_id_fkey
      foreign key (lead_capture_id) references public.lead_captures(id)
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'taster_sessions_lead_capture_id_fkey'
      and conrelid = 'public.taster_sessions'::regclass
  ) then
    alter table public.taster_sessions
      add constraint taster_sessions_lead_capture_id_fkey
      foreign key (lead_capture_id) references public.lead_captures(id)
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'taster_identity_candidates_lead_capture_id_fkey'
      and conrelid = 'public.taster_identity_candidates'::regclass
  ) then
    alter table public.taster_identity_candidates
      add constraint taster_identity_candidates_lead_capture_id_fkey
      foreign key (lead_capture_id) references public.lead_captures(id)
      on delete restrict not valid;
  end if;
end
$migration$;

create index if not exists idx_taster_progress_lead_capture_id
  on public.taster_progress(lead_capture_id)
  where lead_capture_id is not null;

create index if not exists idx_taster_sessions_lead_capture_id
  on public.taster_sessions(lead_capture_id)
  where lead_capture_id is not null;

create index if not exists idx_taster_identity_candidates_lead_capture_id
  on public.taster_identity_candidates(lead_capture_id)
  where lead_capture_id is not null;

create or replace function private.require_lead_capture_for_new_taster()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.lead_capture_id is null then
    raise exception 'lead_capture_id is required before a new taster record can be created'
      using errcode = '23502';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_require_lead_capture_for_taster_progress on public.taster_progress;
create trigger trg_require_lead_capture_for_taster_progress
before insert on public.taster_progress
for each row execute function private.require_lead_capture_for_new_taster();

drop trigger if exists trg_require_lead_capture_for_taster_session on public.taster_sessions;
create trigger trg_require_lead_capture_for_taster_session
before insert on public.taster_sessions
for each row execute function private.require_lead_capture_for_new_taster();

create or replace function public.begin_valu_taster_signup(
  p_signup_key uuid,
  p_resume_token_hash text,
  p_name text,
  p_email text,
  p_role text,
  p_experience text,
  p_organisation text default null,
  p_interest text default null,
  p_marketing_consent boolean default false,
  p_privacy_acknowledged boolean default false,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null
)
returns table(lead_capture_id uuid, progress_id uuid, created boolean)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_name text := pg_catalog.btrim(pg_catalog.coalesce(p_name, ''));
  v_email text := pg_catalog.lower(pg_catalog.btrim(pg_catalog.coalesce(p_email, '')));
  v_role text := pg_catalog.btrim(pg_catalog.coalesce(p_role, ''));
  v_organisation text := nullif(pg_catalog.btrim(pg_catalog.coalesce(p_organisation, '')), '');
  v_interest text := nullif(pg_catalog.btrim(pg_catalog.coalesce(p_interest, '')), '');
  v_lead_id uuid;
  v_progress_id uuid;
  v_lead_inserted boolean := false;
  v_progress_inserted boolean := false;
  v_lead public.lead_captures%rowtype;
  v_progress public.taster_progress%rowtype;
begin
  if p_signup_key is null then
    raise exception 'signup reference is required' using errcode = '22023';
  end if;
  if p_resume_token_hash is null or p_resume_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'valid resume-token hash is required' using errcode = '22023';
  end if;
  if v_name = '' or pg_catalog.length(v_name) > 200 then
    raise exception 'valid name is required' using errcode = '22023';
  end if;
  if v_role = '' or pg_catalog.length(v_role) > 160 then
    raise exception 'valid role is required' using errcode = '22023';
  end if;
  if v_email = '' or pg_catalog.length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' then
    raise exception 'valid email is required' using errcode = '22023';
  end if;
  if p_experience is null or pg_catalog.length(pg_catalog.btrim(p_experience)) = 0
    or pg_catalog.length(p_experience) > 80 then
    raise exception 'valid experience band is required' using errcode = '22023';
  end if;
  if pg_catalog.length(pg_catalog.coalesce(p_organisation, '')) > 180
    or pg_catalog.length(pg_catalog.coalesce(p_interest, '')) > 120 then
    raise exception 'registration details exceed the allowed length' using errcode = '22023';
  end if;
  if p_privacy_acknowledged is distinct from true then
    raise exception 'privacy notice acknowledgement is required' using errcode = '22023';
  end if;

  insert into public.lead_captures (
    source, external_id, full_name, email, role, organisation, interest,
    source_detail, utm_source, utm_medium, utm_campaign,
    raw_payload, consent, consent_basis
  ) values (
    'valu_taster_signup',
    'valu-taster:' || p_signup_key::text,
    v_name,
    v_email,
    v_role,
    v_organisation,
    v_interest,
    'VALU taster registration',
    nullif(pg_catalog.btrim(pg_catalog.coalesce(p_utm_source, '')), ''),
    nullif(pg_catalog.btrim(pg_catalog.coalesce(p_utm_medium, '')), ''),
    nullif(pg_catalog.btrim(pg_catalog.coalesce(p_utm_campaign, '')), ''),
    pg_catalog.jsonb_build_object(
      'experience', p_experience,
      'privacy_notice_acknowledged', true,
      'privacy_notice_acknowledged_at', pg_catalog.clock_timestamp(),
      'marketing_consent', pg_catalog.coalesce(p_marketing_consent, false)
    ),
    pg_catalog.coalesce(p_marketing_consent, false),
    case when pg_catalog.coalesce(p_marketing_consent, false)
      then 'explicit_valu_taster_marketing_opt_in'
      else null
    end
  )
  on conflict (source, external_id) do nothing
  returning id into v_lead_id;

  if v_lead_id is not null then
    v_lead_inserted := true;
  else
    select * into v_lead
    from public.lead_captures
    where source = 'valu_taster_signup'
      and external_id = 'valu-taster:' || p_signup_key::text
    for update;

    if not found then
      raise exception 'registration retry could not be reconciled' using errcode = '40001';
    end if;

    if v_lead.full_name is distinct from v_name
      or pg_catalog.lower(pg_catalog.coalesce(v_lead.email, '')) is distinct from v_email
      or v_lead.role is distinct from v_role
      or v_lead.organisation is distinct from v_organisation
      or v_lead.interest is distinct from v_interest
      or v_lead.consent is distinct from pg_catalog.coalesce(p_marketing_consent, false)
      or v_lead.raw_payload ->> 'experience' is distinct from p_experience then
      raise exception 'signup reference was reused with different registration details' using errcode = '22023';
    end if;

    v_lead_id := v_lead.id;
  end if;

  insert into public.taster_progress (
    resume_token_hash, name, role, experience, email,
    current_question, answers, status, expires_at, lead_capture_id
  ) values (
    p_resume_token_hash, v_name, v_role, p_experience, v_email,
    0, '{}'::jsonb, 'in_progress', pg_catalog.now() + interval '30 days', v_lead_id
  )
  on conflict (resume_token_hash) do nothing
  returning id into v_progress_id;

  if v_progress_id is not null then
    v_progress_inserted := true;
  else
    select * into v_progress
    from public.taster_progress
    where resume_token_hash = p_resume_token_hash
    for update;

    if not found then
      raise exception 'saved progress retry could not be reconciled' using errcode = '40001';
    end if;

    if v_progress.lead_capture_id is not null and v_progress.lead_capture_id is distinct from v_lead_id then
      raise exception 'saved progress is already linked to a different registration' using errcode = '23505';
    end if;
    if v_progress.email is not null and pg_catalog.lower(v_progress.email) is distinct from v_email then
      raise exception 'saved progress email does not match this registration' using errcode = '22023';
    end if;
    if v_progress.name is not null and v_progress.name is distinct from v_name then
      raise exception 'saved progress name does not match this registration' using errcode = '22023';
    end if;
    if v_progress.role is not null and v_progress.role is distinct from v_role then
      raise exception 'saved progress role does not match this registration' using errcode = '22023';
    end if;
    if v_progress.experience is not null and v_progress.experience is distinct from p_experience then
      raise exception 'saved progress experience does not match this registration' using errcode = '22023';
    end if;

    update public.taster_progress
    set lead_capture_id = v_lead_id,
        name = pg_catalog.coalesce(name, v_name),
        role = pg_catalog.coalesce(role, v_role),
        experience = pg_catalog.coalesce(experience, p_experience),
        email = pg_catalog.coalesce(email, v_email),
        updated_at = pg_catalog.now()
    where id = v_progress.id
    returning id into v_progress_id;
  end if;

  return query select v_lead_id, v_progress_id, (v_lead_inserted or v_progress_inserted);
end;
$function$;

revoke all on function public.begin_valu_taster_signup(uuid,text,text,text,text,text,text,text,boolean,boolean,text,text,text) from public, anon, authenticated;
grant execute on function public.begin_valu_taster_signup(uuid,text,text,text,text,text,text,text,boolean,boolean,text,text,text) to service_role;

drop function if exists public.submit_taster_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text);

create function public.submit_taster_with_identity_candidate(
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
  v_email text := pg_catalog.lower(pg_catalog.btrim(pg_catalog.coalesce(p_email, '')));
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
  if pg_catalog.btrim(pg_catalog.coalesce(p_name, '')) = '' or pg_catalog.length(pg_catalog.btrim(p_name)) > 200 then
    raise exception 'valid name is required' using errcode = '22023';
  end if;
  if pg_catalog.btrim(pg_catalog.coalesce(p_role, '')) = '' or pg_catalog.length(pg_catalog.btrim(p_role)) > 160 then
    raise exception 'valid role is required' using errcode = '22023';
  end if;
  if pg_catalog.length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' then
    raise exception 'valid email is required' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_answers) <> 'object' or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_answers)) <> 9 then
    raise exception 'all 9 snapshot answers are required' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_cluster_scores) <> 'object' then
    raise exception 'cluster scores must be an object' using errcode = '22023';
  end if;

  select * into v_lead
  from public.lead_captures
  where id = p_lead_capture_id
    and pg_catalog.lower(pg_catalog.coalesce(email, '')) = v_email
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

  select lead_capture_id into v_candidate_lead_id
  from public.taster_identity_candidates
  where taster_id = v_id;

  if v_candidate_lead_id is distinct from p_lead_capture_id then
    raise exception 'snapshot identity candidate is linked to a different registration' using errcode = '23505';
  end if;

  return query select v_id, v_created;
end;
$function$;

revoke all on function public.submit_taster_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.submit_taster_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text,uuid) to service_role;

commit;