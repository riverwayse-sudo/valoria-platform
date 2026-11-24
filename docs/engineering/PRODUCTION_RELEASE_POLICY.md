# Valoria Production Release Policy

**Status:** Mandatory for production-bound changes  
**Production runtime:** Cloudflare Workers and approved Cloudflare services  
**Companion standards:** `ENGINEERING_STANDARD.md`, `docs/engineering/COMPONENT_CHANGE_CONTROL.md`, `docs/engineering/PLATFORM_INVARIANTS.md`

## 1. Release boundary
A production release requires an explicitly approved change with a known target, risk level, baseline commit, test evidence and recovery plan. Documentation/governance-only changes must not modify runtime bundles, routes, styles, assets, database state, environment variables, DNS or Worker configuration.

## 2. Risk classification
| Level | Change class | Minimum evidence |
|---|---|---|
| 1 — Low | Documentation, isolated copy or isolated non-shared presentation | Scope review, relevant checks, confirm no protected runtime surface changed |
| 2 — Moderate | Page/component behavior, marketplace projection, profile display, API contract | Unit/contract tests, dependent regression, production build, desktop/mobile browser verification, route and interaction checks |
| 3 — High | Authentication, authorization, consent, scoring, listing, schema/RLS, shared services or identity | Level 2 plus security review, migration/compatibility analysis, failure-path tests, controlled rollout, rollback/forward-recovery and post-deploy verification |

Risk is determined by the highest-impact dependency, not the number of files.

## 3. Pre-deploy gates
- Scope, target component and protected components are recorded.
- Root cause and intended outcome are clear; no unrelated work is bundled.
- Applicable unit, contract, regression, design, security, dependency and build checks pass.
- No required check is failed, skipped or cancelled.
- Migrations are reviewed for idempotency, locks, data preservation, compatibility and recovery.
- User-visible changes have matching desktop/mobile before-and-after verification.
- Critical journeys and neighboring components have regression coverage proportionate to blast radius.
- No unresolved Critical or High defect remains.
- Exact source commit, Worker target, deployment workflow and recovery version are recorded.

## 4. Deployment and verification
- Use the approved Cloudflare production workflow; do not initiate Vercel deployment operations.
- Serialize production deployments; do not run overlapping releases.
- Deploy only the reviewed commit.
- Verify exact Cloudflare Worker deployment/version and production route health.
- For user-visible changes, verify rendered output and key interactions on the live site. HTTP success alone is insufficient.
- For stateful changes, verify synthetic journeys and authoritative server state without using real participants as test subjects.
- Record checks as PASS, FAIL, SKIPPED or NOT VERIFIED.

## 5. Rollback and recovery
Before deployment identify the last known-good Worker version, migration compatibility, rollback/forward-recovery choice, compatibility window and recovery owner. If production health, critical journeys, data integrity, security or display parity regresses: stop rollout, preserve evidence, recover using the documented plan, verify routes and journeys, then add a regression guard before retrying. Worker rollback does not automatically reverse database migrations.

## 6. Completion standard
A change is complete only when its outcome is verified and protected behavior remains intact. A merged PR, green build, successful deployment or HTTP 200 alone is not proof. Record PR/commit, CI run, test evidence, Cloudflare deployment/version, production verification, limitations and recovery reference.
