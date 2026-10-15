-- Close VALU identity reconciliation audit gaps without weakening ownership guarantees.
alter table public.identity_reconciliation_reviews
  add column if not exists review_actor_type text not null default 'human';

update public.identity_reconciliation_reviews
set review_actor_type = case when reviewed_by is null then 'system' else 'human' end
where review_actor_type is null
   or (review_actor_type = 'human' and reviewed_by is null)
   or (review_actor_type = 'system' and reviewed_by is not null);

alter table public.identity_reconciliation_reviews
  alter column reviewed_by drop not null;

alter table public.identity_reconciliation_reviews
  drop constraint if exists identity_reconciliation_review_actor_check;

alter table public.identity_reconciliation_reviews
  add constraint identity_reconciliation_review_actor_check
  check (
    (review_actor_type = 'human' and reviewed_by is not null)
    or (review_actor_type = 'system' and reviewed_by is null)
  );

create index if not exists identity_reconciliation_reviews_reviewed_by_idx
  on public.identity_reconciliation_reviews (reviewed_by)
  where reviewed_by is not null;

create or replace function private.valu_reconciliation_health()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  report jsonb;
begin
  select jsonb_build_object(
    'generated_at', now(),
    'full_assessments_total', (select count(*) from public.valu_assessments),
    'full_assessments_completed', (select count(*) from public.valu_assessments where completed_at is not null),
    'professional_profiles_total', (select count(*) from public.professional_profiles),
    'profiles_without_full_assessment', (
      select count(*) from public.professional_profiles p
      where not exists (select 1 from public.valu_assessments a where a.user_id = p.id and a.completed_at is not null)
    ),
    'completed_assessments_without_profile', (
      select count(*) from public.valu_assessments a
      where a.completed_at is not null
        and not exists (select 1 from public.professional_profiles p where p.id = a.user_id)
    ),
    'completed_assessments_missing_identity_link', (
      select count(*) from public.valu_assessments a
      where a.completed_at is not null and a.user_id is not null
        and not exists (
          select 1 from public.assessment_identity_links l
          where l.assessment_id = a.id and l.user_id = a.user_id
        )
    ),
    'assessment_identity_owner_conflicts', (
      select count(*) from public.assessment_identity_links l
      join public.valu_assessments a on a.id = l.assessment_id
      where l.user_id is distinct from a.user_id
    ),
    'journey_missing_or_wrong_current_assessment', (
      select count(*) from public.valu_assessments a
      left join public.professional_journey j
        on j.user_id = a.user_id and j.current_assessment_id = a.id
      where a.completed_at is not null and j.user_id is null
    ),
    'listed_profiles_violating_readiness', (
      select count(*) from public.professional_profiles p
      where p.listing_status = 'listed'
        and (
          p.eligible_for_listing is distinct from true
          or p.profile_complete is distinct from true
          or p.visibility is distinct from 'public'
        )
    ),
    'taster_sessions_total', (select count(*) from public.taster_sessions),
    'taster_sessions_unlinked', (select count(*) from public.taster_sessions where user_id is null),
    'taster_version_unknown', (
      select count(*) from public.taster_sessions
      where taster_version is null or taster_version_source = 'legacy_unknown'
    ),
    'identity_review_queue_open', (
      select count(*) from public.identity_reconciliation_reviews
      where decision in ('candidate_match', 'conflict', 'unmatched')
    ),
    'journey_events_count', (select count(*) from public.journey_events),
    'valoria_journey_events_count', (select count(*) from public.valoria_journey_events)
  ) into report;

  return report;
end;
$$;

revoke all on function private.valu_reconciliation_health() from public, anon, authenticated;
grant execute on function private.valu_reconciliation_health() to service_role;
