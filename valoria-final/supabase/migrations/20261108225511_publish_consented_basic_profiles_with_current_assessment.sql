CREATE OR REPLACE FUNCTION private.is_basic_public_profile_ready(p_professional_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.professional_profiles p
    WHERE p.id = p_professional_id
      AND p.is_test IS FALSE
      AND p.revoked_at IS NULL
      AND NULLIF(BTRIM(p.display_name), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(p.headline, p.current_job_title)), '') IS NOT NULL
      AND NULLIF(BTRIM(p.atb_id), '') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.professional_capabilities c
        WHERE c.professional_id = p.id AND c.is_active IS TRUE
      )
      AND (
        (
          COALESCE(p.valu_index, 0) >= 35
          AND private.valu_assessment_is_current(p.id)
        )
        OR EXISTS (
          SELECT 1 FROM public.taster_sessions t
          WHERE t.user_id = p.id AND t.completed_at IS NOT NULL
        )
      )
      AND (
        SELECT a.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'
        FROM public.professional_profile_acknowledgements a
        WHERE a.professional_id = p.id
          AND a.acknowledgement_type = 'profile_submission'
        ORDER BY a.acknowledged_at DESC NULLS LAST, a.created_at DESC, a.id DESC
        LIMIT 1
      ) IS TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.professional_listing_events e
        WHERE e.professional_id = p.id
          AND e.event_type IN ('ADMIN_REVOKED', 'ADMIN_SUSPENDED')
          AND e.created_at = (
            SELECT MAX(e2.created_at)
            FROM public.professional_listing_events e2
            WHERE e2.professional_id = p.id
          )
      )
      AND NOT COALESCE((
        SELECT c.admin_revoked
        FROM public.professional_listing_controls c
        WHERE c.professional_id = p.id
      ), FALSE)
  );
$function$;

DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  v_definition := pg_get_functiondef('private.sync_professional_listing_status(uuid)'::regprocedure);

  v_old := '  basic_taster_ok boolean := false;';
  v_new := '  basic_taster_ok boolean := false;
  basic_profile_ok boolean := false;';
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate sync function declaration for basic_profile_ok patch';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '  full_listing_ready := private.is_full_marketplace_listing_ready(p_professional_id);';
  v_new := '  basic_profile_ok := private.is_basic_public_profile_ready(p_professional_id);
  full_listing_ready := private.is_full_marketplace_listing_ready(p_professional_id);';
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate sync readiness assignment';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '  if (full_listing_ready or basic_taster_ok) and not blocked then';
  v_new := '  if (full_listing_ready or basic_profile_ok or basic_taster_ok) and not blocked then';
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate sync listing decision';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;

  v_definition := pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);

  v_old := $old$
  select * into t
    from public.taster_sessions
   where user_id = p_professional_id and completed_at is not null
   order by completed_at desc, created_at desc
   limit 1;

  if t.id is not null and p.listing_status = 'listed' and p.visibility in ('public','marketplace','registered_only') then
    insert into public.marketplace_public_roster(
      professional_id, full_name, bio, location, languages, headline, current_job_title,
      capability, track, capabilities, selected_capabilities, atb_id, display_initials, photo_url, industry,
      skills, topics, programme_types, availability, valu_index, cluster_scores,
      designation, fee_range, salary_expectation, availability_status,
      projection_refreshed_at, assessment_access, assessment_summary
    )
    values(
      p.id, coalesce(nullif(trim(p.display_name),''), nullif(trim(t.name),'')), null,
      p.location, p.languages, coalesce(nullif(trim(p.headline),''), nullif(trim(t.role),'')),
      p.current_job_title, 'talent', 'candidate', array['talent']::text[], array['talent']::text[], p.atb_id,
      p.display_initials, p.photo_url, p.industry, p.skills, null, p.programme_types,
      p.availability, null, null, 'BASIC', p.fee_range, p.salary_expectation,
      p.availability_status, now(), 'basic', null
    );
  end if;
$old$;

  v_new := $new$
  select * into t
    from public.taster_sessions
   where user_id = p_professional_id and completed_at is not null
   order by completed_at desc, created_at desc
   limit 1;

  if private.is_basic_public_profile_ready(p_professional_id)
     and p.listing_status = 'listed'
     and p.visibility in ('public','marketplace','registered_only') then
    insert into public.marketplace_public_roster(
      professional_id, full_name, bio, location, languages, headline, current_job_title,
      capability, track, capabilities, selected_capabilities, atb_id, display_initials, photo_url, industry,
      skills, topics, programme_types, availability, valu_index, cluster_scores,
      designation, fee_range, salary_expectation, availability_status,
      projection_refreshed_at, assessment_access, assessment_summary
    )
    values(
      p.id, coalesce(nullif(trim(p.display_name),''), nullif(trim(t.name),'')), null,
      p.location, p.languages,
      coalesce(nullif(trim(p.headline),''), nullif(trim(p.current_job_title),''), nullif(trim(t.role),'')),
      p.current_job_title,
      selected_caps[1],
      case
        when 'talent' = any(selected_caps) then 'candidate'
        when 'speaker' = any(selected_caps) then 'speaker'
        when 'facilitator' = any(selected_caps) then 'facilitator'
        else null
      end,
      selected_caps, selected_caps, p.atb_id,
      p.display_initials, p.photo_url, p.industry, p.skills, p.topics, p.programme_types,
      p.availability, null, null, 'BASIC', p.fee_range, p.salary_expectation,
      p.availability_status, now(), 'basic', null
    );
  end if;
$new$;

  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate basic roster projection block';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END;
$migration$;

DO $reconcile$
DECLARE
  target_id uuid;
BEGIN
  FOR target_id IN
    SELECT p.id
    FROM public.professional_profiles p
    WHERE p.is_test IS FALSE
      AND EXISTS (
        SELECT 1 FROM public.professional_profile_acknowledgements a
        WHERE a.professional_id = p.id
          AND a.acknowledgement_type = 'profile_submission'
          AND a.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'
      )
      AND private.is_basic_public_profile_ready(p.id)
  LOOP
    PERFORM private.sync_professional_listing_status(target_id);
    PERFORM public.refresh_marketplace_public_roster(target_id);
  END LOOP;
END;
$reconcile$;
