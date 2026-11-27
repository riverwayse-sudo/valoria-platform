# Valoria Platform Invariants

**Status:** Mandatory product and engineering constraints  
**Scope:** `valoria-site`, `valoria-platform`, Supabase and Cloudflare production services  
**Governance:** `VALORIA_UNIFIED_GOVERNANCE.md` and `VALORIA_REQUIREMENTS_REGISTER.md`

These invariants protect approved behaviour. They do not authorize redesign, reinterpretation or silent policy changes.

## 1. Change isolation

- Identify the exact target component, files, direct dependencies and explicit exclusions before editing.
- Keep fixes minimal. Do not bundle unrelated cleanup, formatting, redesign, renaming or dependency upgrades.
- Existing verified behaviour is the baseline. Prove the requested behaviour changed and protected neighbouring behaviour did not.
- Governance/documentation-only changes must not alter application runtime, styles, assets, routes, API handlers, migrations, Worker configuration or production data.
- If the change crosses its declared boundary, stop and update the impact assessment before proceeding.

## 2. Website and display invariants

For changes affecting rendered pages, route data, shared styles, assets or component behaviour:

- Preserve unrelated layouts, section order, typography, colour tokens, spacing, navigation, links, responsive behaviour and interaction states.
- Preserve public routes, canonical URLs, metadata and loading/error behaviour unless explicitly in scope.
- Protect homepage profile rails, profile cards, marketplace cards/listings, search/filter behaviour and public profile rendering unless explicitly in scope.
- Do not change shared CSS, global tokens, root layouts, navigation, shared cards or common data projections for a local fix without mapping every consumer.
- Source assertions and HTTP 200 responses do not prove visual or interaction parity.
- Compare before/after at matching desktop and mobile viewports with equivalent fixtures and state.
- For data-backed display changes, verify both the data contract and rendered output using synthetic or otherwise authorized data.
- Unexplained visual regression, missing content, route failure, console error, overflow, accessibility regression or interaction failure blocks release.

## 3. Product and data invariants

- The 9-question Taster and separate 58-question full assessment remain distinct records and journeys. The Taster is not part of or deducted from the full assessment.
- The full assessment remains 54 scored questions plus 4 validity anchors.
- New Taster sessions use the approved nine-question version. Historical, explicitly versioned 15-question sessions remain resumable only as legacy compatibility; never make them the default for new sessions.
- Create the participant account at Taster entry and request email confirmation only after Taster completion. Before confirmation, permit only a server-issued, short-lived, single-use Taster-start/continuation capability; do not create a general authenticated session or permit dashboard, profile, marketplace or Full VALU access. After confirmation, verify ownership and idempotently link the exact saved Taster before dashboard access. Preserve the explicitly supported legacy recovery path.
- Taster and full-assessment answers, progress and completion remain independent, attributable and server-confirmed.
- VALU is presented in points. One canonical server-side implementation owns scoring and designation; do not duplicate or locally reinterpret scoring.
- PRIME remains five clusters and 17 canonical skills. Use approved canonical labels and mappings.
- The 9 November 2026 user-approved VALU rule resolves the older PDF discrepancy: 90/75/55/35 merit bands, no public merit designation below 35, and a separate 35-point eligibility/listing gate. Keep site, platform and database writers aligned; never backfill historical labels by inference.
- One account has one canonical professional profile; multiple declared capabilities do not create duplicate profiles. Taster completion automatically creates/refreshes the approved profile and eligibility projection without an administrator approval gate; public visibility still requires participant-entered consent and eligibility.
- Account/profile creation, assessment completion, eligibility, participant consent and public discoverability are separate states.
- Public visibility requires current, explicit participant-entered consent through the approved profile setup/edit flow. Administrator attestation, inferred consent or marketing consent is not public-profile consent.
- Automated identity matches are suggestions only. Historical links require authenticated human review and traceable evidence; never transfer ownership automatically.
- Never fabricate profiles, counts, credentials, opportunities, buyer activity or outcomes.
- Never alter participant data, answers, scores, identity links or consent without explicit authorization.
- Email delivery states remain distinct and retries idempotent.

## 4. Security and availability invariants

- No secret, service-role credential or privileged token may enter browser code, committed files or logs.
- Authentication, authorization, session, identity-linking and consent changes require security and regression coverage.
- Database changes must be migration-backed and reviewed for locks, data loss, partial failure, compatibility and recovery.
- Destructive data operations require specific authorization. Tests must not mutate production participant data.
- RLS and server-side authorization remain authoritative; client-editable metadata is never an authorization source.
- Failed, skipped, cancelled or unverified required checks are not passes.

## 5. Required change evidence

Every change record must identify:
1. Baseline commit and component status.
2. Exact in-scope and out-of-scope behaviour.
3. Affected files, routes, dependencies, API contracts and data objects.
4. Tests run and exact results, including failed/skipped/unverified checks.
5. Before/after desktop and mobile evidence for user-visible changes.
6. Data, consent, security and email side effects.
7. Recovery plan and exact deployment version when production release is authorized.

If evidence is missing, mark the item **NOT VERIFIED**. Do not claim a component is protected or a release is complete by inference.
