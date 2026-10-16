# VALU reconciliation runbook

## Canonical sources

- Full assessment records: `public.valu_assessments`
- Taster/snapshot records: `public.taster_sessions`
- Authenticated accounts: `auth.users`
- Taster-to-contact evidence projection: `public.taster_identity_candidates` (service-role only)
- Professional profiles: `public.professional_profiles`
- Assessment ownership links: `public.assessment_identity_links`
- Current journey state: `public.professional_journey`
- Canonical journey event history: `public.valoria_journey_events`
- Legacy, currently empty event table: `public.journey_events`
- Review ledger: `public.identity_reconciliation_reviews`

Counts across these tables are not expected to be equal. A person may have a taster and a full assessment; a contact may be identified before they register; a newly created account may have a profile but no completed full assessment yet. Report tasters, identified contacts, authenticated accounts, profiles, completed assessments, and public marketplace listings as separate populations.

## Identity model

A taster is an assessment record, not an account. Reconciliation must represent three separate things:

1. **Taster:** immutable session ID, answers, score, timestamp, and known/unknown version provenance.
2. **Person/contact candidate:** contact details and source-record evidence that may identify who submitted the taster.
3. **Authenticated account/profile:** the verified account that can claim the taster and enter the marketplace lifecycle.

The private `taster_identity_candidates` projection stores the best evidence available from exact normalized name-and-role matches across lead captures, event registrations, and waitlist rows. It preserves source IDs for audit. Candidate evidence is not proof of account ownership by itself.

- `account_linked`: a taster already has a verified account link; retain it and audit the account.
- `contact_candidate`: one email is corroborated by multiple source records with an exact normalized name and role. The person is identified as a candidate contact, but must authenticate/verify that email before the taster is attached to an account.
- `conflicting_evidence`: multiple candidate emails; do not auto-link.
- `unresolved`: the current sources do not contain enough corroborating evidence.
- `claimed`: reserved for a completed authenticated claim flow with a verified account link.

Repeated taster records can point to the same contact. Preserve each taster ID and its original answers; flag possible duplicates rather than merging or deleting sessions automatically.

## Rules

1. Use immutable authenticated account IDs and exact assessment/taster IDs as primary identity evidence.
2. Never merge on name, role, date, score, or similar-looking email alone. Exact name-and-role plus multiple source rows can establish a *contact candidate*, not authenticated account ownership.
3. Never create fake auth users, invent emails, or create public marketplace profiles solely from contact-list rows.
4. Never transfer an assessment owned by another account or overwrite a different non-null `taster_id`.
5. Never recalculate historical scores as part of identity repair. Preserve answers, score, completion timestamp, scoring version, rubric version, and taster provenance.
6. Unknown historical taster versions remain `legacy_unknown` until immutable release/deployment evidence proves the version.
7. Every automated reconciliation decision must be recorded in `identity_reconciliation_reviews` with `review_actor_type='system'`; human decisions must carry a real authenticated `reviewed_by` account.
8. A contact candidate is not automatically a public marketplace listing. Public Basic listing requires the product's approved identity/account-claim, consent, readiness, visibility, and listing-governance gates. Full VALU completion continues to control full-assessment benefits and tier display.
9. Do not use `profile_complete` alone as the definition of assessment completion or Basic marketplace eligibility. Use canonical readiness/eligibility and visibility fields; preserve test fixtures unless their retirement is explicitly authorized.
10. Keep unlinked taster sessions in the review queue unless a stable, verified identity link is available.
11. The populated event stream is `valoria_journey_events`; do not treat the empty legacy `journey_events` table as the current journey history.
12. The candidate projection contains contact data and is service-role only; never expose it through a public roster or client-readable API.

## Operational reconciliation

For every taster, the operator must be able to answer:
- Which exact taster record is this?
- What source records support the contact candidate?
- Is there one candidate email or conflicting evidence?
- Does that email match a verified auth account?
- If not, has the person been invited to claim the taster, or is further evidence required?
- Is the resulting account/profile eligible for Basic or full marketplace presence, and which gate approved or blocked it?

Do not declare closure merely because each row has a queue entry. Closure means each taster is either account-linked through verified evidence, mapped to a supported contact candidate with a claim/recovery path, or explicitly unresolved with the evidence gap and next action recorded. The count of these outcomes must reconcile to the total taster count.

## Health check

Call `private.valu_reconciliation_health()` from a privileged server-side process using the service role. Do not expose this function to anonymous or authenticated clients. Capture its output before and after each reconciliation run.

## Closure criteria

- Zero completed assessments missing their correct identity link.
- Zero assessment-owner conflicts.
- Zero completed assessments missing their expected journey/current-assessment state.
- Zero listed profiles with an eligibility or visibility conflict. Profile-incomplete and test-fixture counts remain separately visible for operational review and are not silently reclassified.
- Every taster has a row in `taster_identity_candidates` and is categorized as account-linked, contact-candidate, conflicting-evidence, or unresolved.
- Every contact candidate without an account has a verified-email claim/recovery next action; no account ownership is inferred from name, role, score, or dates.
- Unknown historical version provenance remains explicitly unknown rather than inferred.
- Re-run build, contract tests, database security advisors, and production route checks after code changes.


## Continuous operational monitoring

