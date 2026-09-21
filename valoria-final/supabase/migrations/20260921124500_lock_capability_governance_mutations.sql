-- Capability governance is platform-owned. Professionals select capabilities through
-- professional_profiles.active_tracks; they never mutate eligibility/listing state directly.

drop policy if exists professional_capabilities_owner_insert on public.professional_capabilities;
drop policy if exists professional_capabilities_owner_update on public.professional_capabilities;
drop policy if exists professional_capabilities_owner_delete on public.professional_capabilities;
