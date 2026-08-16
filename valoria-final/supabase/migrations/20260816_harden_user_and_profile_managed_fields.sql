-- Prevent authenticated users from promoting themselves or rewriting platform-owned professional data.

create or replace function public.guard_user_managed_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_valoria_admin() then
    if new.user_type is distinct from old.user_type then
      raise exception 'user_type is platform-managed';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_user_managed_fields() from public;

drop trigger if exists trg_guard_users_managed_fields on public.users;
create trigger trg_guard_users_managed_fields
before update on public.users
for each row execute function public.guard_user_managed_fields();

create or replace function public.guard_professional_platform_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_valoria_admin() then
    if new.valu_index is distinct from old.valu_index
       or new.cluster_scores is distinct from old.cluster_scores
       or new.skill_scores is distinct from old.skill_scores
       or new.designation is distinct from old.designation
       or new.assessment_completed_at is distinct from old.assessment_completed_at
       or new.assessment_expires_at is distinct from old.assessment_expires_at
       or new.atb_id is distinct from old.atb_id
       or new.listing_status is distinct from old.listing_status
       or new.speaker_tier is distinct from old.speaker_tier
       or new.pcp_certified is distinct from old.pcp_certified
    then
      raise exception 'platform-managed professional fields cannot be changed by the profile owner';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_professional_platform_fields() from public;

drop trigger if exists trg_guard_professional_platform_fields on public.professional_profiles;
create trigger trg_guard_professional_platform_fields
before update on public.professional_profiles
for each row execute function public.guard_professional_platform_fields();
