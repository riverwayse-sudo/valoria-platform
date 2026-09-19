-- Recovered production migration: avatar/profile changes must refresh readiness.
create or replace function private.queue_readiness_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $function$
begin
  perform private.enqueue_readiness_refresh(new.id, 'professional_profile');
  return new;
end;
$function$;

drop trigger if exists trg_professional_profile_readiness_refresh on public.professional_profiles;

create trigger trg_professional_profile_readiness_refresh
after update of profile_complete, display_name, bio, photo_url, active_tracks, visibility,
  valu_index, assessment_completed_at, assessment_expires_at
on public.professional_profiles
for each row
when (
  new.profile_complete is distinct from old.profile_complete
  or new.display_name is distinct from old.display_name
  or new.bio is distinct from old.bio
  or new.photo_url is distinct from old.photo_url
  or new.active_tracks is distinct from old.active_tracks
  or new.visibility is distinct from old.visibility
  or new.valu_index is distinct from old.valu_index
  or new.assessment_completed_at is distinct from old.assessment_completed_at
  or new.assessment_expires_at is distinct from old.assessment_expires_at
)
execute function private.queue_readiness_from_profile();