-- Eligibility refresh updates eligibility only. Listing publication remains admin-controlled.
create or replace function private.sync_professional_listing_status(p_professional_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare p record; readiness jsonb; eligible boolean;
begin
 select * into p from public.professional_profiles where id=p_professional_id for update;
 if not found then return jsonb_build_object('ok',false,'eligible_for_listing',false,'listing_status',null); end if;
 readiness:=private.evaluate_professional_readiness(p_professional_id);
 eligible:=coalesce((readiness->>'eligible')::boolean,false);
 update public.professional_profiles set eligible_for_listing=eligible, updated_at=now() where id=p_professional_id;
 return jsonb_build_object('ok',true,'eligible_for_listing',eligible,'listing_status',p.listing_status,'readiness',readiness);
end; $$;
revoke all on function private.sync_professional_listing_status(uuid) from public,anon,authenticated; grant execute on function private.sync_professional_listing_status(uuid) to service_role;

alter table public.professional_readiness_refresh_queue add column if not exists attempts integer not null default 0;
alter table public.professional_readiness_refresh_queue add column if not exists last_error text;
alter table public.professional_readiness_refresh_queue add column if not exists processed_at timestamptz;
alter table public.professional_readiness_refresh_queue add column if not exists next_attempt_at timestamptz not null default now();

create or replace function private.refresh_professional_readiness_queue(p_limit integer default 100) returns integer language plpgsql security definer set search_path=public,private as $$
declare item record; processed integer:=0;
begin
 for item in select professional_id,reason,attempts from public.professional_readiness_refresh_queue where processed_at is null and next_attempt_at<=now() order by requested_at limit greatest(1,least(coalesce(p_limit,100),500)) for update skip locked loop
   begin
     perform private.sync_professional_listing_status(item.professional_id);
     update public.professional_readiness_refresh_queue set processed_at=now(), last_error=null where professional_id=item.professional_id;
     processed:=processed+1;
   exception when others then
     update public.professional_readiness_refresh_queue set attempts=attempts+1,last_error=left(sqlerrm,1000),next_attempt_at=now()+least(interval '1 hour', interval '5 seconds' * power(2,least(attempts,8))) where professional_id=item.professional_id;
   end;
 end loop;
 return processed;
end; $$;
revoke all on function private.refresh_professional_readiness_queue(integer) from public,anon,authenticated; grant execute on function private.refresh_professional_readiness_queue(integer) to service_role;
create index if not exists idx_readiness_queue_due on public.professional_readiness_refresh_queue(next_attempt_at) where processed_at is null;
