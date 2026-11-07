CREATE OR REPLACE FUNCTION private.sync_professional_listing_status(p_professional_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  p record;
  cap record;
  cap_result jsonb;
  capability_results jsonb := '[]'::jsonb;
  assessment_ok boolean := false;
  basic_taster_ok boolean := false;
  public_consent_ok boolean := false;
  blocked boolean := false;
  next_status text;
  listed_capability_count integer := 0;
begin
  select * into p
  from public.professional_profiles
  where id = p_professional_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'professional_id', p_professional_id);
  end if;

  assessment_ok := coalesce(p.is_test, false) = false
    and coalesce(p.valu_index, 0) >= 35
    and private.valu_assessment_is_current(p_professional_id);

  basic_taster_ok :=
    coalesce(p.is_test, false) = false
    and exists (
      select 1 from public.taster_sessions t
      where t.user_id = p_professional_id and t.completed_at is not null
    );

  select coalesce((
    select acknowledgement.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'
    from public.professional_profile_acknowledgements acknowledgement
    where acknowledgement.professional_id = p_professional_id
      and acknowledgement.acknowledgement_type = 'profile_submission'
    order by acknowledgement.acknowledged_at desc nulls last,
             acknowledgement.created_at desc,
             acknowledgement.id desc
    limit 1
  ), false) into public_consent_ok;

  select
    (p.revoked_at is not null)
    or exists (
      select 1 from public.professional_listing_events e
      where e.professional_id = p_professional_id
        and e.event_type in ('ADMIN_REVOKED', 'ADMIN_SUSPENDED')
        and e.created_at = (
          select max(e2.created_at)
          from public.professional_listing_events e2
          where e2.professional_id = p_professional_id
        )
    )
    or coalesce((
      select plc.admin_revoked
      from public.professional_listing_controls plc
      where plc.professional_id = p_professional_id
    ), false)
    into blocked;

  for cap in
    select pc.capability
    from public.professional_capabilities pc
    where pc.professional_id = p_professional_id and pc.is_active = true
    order by pc.capability
  loop
    cap_result := private.sync_professional_capability(p_professional_id, cap.capability);
    capability_results := capability_results || jsonb_build_array(cap_result);
  end loop;

  select count(*) into listed_capability_count
  from public.professional_capabilities pc
  where pc.professional_id = p_professional_id
    and pc.is_active = true
    and pc.eligible_for_listing = true
    and pc.eligibility_status = 'listed';

  if (assessment_ok or basic_taster_ok) and not blocked then
    next_status := 'listed';
  elsif p.listing_status in ('listed', 'pending') then
    next_status := 'unlisted';
  else
    next_status := p.listing_status;
  end if;

  update public.professional_profiles
  set eligible_for_listing = (next_status = 'listed'),
      listing_status = next_status,
      visibility = case
        when next_status = 'listed' and public_consent_ok then 'public'
        when next_status = 'listed' then 'registered_only'
        when next_status = 'unlisted' and visibility = 'public' then 'registered_only'
        else visibility
      end,
      listed_at = case
        when next_status = 'listed' and listed_at is null then now()
        when next_status <> 'listed' then null
        else listed_at
      end,
      updated_at = now()
  where id = p_professional_id;

  return jsonb_build_object(
    'ok', true,
    'professional_id', p_professional_id,
    'eligible_for_listing', (next_status = 'listed'),
    'listing_status', next_status,
    'full_assessment_complete', assessment_ok,
    'basic_taster_complete', basic_taster_ok,
    'blocked', blocked,
    'listed_capability_count', listed_capability_count,
    'capability_results', capability_results
  );
end;
$function$
;

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

  selected_caps := array(
    select normalized.capability
      from (
        select distinct case when lower(x) = 'candidate' then 'talent' else lower(x) end as capability
          from unnest(coalesce(p.active_tracks, '{}'::text[])) x
         where lower(x) in ('talent','candidate','speaker','facilitator')
      ) normalized
     order by case normalized.capability when 'talent' then 1 when 'speaker' then 2 when 'facilitator' then 3 else 9 end
  );
  if coalesce(cardinality(selected_caps), 0) = 0 then
    selected_caps := '{}'::text[];
  end if;

  assessment_ok := coalesce(p.valu_index, 0) >= 35
    and private.valu_assessment_is_current(p_professional_id);

  if assessment_ok and p.visibility in ('public','marketplace','registered_only') and p.listing_status = 'listed' then
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
    canonical_designation := coalesce(canonical_designation, p.designation);

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
end;
$function$
;

-- Reconcile all profiles after enforcing the Full-tier 35-point threshold.
do $$
declare target_id uuid;
begin
  for target_id in select id from public.professional_profiles loop
    perform private.sync_professional_listing_status(target_id);
  end loop;
end;
$$;
