create or replace function private.valu_assessment_is_current(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select exists (
    select 1
    from public.professional_profiles profile
    join lateral (
      select assessment.total_score, assessment.completed_at
      from public.valu_assessments assessment
      where assessment.user_id = profile.id
        and assessment.completed_at is not null
      order by assessment.completed_at desc, assessment.created_at desc, assessment.id desc
      limit 1
    ) latest on true
    where profile.id = p_professional_id
      and coalesce(profile.is_test, false) = false
      and profile.revoked_at is null
      and coalesce(profile.valu_index, 0) >= 35
      and profile.valu_index = latest.total_score
      and profile.assessment_completed_at = latest.completed_at
      and profile.assessment_expires_at is not null
      and profile.assessment_expires_at > now()
      and coalesce(latest.total_score, 0) >= 35
  );
$function$;
