-- Restore public marketplace reads only for profiles that have explicitly
-- acknowledged the current public-visibility terms and remain listed.
-- Registered-only, unlisted, test, revoked, and stale-consent profiles stay hidden.

drop policy if exists marketplace_public_read on public.marketplace_public_roster;

create policy marketplace_public_read
on public.marketplace_public_roster
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.professional_profiles p
    where p.id = marketplace_public_roster.professional_id
      and coalesce(p.is_test, false) = false
      and p.listing_status = 'listed'
      and coalesce(p.eligible_for_listing, false) = true
      and p.visibility = 'public'
      and p.revoked_at is null
      and coalesce((
        select plc.admin_revoked
        from public.professional_listing_controls plc
        where plc.professional_id = p.id
      ), false) = false
      and exists (
        select 1
        from (
          select a.acknowledgement_version
          from public.professional_profile_acknowledgements a
          where a.professional_id = p.id
            and a.acknowledgement_type = 'profile_submission'
          order by
            a.acknowledged_at desc nulls last,
            a.created_at desc,
            a.id desc
          limit 1
        ) latest_ack
        where latest_ack.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'
      )
      and not exists (
        select 1
        from public.professional_listing_events e
        where e.professional_id = p.id
          and e.event_type in ('ADMIN_REVOKED', 'ADMIN_SUSPENDED')
          and e.created_at = (
            select max(e2.created_at)
            from public.professional_listing_events e2
            where e2.professional_id = p.id
          )
      )
  )
);

comment on policy marketplace_public_read on public.marketplace_public_roster is
'Public marketplace reads are limited to non-test, currently listed and eligible professionals with public visibility and the latest explicit public-profile acknowledgement. Registered-only and revoked profiles remain private.';
