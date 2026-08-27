-- VALU v4 lifecycle: keep marketplace eligibility/listing state synchronized.
-- The refresh path is service-role only; mutations schedule a refresh request rather than
-- invoking privileged governance logic directly inside user-owned writes.

create table if not exists public.professional_readiness_refresh_queue (
  professional_id uuid primary key references public.professional_profiles(id) on delete cascade,
  reason text not null,
  requested_at timestamptz not null default now()
);

alter table public.professional_readiness_refresh_queue enable row level security;
revoke all on public.professional_readiness_refresh_queue from public, anon, authenticated;
grant select, insert, update, delete on public.professional_readiness_refresh_queue to service_role;

create or replace function private.request_professional_readiness_refresh()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.professional_readiness_refresh_queue (professional_id, reason, requested_at)
  values (coalesce(new.professional_id, new.id), tg_table_name, now())
  on conflict (professional_id) do update
    set reason = excluded.reason,
        requested_at = excluded.requested_at;
  return new;
end;
$$;

revoke all on function private.request_professional_readiness_refresh() from public, anon, authenticated;
grant execute on function private.request_professional_readiness_refresh() to service_role;

-- These triggers only enqueue. The authoritative service-role worker consumes the queue
-- and calls private.sync_professional_listing_status(uuid).
drop trigger if exists trg_capability_readiness_refresh on public.professional_capabilities;
create trigger trg_capability_readiness_refresh after insert or update or delete on public.professional_capabilities
for each row execute function private.request_professional_readiness_refresh();

drop trigger if exists trg_document_readiness_refresh on public.professional_documents;
create trigger trg_document_readiness_refresh after insert or update or delete on public.professional_documents
for each row execute function private.request_professional_readiness_refresh();

drop trigger if exists trg_speaking_history_readiness_refresh on public.speaking_history;
create trigger trg_speaking_history_readiness_refresh after insert or update or delete on public.speaking_history
for each row execute function private.request_professional_readiness_refresh();

drop trigger if exists trg_speaking_engagement_readiness_refresh on public.speaking_engagements;
create trigger trg_speaking_engagement_readiness_refresh after insert or update or delete on public.speaking_engagements
for each row execute function private.request_professional_readiness_refresh();

drop trigger if exists trg_facilitation_history_readiness_refresh on public.facilitation_history;
create trigger trg_facilitation_history_readiness_refresh after insert or update or delete on public.facilitation_history
for each row execute function private.request_professional_readiness_refresh();

drop trigger if exists trg_facilitation_engagement_readiness_refresh on public.facilitation_engagements;
create trigger trg_facilitation_engagement_readiness_refresh after insert or update or delete on public.facilitation_engagements
for each row execute function private.request_professional_readiness_refresh();

create or replace function private.refresh_professional_readiness_queue(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  item record;
  processed integer := 0;
begin
  for item in
    select professional_id from public.professional_readiness_refresh_queue
    order by requested_at
    limit greatest(1, least(coalesce(p_limit,100),500))
    for update skip locked
  loop
    perform private.sync_professional_listing_status(item.professional_id);
    delete from public.professional_readiness_refresh_queue where professional_id=item.professional_id;
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;

revoke all on function private.refresh_professional_readiness_queue(integer) from public, anon, authenticated;
grant execute on function private.refresh_professional_readiness_queue(integer) to service_role;

-- Assessment/profile changes are handled by explicit application/service calls because
-- their source tables use different ownership keys. The canonical service flow must call
-- private.sync_professional_listing_status after an authoritative assessment completion
-- and after profile verification changes.
