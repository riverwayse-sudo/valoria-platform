# Valoria Unified Product Governance and Engineering Workflow

**VALORIA_GOVERNANCE_VERSION: 1.0.0**  
**Status:** Mandatory after approval and merge.  
**Scope:** `valoria-site`, `valoria-platform`, Supabase, Cloudflare Workers, shared APIs, data contracts and operational workflows.

## 1. Purpose

This document harmonises the Valoria Institute Website, Platform & User Experience Strategic Review (updated 4 November 2026), the Valoria Website Content Overhaul, subsequent explicitly approved product decisions, and the existing Riverways Engineering Quality Standard (REQS).

It creates one requirements-to-release workflow. It does not replace the source documents, silently rewrite product policy, or claim that requirements have been implemented merely because they are recorded here.

## 2. Authority and conflict resolution

Apply requirements in this order:

1. A later, explicit product-owner decision that clearly changes a specific earlier decision.
2. This approved Valoria governance contract and protected standards register.
3. The Strategic Review for institutional, product, platform and marketplace intent.
4. The Content Overhaul for page-level content, claims, navigation and publishing requirements.
5. Approved technical architecture, API contracts and repository engineering standards.
6. Existing implementation, which is evidence to inspect, not authority to redefine a requirement.
7. Suggestions, assumptions and unapproved changes.

A later decision supersedes only the specific conflicting clause it addresses. It does not invalidate unrelated requirements in either source document. If two authoritative sources still conflict, record the conflict in the requirements register as **DECISION REQUIRED** and stop the affected change. Do not guess, silently choose a convenient interpretation, or change production behaviour to make the documents appear consistent.

## 3. Protected product standards

The following are protected contracts. Routine fixes, refactoring and visual work must preserve them.

### Assessment and identity
- The 9-question Taster and the separate 58-question full assessment are distinct assessment stages. The Taster is not part of, deducted from, or reused as questions in the full assessment.
- The full assessment contract is 54 scored questions plus 4 validity anchors.
- New Taster sessions use the approved nine-question version. Explicitly versioned historical 15-question sessions remain supported for resume/compatibility; they must never become the default for new sessions.
- The current approved journey creates the participant's account at the beginning of the Taster journey, then permits the participant to complete the nine-question Taster before requesting email confirmation. Before confirmation, only a server-issued, short-lived, single-use capability may authorize the narrowly scoped Taster-start and continuation operations; it must not create a general authenticated session or permit dashboard, profile, marketplace or Full VALU access. After confirmation, the callback must verify ownership, link the exact saved Taster idempotently, establish the authenticated session and return the participant to the dashboard. This supersedes the earlier no-account wording in the Content Overhaul for new participants. Existing legacy sessions retain their explicit recovery path.
- Taster and full-assessment answers, progress, completion and records remain independent. Save/resume and completion must be server-confirmed.
- Do not expose misleading progress counters or imply the Taster is a subset of the full assessment. Approved explanatory pages may describe the two stages and their question counts.
- Identity linking is exact, evidence-backed and idempotent. Automated matches are suggestions only. No historical identity link or ownership transfer is applied without authenticated human review and traceable evidence.

### VALU and PRIME
- PRIME remains five clusters and 17 canonical skills. Skill names and cluster mappings must come from the approved canonical source; do not invent or locally rename skills.
- VALU is presented in points, not percentages or percentage-formatted scores. Do not introduce a competing frontend scoring implementation.
- The authoritative server-side scoring/designation implementation and its versioned boundary tests are the scoring source of truth.
- The two source documents contain designation-boundary material that must be reconciled against the currently approved VALU implementation before changing any threshold. A mismatch is **DECISION REQUIRED**, not permission to alter scoring or rewrite historical results.
- A score, profile projection or cached display field is not proof of assessment completion. Completion and results must derive from the canonical completed assessment record.

