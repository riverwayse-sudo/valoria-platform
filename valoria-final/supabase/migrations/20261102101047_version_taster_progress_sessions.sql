alter table public.taster_progress
  add column if not exists taster_version text,
  add column if not exists total_questions smallint;

update public.taster_progress p
set
  taster_version = case
    when p.current_question > 9
      or (p.created_at < timestamptz '2026-10-29 22:00:00+00' and p.answers <> '{}'::jsonb)
    then 'legacy-15'
    else '4.1'
  end,
  total_questions = case
    when p.current_question > 9
      or (p.created_at < timestamptz '2026-10-29 22:00:00+00' and p.answers <> '{}'::jsonb)
    then 15
    else 9
  end
where taster_version is null or total_questions is null;

alter table public.taster_progress
  alter column taster_version set default '4.1',
  alter column taster_version set not null,
  alter column total_questions set default 9,
  alter column total_questions set not null;

alter table public.taster_progress
  add constraint taster_progress_question_bounds
  check (current_question >= 0 and current_question <= total_questions);
