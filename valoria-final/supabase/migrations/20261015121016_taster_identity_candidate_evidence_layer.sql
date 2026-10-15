-- Evidence-backed contact candidates for legacy tasters.
-- Do not create auth accounts or public profiles from contact-list rows.
create table if not exists public.taster_identity_candidates (
  taster_id uuid primary key references public.taster_sessions(id) on delete cascade,
  candidate_name text,
  candidate_role text,
  candidate_email text,
  evidence_source_count integer not null default 0,
  evidence_sources text[] not null default '{}',
  evidence_refs jsonb not null default '[]'::jsonb,
  same_contact_taster_count integer not null default 1,
  identity_status text not null default 'unresolved'
    check (identity_status in ('account_linked','contact_candidate','conflicting_evidence','unresolved','claimed')),
  linked_user_id uuid references auth.users(id) on delete set null,
  resolution_notes text,
  first_reconciled_at timestamptz not null default now(),
  last_reconciled_at timestamptz not null default now(),
  check (identity_status not in ('contact_candidate','claimed') or candidate_email is not null),
  check (identity_status not in ('account_linked','claimed') or linked_user_id is not null)
);
create index if not exists idx_taster_identity_candidates_status on public.taster_identity_candidates(identity_status);
create index if not exists idx_taster_identity_candidates_email on public.taster_identity_candidates(lower(candidate_email)) where candidate_email is not null;
create index if not exists idx_taster_identity_candidates_linked_user on public.taster_identity_candidates(linked_user_id) where linked_user_id is not null;
alter table public.taster_identity_candidates enable row level security;
revoke all on public.taster_identity_candidates from anon, authenticated;
grant select, insert, update, delete on public.taster_identity_candidates to service_role;

with src as (
 select 'lead_capture'::text source_type,id::text source_id,lower(trim(full_name)) n,lower(trim(email)) e,lower(trim(coalesce(role,''))) r from public.lead_captures where nullif(trim(full_name),'') is not null and nullif(trim(email),'') is not null
 union all select 'event_registration',id::text,lower(trim(full_name)),lower(trim(email)),lower(trim(coalesce(role,''))) from public.professional_standard_event_registrations where nullif(trim(full_name),'') is not null and nullif(trim(email),'') is not null
 union all select 'waitlist',id::text,lower(trim(full_name)),lower(trim(email)),lower(trim(coalesce(role,''))) from public.waitlist where nullif(trim(full_name),'') is not null and nullif(trim(email),'') is not null
), m as (
 select t.id tid,t.name,t.role,t.user_id,s.e,s.source_type,s.source_id from public.taster_sessions t join src s on s.n=lower(trim(t.name)) and s.r=lower(trim(coalesce(t.role,'')))
), a as (
 select t.id tid,t.name,t.role,t.user_id,count(distinct m.e) ec,min(m.e) sole_email,count(distinct m.source_id) sc,
 coalesce(array_agg(distinct m.source_type order by m.source_type) filter(where m.source_type is not null),'{}'::text[]) st,
 coalesce(jsonb_agg(distinct jsonb_build_object('source',m.source_type,'source_id',m.source_id,'email',m.e)) filter(where m.source_id is not null),'[]'::jsonb) refs
 from public.taster_sessions t left join m on m.tid=t.id group by t.id,t.name,t.role,t.user_id
), cc as (
 select lower(trim(name)) n,lower(trim(coalesce(role,''))) r,sole_email e,count(*) c from a where ec=1 and sc>=2 group by 1,2,3
)
insert into public.taster_identity_candidates(taster_id,candidate_name,candidate_role,candidate_email,evidence_source_count,evidence_sources,evidence_refs,same_contact_taster_count,identity_status,linked_user_id,resolution_notes)
select a.tid,a.name,a.role,case when a.ec=1 and a.sc>=2 then a.sole_email end,a.sc,a.st,a.refs,
 case when a.ec=1 and a.sc>=2 then coalesce(cc.c,1) else 1 end,
 case when a.user_id is not null then 'account_linked' when a.ec>1 then 'conflicting_evidence' when a.ec=1 and a.sc>=2 then 'contact_candidate' else 'unresolved' end,
 a.user_id,
 case when a.user_id is not null then 'Existing account link preserved.'
 when a.ec>1 then 'Conflicting email candidates; manual verification required.'
 when a.ec=1 and a.sc>=2 then 'Contact candidate supported by exact normalized name and role across multiple source rows; account ownership still requires authentication.'
 else 'No corroborated exact name-and-role contact candidate in current source tables.' end
from a left join cc on cc.n=lower(trim(a.name)) and cc.r=lower(trim(coalesce(a.role,''))) and cc.e=a.sole_email
on conflict(taster_id) do update set candidate_name=excluded.candidate_name,candidate_role=excluded.candidate_role,candidate_email=excluded.candidate_email,evidence_source_count=excluded.evidence_source_count,evidence_sources=excluded.evidence_sources,evidence_refs=excluded.evidence_refs,same_contact_taster_count=excluded.same_contact_taster_count,last_reconciled_at=now();
update public.taster_identity_candidates c set identity_status='account_linked',linked_user_id=t.user_id,candidate_email=coalesce(lower(trim(u.email)),c.candidate_email),last_reconciled_at=now()
from public.taster_sessions t join auth.users u on u.id=t.user_id where c.taster_id=t.id and t.user_id is not null;
comment on table public.taster_identity_candidates is 'Private operational reconciliation projection. Service-role only; not a public marketplace source of truth.';