### Profiles, consent and marketplace
- One account has one canonical professional profile. The profile may carry multiple declared capabilities/modalities (candidate, speaker and facilitator) without creating duplicate accounts or profiles.
- Account/profile creation, assessment completion, eligibility, participant consent and public discoverability are separate states. Taster completion must automatically create or refresh the approved professional profile and eligibility projection without an administrator approval gate; public visibility remains gated by participant-entered consent and eligibility.
- Public visibility requires the current, explicit participant-entered acknowledgement through the approved profile setup/edit journey. Administrative attestation, inferred consent or an unchecked marketing choice is not public-profile consent.
- Eligibility and merit are determined by the authoritative platform rules. A Taster result, profile existence or account creation must not be misrepresented as full VALU completion or certification.
- Never fabricate profiles, counts, opportunities, credentials, buyer activity or testimonials. Preserve source records and audit history. No participant data, scores, identity links or consent may be changed without explicit authorization.

### Institutional content and claims
- Public content must follow the latest approved brand and positioning decisions. Historical wording in either PDF is not automatically current if a later explicit brand decision supersedes it.
- Never publish unsupported independent-validation, certification, programme-duration, pricing, outcome, partnership, live-count or opportunity-supply claims.
- The website and platform must distinguish institutional standards, product capabilities and actual operational supply.
- The legal entity, canonical public names, canonical skill labels and other unresolved owner decisions remain **DECISION REQUIRED** until documented approval is recorded.

## 4. Repository and service boundaries

| Domain | System of record / owner | Other repository's role |
|---|---|---|
| Public pages, public copy, SEO, navigation and legal-page presentation | `valoria-site` | Platform supplies approved product facts/contracts only |
| Authentication, account identity and session semantics | Platform/Auth integration contract | Site provides entry UI and consumes the documented contract |
| Taster and full assessment engines, persistence and completion | `valoria-platform` | Site links/handoffs through documented routes and APIs |
| VALU scoring, PRIME mapping and designation rules | Platform's canonical server-side implementation | Site displays returned authoritative results |
| Profile records, eligibility, consent and marketplace projections | Platform/database contracts | Site presents public/private views without recalculating rules |
| Buyer/opportunity operational workflows | Platform/API contracts, with public discovery presentation on site | Site must show truthful supply and working destinations |
| Shared security, privacy, data and deployment contracts | Versioned cross-repository interfaces | Both repositories test compatibility |

Do not duplicate business rules across repositories. Do not move files, create services, change API ownership or refactor shared architecture as part of an unrelated defect fix. API and data contracts must be versioned and compatibility-tested before either consumer changes.

## 5. One requirements-to-release workflow

Every change follows the same sequence:

1. **Register:** assign requirement/defect IDs and link the source clause or approved decision.
2. **Classify:** mark it Protected Standard, Controlled Product Requirement, or Adaptable Implementation Detail.
3. **Baseline:** identify current source commit, component status, existing behaviour and passing/failing tests.
4. **Impact-map:** identify target component, callers, shared styles, routes, APIs, data objects, consent/security boundaries, other repository dependencies and explicit exclusions.
5. **Conflict-check:** resolve any authority or requirement conflict before editing.
6. **Implement narrowly:** smallest change that meets the requirement; no unrelated cleanup, redesign, renaming, dependency upgrade or formatting.
7. **Test locally/CI:** run targeted tests, contract/boundary tests and the relevant full regression suites. Add a regression test for every confirmed defect.
8. **Verify staging:** use synthetic identities and isolated data; verify affected journeys, neighbouring components, desktop/mobile display, routes, console, errors and responsive states as applicable.
9. **Review release risk:** assess data migration, rollback/forward recovery, privacy, consent, security, accessibility and operational monitoring.
10. **Release:** Cloudflare is the approved production deployment target. Production deployment requires explicit approval, all applicable checks passing and a recorded recovery path.
11. **Verify and close:** verify the exact deployed commit/Worker version and real route where release-bound; update the requirement, component and quality registers with evidence.

No stage may be skipped because a change is described as small. Risk is determined by blast radius, not file count.

## 6. Change classes and approval

