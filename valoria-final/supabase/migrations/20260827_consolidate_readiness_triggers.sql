-- Remove legacy duplicate/direct listing triggers. The unified VALU v4 queue is now the sole async readiness path.
drop trigger if exists trg_readiness_refresh_professional_capabilities on public.professional_capabilities;
drop trigger if exists trg_readiness_refresh_professional_documents on public.professional_documents;
drop trigger if exists trg_readiness_refresh_speaking_history on public.speaking_history;
drop trigger if exists trg_readiness_refresh_speaking_engagements on public.speaking_engagements;
drop trigger if exists trg_readiness_refresh_facilitation_history on public.facilitation_history;
drop trigger if exists trg_readiness_refresh_facilitation_engagements on public.facilitation_engagements;
drop trigger if exists trg_cv_assessment_refresh_listing on public.cv_assessments;
drop trigger if exists trg_profile_refresh_talent_listing on public.professional_profiles;

-- Recreate canonical triggers explicitly so this migration is safe on existing environments.
drop trigger if exists trg_capability_readiness_refresh on public.professional_capabilities;
create trigger trg_capability_readiness_refresh after insert or update or delete on public.professional_capabilities for each row execute function private.request_professional_readiness_refresh();
drop trigger if exists trg_document_readiness_refresh on public.professional_documents;
create trigger trg_document_readiness_refresh after insert or update or delete on public.professional_documents for each row execute function private.request_professional_readiness_refresh();
drop trigger if exists trg_speaking_history_readiness_refresh on public.speaking_history;
create trigger trg_speaking_history_readiness_refresh after insert or update or delete on public.speaking_history for each row execute function private.request_professional_readiness_refresh();
drop trigger if exists trg_speaking_engagement_readiness_refresh on public.speaking_engagements;
create trigger trg_speaking_engagement_readiness_refresh after insert or update or delete on public.speaking_engagements for each row execute function private.request_professional_readiness_refresh();
drop trigger if exists trg_facilitation_history_readiness_refresh on public.facilitation_history;
create trigger trg_facilitation_history_readiness_refresh after insert or update or delete on public.facilitation_history for each row execute function private.request_professional_readiness_refresh();
drop trigger if exists trg_facilitation_engagement_readiness_refresh on public.facilitation_engagements;
create trigger trg_facilitation_engagement_readiness_refresh after insert or update or delete on public.facilitation_engagements for each row execute function private.request_professional_readiness_refresh();

drop trigger if exists trg_valu_assessment_readiness_refresh on public.valu_assessments;
create trigger trg_valu_assessment_readiness_refresh after insert or update of total_score,completed_at,expires_at or delete on public.valu_assessments for each row execute function private.queue_readiness_from_assessment();
drop trigger if exists trg_professional_profile_readiness_refresh on public.professional_profiles;
create trigger trg_professional_profile_readiness_refresh after update of profile_complete,display_name,bio,active_tracks,visibility,valu_index,assessment_completed_at,assessment_expires_at on public.professional_profiles for each row when (new.profile_complete is distinct from old.profile_complete or new.display_name is distinct from old.display_name or new.bio is distinct from old.bio or new.active_tracks is distinct from old.active_tracks or new.visibility is distinct from old.visibility or new.valu_index is distinct from old.valu_index or new.assessment_completed_at is distinct from old.assessment_completed_at or new.assessment_expires_at is distinct from old.assessment_expires_at) execute function private.queue_readiness_from_profile();
