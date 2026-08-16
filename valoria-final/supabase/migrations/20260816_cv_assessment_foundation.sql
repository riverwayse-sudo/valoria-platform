-- Valoria CV Evidence Assessment foundation.
-- Deterministic, auditable assessment data; no external AI dependency.

create table if not exists public.cv_assessments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete restrict,
  document_id uuid references public.professional_documents(id) on delete restrict,
  status text not null default 'UPLOADED'
    check (status in ('UPLOADED','PROCESSING','ASSESSED','REVIEW_REQUIRED','FAILED','SUPERSEDED')),
  score numeric(5,2),
  assessment_version text not null default 'v1',
  extracted_text_hash text,
  structured_data jsonb not null default '{}'::jsonb,
  dimension_scores jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  assessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cv_assessments_active_document_idx
on public.cv_assessments(document_id)
where status <> 'SUPERSEDED';

create index if not exists cv_assessments_professional_idx
on public.cv_assessments(professional_id, created_at desc);

alter table public.cv_assessments enable row level security;
revoke all on public.cv_assessments from anon;

grant select on public.cv_assessments to authenticated;

drop policy if exists cv_assessments_owner_select on public.cv_assessments;
create policy cv_assessments_owner_select
on public.cv_assessments for select to authenticated
using (professional_id = auth.uid());

-- Assessment creation/mutation belongs to the trusted processing layer.
revoke insert, update, delete on public.cv_assessments from authenticated;

create or replace function public.create_cv_assessment(p_document_id uuid)
returns public.cv_assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.professional_documents;
  r public.cv_assessments;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into d from public.professional_documents where id = p_document_id for update;
  if d.id is null then raise exception 'CV document not found'; end if;
  if d.professional_id <> auth.uid() then raise exception 'Document ownership check failed'; end if;
  if lower(coalesce(d.document_type,'')) <> 'cv' then raise exception 'Document is not a CV'; end if;

  if exists (select 1 from public.cv_assessments where document_id=p_document_id and status <> 'SUPERSEDED') then
    raise exception 'An active assessment already exists for this CV';
  end if;

  insert into public.cv_assessments (professional_id, document_id, status)
  values (d.professional_id, d.id, 'UPLOADED')
  returning * into r;

  return r;
end;
$$;

revoke execute on function public.create_cv_assessment(uuid) from public, anon;
grant execute on function public.create_cv_assessment(uuid) to authenticated;

comment on table public.cv_assessments is
'Valoria deterministic CV evidence assessment. Scores and evidence are auditable and versioned; AI is optional and never authoritative.';
