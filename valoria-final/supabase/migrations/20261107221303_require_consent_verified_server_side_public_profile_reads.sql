-- Record the consent-verified direct profile and certificate read policies
-- already applied to staging. Public profile reads require the latest explicit
-- visibility acknowledgement and assessment-specific listing eligibility.

create or replace function private.has_public_profile_consent(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog'
as $function$
  select coalesce((
    select acknowledgement.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'
    from public.professional_profile_acknowledgements acknowledgement
    where acknowledgement.professional_id = p_professional_id
      and acknowledgement.acknowledgement_type = 'profile_submission'
    order by acknowledgement.acknowledged_at desc nulls last,
             acknowledgement.created_at desc,
             acknowledgement.id desc
    limit 1
  ), false);
$function$;

create or replace function private.is_public_profile_eligible(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog'
as $function$
  select exists (
    select 1
    from public.marketplace_public_roster roster
    join public.professional_profiles profile
      on profile.id = roster.professional_id
    where roster.professional_id = p_professional_id
      and (
        (
          roster.assessment_access = 'full'
          and cardinality(coalesce(roster.capabilities, '{}'::text[])) > 0
          and profile.valu_index >= 35
          and roster.valu_index = profile.valu_index
          and roster.assessment_summary is not null
          and length(btrim(roster.assessment_summary)) >= 12
          and profile.profile_complete is true
          and private.is_full_marketplace_listing_ready(profile.id)
        )
        or
        (
          roster.assessment_access = 'basic'
          and exists (
            select 1
            from public.taster_sessions taster
            where taster.user_id = profile.id
              and taster.completed_at is not null
          )
          and coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(roster.full_name), '')) is not null
          and coalesce(
            nullif(btrim(profile.headline), ''),
            nullif(btrim(profile.current_job_title), ''),
            nullif(btrim(roster.headline), ''),
            nullif(btrim(roster.current_job_title), '')
          ) is not null
        )
      )
      and profile.is_test is false
      and profile.visibility = 'public'
      and profile.listing_status = 'listed'
      and profile.revoked_at is null
  );
$function$;

create or replace function private.can_read_public_professional_certificate(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog'
as $function$
  select
    private.has_public_profile_consent(p_professional_id)
    and private.is_public_profile_eligible(p_professional_id);
$function$;

revoke all on function private.has_public_profile_consent(uuid) from public, anon, authenticated;
revoke all on function private.is_public_profile_eligible(uuid) from public, anon, authenticated;
revoke all on function private.can_read_public_professional_certificate(uuid) from public, anon, authenticated;
grant execute on function private.has_public_profile_consent(uuid) to anon, authenticated;
grant execute on function private.is_public_profile_eligible(uuid) to anon, authenticated;
grant execute on function private.can_read_public_professional_certificate(uuid) to anon, authenticated;

drop policy if exists pp_public_read_consent_verified on public.professional_profiles;
create policy pp_public_read_consent_verified
on public.professional_profiles
for select
to anon, authenticated
using (
  is_test is false
  and visibility = 'public'
  and listing_status = 'listed'
  and revoked_at is null
  and private.has_public_profile_consent(id)
  and private.is_public_profile_eligible(id)
);

drop policy if exists certificates_public_verified_read on public.professional_certificates;
create policy certificates_public_verified_read
on public.professional_certificates
for select
to anon, authenticated
using (
  revoked_at is null
  and private.can_read_public_professional_certificate(professional_id)
);

comment on function private.has_public_profile_consent(uuid) is
'Returns true only when the latest profile_submission acknowledgement is the current explicit public visibility consent version.';

comment on function private.is_public_profile_eligible(uuid) is
'Checks the current Full or Basic assessment-specific public profile requirements, public visibility and non-revoked/non-test state.';

comment on function private.can_read_public_professional_certificate(uuid) is
'Allows certificate reads only when the professional has current public profile consent and meets public profile eligibility requirements.';

comment on policy pp_public_read_consent_verified on public.professional_profiles is
'Allows limited public profile column reads only for consented, eligible, listed, visible and non-test/non-revoked professionals.';

comment on policy certificates_public_verified_read on public.professional_certificates is
'Allows certificate reads only when the associated professional has current public visibility consent and meets public listing requirements.';
