-- Valoria Excellence: make internal-only assessment progress access explicit.
-- No anon/authenticated policies are granted. service_role remains the only client/API role with a policy.
create policy "valu_assessment_progress_service_role_only"
on public.valu_assessment_progress
for all
to service_role
using (true)
with check (true);
