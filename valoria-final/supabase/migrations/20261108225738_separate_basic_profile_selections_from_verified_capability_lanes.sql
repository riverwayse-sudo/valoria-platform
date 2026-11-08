DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  v_definition := pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);

  v_old := $old$
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
$old$;

  v_new := $new$
  if private.is_basic_public_profile_ready(p_professional_id)
     and p.listing_status = 'listed'
     and p.visibility in ('public','marketplace','registered_only') then
    -- Basic cards may display declared selections, but only evidence-approved
    -- capabilities are exposed as searchable/listable directory lanes.
    caps := array(
      select distinct pc.capability
      from public.professional_capabilities pc
      where pc.professional_id = p.id
        and pc.is_active is true
        and pc.eligible_for_listing is true
        and pc.eligibility_status = 'listed'
        and pc.capability = any(selected_caps)
      order by pc.capability
    );
    if coalesce(cardinality(caps), 0) = 0 then
      caps := '{}'::text[];
    end if;

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
      caps[1],
      case
        when 'talent' = any(caps) then 'candidate'
        when 'speaker' = any(caps) then 'speaker'
        when 'facilitator' = any(caps) then 'facilitator'
        else null
      end,
      caps, selected_caps, p.atb_id,
      p.display_initials, p.photo_url, p.industry, p.skills, p.topics, p.programme_types,
      p.availability, null, null, 'BASIC', p.fee_range, p.salary_expectation,
      p.availability_status, now(), 'basic', null
    );
  end if;
$new$;

  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate Basic roster projection for capability distinction';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END;
$migration$;

DO $reconcile$
DECLARE target_id uuid;
BEGIN
  FOR target_id IN
    SELECT professional_id FROM public.marketplace_public_roster
    WHERE assessment_access = 'basic'
  LOOP
    PERFORM public.refresh_marketplace_public_roster(target_id);
  END LOOP;
END;
$reconcile$;
