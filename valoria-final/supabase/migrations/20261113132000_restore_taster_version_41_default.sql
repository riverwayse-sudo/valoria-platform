-- Keep staging aligned with the recalled production Taster baseline.
-- This changes only the default for new progress rows; existing participant
-- sessions and progress records are not rewritten.
alter table public.taster_progress
  alter column taster_version set default '4.1';
