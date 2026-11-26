# Valoria Production Release Policy

**Status:** Mandatory for production-bound changes  
**Production runtime:** Approved Cloudflare Workers and Cloudflare services  
**Companion standards:** `ENGINEERING_STANDARD.md`, `COMPONENT_CHANGE_CONTROL.md`, `PLATFORM_INVARIANTS.md`, `VALORIA_UNIFIED_GOVERNANCE.md`

## 1. Release boundary

Production release requires an explicitly approved change, known target, risk classification, baseline commit, passing evidence and recovery plan. Documentation/governance-only changes must not alter runtime bundles, routes, styles, assets, database state, environment variables, DNS or Worker configuration.

## 2. Risk classification

| Level | Change class | Minimum evidence |
|---|---|---|
| 1 — Low | Documentation or isolated non-shared presentation | Scope review, relevant checks, confirm no protected runtime surface changed |
| 2 — Moderate | Page/component behaviour, profile projection, API contract | Unit/contract tests, dependent regression, production build, desktop/mobile browser verification, route and interaction checks |
| 3 — High | Authentication, authorization, consent, scoring, listing, schema/RLS, identity, shared services | Level 2 plus security review, migration/compatibility analysis, failure-path tests, controlled rollout, explicit rollback/forward-recovery and post-deploy verification |

Risk is determined by the highest-impact dependency, not file count.

## 3. Mandatory pre-deploy gates

- Requirement IDs, change class, scope and protected components are recorded.
- Root cause and intended outcome are clear; unrelated work is excluded.
- All applicable unit, contract, regression, design, security, dependency and build checks pass.
- No required check is failed, skipped or cancelled. Exceptions cannot waive security, data-integrity or critical-journey gates.
- Migrations are reviewed for idempotency, locking, data preservation, compatibility and recovery.
- User-visible changes have equivalent before/after desktop and mobile verification.
- Critical journeys and neighbouring components have regression coverage proportionate to blast radius.
- No unresolved Critical or High defect remains.
- Exact source commit, Cloudflare Worker target, release workflow and recovery version are recorded.

## 4. Deployment and verification

- Production operations target Cloudflare only. Do not initiate Vercel deployment operations.
- Production deploys are serialized; do not run overlapping releases.
- Deploy only the reviewed commit. Do not deploy an unreviewed branch or working tree.
- Verify the exact Cloudflare Worker deployment/version and production route after release.
- For user-visible changes, verify rendered output and key interactions; HTTP success alone is insufficient.
- For stateful changes, verify the authorized synthetic journey and canonical server state.
- Record PASS, FAIL, SKIPPED and NOT VERIFIED separately. Never convert unavailable evidence into a pass.

## 5. Rollback and recovery

Before release, identify the last known-good Worker version, whether rollback is safe for the changed data/API contract, whether forward recovery is safer, compatibility requirements and the recovery owner.

If production health, critical journeys, data integrity, security or display parity regresses:
1. Stop rollout and unrelated changes.
2. Preserve logs, deployment IDs and failure evidence.
3. Roll back to the known-good Worker version when compatible, or execute the documented forward-recovery plan.
4. Verify route health and affected critical journeys.
5. Record the defect and add a regression guard before retrying.

A Worker rollback does not automatically reverse a database migration. Database recovery follows its migration-specific plan.

## 6. Completion standard

A change is complete only when its intended outcome is verified and protected behaviour remains intact. A merged PR, green build, successful deployment or HTTP 200 alone is not proof of completion.

The release record includes PR/commit, CI run, tests, environment, Cloudflare deployment/version, production verification, limitations and recovery reference.
