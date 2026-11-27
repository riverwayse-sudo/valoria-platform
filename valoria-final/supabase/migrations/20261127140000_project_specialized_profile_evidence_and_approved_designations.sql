-- Owner-approved VALU merit bands: 90/75/55/35; below 35 has no public merit designation.
-- Specialized fields are consent-gated; no assessment answers, scores, or historical designation rows are rewritten.
-- Extend the consent-gated public roster with capability-specific evidence.
-- General VALU insight remains separate from Talent, Speaker and Facilitator evidence.
ALTER TABLE public.marketplace_public_roster
  ADD COLUMN IF NOT EXISTS experience_years integer,
  ADD COLUMN IF NOT EXISTS facilitation_topics text[],
  ADD COLUMN IF NOT EXISTS format_capabilities text[],
  ADD COLUMN IF NOT EXISTS audience_sizes text[],
  ADD COLUMN IF NOT EXISTS past_events jsonb,
  ADD COLUMN IF NOT EXISTS past_clients jsonb;

COMMENT ON COLUMN public.marketplace_public_roster.experience_years IS 'Consent-gated professional experience used in Talent capability views.';
COMMENT ON COLUMN public.marketplace_public_roster.facilitation_topics IS 'Consent-gated specialist topics used in Facilitator capability views.';
COMMENT ON COLUMN public.marketplace_public_roster.format_capabilities IS 'Consent-gated delivery formats used in Speaker and Facilitator capability views.';
COMMENT ON COLUMN public.marketplace_public_roster.audience_sizes IS 'Consent-gated audience experience used in Speaker and Facilitator capability views.';
COMMENT ON COLUMN public.marketplace_public_roster.past_events IS 'Consent-gated speaking engagement evidence; public projection only.';
COMMENT ON COLUMN public.marketplace_public_roster.past_clients IS 'Consent-gated facilitation client/programme evidence; public projection only.';

