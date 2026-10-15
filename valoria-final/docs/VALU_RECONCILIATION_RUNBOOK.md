# VALU reconciliation runbook

## Canonical sources

- Full assessment records: `public.valu_assessments`
- Taster/snapshot records: `public.taster_sessions`
- Authenticated accounts: `auth.users`
- Professional profiles: `public.professional_profiles`
- Assessment ownership links: `public.assessment_identity_links`
- Journey state: `public.professional_journey`
- Review ledger: `public.identity_reconciliation_reviews`

Counts across these tables are not expected to be equal. A person may have a taster and a full assessment; a newly created account may have a profile but no completed full assessment yet. Report each population separately.

## Rules

1. Use immutable authenticated account IDs and exact assessment/taster IDs as primary identity evidence.
2. Never merge on name, role, date, score, or similar-looking email alone.
3. Never transfer an assessment owned by another account or overwrite a different non-null `taster_id`.
4. Never recalculate historical scores as part of identity repair. Preserve answers, score, completion timestamp, scoring version, rubric version, and taster provenance.
5. Unknown historical taster versions remain `legacy_unknown` until immutable release/deployment evidence proves the version.
6. Every automated reconciliation decision must be recorded in `identity_reconciliation_reviews` with `review_actor_type='system'`; human decisions must carry a real authenticated `reviewed_by` account.
7. A profile row is not proof of full assessment completion. Marketplace listing must be gated by the canonical readiness function and eligibility fields.
8. Keep unlinked taster sessions in the review queue unless a stable, verified identity link is available.

## Health check

Call `private.valu_reconciliation_health()` from a privileged server-side process using the service role. Do not expose this function to anonymous or authenticated clients. Capture its output before and after each reconciliation run.

## Closure criteria

- Zero completed assessments missing their correct identity link.
- Zero assessment-owner conflicts.
- Zero completed assessments missing their expected journey/current-assessment state.
- Zero listed profiles whose readiness/eligibility/profile-complete state is false.
- All unlinked tasters are either linked by verified stable identity or recorded as unresolved in the review ledger.
- Unknown historical version provenance remains explicitly unknown rather than inferred.
- Re-run build, contract tests, database security advisors, and production route checks after code changes.
