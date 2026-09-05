-- Continuous closeout: repository migration record for production hardening.
-- Idempotent: indexes use IF NOT EXISTS; policies are created only when absent.

create index if not exists facilitation_engagements_professional_id_idx
  on public.facilitation_engagements(professional_id);
create index if not exists facilitation_history_professional_id_idx
  on public.facilitation_history(professional_id);
create index if not exists marketplace_governance_events_actor_id_idx
  on public.marketplace_governance_events(actor_id);
create index if not exists marketplace_governance_events_professional_id_idx
  on public.marketplace_governance_events(professional_id);
create index if not exists professional_documents_verified_by_idx
  on public.professional_documents(verified_by);
create index if not exists professional_listing_controls_revoked_by_idx
  on public.professional_listing_controls(revoked_by);
create index if not exists speaking_engagements_professional_id_idx
  on public.speaking_engagements(professional_id);
create index if not exists speaking_history_professional_id_idx
  on public.speaking_history(professional_id);

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='professional_capabilities' and policyname='professional_capabilities_owner_all') then
    create policy professional_capabilities_owner_all on public.professional_capabilities
      for all to authenticated using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='facilitation_history' and policyname='facilitation_history_owner_all') then
    create policy facilitation_history_owner_all on public.facilitation_history
      for all to authenticated using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='facilitation_engagements' and policyname='facilitation_engagements_owner_all') then
    create policy facilitation_engagements_owner_all on public.facilitation_engagements
      for all to authenticated using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='speaking_history' and policyname='speaking_history_owner_all') then
    create policy speaking_history_owner_all on public.speaking_history
      for all to authenticated using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='speaking_engagements' and policyname='speaking_engagements_owner_all') then
    create policy speaking_engagements_owner_all on public.speaking_engagements
      for all to authenticated using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='professional_listing_controls' and policyname='professional_listing_controls_owner_read') then
    create policy professional_listing_controls_owner_read on public.professional_listing_controls
      for select to authenticated using (professional_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='professional_listing_events' and policyname='professional_listing_events_owner_read') then
    create policy professional_listing_events_owner_read on public.professional_listing_events
      for select to authenticated using (professional_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='professional_readiness_refresh_queue' and policyname='professional_readiness_queue_owner_read') then
    create policy professional_readiness_queue_owner_read on public.professional_readiness_refresh_queue
      for select to authenticated using (professional_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='marketplace_governance_events' and policyname='marketplace_governance_events_admin_read') then
    create policy marketplace_governance_events_admin_read on public.marketplace_governance_events
      for select to authenticated
      using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='taster_sessions' and policyname='taster_sessions_public_insert') then
    create policy taster_sessions_public_insert on public.taster_sessions
      for insert to anon, authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='rate_limits' and policyname='rate_limits_no_client_access') then
    create policy rate_limits_no_client_access on public.rate_limits
      for select to authenticated using (false);
  end if;
end $$;