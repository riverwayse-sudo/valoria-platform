-- New taster registrations use the approved standalone Intelligence instrument.
-- Existing in-progress rows retain their stored version and remain resumable.
alter table public.taster_progress
  alter column taster_version set default '4.2';
