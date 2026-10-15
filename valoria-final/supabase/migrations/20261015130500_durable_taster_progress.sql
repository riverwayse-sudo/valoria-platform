CREATE TABLE IF NOT EXISTS public.taster_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_token_hash text NOT NULL UNIQUE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  role text NOT NULL CHECK (length(btrim(role)) BETWEEN 1 AND 160),
  experience text NOT NULL,
  email text NOT NULL CHECK (length(email) <= 254),
  current_question smallint NOT NULL DEFAULT 0 CHECK (current_question BETWEEN 0 AND 15),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object'),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  taster_id uuid NULL REFERENCES public.taster_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS taster_progress_status_updated_idx
  ON public.taster_progress(status, updated_at);

ALTER TABLE public.taster_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.taster_progress FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.taster_progress TO service_role;

COMMENT ON TABLE public.taster_progress IS
  'Private resumable progress for the 15-question VALU snapshot. Resume tokens are stored as SHA-256 hashes; service-role API only.';
