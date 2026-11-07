-- Keep the public roster read path closed unless the professional has
-- explicitly opted into public marketplace visibility.
-- Basic listings require a completed taster; full listings require the
-- current full assessment, complete profile and all active capabilities eligible.

create or replace function private.is_marketplace_profile_public(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.professional_profiles pp
    join public.marketplace_public_roster roster
      on roster.professional_id = pp.id
    where pp.id = p_professional_id
      and pp.visibility = 'public'
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
$function$;

revoke all on function private.is_marketplace_profile_public(uuid) from public, anon, authenticated;
grant execute on function private.is_marketplace_profile_public(uuid) to anon, authenticated;

drop policy if exists marketplace_public_read on public.marketplace_public_roster;

create policy marketplace_public_read
on public.marketplace_public_roster
for select
to anon, authenticated
using (private.is_marketplace_profile_public(professional_id));

comment on function private.is_marketplace_profile_public(uuid) is
'Returns true only for non-test, non-revoked, publicly visible, listed professionals with current explicit public-profile acknowledgement. Basic access requires a completed taster; full access requires a current full VALU assessment, complete profile and eligible active capabilities.';

comment on policy marketplace_public_read on public.marketplace_public_roster is
'Allows public marketplace reads only when private.is_marketplace_profile_public confirms current visibility consent and assessment-specific listing requirements.';
