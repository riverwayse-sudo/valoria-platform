alter table public.taster_sessions add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.taster_sessions add column if not exists linked_at timestamptz;
alter table public.taster_sessions add column if not exists reminder_count integer not null default 0;
alter table public.taster_sessions add column if not exists last_reminder_at timestamptz;
create index if not exists idx_taster_sessions_user_id on public.taster_sessions(user_id);
create index if not exists idx_taster_sessions_reminder_due on public.taster_sessions(user_id, linked_at, last_reminder_at) where user_id is not null;

create or replace function public.link_taster_to_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.user_id is null then return new; end if;
  insert into public.professional_profiles (id,display_name,headline,listing_status,profile_complete,visibility,active_tracks,eligible_for_listing,availability_status,created_at,updated_at)
  values (new.user_id,nullif(trim(new.name),''),nullif(trim(new.role),''),'listed',false,'registered_only',array['candidate']::text[],false,'available',now(),now())
  on conflict (id) do update set
    display_name=coalesce(public.professional_profiles.display_name,excluded.display_name),
    headline=coalesce(public.professional_profiles.headline,excluded.headline),
    listing_status=case when public.professional_profiles.listing_status in ('revoked','suspended') then public.professional_profiles.listing_status else 'listed' end,
    profile_complete=false,
    updated_at=now();
  new.linked_at=coalesce(new.linked_at,now());
  return new;
end;
$$;

drop trigger if exists trg_link_taster_to_profile on public.taster_sessions;
create trigger trg_link_taster_to_profile before update of user_id on public.taster_sessions for each row when (new.user_id is not null and old.user_id is distinct from new.user_id) execute function public.link_taster_to_profile();
