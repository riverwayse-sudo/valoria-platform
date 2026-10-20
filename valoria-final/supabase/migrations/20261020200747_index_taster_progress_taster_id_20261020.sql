-- Index the foreign key used by identity reconciliation and snapshot progress joins.
CREATE INDEX IF NOT EXISTS taster_progress_taster_id_idx
  ON public.taster_progress (taster_id);