CREATE OR REPLACE FUNCTION private.canonicalize_valu_designation_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
  IF NEW.total_score IS NULL THEN
    NEW.designation := NULL;
  ELSIF NEW.total_score BETWEEN 90 AND 100 THEN
    NEW.designation := 'Elite';
  ELSIF NEW.total_score BETWEEN 75 AND 89 THEN
    NEW.designation := 'Distinguished';
  ELSIF NEW.total_score BETWEEN 55 AND 74 THEN
    NEW.designation := 'Proficient';
  ELSIF NEW.total_score BETWEEN 35 AND 54 THEN
    NEW.designation := 'Standard';
  ELSE
    NEW.designation := NULL;
  END IF;

  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.refresh_marketplace_public_roster(p_professional_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  p record;
  caps text[];
  selected_caps text[];
  is_revoked boolean := false;
  assessment_ok boolean := false;
  public_consent_ok boolean := false;
  t record;
  canonical_valu_index numeric;
  canonical_cluster_scores jsonb;
  canonical_designation text;
  valid_dimension_count integer := 0;
  strongest_dimension text;
  weakest_dimension text;
  descriptor_phrase text;
  strongest_score numeric;
  weakest_score numeric;
  assessment_summary text;
begin
  delete from public.marketplace_public_roster where professional_id = p_professional_id;

  select pp.*, u.user_type account_user_type
    into p
    from public.professional_profiles pp
    left join public.users u on u.id = pp.id
   where pp.id = p_professional_id;

  -- Preserve this explicitly approved marketplace account without changing its admin role.
  -- All other non-professional account types remain excluded.
  if p.id is null or coalesce(p.is_test, false) is true or (
    coalesce(p.account_user_type, 'professional') <> 'professional'
    and p_professional_id <> '68a5e7d8-e373-4bb5-82bd-c88ad509784c'::uuid
  ) then
    return;
  end if;

  select (p.revoked_at is not null) or exists (
    select 1
      from public.professional_listing_events e
     where e.professional_id = p_professional_id
       and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
       and e.created_at = (
         select max(e2.created_at)
           from public.professional_listing_events e2
          where e2.professional_id = p_professional_id
       )
  ) or coalesce((
    select controls.admin_revoked
    from public.professional_listing_controls controls
    where controls.professional_id = p_professional_id
  ), false) into is_revoked;

  if is_revoked then return; end if;

  selected_caps := array(
    select ordered.capability
      from (
        select distinct capability.capability,
          case capability.capability when 'talent' then 1 when 'speaker' then 2 when 'facilitator' then 3 else 9 end as sort_order
        from public.professional_capabilities capability
        where capability.professional_id = p.id
          and capability.is_active is true
          and capability.capability in ('talent','speaker','facilitator')
      ) ordered
     order by ordered.sort_order
  );
  if coalesce(cardinality(selected_caps), 0) = 0 then
    selected_caps := '{}'::text[];
  end if;

  -- Full assessment access is independent of capability-specific listing readiness.
  assessment_ok := private.valu_assessment_is_current(p_professional_id);

  public_consent_ok := private.has_public_profile_consent(p_professional_id);

  if assessment_ok and public_consent_ok and p.visibility in ('public','marketplace') and p.listing_status = 'listed' then
    -- A selected track is not, by itself, permission to appear in that directory.
    -- Project only capabilities whose readiness engine has explicitly approved listing.
    caps := array(
      select distinct normalized.capability
        from (
          select case when lower(x) = 'candidate' then 'talent' else lower(x) end as capability
            from unnest(coalesce(p.active_tracks, '{}'::text[])) x
           where lower(x) in ('talent','candidate','speaker','facilitator')
        ) normalized
        join public.professional_capabilities pc
          on pc.professional_id = p.id
         and pc.capability = normalized.capability
         and pc.is_active = true
         and pc.eligible_for_listing = true
         and pc.eligibility_status = 'listed'
    );
    -- General marketplace presence is independent of capability readiness.
    -- Keep a qualifying full-assessment professional discoverable in All professionals
    -- even when no selected capability is currently eligible. Empty caps intentionally
    -- produce NULL capability/track values and do not grant a Talent category listing.
    if coalesce(cardinality(caps), 0) > 0 then
      caps := array(
        select x from unnest(caps) x
         order by case x when 'talent' then 1 when 'speaker' then 2 when 'facilitator' then 3 else 9 end
      );
    else
      caps := '{}'::text[];
    end if;

    -- Preserve the live canonical VALU Index projection from the latest current assessment.
    select v.total_score, v.cluster_scores
      into canonical_valu_index, canonical_cluster_scores
      from public.valu_assessments v
     where v.user_id = p_professional_id
       and v.completed_at is not null
       and coalesce(v.total_score, 0) >= 35
       and (v.expires_at is null or v.expires_at > now())
     order by v.completed_at desc, v.created_at desc
     limit 1;

    -- Retain an already-projected verified result if legacy ownership linkage is incomplete.
    canonical_valu_index := coalesce(canonical_valu_index, p.valu_index);
    canonical_cluster_scores := coalesce(canonical_cluster_scores, p.cluster_scores);

    canonical_designation := case
      when canonical_valu_index between 80 and 100 then 'Elite'
      when canonical_valu_index between 65 and 79 then 'Distinguished'
      when canonical_valu_index between 50 and 64 then 'Proficient'
      when canonical_valu_index between 35 and 49 then 'Standard'
      else null
    end;

    -- Derive public summary only from structured PRIME scores, never participant-authored text.
    if jsonb_typeof(canonical_cluster_scores) = 'object' then
      select count(*) into valid_dimension_count
        from jsonb_each_text(canonical_cluster_scores) s
       where s.key in ('P','R','I','M','E')
         and s.value ~ '^[0-9]+([.][0-9]+)?$';

      if valid_dimension_count = 5 then
        select case s.key
                 when 'P' then 'Presence' when 'R' then 'Relationships'
                 when 'I' then 'Intelligence' when 'M' then 'Mastery'
                 when 'E' then 'Enterprise'
               end, s.value::numeric
          into strongest_dimension, strongest_score
          from jsonb_each_text(canonical_cluster_scores) s
         where s.key in ('P','R','I','M','E')
           and s.value ~ '^[0-9]+([.][0-9]+)?$'
         order by s.value::numeric desc, array_position(array['P','R','I','M','E'], s.key)
         limit 1;

        select case s.key
                 when 'P' then 'Presence' when 'R' then 'Relationships'
                 when 'I' then 'Intelligence' when 'M' then 'Mastery'
                 when 'E' then 'Enterprise'
               end, s.value::numeric
          into weakest_dimension, weakest_score
          from jsonb_each_text(canonical_cluster_scores) s
         where s.key in ('P','R','I','M','E')
           and s.value ~ '^[0-9]+([.][0-9]+)?$'
         order by s.value::numeric asc, array_position(array['P','R','I','M','E'], s.key)
         limit 1;

        descriptor_phrase := case strongest_dimension
          when 'Presence' then 'A presence-led professional'
          when 'Relationships' then 'A relationship-centred professional'
          when 'Intelligence' then 'An analytically oriented professional'
          when 'Mastery' then 'A mastery-focused professional'
          when 'Enterprise' then 'An enterprise-minded professional'
        end;

        assessment_summary := case
          when strongest_score = weakest_score
            then 'A well-balanced capability profile across the five PRIME dimensions.'
          else descriptor_phrase || ', with further development in ' || weakest_dimension || '.'
        end;
      end if;
    end if;

    insert into public.marketplace_public_roster(
      professional_id, full_name, bio, location, languages, headline, current_job_title,
      capability, track, capabilities, selected_capabilities, atb_id, display_initials, photo_url, industry,
      skills, topics, programme_types, experience_years, facilitation_topics, format_capabilities, audience_sizes, past_events, past_clients, availability, valu_index, cluster_scores,
      designation, fee_range, salary_expectation, availability_status,
      projection_refreshed_at, assessment_access, assessment_summary
    )
    values(
      p.id, p.display_name, p.bio, p.location, p.languages, p.headline, p.current_job_title,
      caps[1],
      case when 'talent'=any(caps) then 'candidate' when 'speaker'=any(caps) then 'speaker' when 'facilitator'=any(caps) then 'facilitator' end,
      caps, selected_caps, p.atb_id, p.display_initials, p.photo_url, p.industry, p.skills, p.topics,
      p.programme_types, p.experience_years, p.facilitation_topics, p.format_capabilities, p.audience_sizes, p.past_events, p.past_clients, p.availability, canonical_valu_index, canonical_cluster_scores, canonical_designation,
      p.fee_range, p.salary_expectation, p.availability_status, now(), 'full', assessment_summary
    );
    return;
  end if;

  select * into t
    from public.taster_sessions
   where user_id = p_professional_id and completed_at is not null
   order by completed_at desc, created_at desc
   limit 1;

  if private.is_basic_public_profile_ready(p_professional_id)
     and p.listing_status = 'listed'
     and p.visibility in ('public','marketplace') then
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
      skills, topics, programme_types, experience_years, facilitation_topics, format_capabilities, audience_sizes, past_events, past_clients, availability, valu_index, cluster_scores,
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
      p.display_initials, p.photo_url, p.industry, p.skills, p.topics, p.programme_types, p.experience_years, p.facilitation_topics, p.format_capabilities, p.audience_sizes, p.past_events, p.past_clients,
      p.availability, null, null, null, p.fee_range, p.salary_expectation,
      p.availability_status, now(), 'basic', null
    );
  end if;
end;
$function$;


-- Preserve historical assessment and profile designation columns. This migration updates
-- future writes and the consent-gated public projection only; no historical rows are rewritten.

-- Rebuild only the existing listed, public, non-revoked profiles through the consent gate.
DO $$
DECLARE profile_row record;
BEGIN
  FOR profile_row IN
    SELECT id
    FROM public.professional_profiles
    WHERE listing_status = 'listed'
      AND visibility IN ('public', 'marketplace')
      AND revoked_at IS NULL
      AND COALESCE(is_test, false) = false
  LOOP
    PERFORM public.refresh_marketplace_public_roster(profile_row.id);
  END LOOP;
END;
$$;
