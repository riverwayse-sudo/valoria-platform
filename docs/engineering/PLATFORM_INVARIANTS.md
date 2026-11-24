# Valoria Platform Invariants

**Status:** Mandatory product and engineering constraints  
**Scope:** valoria-site, valoria-platform, Supabase and Cloudflare production services

These invariants protect established behavior. They are not permission to redesign, reinterpret or silently change product policy.

## 1. Change isolation
- Governance, documentation or CI-only changes must not modify runtime code, styles, assets, route handlers, database migrations, Worker configuration or production data.
- Every change identifies its target component, affected files, dependencies and explicit exclusions before implementation.
- If implementation crosses the declared boundary, stop and record a revised impact assessment.
- No unrelated cleanup, formatting, dependency upgrade or redesign may be bundled with a defect fix.
- Existing behavior is the baseline. Prove the requested behavior changed and protected neighboring behavior did not.

## 2. Website and display invariants
For changes affecting rendered pages, route data, shared styles, assets or component behavior:
- Preserve unrelated layouts, section order, typography, color tokens, spacing, navigation, links, responsive behavior and interaction states.
- Preserve public routes, canonical URLs, metadata and page loading/error behavior unless explicitly in scope.
- Protect homepage profile rails, profile cards, marketplace cards/listings, category discovery and public profile rendering unless explicitly in scope.
- Do not change shared CSS, global tokens, root layouts, navigation, shared cards or common data projections for a local fix without mapping every consumer.
- Source assertions and HTTP 200 responses do not prove visual or interaction parity.
- Capture/inspect before and after at matching desktop and mobile viewports, using the same fixture and state.
- For data-backed display changes, verify both the data contract and rendered output with synthetic or authorized data.
- Unexplained visual regression, missing content, route failure, console error, overflow or interaction regression blocks release.

## 3. Product and data invariants
- The 9-question VALU taster and 58-question full assessment are separate journeys and records; never merge or silently substitute them.
- Answers, checkpoints and completion snapshots remain attributable to the correct assessment and identity. Save/resume must not lose or cross-contaminate answers.
- VALU Index uses authoritative PRIME points and canonical merit mapping; never represent it as a percentage or /100 score.
- Listing, public visibility, consent, capability eligibility, suspension and revocation are distinct states, enforced by authoritative server-side rules.
- Taster-completion listing policy follows the currently approved product rule and canonical lifecycle implementation; do not reintroduce a prohibited approval gate or profile-settings visibility toggle.
- Never fabricate, overwrite, bulk-attest or infer participant consent, profile data, answers, scores, identity links or activity.
- Never use client-editable metadata for authorization. RLS and server-side authorization remain authoritative.
- Email states and retries remain idempotent and distinguish queued, attempted, accepted, delivered and failed.

## 4. Security and availability invariants
- No secret, service-role credential or privileged token enters browser code, committed files or logs.
- Authentication, authorization, session, identity-linking and consent changes require security and regression coverage.
- Database changes are migration-backed, reviewed for locks, data loss, partial failure and recovery.
- Destructive data operations require specific authorization; tests must not mutate production participant data.
- Existing production routes and Cloudflare bindings remain compatible unless explicitly targeted.
- A failed or unverified critical check is not a pass. Never bypass checks to force deployment.

## 5. Required evidence
Record baseline commit, component status, scope/exclusions, affected dependencies/contracts, exact test results, visual before/after evidence where relevant, data/security/email side effects, deployment version and recovery plan. Mark unavailable evidence **NOT VERIFIED**; do not infer success.
