-- VALU v4 lifecycle wiring for the two authoritative sources.
-- Assessment rows identify the professional through valu_assessments.user_id.
-- Profile rows identify the professional through professional_profiles.id.
-- Neither trigger directly changes listing state; the service worker performs governance.

create or replace function private.queue_readiness_from_assessment()
returns trigger
language plpgsql security definer set search_path=public,private
as $$
begin
  if coalesce(new.user_id, old.user_id) is not null then
    perform private.enqueue_readiness_refresh(coalesce(new.user_id, old.user_id), 'valu_assessment');
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function private.queue_readiness_from_assessment() from public,anon,authenticated;
grant execute on function private.queue_readiness_from_assessment() to service_role;

drop trigger if exists trg_valu_assessment_readiness_refresh on public.valu_assessments;
create trigger trg_valu_assessment_readiness_refresh
  after insert or update of total_score,completed_at,expires_at or delete
  on public.valu_assessments
  for each row execute function private.queue_readiness_from_assessment();

create or replace function private.queue_readiness_from_profile()
returns trigger
language plpgsql security definer set search_path=public,private
as $$
begin
  perform private.enqueue_readiness_refresh(new.id, 'professional_profile');
  return new;
end;
$$;
revoke all on function private.queue_readiness_from_profile() from public,anon,authenticated;
grant execute on function private.queue_readiness_from_profile() to service_role;

drop trigger if exists trg_professional_profile_readiness_refresh on public.professional_profiles;
create trigger trg_professional_profile_readiness_refresh
  after update of profile_complete,display_name,bio,active_tracks,visibility,valu_index,assessment_completed_at,assessment_expires_at
  on public.professional_profiles
  for each row
  when (
    new.profile_complete is distinct from old.profile_complete or
    new.display_name is distinct from old.display_name or
    new.bio is distinct from old.bio or
    new.active_tracks is distinct from old.active_tracks or
    new.visibility is distinct from old.visibility or
    new.valu_index is distinct from old.valu_index or
    new.assessment_completed_at is distinct from old.assessment_completed_at or
    new.assessment_expires_at is distinct from old.assessment_expires_at
  )
  execute function private.queue_readiness_from_profile();

-- A current VALU assessment is required: completed, >=35, and not expired.
create or replace function private.valu_assessment_is_current(p_professional_id uuid)
returns boolean
language sql stable security definer set search_path=public,private
as $$
  select exists (
    select 1
    from public.valu_assessments v
    where v.user_id=p_professional_id
      and v.completed_at is not null
      and coalesce(v.total_score,0)>=35
      and (v.expires_at is null or v.expires_at>now())
  );
$$;
revoke all on function private.valu_assessment_is_current(uuid) from public,anon,authenticated;
grant execute on function private.valu_assessment_is_current(uuid) to service_role;
