-- supabase/sync-valu-to-profile.sql
--
-- Root fix for: professional_profiles.valu_index / cluster_scores /
-- designation are read by profile/setup and the public profile page,
-- but nothing was ever writing to them. The real result lands in
-- valu_assessments (written by the platform's submit-assessment.js /
-- update-assessment.js) and never made it across.
--
-- This trigger copies the result over automatically the moment a
-- valu_assessments row has a user_id attached (or is updated), so new
-- assessments sync going forward with zero app-code involvement.
--
-- Run this in the Supabase SQL editor once. Safe to re-run.

create or replace function public.sync_valu_assessment_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    update public.professional_profiles
    set
      valu_index      = new.total_score,
      cluster_scores  = new.cluster_scores,
      designation     = new.designation,
      -- Only ever upgrades listing_status to 'listed' on a qualifying score;
      -- never downgrades an existing status (e.g. one an admin already
      -- reviewed and approved manually).
      listing_status  = case
        when new.total_score >= 35 and listing_status is distinct from 'listed'
          then 'listed'
        else listing_status
      end,
      updated_at = now()
    where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_valu_to_profile on public.valu_assessments;

create trigger trg_sync_valu_to_profile
after insert or update of user_id, total_score, cluster_scores, designation
on public.valu_assessments
for each row
execute function public.sync_valu_assessment_to_profile();

-- ── Required for the app's fallback query too ────────────────────────────
-- profile/setup/page.jsx also queries valu_assessments directly (by
-- user_id or email) as a client-side fallback for anyone whose row was
-- written before this trigger existed. That query needs an RLS policy
-- letting a logged-in user read their own row — without this, the
-- fallback silently returns nothing.
alter table public.valu_assessments enable row level security;

drop policy if exists "authenticated can read own assessment" on public.valu_assessments;
create policy "authenticated can read own assessment"
on public.valu_assessments
for select
to authenticated
using (auth.uid() = user_id or lower(email) = lower(auth.email()));

-- ── Backfill for anyone who already completed the assessment before ─────
-- this trigger existed and whose profile row already exists. Run once,
-- after creating the trigger above. No-op for anyone without both rows.
update public.professional_profiles p
set
  valu_index     = va.total_score,
  cluster_scores = va.cluster_scores,
  designation    = va.designation,
  listing_status = case
    when va.total_score >= 35 and p.listing_status is distinct from 'listed'
      then 'listed'
    else p.listing_status
  end,
  updated_at = now()
from public.valu_assessments va
where va.user_id = p.id
  and p.valu_index is null
  and va.total_score is not null;