- **Protected Standard:** cannot change through routine implementation. Requires explicit product-owner approval, written decision record, impact analysis, versioned contract update and migration/regression plan where applicable.
- **Controlled Product Requirement:** may evolve only through documented product-owner approval and updated acceptance criteria.
- **Adaptable Implementation Detail:** engineering may improve it within existing contracts and component boundaries.

A code change must not silently promote an implementation detail into a product rule or downgrade a protected standard.

## 7. Mandatory verification and release gates

Use layered evidence; no single check substitutes for another.

- Static analysis, lint/type checks where configured, locked dependency install and production build.
- Unit tests and defect-specific regression tests.
- API, database, authorization, RLS and cross-repository contract tests where affected.
- Synthetic end-to-end browser tests for critical journeys.
- Desktop/mobile visual and interaction checks for user-visible changes.
- Security, secret, dependency and accessibility checks proportionate to the change.
- Migration idempotency, data preservation, partial-failure and recovery verification.
- Staging isolation and environment parity.
- Production smoke checks and monitoring for approved releases.

A build, merge, HTTP 200, source assertion or deployment alone is not proof of user-journey acceptance.

Statuses must be evidence-based:
- **PASS:** required evidence exists and is linked.
- **FAIL:** test or acceptance criterion failed.
- **NOT VERIFIED:** evidence is absent or the test could not be run.
- **FIXED IN CODE — NOT VERIFIED:** implementation changed but runtime acceptance is outstanding.
- **DECISION REQUIRED:** authoritative requirements conflict or owner input is required.
- **DEFERRED:** explicitly approved for a later phase with owner and reason.

Known Critical or High defects block production release. Failed, skipped or cancelled required checks block release. Never infer a pass.

## 8. Regression and component protection

- Every verified component is **VERIFIED — PROTECTED** only when its acceptance criteria, exact source commit/version, tests, dependencies and evidence are recorded.
- Protected neighbouring components remain unchanged unless the impact map proves they must change.
- Cross-component changes require tests at every affected boundary and explicit approval where a protected standard changes.
- User-visible changes require matching before/after desktop and mobile evidence using equivalent fixtures and states.
- Unexplained layout, content, data, route, console, accessibility or interaction differences block release.
- Critical journey coverage must include registration/confirmation/session, Taster start/save/resume/complete, independent full assessment/save/resume/submit, VALU results, dashboard, profile/consent/eligibility, marketplace and opportunity enquiry/application flows.
- Historical participant data is not a test fixture. Use synthetic identities and isolated data. Do not send test email to real recipients without explicit authorization.

## 9. Defect closure and recovery

Every defect closure records:
1. Root cause.
2. Impact and affected components.
3. Minimal correction and rationale.
4. Commands, tests, CI runs, staging evidence and production evidence where applicable.
5. Recurrence prevention (test, invariant, constraint, alert or architecture safeguard).
6. Recovery/rollback or forward-fix procedure.
7. Remaining limitations and owner.

For database changes, preserve source records and audit history; destructive operations require explicit authorization. A rollback plan must state whether rollback is safe after data writes, or whether forward recovery is required.

## 10. Shared and repository-specific registers

- `VALORIA_REQUIREMENTS_REGISTER.md` is the shared cross-repository requirements and decision register. It tracks what is required and the acceptance criteria.
- Each repository's `QUALITY_REGISTER.md` remains the evidence register for that repository's implementation, tests, risks and remediation. Neither repository may overwrite the other's evidence.
- `COMPONENT_CHANGE_CONTROL.md` tracks component boundaries and protected status.
- Existing `ENGINEERING_STANDARD.md`, security policies, design/motion constitutions and release workflows remain in force. This document supplements them; it does not weaken stricter requirements.
- Both repositories must carry the same governance version and materially identical shared governance text. Changes to this contract must be made in both repositories in the same coordinated change set.

## 11. Explicit non-goals

This governance change does not merge repositories, change runtime behavior, alter scoring thresholds, rewrite historical data, change consent, change Supabase Auth settings, change DNS/Cloudflare configuration, trigger deployment, create fake marketplace supply, or authorize production promotion.
