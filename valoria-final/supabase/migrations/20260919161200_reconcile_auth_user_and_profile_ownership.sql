-- Reconcile auth identities with the application's canonical users/profile chain.
insert into public.users (id,email,full_name,user_type,created_at,updated_at)
select au.id,lower(au.email),
       coalesce(nullif(trim(au.raw_user_meta_data->>'display_name'),''),nullif(trim(au.raw_user_meta_data->>'full_name'),''),split_part(au.email,'@',1)),
       case when exists (select 1 from public.admin_users a where a.id=au.id) then 'admin' else 'professional' end,
       au.created_at,now()
from auth.users au
where au.email is not null
  and not exists (select 1 from public.users u where u.id=au.id);

insert into public.professional_profiles (
  id,display_name,headline,listing_status,profile_complete,visibility,active_tracks,
  eligible_for_listing,availability_status,valu_index,cluster_scores,designation,
  assessment_completed_at,created_at,updated_at
)
select v.user_id,nullif(trim(v.name),''),nullif(trim(v.role),''),
       'unlisted',false,'registered_only',array['candidate']::text[],false,'available',
       v.total_score,v.cluster_scores,v.designation,v.completed_at,now(),now()
from public.valu_assessments v
join public.users u on u.id=v.user_id
where v.user_id is not null
  and v.completed_at is not null
  and not exists (select 1 from public.professional_profiles p where p.id=v.user_id);

-- Anonymous legacy assessments without an email/owner are intentionally retained
-- as unclaimed records and are never auto-assigned by name similarity.
