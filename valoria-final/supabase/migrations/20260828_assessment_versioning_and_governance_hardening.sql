-- VALU v4 assessment provenance and governance hardening.
-- Completed assessments retain the scoring contract that produced them.

alter table public.valu_assessments
  add column if not exists scoring_version text not null default 'VALU-v4.0',
  add column if not exists rubric_version text not null default 'PRIME-v4';

create table if not exists public.marketplace_governance_events (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  previous_status text,
  new_status text not null check (new_status in ('listed','unlisted','suspended','revoked')),
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.marketplace_governance_events enable row level security;
revoke all on public.marketplace_governance_events from public,anon,authenticated;
grant select,insert,update,delete on public.marketplace_governance_events to service_role;

-- A completed assessment must preserve its provenance. New scoring contracts create new assessments.
create or replace function private.prevent_completed_assessment_mutation()
returns trigger language plpgsql as $$
begin
  if old.completed_at is not null then
    if new.completed_at is distinct from old.completed_at
       or new.total_score is distinct from old.total_score
       or new.scoring_version is distinct from old.scoring_version
       or new.rubric_version is distinct from old.rubric_version then
      raise exception 'completed VALU assessment is immutable; create a new assessment attempt';
    end if;
  end if;
  return new;
end; $$;
revoke all on function private.prevent_completed_assessment_mutation() from public,anon,authenticated;

drop trigger if exists trg_prevent_completed_assessment_mutation on public.valu_assessments;
create trigger trg_prevent_completed_assessment_mutation
before update on public.valu_assessments
for each row execute function private.prevent_completed_assessment_mutation();

-- Do not permit non-service clients to invoke the governance audit surface.
revoke all on function private.set_marketplace_listing_status(uuid,text,text) from public,anon,authenticated;
grant execute on function private.set_marketplace_listing_status(uuid,text,text) to service_role;
