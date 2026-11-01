# Valoria Module Register — Platform Repository

**Repository:** `riverwayse-sudo/valoria-platform`  
**Branch:** `chore/valoria-module-stabilisation`  
**Baseline:** `main`  
**Status:** Register established; modules are **NOT AUDITED** unless an evidence-backed note below says otherwise.

This is the platform-side register of a cross-repository stabilisation programme. The site repository carries the corresponding register. Platform owns canonical data and server-side business rules; the site consumes those contracts.

## Module index

| ID | Module | Platform responsibility | Site counterpart | Initial status |
|---|---|---|---|---|
| PUB | Public website | No primary ownership | Public pages, navigation, SEO, event promotion | NOT AUDITED |
| AUTH | Authentication & accounts | Identity provider integration, account creation APIs, confirmation, recovery, session validation and identity linking | Signup/sign-in UI, callbacks and session-aware routing | NOT AUDITED |
| TAS | Taster & onboarding | Nine-question taster state, answer persistence, resume tokens, submission and account association | Taster screens, onboarding and bridge UI | NOT AUDITED |
| ASM | Full assessment | 58-question engine, sequencing, progress persistence, submission and idempotency | Assessment shell, route, progress and handoff UI | NOT AUDITED |
| SCO | VALU Index & certification | Canonical PRIME scoring, VALU Index, merit tiers, report and certification eligibility | Results and points presentation | NOT AUDITED |
| DASH | Dashboard & journey | Canonical journey state, transition rules, authenticated handoff and event history | Dashboard and next-step presentation | NOT AUDITED |
| PROF | Professional profiles | Profile persistence, identity association, report-derived summary and capabilities | Profile setup/edit/display UI | NOT AUDITED |
| MKT | Talent marketplace | Eligibility, roster/listing materialisation, access gates and capability data | Discovery, cards, filters and modalities | NOT AUDITED |
| EVT | Events & engagement | Registration persistence and event-related integrations where applicable | Event pages and registration UI | NOT AUDITED |
| COM | Communications | Confirmation, recovery, transactional/report email and delivery tracking | User-facing communication entry points | NOT AUDITED |
| ADM | Administration & data operations | Admin APIs, reconciliation, auditability, permissions and data integrity | Admin-facing surfaces, if present | NOT AUDITED |
| INF | Infrastructure, APIs & security | API handlers, database migrations, RLS, service boundaries, secrets/configuration and runtime | Site proxy, rewrites, middleware and deployment configuration | NOT AUDITED |

## Evidence-linked open work (not a complete audit)

These open PR descriptions are review leads only. They do not establish that a fix is complete or that production is healthy.

| Module | Reference | Recorded condition |
|---|---|---|
| SCO / ASM / INF | [PR #60](https://github.com/riverwayse-sudo/valoria-platform/pull/60) | Draft snapshot submission/API routing remediation; its description says automated tests and live endpoint probes had not been run from the connector |
| AUTH / COM | [PR #54](https://github.com/riverwayse-sudo/valoria-platform/pull/54) | Signup fallback draft; preview was READY but controlled end-to-end signup and confirmation acceptance gate remained |
| AUTH / COM | [PR #53](https://github.com/riverwayse-sudo/valoria-platform/pull/53) | Signup diagnostics draft; diagnostic instrumentation is not itself a root-cause fix |
| COM / ADM | [PR #52](https://github.com/riverwayse-sudo/valoria-platform/pull/52) | Report email pending health metric; verify current implementation and data before relying on the metric |
| PROF / MKT | [PR #23](https://github.com/riverwayse-sudo/valoria-platform/pull/23) | Assessment-to-marketplace handoff change; review current base and cross-repository contract |
| SCO | [PR #57](https://github.com/riverwayse-sudo/valoria-platform/pull/57) | PRIME result presentation; verify it preserves canonical points and current VALU terminology |

## Issue register format

Create one issue record per independently diagnosable defect. Use IDs such as `AUTH-001`, `TAS-001`, `ASM-001`, `SCO-001`, `MKT-001`.

Required fields:
- **ID / module**
- **Observed behaviour** (exact route/action, expected vs actual result)
- **Environment** (local, preview, staging, production; include deployment/commit)
- **Severity** (S0 data/security; S1 critical journey blocked; S2 major function impaired; S3 cosmetic/minor)
- **Evidence** (reproduction steps, request/response, logs, test, PR/commit)
- **Root cause** (UNKNOWN until demonstrated)
- **Affected API/database objects/files**
- **Dependencies / contract owner**
- **Fix scope**
- **Regression test** (must fail before the fix and pass after)
- **Verification evidence**
- **Status** (NOT AUDITED, OPEN, INVESTIGATING, FIXED—UNVERIFIED, VERIFIED IN PREVIEW, RELEASED, MONITORING)

Never label an issue FIXED based only on a code change. Never label it RELEASED without deployment evidence and production smoke tests.

## Platform ownership and contract boundaries

- **AUTH** owns identity, verification, sessions and account ownership. No downstream module may invent or bypass identity.
- **TAS / ASM** own assessment answers, progress, completion and idempotent submission. The site renders and requests state; it does not manufacture it.
- **SCO** owns scoring and official VALU Index/merit rules. Consumers display canonical results; no duplicate scoring formula.
- **DASH** owns canonical journey transitions/events. Dashboard UI reads this state and must not calculate progress from unrelated proxies.
- **PROF** owns professional profile persistence and capability records.
- **MKT** consumes verified profile/assessment/eligibility state. Listing eligibility must have one canonical rule and one authoritative source.
- **COM** owns delivery outcomes; email failure must be observable and must not silently corrupt assessment/account state.
- **ADM** owns controlled reconciliation and auditable privileged operations.
- **INF** owns API, database, environment and security controls.

## Change isolation rules

1. One canonical source of truth per domain; no duplicated scoring, eligibility, journey or identity rules.
2. Cross-module changes must document provider, consumer, request/response schema, authorization, idempotency and failure behaviour.
3. Every fix needs a discriminating regression test that fails when the old defect is reintroduced.
4. Migrations must be reviewed for ordering, idempotency, RLS/privileges, environment targeting and preservation of existing records.
5. No production data mutation as a test strategy. Use isolated test identities and non-production data.
6. Keep site and platform PRs separate but link them with a shared module/issue ID and compatible API contract.
7. Do not merge or deploy based solely on a green build; require end-to-end acceptance for the affected journey.

## Initial audit order

1. INF — API contracts, database access, environment isolation and security
2. AUTH — account creation, confirmation, session and recovery
3. TAS — nine-question taster, persistence, resume and identity linking
4. ASM — 58-question assessment, progress, submission and idempotency
5. SCO — canonical PRIME points and VALU Index
6. DASH — journey state and handoff
7. PROF → MKT — profile, capability, eligibility and listing
8. COM, EVT, ADM — delivery, events and operational controls

**Product invariants to preserve:** taster has 9 questions; full assessment has 58 questions; display VALU Index/PRIME scores as points, not percentages. Verify exact assessment accounting and eligibility rules against the canonical implementation before changing them.
