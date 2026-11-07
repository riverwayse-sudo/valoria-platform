-- The directory reads a deliberately limited public projection from the roster.
-- RLS still enforces explicit consent, current eligibility, non-test status and
-- revocation checks through public.marketplace_public_read.
-- Do not grant bio, internal seniority metadata or projection refresh metadata.

grant select (
  professional_id,
  full_name,
  location,
  languages,
  headline,
  current_job_title,
  capability,
  track,
  capabilities,
  atb_id,
  display_initials,
  photo_url,
  industry,
  skills,
  topics,
  programme_types,
  availability,
  valu_index,
  cluster_scores,
  designation,
  fee_range,
  salary_expectation,
  availability_status,
  assessment_access,
  assessment_summary,
  selected_capabilities
) on public.marketplace_public_roster to anon, authenticated;

comment on table public.marketplace_public_roster is
'Consent-gated public marketplace projection. Anonymous and authenticated roles receive column-level SELECT only for approved directory fields; RLS policy marketplace_public_read enforces explicit consent and listing eligibility.';
