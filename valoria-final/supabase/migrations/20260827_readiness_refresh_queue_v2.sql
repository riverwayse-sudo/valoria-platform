-- Safe asynchronous readiness refresh path.
-- User-owned mutations enqueue; only service_role can consume and execute governance.

create table if not exists public.professional_readiness_refresh_queue (
  professional_id uuid primary key references public.professional_profiles(id) on delete cascade,
  reason text not null,
  requested_at timestamptz not null default now()
);

alter table public.professional_readiness_refresh_queue enable row level security;
revoke all on public.professional_readiness_refresh_queue from public,anon,authenticated;
grant select,insert,update,delete on public.professional_readiness_refresh_queue to service_role;

create or replace function private.enqueue_readiness_refresh(p_professional_id uuid,p_reason text)
returns void language sql security definer set search_path=public,private as $$
  insert into public.professional_readiness_refresh_queue(professional_id,reason,requested_at)
  values(p_professional_id,coalesce(nullif(trim(p_reason),''),'mutation'),now())
  on conflict(professional_id) do update set reason=excluded.reason,requested_at=excluded.requested_at;
$$;
revoke all on function private.enqueue_readiness_refresh(uuid,text) from public,anon,authenticated;
grant execute on function private.enqueue_readiness_refresh(uuid,text) to service_role;

create or replace function private.refresh_professional_readiness_queue(p_limit integer default 100)
returns integer language plpgsql security definer set search_path=public,private as $$
declare item record; processed integer:=0;
begin
 for item in select professional_id,reason from public.professional_readiness_refresh_queue order by requested_at limit greatest(1,least(coalesce(p_limit,100),500)) for update skip locked loop
   perform private.sync_professional_listing_status(item.professional_id);
   delete from public.professional_readiness_refresh_queue where professional_id=item.professional_id;
   processed:=processed+1;
 end loop;
 return processed;
end; $$;
revoke all on function private.refresh_professional_readiness_queue(integer) from public,anon,authenticated;
grant execute on function private.refresh_professional_readiness_queue(integer) to service_role;

-- Evidence mutations enqueue a refresh. The trigger function itself only writes the queue;
-- it never changes listing state.
create or replace function private.queue_readiness_from_evidence()
returns trigger language plpgsql security definer set search_path=public,private as $$
begin
  perform private.enqueue_readiness_refresh(coalesce(new.professional_id,old.professional_id),tg_table_name);
  return coalesce(new,old);
end; $$;
revoke all on function private.queue_readiness_from_evidence() from public,anon,authenticated;
grant execute on function private.queue_readiness_from_evidence() to service_role;

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['professional_capabilities','professional_documents','speaking_history','speaking_engagements','facilitation_history','facilitation_engagements'] LOOP
   EXECUTE format('drop trigger if exists trg_readiness_refresh_%I on public.%I',t,t);
   EXECUTE format('create trigger trg_readiness_refresh_%I after insert or update or delete on public.%I for each row execute function private.queue_readiness_from_evidence()',t,t);
 END LOOP;
END $$;