The private health report is run by the authenticated Vercel cron endpoint `/api/reconciliation-health` daily at 04:00 UTC (05:00 Nigeria time). The endpoint:
- requires `CRON_SECRET` and uses service-role credentials server-side only;
- reads aggregate health metrics through a service-role-only RPC wrapper;
- stores timestamped aggregate snapshots and alert signatures in the private `valu_reconciliation_health_snapshots` table;
- creates an admin notification when alert conditions appear, change, or clear, rather than duplicating the same notification every day; retries on the next scheduled run if delivery or acknowledgement fails;
- logs a compact aggregate summary only and never writes participant names, emails, account IDs, or raw evidence into telemetry.

The service-role-only health function now includes operational counters for:

- Durable snapshot progress: in-progress, expired-in-progress, and completed rows.
- Taster identity projection: account-linked, contact-candidate, and unresolved counts.
- Marketplace projection integrity: listed profiles versus public roster, plus stale or non-listed roster rows.
- Capability readiness: active capabilities and eligible capabilities whose status is not listed.
- Journey freshness: non-completed/non-closed journey records not updated for more than seven days.
- Existing assessment ownership, journey, eligibility, profile-incomplete, and test-fixture checks.

Invoke `private.valu_reconciliation_health()` only from a trusted server-side process with the service role. Never expose raw candidate records, email addresses, identity references, or this function to browser clients. Store a timestamped aggregate snapshot in operational logs or a private monitoring store; do not persist contact PII in telemetry.

### Alert conditions

Treat these as review triggers, not automatic repair instructions:

- Any non-zero assessment-owner conflict, completed assessment missing its correct identity link, completed assessment missing its journey/current-assessment state, or listing eligibility/visibility conflict.
- Any difference between listed profile count and public roster count, or any profile/roster membership mismatch.
- Any expired progress row still marked in progress.
- Any eligible active capability not in listed status.
- Any journey older than seven days that is not completed/closed.
- A sustained increase in unresolved identity candidates or failed/retried submissions.

Do not automatically merge accounts, delete snapshots, alter assessment scores, publish profiles, or change identity ownership from a monitoring result. Create a review item with record IDs and evidence, then use the identity reconciliation rules above.

### Current live baseline (2026-10-16 23:14 UTC)

The 2026-10-15 baseline above has been superseded by a fresh production query. Do not use the earlier statement of zero missing assessment-to-taster links as current.

- Completed full assessments: 17; **17 have no `taster_id`**.
- Of those 17 missing-link assessments, 5 have review-ledger entries and 12 have no review entry. The five assessment reviews are account-match decisions; they do not resolve the missing taster links.
- Exact contact-email cross-checks produced one candidate for a missing-link assessment, but its name/role evidence conflicts. There are zero missing-link assessments with an exact candidate name-and-role match. No link was inferred.
- Completed taster sessions: 36; 34 have no authenticated account owner.
- Taster identity candidate rows: 36 (2 account-linked, 16 contact candidates, 18 unresolved, 0 conflicting-evidence status at this snapshot).
- Latest review decisions cover 39 distinct source records: 5 assessment records marked verified-match, 1 taster marked verified-match, and 33 tasters marked unmatched. All 39 remain open; a verified match is not closed until the identity correction is applied and verified. Closed-without-link decisions: 0.
- Professional profiles: 18; listed profiles/public roster rows: 17/17, with zero roster membership mismatches.
- Active capabilities: 20; eligible active capabilities waiting in a non-listed status: 0.
- Assessment identity audit links: no owner conflicts; 0 completed assessments missing the separate `assessment_identity_links` audit row. This metric is distinct from the **17 missing `taster_id` links**.
- Completed assessment journey/current-assessment mismatches: 0; completed assessments without a profile: 0.
- Unknown historical taster version provenance: 35; preserve as unknown until immutable deployment evidence proves the version.
- Non-completed/non-closed journey records stale for more than seven days: 5; inspect next action and event history before changing state.
- Durable taster progress: 1 in progress, 0 expired in progress, 1 completed. This counter describes progress records, not the 36 completed taster-session rows.
- The health report now counts missing taster links and unreviewed missing-link assessments separately, and counts the latest review decision per source. Only latest `resolved_no_link` decisions are closed.

### Prevention protocol for new full assessments

- The API rejects a full-assessment submission without a syntactically valid snapshot ID.
- Before saving a full assessment, the API requires the exact snapshot to exist, be completed, match the submitted name and role, have an authenticated account owner, and have a confirmed account email.
- The database insert trigger independently requires a completed, account-owned snapshot, matching name/role, and owner alignment. A request that bypasses the API cannot create a new full assessment with a null or conflicting snapshot/owner.
- Foreign keys now use `ON DELETE RESTRICT` for `valu_assessments.taster_id` and `valu_assessments.user_id`. Deleting a linked snapshot or account cannot silently null the taster link or cascade-delete the assessment. Use an approved account deactivation/retention process instead of deleting assessment owners.
- The database guard applies to new inserts so historical records remain repairable. It does not infer or backfill old links.
- After a new full assessment is saved, the handoff must still confirm the canonical assessment-to-taster link, identity audit link, profile metadata, and `professional_journey` refresh. A failed post-save handoff is a monitored partial-completion incident, not a successful end state.

The live POST flow (init → save → reload/load → complete/submit → idempotent retry) remains a release verification item until exercised through an authorized production test path. A GET returning 405 is expected for the POST-only progress API and does not prove the write flow works.
