-- Allow the opening session to begin before the participant has an identity.
--
-- The two-session journey starts the participant at Question 1 with no account
-- and no personal details. taster-progress 'init' therefore creates the resumable
-- row with identity fields unset, and attaches them later with 'identify' at the
-- session break.
--
-- The table was created for the retired identity-first flow with NOT NULL on
-- name, role, experience and email. Without relaxing those constraints every
-- anonymous 'init' fails with a 23502 not-null violation, which the handler
-- surfaced as "We could not establish a resumable session" — the participant
-- could not begin the assessment at all.
--
-- Nullable identity is the correct contract here: the email CHECK already passes
-- for NULL, and 'identify' enforces that a valid name, role, email and experience
-- band are supplied before the snapshot can be submitted. Existing rows are
-- untouched; only the column defaults for future inserts change.

ALTER TABLE public.taster_progress
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN role DROP NOT NULL,
  ALTER COLUMN experience DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN public.taster_progress.name IS
  'Participant name. NULL until the identity step at the session break.';
COMMENT ON COLUMN public.taster_progress.email IS
  'Contact email. NULL until the identity step at the session break.';
