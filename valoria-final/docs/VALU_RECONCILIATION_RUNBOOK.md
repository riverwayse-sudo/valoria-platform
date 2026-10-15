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
