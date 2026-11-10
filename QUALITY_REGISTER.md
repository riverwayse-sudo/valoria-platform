# Valoria Engineering Quality Register — Platform

**Audit status:** TARGETED CI CONTROLS EXPANDED; broader audit remains in progress. Findings are limited to repository source and GitHub Actions evidence inspected on 11 November 2026. This is not a full security, accessibility, runtime or production audit.

| Gate | Status | Evidence / finding | Owner | Remediation |
|---|---|---|---|---|
| Architecture and maintainability | NOT VERIFIED | No complete dependency/coupling or duplication audit performed | Engineering | Map frontend, API, Supabase and Worker boundaries; identify duplicate business rules |
| Static quality | NOT VERIFIED | PR #181 adds a pinned ESLint no-undef gate for the assessment entry point, taster gate and formal assessment entry. The gate passed in CI. This is targeted coverage, not repository-wide lint or type checking. | Engineering | Expand lint coverage by bounded modules; establish type-safety strategy without masking legacy debt |
| Data integrity | NOT VERIFIED | No complete Supabase schema, constraints, RLS, migration or recovery audit performed | Engineering | Audit policies, constraints, migrations, idempotency and backup/restore |
| API and integrations | NOT VERIFIED | API security contract tests exist, but complete endpoint contract/failure-mode audit not performed | Engineering | Inventory endpoints, authz, validation, timeouts, retries and service bindings |
| Business-rule correctness | FAIL | Active Supabase rapid-service v10 uses Platinum/Gold/Silver/Bronze thresholds 85/70/55, while repository source has a separate 80/65/50/35 mapping. Both diverge from canonical VALU v4 designations at 90/75/55/35. Deployed v10 also accepts a caller-supplied tier. No invocation was found in the last 24 hours; external callers remain unruled-out. Tracked in issue #183. | Product/Engineering | Trace every caller; establish a shared canonical contract; remove tier overrides; add boundary tests; verify source/deployment parity before approved release |
| Security | FAIL | Gitleaks, environment parity and production dependency audit are present in CI; all passed in PR #181 validation. A complete ASVS-oriented auth/session/authz/RLS assessment remains outstanding. | Engineering | Complete ASVS-oriented review; triage and document dependency findings; verify runtime secrets and Worker bindings |
| Accessibility and UX | NOT VERIFIED | No WCAG 2.2 AA audit evidence reviewed | Design/Engineering | Audit keyboard, screen reader, responsive and error states |
| Automated regression | FAIL | Jest suite passed in PR #181. No complete browser journey suite evidenced in inspected package/workflows. | Engineering | Add browser journey coverage using a safe test environment and synthetic accounts |
| Release readiness | NOT VERIFIED | PR #181 CI, platform tests and Cloudflare Worker validation passed. The staging deployment workflow was skipped; no production or staging deployment was performed. An external Vercel status reported build-rate-limit failure; no Vercel operation was performed. | Engineering | Resolve merge requirements without bypassing required checks; verify exact Cloudflare Worker deployment/version only when a runtime change is approved |
| Observability and recovery | NOT VERIFIED | Backup and health workflows exist; complete alerting, restore-test and recovery-runbook audit not performed | Engineering | Verify backup restore, alert delivery, queue retry/dead-letter handling and runbooks |

## Verified CI evidence
- Standards PR #177 merged at dfb66308634e8a1e454d8428fe7a243d8c1d556d.
- PR #181 head 610a10d70f66e7dacc6e5fece7d06d389c686dd1 added the lint:critical script; its ESLint check passed.
- GitHub Actions Valoria CI run #1326 passed: critical-path static analysis, unit tests, production build, secret scan, environment parity and production dependency audit.
- Valoria platform tests run #777 passed.
- Cloudflare assessment Worker validation run #280 passed; it built and bundled assets without deploying.
- The isolated Cloudflare staging deployment workflow was skipped; no deployment is claimed.
- The external Vercel status reported failure with build-rate-limit; no Vercel operation was performed.
- Node 22 is used in CI; runtime/package Node compatibility should be explicitly documented and kept consistent.

## Critical journey acceptance
| Journey | Status | Evidence |
|---|---|---|
| Taster save, resume and server-confirmed completion | NOT VERIFIED | Regression tests exist; real browser acceptance not completed |
| Registration, privacy, optional consent and dashboard handoff | NOT VERIFIED | Source-contract tests exist; real browser acceptance not completed |
| Independent full assessment, checkpoint and resume | NOT VERIFIED | Assessment journey tests exist; real browser acceptance not completed |
| VALU points, PRIME dimensions and merit boundaries | FAIL | Canonical contract tests exist, but active rapid-service email function contains conflicting merit bands and caller-supplied tier override; issue #183 |
| Marketplace eligibility, capability and privacy rules | NOT VERIFIED | Contract tests exist; end-to-end acceptance pending |
| Lead capture, consent-preserving sync and email failure recovery | NOT VERIFIED | Integration and consent discrepancy review pending; do not alter participant consent without explicit authorisation |

Update status only with traceable evidence. Known Critical or High defects block production release.
