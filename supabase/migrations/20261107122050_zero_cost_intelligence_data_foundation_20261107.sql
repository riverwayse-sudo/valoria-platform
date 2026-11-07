-- Valoria zero-cost intelligence data foundation.
-- Staging only until reviewed and promoted through the normal release process.
-- Uses Supabase PostgreSQL + pgvector; no external vector database or paid API.

create extension if not exists vector with schema extensions;

create table if not exists private.professional_search_embeddings (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null
    references public.professional_profiles(id) on delete cascade,
  embedding_model text not null default 'gte-small',
  embedding_dimensions smallint not null default 384
    check (embedding_dimensions = 384),
  source_fingerprint text not null,
  embedding extensions.vector(384) not null,
  embedded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, embedding_model)
);

comment on table private.professional_search_embeddings is
  'Private semantic-search index for professional profile discovery. Embeddings are derived from approved, public-eligible profile fields only; never use assessment answers or private documents.';

comment on column private.professional_search_embeddings.source_fingerprint is
  'Hash of the approved source text used to generate the embedding; regenerate when the source changes.';

create index if not exists professional_search_embeddings_professional_idx
  on private.professional_search_embeddings (professional_id);

alter table private.professional_search_embeddings enable row level security;

revoke all on table private.professional_search_embeddings from public, anon, authenticated;
grant all on table private.professional_search_embeddings to service_role;
