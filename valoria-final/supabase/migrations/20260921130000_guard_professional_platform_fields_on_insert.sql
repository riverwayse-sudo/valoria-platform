begin;

create or replace function public.guard_professional_platform_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if current_setting('request.jwt.claim.role',true) <> 'service_role'
     and not public.is_valoria_admin() then
    if tg_op = 'INSERT' then
      new.eligible_for_listing := false;
      new.listing_status := 'unlisted';
      new.visibility := 'registered_only';
      new.listed_at := null;
      new.atb_id := null;
      new.valu_index := null;
      new.cluster_scores := null;
      new.skill_scores := null;
      new.designation := null;
      new.assessment_completed_at := null;
      new.assessment_expires_at := null;
      new.speaker_tier := null;
      new.revoked_at := null;
      new.revoked_by := null;
      new.revocation_reason := null;
    else
      if new.valu_index is distinct from old.valu_index
         or new.cluster_scores is distinct from old.cluster_scores
         or new.skill_scores is distinct from old.skill_scores
         or new.designation is distinct from old.designation
         or new.assessment_completed_at is distinct from old.assessment_completed_at
         or new.assessment_expires_at is distinct from old.assessment_expires_at
         or new.atb_id is distinct from old.atb_id
         or new.listing_status is distinct from old.listing_status
         or new.eligible_for_listing is distinct from old.eligible_for_listing
         or new.listed_at is distinct from old.listed_at
         or new.visibility is distinct from old.visibility
         or new.speaker_tier is distinct from old.speaker_tier
         or new.revoked_at is distinct from old.revoked_at
         or new.revoked_by is distinct from old.revoked_by
         or new.revocation_reason is distinct from old.revocation_reason then
        raise exception 'platform-managed professional fields cannot be changed by the profile owner';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_professional_platform_fields on public.professional_profiles;
create trigger trg_guard_professional_platform_fields
before insert or update on public.professional_profiles
for each row execute function public.guard_professional_platform_fields();

commit;