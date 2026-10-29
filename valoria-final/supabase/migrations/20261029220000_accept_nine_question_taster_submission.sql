-- Accept the approved nine-question taster.
--
-- The taster was reduced from fifteen questions to the nine approved questions,
-- but submit_taster_with_identity_candidate still rejected anything other than
-- exactly fifteen answers. The handler submits the nine answers it collected, so
-- the RPC raised 'all 15 snapshot answers are required' and the API surfaced a
-- generic save failure: the ninth answer could not be persisted, no taster_id
-- was issued and the participant could not reach account confirmation.
--
-- Only the answer-count guard changes. Every other rule is preserved verbatim so
-- retry reconciliation, identity-candidate creation and ownership stay identical.
CREATE OR REPLACE FUNCTION public.submit_taster_with_identity_candidate(
  p_submission_key uuid,
  p_name text,
  p_role text,
  p_experience text,
  p_email text,
  p_answers jsonb,
  p_cluster_scores jsonb,
  p_strongest_cluster text,
  p_weakest_cluster text,
  p_taster_version text
)
RETURNS TABLE(taster_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_id uuid;
  v_created boolean := false;
  v_email text;
  v_existing public.taster_sessions%ROWTYPE;
BEGIN
  v_email := lower(btrim(coalesce(p_email, '')));
  IF p_submission_key IS NULL THEN
    RAISE EXCEPTION 'submission key is required' USING ERRCODE = '22023';
  END IF;
  IF btrim(coalesce(p_name, '')) = '' OR length(btrim(p_name)) > 200 THEN
    RAISE EXCEPTION 'valid name is required' USING ERRCODE = '22023';
  END IF;
  IF btrim(coalesce(p_role, '')) = '' OR length(btrim(p_role)) > 160 THEN
    RAISE EXCEPTION 'valid role is required' USING ERRCODE = '22023';
  END IF;
  IF length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'valid email is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_answers) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_answers)) <> 9 THEN
    RAISE EXCEPTION 'all 9 snapshot answers are required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_cluster_scores) <> 'object' THEN
    RAISE EXCEPTION 'cluster scores must be an object' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.taster_sessions (
    name, role, experience, taster_answers, cluster_scores,
    strongest_cluster, weakest_cluster, taster_version,
    taster_version_source, submission_key
  ) VALUES (
    btrim(p_name), btrim(p_role), p_experience, p_answers, p_cluster_scores,
    p_strongest_cluster, p_weakest_cluster, p_taster_version,
    'server_stamped', p_submission_key
  )
  ON CONFLICT (submission_key) WHERE submission_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    v_created := true;
  ELSE
    SELECT * INTO v_existing
    FROM public.taster_sessions
    WHERE submission_key = p_submission_key
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'submission retry could not be reconciled' USING ERRCODE = '40001';
    END IF;
    IF v_existing.name IS DISTINCT FROM btrim(p_name)
      OR v_existing.role IS DISTINCT FROM btrim(p_role)
      OR v_existing.experience IS DISTINCT FROM p_experience
      OR v_existing.taster_answers IS DISTINCT FROM p_answers
    THEN
      RAISE EXCEPTION 'submission key was reused with different snapshot data' USING ERRCODE = '22023';
    END IF;
    v_id := v_existing.id;
  END IF;

  INSERT INTO public.taster_identity_candidates (
    taster_id, candidate_name, candidate_role, candidate_email,
    evidence_source_count, evidence_sources, evidence_refs,
    same_contact_taster_count, identity_status, linked_user_id,
    resolution_notes, last_reconciled_at
  ) VALUES (
    v_id, btrim(p_name), btrim(p_role), v_email,
    0, ARRAY[]::text[], '[]'::jsonb, 1, 'unresolved', NULL,
    'New snapshot. Submitted email is a contact hint only until a confirmed authenticated account claims it.',
    now()
  )
  ON CONFLICT ON CONSTRAINT taster_identity_candidates_pkey DO NOTHING;

  RETURN QUERY SELECT v_id, v_created;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_taster_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_taster_with_identity_candidate(uuid,text,text,text,text,jsonb,jsonb,text,text,text) TO service_role;
