-- Keep direct professional_profiles and certificate reads aligned with the
-- marketplace roster policy. Admin suspensions/revocations and eligibility flags
-- must block every public read path, including Basic listings.

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
      and coalesce(profile.eligible_for_listing, false) = true
      and not private.is_professional_listing_blocked(profile.id)
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

revoke all on function private.is_public_profile_eligible(uuid) from public, anon, authenticated;
revoke all on function private.can_read_public_professional_certificate(uuid) from public, anon, authenticated;
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

comment on function private.is_public_profile_eligible(uuid) is
'Checks current Full or Basic listing requirements, explicit public consent, public visibility, eligibility, and admin suspension/revocation state.';
