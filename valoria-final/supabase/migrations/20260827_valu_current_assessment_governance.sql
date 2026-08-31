-- Final v4 governance override: a professional must have a current completed VALU score >=35.
-- Expired assessments no longer satisfy marketplace eligibility.

create or replace function private.evaluate_professional_readiness(p_professional_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare missing jsonb:='[]'::jsonb; profile_complete boolean:=false; valu_complete boolean:=false; blocked boolean:=false; cv_present boolean:=false; speaker_history_present boolean:=false; speaker_engagement_present boolean:=false; facilitator_history_present boolean:=false; facilitator_engagement_present boolean:=false; capability text; eligible boolean:=false;
begin
 select coalesce(p.profile_complete,false) and nullif(trim(coalesce(p.display_name,'')),'') is not null and nullif(trim(coalesce(p.bio,'')),'') is not null into profile_complete from public.professional_profiles p where p.id=p_professional_id;
 valu_complete:=private.valu_assessment_is_current(p_professional_id);
 select exists(select 1 from public.professional_listing_events e where e.professional_id=p_professional_id and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED') and e.created_at=(select max(e2.created_at) from public.professional_listing_events e2 where e2.professional_id=p_professional_id)) into blocked;
 for capability in select lower(c.capability) from public.professional_capabilities c where c.professional_id=p_professional_id and c.is_active=true loop
  if capability='talent' then select exists(select 1 from public.professional_documents d where d.professional_id=p_professional_id and lower(d.document_type)='cv' and coalesce(d.is_current,true)=true) into cv_present; if not cv_present then missing:=missing||'["talent_cv"]'::jsonb; end if;
  elsif capability='speaker' then select exists(select 1 from public.speaking_history h where h.professional_id=p_professional_id) into speaker_history_present; select exists(select 1 from public.speaking_engagements e where e.professional_id=p_professional_id) into speaker_engagement_present; if not speaker_history_present then missing:=missing||'["speaking_history"]'::jsonb; end if; if not speaker_engagement_present then missing:=missing||'["speaking_engagement"]'::jsonb; end if;
  elsif capability='facilitator' then select exists(select 1 from public.facilitation_history h where h.professional_id=p_professional_id) into facilitator_history_present; select exists(select 1 from public.facilitation_engagements e where e.professional_id=p_professional_id) into facilitator_engagement_present; if not facilitator_history_present then missing:=missing||'["facilitation_history"]'::jsonb; end if; if not facilitator_engagement_present then missing:=missing||'["facilitation_engagement"]'::jsonb; end if; end if;
 end loop;
 if not profile_complete then missing:=missing||'["profile"]'::jsonb; end if;
 if not valu_complete then missing:=missing||'["valu_assessment_score_35_current"]'::jsonb; end if;
 if not exists(select 1 from public.professional_capabilities c where c.professional_id=p_professional_id and c.is_active=true) then missing:=missing||'["capability"]'::jsonb; end if;
 eligible:=jsonb_array_length(missing)=0 and not blocked;
 return jsonb_build_object('professional_id',p_professional_id,'profile_complete',profile_complete,'valu_complete',valu_complete,'blocked',blocked,'eligible',eligible,'missing',missing);
end; $$;
revoke all on function private.evaluate_professional_readiness(uuid) from public,anon,authenticated; grant execute on function private.evaluate_professional_readiness(uuid) to service_role;
