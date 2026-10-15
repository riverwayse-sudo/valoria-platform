# Valoria Engineering Integrity Protocol

## Purpose and source of truth
Valoria Institute is an institutional assessment, learning, certification, and professional-capability platform. Data integrity and participant trust outrank release speed and cosmetic completion. Supabase Auth user ID is the account identity. A taster session and a full assessment are separate immutable records. One authenticated account maps to one professional profile, and that profile may have multiple capabilities. Public listing is a governed state, not a synonym for account creation, profile existence, or assessment completion.

## Non-negotiable invariants
1. Never infer ownership from name, role, score, or timestamp.
2. Never rewrite historical answers, scores, completion timestamps, or version provenance during identity repair.
3. Never expose private identity-candidate data or service-role credentials to browsers.
4. Never treat a successful partial write as a successful end-to-end journey.
5. Never bypass consent, eligibility, capability, and visibility gates to create a listing.
6. Preserve genuine participant records and test fixtures unless a documented change explicitly authorizes retirement.
7. Report contacts, accounts, tasters, full assessment attempts, completed assessments, profiles, capabilities, eligible capabilities, visible listings, and fixtures as separate populations.

## Data contracts
- Validate required fields at every server API boundary even when the UI uses required fields.
- Normalize email by trimming and lowercasing; validate format and a 254-character maximum.
- Validate type, bounds, enum membership, and answer shape on the server. Never trust client-supplied owner IDs, scores, scoring versions, eligibility, or listing state.
- Retriable submissions require a stable attempt/request key and must not create duplicate records. This remains an implementation requirement until the schema and integration tests prove it.
- Multi-row invariants should use database constraints or narrowly scoped RPCs rather than client sequencing.
- If a secondary write fails after the canonical record is saved, record a durable retry/review item or expose a recoverable state. Log the record ID and failing stage, not secrets or assessment answers.

## Canonical journey
Conceptual states: visitor → contact captured → account created → email confirmed → snapshot started/completed → full assessment started/completed → profile ready → capability eligible → listing approved/visible. Returning users and snapshot-only participants may enter at different states; unresolved identity remains unresolved until supported evidence exists.

Every transition needs server-side preconditions, a stable entity ID, idempotent retry semantics, a durable history record, and a recovery path. The canonical journey event table is valoria_journey_events; do not assume the legacy journey_events table is canonical. A failed projection, notification, or email must not erase a completed upstream record. Snapshot scores remain directional and never become the official VALU Index.

## Security and privacy
- Derive account identity from a verified server-side session, not request payloads.
- Email claims require confirmed email, exact normalized matching, conditional ownership writes, and conflict handling.
- Keep private candidate tables service-role-only and RLS-protected; privileged RPC grants must be narrow.
- Apply shared rate limits to account creation, submission, claims, and recovery. Use no-store responses for identity/assessment endpoints.
- Never log passwords, access tokens, service-role keys, full answers, or unnecessary personal data.
- Record consent purpose, source, and timestamp where required; separate transactional messages from marketing and respect suppression/unsubscribe state.
- Do not upgrade Supabase as a workaround. Document unavailable plan features as residual risks and apply feasible compensating controls.

## Change and release gates
1. Inspect repository, branch, related code/tests/migrations, environment, and current deployed commit.
2. Capture a read-only baseline for affected entities and states.
3. Define failure mode, scope, acceptance tests, non-goals, migration impact, and rollback approach.
4. Implement on a named branch and review the full diff for unrelated edits, secrets, PII, and unsupported assumptions.
5. Run unit/contract tests, build, migration checks, security checks, and negative-path/retry tests.
6. Verify preview behavior and the exact commit SHA before production release.
7. Run production smoke tests, inspect errors, and reconcile before/after counts.
8. Report evidence, failures, residual risks, and rollback steps. A green build alone is not acceptance.

## Reconciliation closure
Every taster must have a projection or a monitored recovery item. No completed assessment may lack its correct identity link or expected journey state. No owner conflict may remain silently unresolved. No visible listing may conflict with eligibility/visibility rules. Unknown historical versions remain unknown. Every unresolved item must state the evidence gap, owner, next action, and age. Queue population alone is not closure.

## AI anti-slop sequence
Inspect → baseline → specify → implement → prove → release → reconcile → report. Never invent schema fields, routes, deployment states, or test results; never infer identity; never rewrite unrelated UI during integrity repairs; never claim a protocol is implemented merely because documentation exists; never claim a deployment fix without verifying its commit and behavior.
