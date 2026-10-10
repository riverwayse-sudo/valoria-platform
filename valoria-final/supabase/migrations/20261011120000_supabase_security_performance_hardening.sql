-- Targeted security/performance hardening. Preserve existing policy predicates and public journey writes.
create index if not exists idx_fk_assessment_identity_links_linked_by on public.assessment_identity_links (linked_by);
create index if not exists idx_fk_coaching_requests_coach_professional_id on public.coaching_requests (coach_professional_id);
create index if not exists idx_fk_opportunities_created_by on public.opportunities (created_by);
create index if not exists idx_fk_opportunities_employer_id on public.opportunities (employer_id);
create index if not exists idx_fk_opportunities_reviewed_by on public.opportunities (reviewed_by);
create index if not exists idx_fk_opportunity_applications_cv_document_id on public.opportunity_applications (cv_document_id);
create index if not exists idx_fk_opportunity_applications_professional_id on public.opportunity_applications (professional_id);
create index if not exists idx_fk_opportunity_invites_invited_by on public.opportunity_invites (invited_by);
create index if not exists idx_fk_opportunity_messages_opportunity_id on public.opportunity_messages (opportunity_id);
create index if not exists idx_fk_opportunity_messages_sender_user_id on public.opportunity_messages (sender_user_id);
create index if not exists idx_fk_opportunity_submissions_opportunity_id on public.opportunity_submissions (opportunity_id);
create index if not exists idx_fk_opportunity_submissions_reviewed_by on public.opportunity_submissions (reviewed_by);
create index if not exists idx_fk_opportunity_submissions_submitter_user_id on public.opportunity_submissions (submitter_user_id);
create index if not exists idx_fk_placement_cases_assigned_admin on public.placement_cases (assigned_admin);
create index if not exists idx_fk_placement_cases_employer_id on public.placement_cases (employer_id);
create index if not exists idx_fk_placement_cases_opportunity_id on public.placement_cases (opportunity_id);
create index if not exists idx_fk_platform_audit_events_actor_user_id on public.platform_audit_events (actor_user_id);
create index if not exists idx_fk_platform_audit_events_subject_user_id on public.platform_audit_events (subject_user_id);
create index if not exists idx_fk_professional_event_attendance_marked_by on public.professional_event_attendance (marked_by);
create index if not exists idx_fk_professional_journey_current_assessment_id on public.professional_journey (current_assessment_id);
create index if not exists idx_fk_professional_outcome_events_capability_id on public.professional_outcome_events (capability_id);
create index if not exists idx_fk_professional_value_activation_assessment_id on public.professional_value_activation (assessment_id);

-- Session creation is server-authoritative through rate-limited service-role APIs.
-- Remove anonymous client inserts while preserving owner read/update policies.
drop policy if exists assessment_sessions_public_insert on public.assessment_sessions;
drop policy if exists taster_sessions_public_insert on public.taster_sessions;

-- Use init-plan evaluation for auth.uid() without changing access predicates.
drop policy if exists "users can read own journey events" on public.journey_events;
create policy "users can read own journey events" on public.journey_events for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists journey_owner_read on public.professional_journey;
create policy journey_owner_read on public.professional_journey for select to public using ((select auth.uid()) = user_id or is_valoria_admin());

drop policy if exists employer_owner_all on public.employer_profiles;
create policy employer_owner_all on public.employer_profiles for all to public using ((select auth.uid()) = id or is_valoria_admin()) with check ((select auth.uid()) = id or is_valoria_admin());

drop policy if exists opportunities_public_read on public.opportunities;
create policy opportunities_public_read on public.opportunities for select to public using (((status = 'published'::text) and ((closing_at is null) or (closing_at > now())) and (access_level = 'public'::text)) or (created_by = (select auth.uid())) or is_valoria_admin());

drop policy if exists opportunity_application_owner on public.opportunity_applications;
create policy opportunity_application_owner on public.opportunity_applications for all to public using ((professional_id = (select auth.uid()) or is_valoria_admin())) with check (professional_id = (select auth.uid()) or is_valoria_admin());

drop policy if exists opportunity_submission_insert on public.opportunity_submissions;
create policy opportunity_submission_insert on public.opportunity_submissions for insert to public with check (submitter_user_id is null or submitter_user_id = (select auth.uid()));

drop policy if exists opportunity_submission_owner_read on public.opportunity_submissions;
create policy opportunity_submission_owner_read on public.opportunity_submissions for select to public using (submitter_user_id = (select auth.uid()) or is_valoria_admin());

drop policy if exists event_attendance_owner_read on public.professional_event_attendance;
create policy event_attendance_owner_read on public.professional_event_attendance for select to public using (professional_id = (select auth.uid()) or is_valoria_admin());

drop policy if exists certificates_owner_read on public.professional_certificates;
create policy certificates_owner_read on public.professional_certificates for select to public using (professional_id = (select auth.uid()) or is_valoria_admin());

-- These authenticated policies duplicate the public-role policies with the same predicates.
drop policy if exists "users can read own notifications" on public.notifications;
drop policy if exists "users can mark own notifications read" on public.notifications;
