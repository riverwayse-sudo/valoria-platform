-- VALU v4 marketplace governance aligned to the live Valoria schema.
-- Score eligibility and listing status are separate concepts.
-- Core governance logic remains in private schema; public wrappers are service-role-only for PostgREST invocation.

create schema if not exists private;

-- Governance helpers are intentionally kept in private schema. Public RPC wrappers below
-- exist only because PostgREST exposes public schema functions.

create or replace function private.evaluate_professional_readiness(p_professional_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare missing jsonb:='[]'::jsonb; profile_complete boolean:=false; valu_complete boolean:=false; blocked boolean:=false; cv_present boolean:=false; speaker_history_present boolean:=false; speaker_engagement_present boolean:=false; facilitator_history_present boolean:=false; facilitator_engagement_present boolean:=false; capability text; eligible boolean:=false;
begin
 select coalesce(p.profile_complete,false) and nullif(trim(coalesce(p.display_name,'')),'') is not null and nullif(trim(coalesce(p.bio,'')),'') is not null into profile_complete from public.professional_profiles p where p.id=p_professional_id;
 select exists(select 1 from public.valu_assessments v where v.user_id=p_professional_id and v.completed_at is not null and coalesce(v.total_score,0)>=35) into valu_complete;
 select exists(select 1 from public.professional_listing_events e where e.professional_id=p_professional_id and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED') and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p_professional_id)) into blocked;
 for capability in select lower(c.capability) from public.professional_capabilities c where c.professional_id=p_professional_id and c.is_active=true loop
  if capability='talent' then select exists(select 1 from public.professional_documents d where d.professional_id=p_professional_id and d.document_type='cv' and d.is_current=true) into cv_present; if not cv_present then missing:=missing||'["talent_cv"]'::jsonb; end if;
  elsif capability='speaker' then select exists(select 1 from public.speaking_history h where h.professional_id=p_professional_id) into speaker_history_present; select exists(select 1 from public.speaking_engagements e where e.professional_id=p_professional_id) into speaker_engagement_present; if not speaker_history_present then missing:=missing||'["speaking_history"]'::jsonb; end if; if not speaker_engagement_present then missing:=missing||'["speaking_engagement"]'::jsonb; end if;
  elsif capability='facilitator' then select exists(select 1 from public.facilitation_history h where h.professional_id=p_professional_id) into facilitator_history_present; select exists(select 1 from public.facilitation_engagements e where e.professional_id=p_professional_id) into facilitator_engagement_present; if not facilitator_history_present then missing:=missing||'["facilitation_history"]'::jsonb; end if; if not facilitator_engagement_present then missing:=missing||'["facilitation_engagement"]'::jsonb; end if; end if;
 end loop;
 if not profile_complete then missing:=missing||'["profile"]'::jsonb; end if;
 if not valu_complete then missing:=missing||'["valu_assessment_score_35"]'::jsonb; end if;
 if not exists(select 1 from public.professional_capabilities c where c.professional_id=p_professional_id and c.is_active=true) then missing:=missing||'["capability"]'::jsonb; end if;
 eligible:=jsonb_array_length(missing)=0 and not blocked;
 return jsonb_build_object('professional_id',p_professional_id,'profile_complete',profile_complete,'valu_complete',valu_complete,'blocked',blocked,'eligible',eligible,'missing',missing);
end; $$;
revoke all on function private.evaluate_professional_readiness(uuid) from public,anon,authenticated; grant execute on function private.evaluate_professional_readiness(uuid) to service_role;

create or replace function private.compute_professional_listing_eligibility(p_professional_id uuid) returns boolean language plpgsql security definer set search_path=public,private as $$ declare readiness jsonb; begin readiness:=private.evaluate_professional_readiness(p_professional_id); return coalesce((readiness->>'eligible')::boolean,false); end; $$;
revoke all on function private.compute_professional_listing_eligibility(uuid) from public,anon,authenticated; grant execute on function private.compute_professional_listing_eligibility(uuid) to service_role;

create or replace function private.sync_professional_listing_status(p_professional_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare p record; readiness jsonb; eligible boolean; previous_status text; next_status text;
begin
 select * into p from public.professional_profiles where id=p_professional_id for update;
 if not found then return jsonb_build_object('ok',false,'eligible_for_listing',false,'listing_status',null); end if;
 readiness:=private.evaluate_professional_readiness(p_professional_id); eligible:=coalesce((readiness->>'eligible')::boolean,false); previous_status:=p.listing_status; next_status:=previous_status;
 if previous_status not in ('suspended','revoked') then next_status:=case when eligible then 'listed' else 'unlisted' end; end if;
 update public.professional_profiles set eligible_for_listing=eligible, listing_status=next_status, listed_at=case when next_status='listed' and previous_status<>'listed' then now() else listed_at end, updated_at=now() where id=p_professional_id;
 if next_status<>previous_status then insert into public.professional_listing_events (professional_id,event_type,previous_status,new_status,reason,metadata) values (p_professional_id,case when next_status='listed' then 'AUTO_LISTED' else 'ELIGIBILITY_FAILED' end,previous_status,next_status,case when next_status='listed' then 'All automated VALU v4 marketplace eligibility gates passed.' else 'One or more automated marketplace eligibility gates are incomplete.' end,readiness); end if;
 return jsonb_build_object('ok',true,'eligible_for_listing',eligible,'listing_status',next_status,'readiness',readiness);
end; $$;
revoke all on function private.sync_professional_listing_status(uuid) from public,anon,authenticated; grant execute on function private.sync_professional_listing_status(uuid) to service_role;

create or replace function public.evaluate_professional_readiness(p_professional_id uuid) returns jsonb language plpgsql security invoker set search_path=public,private as $$ select private.evaluate_professional_readiness(p_professional_id); $$;
create or replace function public.compute_professional_listing_eligibility(p_professional_id uuid) returns boolean language sql security invoker set search_path=public,private as $$ select private.compute_professional_listing_eligibility(p_professional_id); $$;
create or replace function public.sync_professional_listing_status(p_professional_id uuid) returns jsonb language sql security invoker set search_path=public,private as $$ select private.sync_professional_listing_status(p_professional_id); $$;
revoke all on function public.evaluate_professional_readiness(uuid) from public,anon,authenticated; grant execute on function public.evaluate_professional_readiness(uuid) to service_role;
revoke all on function public.compute_professional_listing_eligibility(uuid) from public,anon,authenticated; grant execute on function public.compute_professional_listing_eligibility(uuid) to service_role;
revoke all on function public.sync_professional_listing_status(uuid) from public,anon,authenticated; grant execute on function public.sync_professional_listing_status(uuid) to service_role;

drop view if exists public.marketplace_professionals;
create view public.marketplace_professionals with (security_invoker=true) as select p.id as professional_id,p.display_name as full_name,p.bio,p.location,p.languages,p.headline,p.listing_status,p.availability_status,p.visibility,coalesce(c.capabilities,'{}'::text[]) as capabilities from public.professional_profiles p left join lateral (select array_agg(distinct lower(pc.capability) order by lower(pc.capability)) as capabilities from public.professional_capabilities pc where pc.professional_id=p.id and pc.is_active=true) c on true where p.listing_status='listed' and p.availability_status in ('available','limited') and p.visibility='public' and coalesce(p.eligible_for_listing,false)=true;
revoke all on public.marketplace_professionals from public,anon; grant select on public.marketplace_professionals to authenticated;
