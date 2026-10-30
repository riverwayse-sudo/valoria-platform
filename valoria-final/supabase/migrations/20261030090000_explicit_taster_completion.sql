-- Make taster completion an explicit, self-contained contract.
--
-- The full-assessment handoff refuses to start unless the linked snapshot has
-- taster_sessions.completed_at set ("Complete your VALU snapshot first.").
-- Nothing in the repository ever wrote that column: submit_taster_with_identity_candidate
-- inserts the row without it and the taster-progress 'complete' action only closes
-- the resumable taster_progress row. Completion therefore depended on an
-- out-of-band column default that no migration declared, that CI never exercised
-- and that a fresh environment did not reproduce — the exact condition that left
-- a confirmed participant unable to continue.
--
-- The RPC now stamps completed_at itself when it creates the snapshot, so a
-- submitted snapshot is always a completed snapshot regardless of environment
-- defaults. The column default is set too, so any future insert path inherits the
-- same contract.
--
-- Only the INSERT changes. Every other rule (answer count, identity, ownership,
-- retry reconciliation) is preserved verbatim. No stored snapshot is modified.

alter table public.taster_sessions
  alter column completed_at set default now();

comment on column public.taster_sessions.completed_at is
  'Set when the nine-question opening session is submitted. Required before the full-assessment handoff is issued.';

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
    taster_version_source, submission_key, completed_at
  ) VALUES (
    btrim(p_name), btrim(p_role), p_experience, p_answers, p_cluster_scores,
    p_strongest_cluster, p_weakest_cluster, p_taster_version,
    'server_stamped', p_submission_key, now()
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

-- Recover snapshots that were already submitted but never stamped complete.
--
-- A participant who finished the opening nine, confirmed their email and then
-- could not continue is in exactly this state: the snapshot exists with its nine
-- answers, but completed_at is null, so the handoff refuses to start.
--
-- A public.taster_sessions row is only ever created by
-- submit_taster_with_identity_candidate, which rejects anything other than nine
-- complete answers, so a row carrying a taster_answers object is positive proof
-- that the snapshot was submitted. The update is idempotent (completed_at is
-- null is the guard) and touches only the missing completion stamp: answers,
-- cluster scores, ownership and every other column are preserved untouched.
UPDATE public.taster_sessions t
SET completed_at = t.created_at
WHERE t.completed_at IS NULL
  AND jsonb_typeof(t.taster_answers) = 'object';

