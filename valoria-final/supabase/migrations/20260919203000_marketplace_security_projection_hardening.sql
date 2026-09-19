-- Production close-out hardening for marketplace public projections and capability RLS.
-- Safe to re-run.

alter view if exists public.marketplace_professionals set (security_invoker = true);
alter view if exists public.marketplace_professionals_general set (security_invoker = true);
alter view if exists public.public_marketplace_professionals set (security_invoker = true);
alter view if exists public.professional_profiles_public set (security_invoker = true);

grant select on public.marketplace_professionals to anon, authenticated;
grant select on public.marketplace_professionals_general to anon, authenticated;
grant select on public.public_marketplace_professionals to anon, authenticated;
grant select on public.professional_profiles_public to anon, authenticated;

drop policy if exists professional_capabilities_owner_select on public.professional_capabilities;
drop policy if exists professional_capabilities_public_listed_read on public.professional_capabilities;

create policy professional_capabilities_public_listed_read
  on public.professional_capabilities
  for select
  to anon
  using (
    is_active = true
    and eligible_for_listing = true
    and eligibility_status = 'listed'
  );

create policy professional_capabilities_owner_select
  on public.professional_capabilities
  for select
  to authenticated
  using (
    professional_id = (select auth.uid())
    or is_valoria_admin()
    or (
      is_active = true
      and eligible_for_listing = true
      and eligibility_status = 'listed'
    )
  );

grant select on public.professional_capabilities to anon, authenticated;