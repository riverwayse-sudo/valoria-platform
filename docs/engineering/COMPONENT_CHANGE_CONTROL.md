# Valoria Component Change-Control Protocol

**Status:** Mandatory across `valoria-site` and `valoria-platform`. Companion to `ENGINEERING_STANDARD.md`.

## 1. Protect verified work

A component that has passed its documented acceptance criteria is **VERIFIED — PROTECTED**. It must not be redesigned, refactored, replaced, reformatted wholesale or behaviorally altered as collateral work in another task.

A protected component may change only when the requested outcome explicitly requires it, or a demonstrated defect, security issue, legal requirement or approved dependency change requires it. Record the reason, affected behavior, evidence and approval. Convenience cleanup and nearby scope are not sufficient reasons.

## 2. Component boundaries

| Component | Responsibility | Contract to preserve |
|---|---|---|
| Public website | Public pages, institutional content, navigation | Public routes, navigation behavior, approved content, responsive behavior |
| VALU Taster | Taster version, questions, answers, scoring and completion | Version semantics, saved answers, resume behavior, immutable completion snapshot |
| Authentication | Signup, signin, password lifecycle, session and confirmation | Provider contract, redirect destinations, session and account identity |
| Identity handoff | Link a saved taster to the authenticated identity | Exact owner checks, idempotency, source taster ID and conflict handling |
| Full VALU Assessment | Independent full assessment, checkpoint, save/resume and submission | Separate record, answer integrity and resume contract |
| VALU Index | PRIME points, dimension mapping and merit designation | Single source of truth, scoring boundaries and persisted result semantics |
| Dashboard | Authenticated status, results and next actions | Status derivation, route access and action destinations |
| Marketplace | Profile projection, capabilities, search and visibility | Consent, eligibility, identity suppression and canonical designation |
| Email and notifications | Confirmation, transactional messages, reminders and delivery tracking | Sender, templates, recipients, idempotency and delivery-state semantics |
| Administration | Internal review, reconciliation and operational controls | Role authorization, auditability and separation from public presentation |
| Shared platform services | APIs, schema, RLS, Cloudflare Workers, queues and shared libraries | Versioned interfaces, security boundaries, migrations and compatibility |

This is a logical map, not permission to move files or create services. Preserve existing architecture unless an architecture change is separately approved.

## 3. Component status

Every component must have one status:
- **VERIFIED — PROTECTED:** acceptance criteria and evidence recorded; changes require §4.
- **IN PROGRESS:** implementation is actively changing.
- **AWAITING VERIFICATION:** implementation exists but tests/runtime evidence are outstanding.
- **BLOCKED:** a dependency, access restriction or unresolved defect prevents verification.

The register must link the exact source commit/version, acceptance evidence, owner, known limitations and dependencies. Code existing, a PR merging or a build passing does not by itself make a component protected. Missing evidence means AWAITING VERIFICATION or BLOCKED.

## 4. Mandatory change procedure

**Before editing**
1. Name the target component and exact behavior being changed.
2. Read its current contract, status, owner, acceptance criteria and dependencies.
3. Inspect implementation and baseline tests at the target commit.
4. Identify direct callers, shared modules, database objects, API contracts, email effects and deployment bindings.
5. State what is explicitly out of scope. Protected neighbors remain out of scope unless evidence proves otherwise.

**During implementation**
1. Make the smallest change that satisfies the requested outcome.
2. Keep edits within the target boundary. Do not bundle unrelated cleanup, redesign, renaming, dependency upgrades or formatting.
3. Preserve existing contracts unless a versioned contract change is required.
4. Add/update regression tests at the boundary where the defect occurs.
5. Do not edit historical participant records, answers, scores, identity links or consent to make tests pass.
6. Use synthetic identities and isolated data for E2E tests. Never use the owner or a real participant as a test subject without explicit authorization.
7. Do not send test email to real recipients; use a controlled sink or explicitly authorized test recipient.

**Before closing**
1. Run target-component tests.
2. Run contract and regression tests for every affected boundary and dependent component.
3. Run applicable repository CI, security checks and production build.
4. Run isolated staging/browser acceptance for user-visible or stateful behavior where supported.
5. Verify exact deployed commit/runtime only when deployment is explicitly authorized.
6. Record passed, failed, skipped and unverified checks separately. Skipped is not passed.
7. Confirm protected neighbors remain unchanged, or justify every cross-boundary edit.
8. Record rollback/recovery steps and the new source commit/version.

## 5. Shared dependencies and cross-component changes

A shared library, schema, migration, API, auth contract, event, email template, global design token or Worker binding is a cross-component change, even if only one file is edited.

For these changes, list every affected component and dependency path; document compatibility and rollout order; test every affected contract; use additive/reversible migrations where possible; coordinate site/platform release versions and Cloudflare bindings; and define rollback or forward-recovery before deployment.

Compartmentalisation does not eliminate shared dependencies. It makes them explicit and testable.

## 6. Prohibited without explicit authorization

- Alter, reset, delete, merge, relink or fabricate participant data.
- Change assessment questions, scoring, merit boundaries, consent or eligibility during unrelated work.
- Change auth, confirmation redirects or identity ownership during visual work.
- Refactor a verified journey merely to simplify a separate feature.
- Replace a working component without parity evidence.
- Deploy, promote, migrate production or change secrets/DNS incidentally.
- Mark a component protected without acceptance evidence.
- Treat a green build, merged PR or deployment as end-to-end proof.

## 7. Emergency exception

A Critical security, privacy, data-integrity or availability defect may require an urgent protected-component change. It must still be scoped, reviewed, tested and documented. If prior approval is impractical, record the emergency rationale and notify the owner promptly. This exception is not for cosmetic work or routine delivery pressure.

## 8. Required PR change record

Every behavior-changing PR must record:
- Target component(s) and current status/baseline commit.
- Requested outcome, in-scope behavior and explicit exclusions.
- Affected dependencies/neighbors and protected components inspected.
- Tests run with exact results; unverified items and blockers.
- Data, consent, security and email side effects.
- Rollback/recovery plan, new commit and deployment status.

A component becomes **VERIFIED — PROTECTED** only after its owner-approved acceptance criteria are met and evidence is recorded in the quality register.

## 9. Relationship to REQS

This protocol supplements and does not weaken `ENGINEERING_STANDARD.md`. Follow the stricter security, privacy, data-integrity and release requirement where rules overlap. The repository quality register is the source of truth for current status and evidence.
