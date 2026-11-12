-- Enforce current public-profile consent and suppress internal identity/access fields
-- from the public marketplace RPC. Only the derived roster projection is refreshed;
-- participant profiles, assessment records and consent records are not modified.

CREATE OR REPLACE FUNCTION private.is_marketplace_profile_public(p_professional_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.professional_profiles pp
    join public.marketplace_public_roster roster
      on roster.professional_id = pp.id
    where pp.id = p_professional_id
      and pp.visibility in ('public','marketplace')
      and pp.listing_status = 'listed'
      and coalesce(pp.eligible_for_listing, false) = true
      and coalesce(pp.is_test, false) = false
      and pp.revoked_at is null
      and not private.is_professional_listing_blocked(pp.id)
      and exists (
        select 1
        from (
          select acknowledgement.acknowledgement_version
          from public.professional_profile_acknowledgements acknowledgement
          where acknowledgement.professional_id = pp.id
            and acknowledgement.acknowledgement_type = 'profile_submission'
          order by
            acknowledgement.acknowledged_at desc nulls last,
            acknowledgement.created_at desc,
            acknowledgement.id desc
          limit 1
        ) latest_ack
        where latest_ack.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'
      )
      and (
        (
          roster.assessment_access = 'basic'
          and exists (
            select 1
            from public.taster_sessions t
            where t.user_id = pp.id
              and t.completed_at is not null
          )
        )
        or
        (
          roster.assessment_access = 'full'
          and pp.profile_complete is true
          and coalesce(pp.valu_index, 0) >= 35
          and private.valu_assessment_is_current(pp.id)
          and exists (
            select 1
            from public.professional_capabilities capability
            where capability.professional_id = pp.id
              and capability.is_active is true
          )
          and not exists (
            select 1
            from public.professional_capabilities capability
            where capability.professional_id = pp.id
              and capability.is_active is true
              and (
                capability.eligible_for_listing is distinct from true
                or capability.eligibility_status is distinct from 'listed'
                or jsonb_array_length(coalesce(capability.missing_requirements, '[]'::jsonb)) > 0
              )
          )
        )
      )
  );
$function$


CREATE OR REPLACE FUNCTION public.refresh_marketplace_public_roster(p_professional_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  ) into is_revoked;

  if is_revoked then return; end if;

  select coalesce((
    select acknowledgement.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'
    from public.professional_profile_acknowledgements acknowledgement
    where acknowledgement.professional_id = p_professional_id
      and acknowledgement.acknowledgement_type = 'profile_submission'
    order by
      acknowledgement.acknowledged_at desc nulls last,
      acknowledgement.created_at desc,
      acknowledgement.id desc
    limit 1
  ), false)
  into public_consent_ok;

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
    select v.total_score, v.cluster_scores, v.designation
      into canonical_valu_index, canonical_cluster_scores, canonical_designation
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
      when canonical_valu_index >= 90 then 'Elite'
      when canonical_valu_index >= 75 then 'Distinguished'
      when canonical_valu_index >= 55 then 'Proficient'
      when canonical_valu_index >= 35 then 'Standard'
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
      skills, topics, programme_types, availability, valu_index, cluster_scores,
      designation, fee_range, salary_expectation, availability_status,
      projection_refreshed_at, assessment_access, assessment_summary
    )
    values(
      p.id, p.display_name, p.bio, p.location, p.languages, p.headline, p.current_job_title,
      caps[1],
      case when 'talent'=any(caps) then 'candidate' when 'speaker'=any(caps) then 'speaker' when 'facilitator'=any(caps) then 'facilitator' end,
      caps, selected_caps, p.atb_id, p.display_initials, p.photo_url, p.industry, p.skills, p.topics,
      p.programme_types, p.availability, canonical_valu_index, canonical_cluster_scores, canonical_designation,
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
     and public_consent_ok
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
end;
$function$


CREATE OR REPLACE FUNCTION private.get_marketplace_public_roster_v1_impl(p_professional_id uuid DEFAULT NULL::uuid, p_atb_id text DEFAULT NULL::text)
 RETURNS TABLE(professional_id uuid, full_name text, location text, languages text[], headline text, current_job_title text, capability text, track text, capabilities text[], selected_capabilities text[], atb_id text, display_initials text, photo_url text, industry text, skills text[], topics text[], programme_types text[], availability text[], valu_index integer, cluster_scores jsonb, assessment_summary text, designation text, availability_status text, assessment_access text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    r.professional_id,
    null::text as full_name,
    r.location,
    r.languages,
    r.headline,
    r.current_job_title,
    r.capability,
    r.track,
    r.capabilities,
    r.selected_capabilities,
    r.atb_id,
    null::text as display_initials,
    r.photo_url,
    r.industry,
    r.skills,
    r.topics,
    r.programme_types,
    r.availability,
    r.valu_index,
    r.cluster_scores,
    r.assessment_summary,
    case
      when r.valu_index >= 90 then 'Elite'
      when r.valu_index >= 75 then 'Distinguished'
      when r.valu_index >= 55 then 'Proficient'
      when r.valu_index >= 35 then 'Standard'
      else null
    end as designation,
    r.availability_status,
    null::text as assessment_access
  from public.marketplace_public_roster as r
  where (p_professional_id is null or r.professional_id = p_professional_id)
    and (p_atb_id is null or r.atb_id = p_atb_id)
    and not (p_professional_id is not null and p_atb_id is not null)
    and private.is_marketplace_profile_public(r.professional_id)
  order by r.valu_index desc nulls last, r.atb_id asc;
$function$


DO $$
DECLARE
  profile_id uuid;
  leak_count bigint;
BEGIN
  -- Re-evaluate the derived public roster against current consent, visibility and eligibility.
  FOR profile_id IN SELECT id FROM public.professional_profiles LOOP
    PERFORM public.refresh_marketplace_public_roster(profile_id);
  END LOOP;

  SELECT count(*)
    INTO leak_count
    FROM public.get_marketplace_public_roster_v1(NULL, NULL)
   WHERE full_name IS NOT NULL
      OR display_initials IS NOT NULL
      OR assessment_access IS NOT NULL;
  IF leak_count > 0 THEN
    RAISE EXCEPTION 'Public marketplace RPC exposed internal identity or assessment-access fields';
  END IF;

  SELECT count(*)
    INTO leak_count
    FROM public.get_marketplace_public_roster_v1(NULL, NULL) roster
    JOIN public.professional_profiles profile
      ON profile.id = roster.professional_id
   WHERE profile.visibility NOT IN ('public', 'marketplace')
      OR profile.listing_status <> 'listed'
      OR profile.is_test IS DISTINCT FROM false
      OR profile.revoked_at IS NOT NULL
      OR NOT private.is_marketplace_profile_public(profile.id);
  IF leak_count > 0 THEN
    RAISE EXCEPTION 'Public marketplace RPC returned a profile that is not currently public and eligible';
  END IF;
END;
$$;
