-- Source-controlled copy of the live CV assessment foundation.
-- Applied to Supabase project valoriainstitute.com as cv_assessment_live_foundation.

create table if not exists public.professional_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.users(id) on delete restrict,
  document_type text not null default 'cv',
  storage_bucket text not null default 'cvs',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  visibility text not null default 'private' check (visibility in ('private','approved_share')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  verified_at timestamptz,
  verified_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.cv_assessments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.users(id) on delete restrict,
  document_id uuid not null references public.professional_documents(id) on delete restrict,
  status text not null default 'uploaded' check (status in ('uploaded','processing','assessed','review_required','failed','superseded')),
  score numeric(5,2), assessment_version text not null default 'v1', extracted_text_hash text,
  structured_data jsonb not null default '{}'::jsonb, dimension_scores jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb, gaps jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb, failure_code text,
  assessed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create unique index if not exists cv_assessments_active_document_idx on public.cv_assessments(document_id) where status <> 'superseded';
create index if not exists cv_assessments_professional_idx on public.cv_assessments(professional_id, created_at desc);

alter table public.professional_documents enable row level security;
alter table public.cv_assessments enable row level security;
revoke all on public.professional_documents, public.cv_assessments from anon;
grant select, insert, update on public.professional_documents to authenticated;
grant select on public.cv_assessments to authenticated;

drop policy if exists professional_documents_owner_select on public.professional_documents;
create policy professional_documents_owner_select on public.professional_documents for select to authenticated using (professional_id = auth.uid());
drop policy if exists professional_documents_owner_insert on public.professional_documents;
create policy professional_documents_owner_insert on public.professional_documents for insert to authenticated with check (professional_id = auth.uid() and lower(document_type)='cv' and visibility='private' and verification_status='unverified');
drop policy if exists professional_documents_owner_update on public.professional_documents;
create policy professional_documents_owner_update on public.professional_documents for update to authenticated using (professional_id=auth.uid()) with check (professional_id=auth.uid() and visibility='private');
drop policy if exists cv_assessments_owner_select on public.cv_assessments;
create policy cv_assessments_owner_select on public.cv_assessments for select to authenticated using (professional_id=auth.uid());
revoke delete on public.professional_documents from authenticated;
revoke insert, update, delete on public.cv_assessments from authenticated;

create or replace function public.create_cv_assessment(p_document_id uuid) returns public.cv_assessments
language plpgsql security definer set search_path=public as $$
declare d public.professional_documents; r public.cv_assessments;
begin
 select * into d from public.professional_documents where id=p_document_id for update;
 if d.id is null then raise exception 'CV document not found'; end if;
 if d.professional_id <> auth.uid() then raise exception 'Document ownership check failed'; end if;
 if lower(d.document_type)<>'cv' then raise exception 'Document is not a CV'; end if;
 if exists(select 1 from public.cv_assessments where document_id=d.id and status<>'superseded') then raise exception 'An active assessment already exists for this CV'; end if;
 insert into public.cv_assessments(professional_id,document_id,status) values(d.professional_id,d.id,'uploaded') returning * into r; return r;
end; $$;
revoke all on function public.create_cv_assessment(uuid) from public,anon; grant execute on function public.create_cv_assessment(uuid) to authenticated;

create table if not exists public.professional_listing_controls (
 professional_id uuid primary key references public.users(id) on delete cascade,
 admin_revoked boolean not null default false, revoke_reason text, revoked_at timestamptz, revoked_by uuid references public.users(id), updated_at timestamptz not null default now()
);
alter table public.professional_listing_controls enable row level security;
revoke all on public.professional_listing_controls from anon,authenticated;

create or replace function public.refresh_talent_listing_status(p_professional_id uuid) returns text
language plpgsql security definer set search_path=public as $$
declare p public.professional_profiles; c public.cv_assessments; ctl public.professional_listing_controls; eligible boolean; next_status text;
begin
 select * into p from public.professional_profiles where id=p_professional_id for update;
 if p.id is null then raise exception 'Professional profile not found'; end if;
 select * into ctl from public.professional_listing_controls where professional_id=p_professional_id;
 select * into c from public.cv_assessments where professional_id=p_professional_id and status='assessed' order by assessed_at desc nulls last,created_at desc limit 1;
 eligible:=coalesce(p.profile_complete,false) and ('talent'=any(coalesce(p.active_tracks,'{}'::text[]))) and c.id is not null and not coalesce(ctl.admin_revoked,false);
 next_status:=case when coalesce(ctl.admin_revoked,false) then 'suspended' when eligible then 'listed' else 'pending' end;
 update public.professional_profiles set listing_status=next_status,updated_at=now() where id=p_professional_id;
 return next_status;
end; $$;
revoke all on function public.refresh_talent_listing_status(uuid) from public,anon,authenticated; grant execute on function public.refresh_talent_listing_status(uuid) to service_role;

create or replace function public.admin_revoke_talent_listing(p_professional_id uuid,p_reason text default null) returns text
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_valoria_admin() then raise exception 'Administrator authorization required'; end if;
 insert into public.professional_listing_controls(professional_id,admin_revoked,revoke_reason,revoked_at,revoked_by,updated_at) values(p_professional_id,true,p_reason,now(),auth.uid(),now()) on conflict(professional_id) do update set admin_revoked=true,revoke_reason=excluded.revoke_reason,revoked_at=excluded.revoked_at,revoked_by=excluded.revoked_by,updated_at=now();
 update public.professional_profiles set listing_status='suspended',updated_at=now() where id=p_professional_id; return 'suspended';
end; $$;
revoke all on function public.admin_revoke_talent_listing(uuid,text) from public,anon,authenticated; grant execute on function public.admin_revoke_talent_listing(uuid,text) to service_role;

create or replace function public.admin_restore_talent_listing(p_professional_id uuid) returns text
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_valoria_admin() then raise exception 'Administrator authorization required'; end if;
 update public.professional_listing_controls set admin_revoked=false,revoke_reason=null,revoked_at=null,revoked_by=null,updated_at=now() where professional_id=p_professional_id;
 return public.refresh_talent_listing_status(p_professional_id);
end; $$;
revoke all on function public.admin_restore_talent_listing(uuid) from public,anon,authenticated; grant execute on function public.admin_restore_talent_listing(uuid) to service_role;

create or replace function public.trigger_refresh_talent_listing() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.refresh_talent_listing_status(coalesce(new.professional_id,new.id)); return new; end; $$;
revoke all on function public.trigger_refresh_talent_listing() from public,anon,authenticated;
drop trigger if exists trg_cv_assessment_refresh_listing on public.cv_assessments;
create trigger trg_cv_assessment_refresh_listing after insert or update of status on public.cv_assessments for each row execute function public.trigger_refresh_talent_listing();
drop trigger if exists trg_profile_refresh_talent_listing on public.professional_profiles;
create trigger trg_profile_refresh_talent_listing after update of profile_complete,active_tracks on public.professional_profiles for each row when (new.profile_complete is distinct from old.profile_complete or new.active_tracks is distinct from old.active_tracks) execute function public.trigger_refresh_talent_listing();
