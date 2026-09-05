-- Continuous closeout: align repository migration history with production hardening
-- Security policies and supporting indexes verified in production on 2026-09-05.

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

-- RLS ownership boundaries for professional-owned evidence.
create policy if not exists professional_capabilities_owner_all on public.professional_capabilities
  for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (professional_id = (select auth.uid()));
create policy if not exists facilitation_history_owner_all on public.facilitation_history
  for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (professional_id = (select auth.uid()));
create policy if not exists facilitation_engagements_owner_all on public.facilitation_engagements
  for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (professional_id = (select auth.uid()));
create policy if not exists speaking_history_owner_all on public.speaking_history
  for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (professional_id = (select auth.uid()));
create policy if not exists speaking_engagements_owner_all on public.speaking_engagements
  for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (professional_id = (select auth.uid()));

-- Internal governance data remains inaccessible except to its owner/admin role.
create policy if not exists professional_listing_controls_owner_read on public.professional_listing_controls
  for select to authenticated using (professional_id = (select auth.uid()));
create policy if not exists professional_listing_events_owner_read on public.professional_listing_events
  for select to authenticated using (professional_id = (select auth.uid()));
create policy if not exists professional_readiness_queue_owner_read on public.professional_readiness_refresh_queue
  for select to authenticated using (professional_id = (select auth.uid()));
create policy if not exists marketplace_governance_events_admin_read on public.marketplace_governance_events
  for select to authenticated
  using (exists (select 1 from public.admin_users au where au.id = (select auth.uid())));

-- Public directional snapshot can be submitted without exposing stored sessions.
create policy if not exists taster_sessions_public_insert on public.taster_sessions
  for insert to anon, authenticated with check (true);

-- Rate-limit internals are never readable through the client API.
create policy if not exists rate_limits_no_client_access on public.rate_limits
  for select to authenticated using (false);
