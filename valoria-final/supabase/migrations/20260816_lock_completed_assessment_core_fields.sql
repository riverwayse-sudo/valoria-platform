-- Make completed VALU assessments immutable at the database boundary.
-- Non-core operational fields (ownership, email delivery, report state, etc.)
-- remain updateable by their existing server-side flows.

create or replace function public.prevent_completed_assessment_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.completed_at is not null then
    if new.identity_hash is distinct from old.identity_hash
      or new.name is distinct from old.name
      or new.role is distinct from old.role
      or new.answers is distinct from old.answers
      or new.total_score is distinct from old.total_score
      or new.designation is distinct from old.designation
      or new.cluster_scores is distinct from old.cluster_scores
      or new.skill_scores is distinct from old.skill_scores
      or new.completed_at is distinct from old.completed_at then
      raise exception 'Completed assessment core fields are immutable';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_completed_assessment_mutation() from public, anon, authenticated;

drop trigger if exists trg_prevent_completed_assessment_mutation on public.valu_assessments;
create trigger trg_prevent_completed_assessment_mutation
before update on public.valu_assessments
for each row execute function public.prevent_completed_assessment_mutation();
