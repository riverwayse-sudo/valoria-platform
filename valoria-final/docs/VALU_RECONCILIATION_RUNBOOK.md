# VALU reconciliation runbook

## Canonical sources

- Full assessment records: `public.valu_assessments`
- Taster/snapshot records: `public.taster_sessions`
- Authenticated accounts: `auth.users`
- Professional profiles: `public.professional_profiles`
- Assessment ownership links: `public.assessment_identity_links`
- Current journey state: `public.professional_journey`
- Canonical journey event history: `public.valoria_journey_events`
- Legacy, currently empty event table: `public.journey_events`
- Review ledger: `public.identity_reconciliation_reviews`

Counts across these tables are not expected to be equal. A person may have a taster and a full assessment; a newly created account may have a profile but no completed full assessment yet. Report each population separately. An incomplete profile is not automatically a missing assessment or identity failure; Basic/assessment-driven marketplace presence is a distinct lifecycle state.

## Rules

1. Use immutable authenticated account IDs and exact assessment/taster IDs as primary identity evidence.
2. Never merge on name, role, date, score, or similar-looking email alone.
3. Never transfer an assessment owned by another account or overwrite a different non-null `taster_id`.
4. Never recalculate historical scores as part of identity repair. Preserve answers, score, completion timestamp, scoring version, rubric version, and taster provenance.
5. Unknown historical taster versions remain `legacy_unknown` until immutable release/deployment evidence proves the version.
6. Every automated reconciliation decision must be recorded in `identity_reconciliation_reviews` with `review_actor_type='system'`; human decisions must carry a real authenticated `reviewed_by` account.
7. Do not use `profile_complete` alone as the definition of assessment completion or Basic marketplace eligibility. Use canonical readiness/eligibility and visibility fields; preserve test fixtures unless their retirement is explicitly authorized.
8. Keep unlinked taster sessions in the review queue unless a stable, verified identity link is available.
9. The populated event stream is `valoria_journey_events`; do not treat the empty legacy `journey_events` table as the current journey history.

## Health check

Call `private.valu_reconciliation_health()` from a privileged server-side process using the service role. Do not expose this function to anonymous or authenticated clients. Capture its output before and after each reconciliation run.

## Closure criteria

- Zero completed assessments missing their correct identity link.
- Zero assessment-owner conflicts.
- Zero completed assessments missing their expected journey/current-assessment state.
- Zero listed profiles with an eligibility or visibility conflict. Profile-incomplete and test-fixture counts remain separately visible for operational review and are not silently reclassified.
- Every unlinked taster is either linked by verified stable identity or recorded as unresolved in the review ledger.
- Unknown historical version provenance remains explicitly unknown rather than inferred.
- Re-run build, contract tests, database security advisors, and production route checks after code changes.
