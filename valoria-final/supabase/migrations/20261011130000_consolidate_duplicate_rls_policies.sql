-- Remove exact duplicate permissive policies and narrow admin write policies to write commands.
drop policy if exists "users can read their own notifications" on public.platform_notifications;
drop policy if exists "users can mark their own notifications read" on public.platform_notifications;

-- Owner SELECT policy already includes owner access, admin access, and public listed capability access.
drop policy if exists "professionals can read own capabilities" on public.professional_capabilities;

-- The public-role owner policy already covers a professional's own application and admin access.
drop policy if exists opportunity_application_professional_insert on public.opportunity_applications;
drop policy if exists opportunity_application_professional_read on public.opportunity_applications;

-- Admin update policy includes the owner predicate and identical owner WITH CHECK.
drop policy if exists professional_documents_owner_update on public.professional_documents;

-- Preserve admin CRUD permissions, while letting the read policies below govern SELECT.
drop policy if exists certificates_admin_write on public.professional_certificates;
create policy certificates_admin_insert on public.professional_certificates for insert to public with check (is_valoria_admin());
create policy certificates_admin_update on public.professional_certificates for update to public using (is_valoria_admin()) with check (is_valoria_admin());
create policy certificates_admin_delete on public.professional_certificates for delete to public using (is_valoria_admin());

drop policy if exists event_attendance_admin_write on public.professional_event_attendance;
create policy event_attendance_admin_insert on public.professional_event_attendance for insert to public with check (is_valoria_admin());
create policy event_attendance_admin_update on public.professional_event_attendance for update to public using (is_valoria_admin()) with check (is_valoria_admin());
create policy event_attendance_admin_delete on public.professional_event_attendance for delete to public using (is_valoria_admin());

drop policy if exists professional_events_admin_write on public.professional_events;
create policy professional_events_admin_insert on public.professional_events for insert to public with check (is_valoria_admin());
create policy professional_events_admin_update on public.professional_events for update to public using (is_valoria_admin()) with check (is_valoria_admin());
create policy professional_events_admin_delete on public.professional_events for delete to public using (is_valoria_admin());
