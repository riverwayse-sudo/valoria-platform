drop policy if exists marketplace_public_read on public.marketplace_public_roster;
create policy marketplace_public_read
  on public.marketplace_public_roster
  for select
  to anon, authenticated
  using (false);

drop policy if exists pp_public_read_listed on public.professional_profiles;
create policy pp_public_read_listed
  on public.professional_profiles
  for select
  to anon
  using (false);

drop policy if exists pp_owner_admin_read on public.professional_profiles;
create policy pp_owner_admin_read
  on public.professional_profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or public.is_valoria_admin()
  );

drop policy if exists certificates_public_verified_read on public.professional_certificates;
create policy certificates_public_verified_read
  on public.professional_certificates
  for select
  to anon
  using (false);
