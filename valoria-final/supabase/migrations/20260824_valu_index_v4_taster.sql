-- VALU Index v4: experience context + separate taster persistence.
-- Full assessment scoring remains server-authoritative.

ALTER TABLE IF EXISTS public.valu_assessments
  ADD COLUMN IF NOT EXISTS experience TEXT;

CREATE TABLE IF NOT EXISTS public.taster_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  experience TEXT,
  taster_answers JSONB NOT NULL,
  cluster_scores JSONB NOT NULL,
  strongest_cluster TEXT NOT NULL,
  weakest_cluster TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT taster_sessions_experience_check
    CHECK (experience IS NULL OR experience IN ('0-3','4-8','9-15','15+')),
  CONSTRAINT taster_sessions_strongest_check
    CHECK (strongest_cluster IN ('P','R','I','M','E')),
  CONSTRAINT taster_sessions_weakest_check
    CHECK (weakest_cluster IN ('P','R','I','M','E'))
);

ALTER TABLE public.taster_sessions ENABLE ROW LEVEL SECURITY;

-- Taster writes go through /api/save-taster using the service-role key.
-- No public INSERT/SELECT policy is intentionally created.
