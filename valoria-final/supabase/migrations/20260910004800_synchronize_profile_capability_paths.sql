-- Keep one professional identity aligned with independently selectable capability paths.
-- active_tracks is the owner's path selection; capability eligibility remains governed
-- by the readiness engine and is never granted by this synchronization trigger.

create or replace function private.sync_profile_capability_paths()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  track text;
begin
  if tg_op = 'UPDATE' and new.active_tracks is not distinct from old.active_tracks then
    return new;
  end if;

  update public.professional_capabilities c
     set is_active = false,
         updated_at = now()
   where c.professional_id = new.id
     and c.is_active = true
     and c.capability not in (
       select case when lower(trim(x)) = 'candidate' then 'talent' else lower(trim(x)) end
       from unnest(coalesce(new.active_tracks, '{}'::text[])) x
     );

  for track in
    select distinct case when lower(trim(x)) = 'candidate' then 'talent' else lower(trim(x)) end
    from unnest(coalesce(new.active_tracks, '{}'::text[])) x
    where lower(trim(x)) in ('candidate','talent','speaker','facilitator')
  loop
    perform private.sync_professional_capability(new.id, track);
  end loop;

  return new;
end;
$$;

revoke all on function private.sync_profile_capability_paths() from public, anon, authenticated;
grant execute on function private.sync_profile_capability_paths() to service_role;

drop trigger if exists trg_sync_profile_capability_paths on public.professional_profiles;
create trigger trg_sync_profile_capability_paths
after insert or update of active_tracks on public.professional_profiles
for each row execute function private.sync_profile_capability_paths();

create or replace function private.sync_profile_capability_paths_for_reconcile(p_professional_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  p record;
  track text;
begin
  select * into p from public.professional_profiles where id = p_professional_id;
  if not found then return; end if;

  update public.professional_capabilities c
     set is_active = false,
         updated_at = now()
   where c.professional_id = p.id
     and c.is_active = true
     and c.capability not in (
       select case when lower(trim(x)) = 'candidate' then 'talent' else lower(trim(x)) end
       from unnest(coalesce(p.active_tracks, '{}'::text[])) x
     );

  for track in
    select distinct case when lower(trim(x)) = 'candidate' then 'talent' else lower(trim(x)) end
    from unnest(coalesce(p.active_tracks, '{}'::text[])) x
    where lower(trim(x)) in ('candidate','talent','speaker','facilitator')
  loop
    perform private.sync_professional_capability(p.id, track);
  end loop;
end;
$$;

revoke all on function private.sync_profile_capability_paths_for_reconcile(uuid) from public, anon, authenticated;
grant execute on function private.sync_profile_capability_paths_for_reconcile(uuid) to service_role;

do $$
declare
  p record;
begin
  for p in select id from public.professional_profiles loop
    perform private.sync_profile_capability_paths_for_reconcile(p.id);
  end loop;
end;
$$;
