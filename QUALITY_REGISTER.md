# Valoria Engineering Quality Register — Platform

**Audit status:** TARGETED CI CONTROLS EXPANDED; broader audit remains in progress. Findings are limited to repository source and GitHub Actions evidence inspected on 11 November 2026. This is not a full security, accessibility, runtime or production audit.

| Gate | Status | Evidence / finding | Owner | Remediation |
|---|---|---|---|---|
| Architecture and maintainability | NOT VERIFIED | No complete dependency/coupling or duplication audit performed | Engineering | Map frontend, API, Supabase and Worker boundaries; identify duplicate business rules |
| Static quality | NOT VERIFIED | PR #181 adds a pinned ESLint no-undef gate for the assessment entry point, taster gate and formal assessment entry. The gate passed in CI. This is targeted coverage, not repository-wide lint or type checking. | Engineering | Expand lint coverage by bounded modules; establish type-safety strategy without masking legacy debt |
| Data integrity | FAIL | Read-only audit found 18 assessment scores all within 0–100, but no CHECK constraint enforces that range. Three lead_capture_id foreign keys remain NOT VALID; read-only joins found zero orphan references. Tracked in issue #188. | Engineering | Add score-range constraint and validate the three foreign keys through reviewed, versioned migrations; continue full schema, RLS, idempotency and recovery audit |
| API and integrations | NOT VERIFIED | API security contract tests exist, but complete endpoint contract/failure-mode audit not performed | Engineering | Inventory endpoints, authz, validation, timeouts, retries and service bindings |
| Business-rule correctness | FAIL | Active Supabase rapid-service v10 uses Platinum/Gold/Silver/Bronze thresholds 85/70/55, while repository source has a separate 80/65/50/35 mapping. Both diverge from canonical VALU v4 designations at 90/75/55/35; deployed v10 also accepts a caller-supplied tier (issue #183). Read-only database audit found 18 VALU-v4.0 records with legacy designation strings inconsistent with their points (issue #186). PR #185 now derives labels from canonical points in retry, account/profile, listing-claim and profile-reminder paths; not yet deployed. | Product/Engineering | Trace every rapid-service caller; make all readers derive designation from points; review admin/report/email consumers; consider an approved designation-only backfill after owner review; verify source/deployment parity |
| Security | FAIL | Gitleaks, environment parity and production dependency audit pass in CI. Security Advisor reports seven RLS-enabled/no-policy tables; direct table privileges for anon and authenticated are false on all seven, so the finding is currently service-role-only by grants. Leaked-password protection remains disabled. Full ASVS-oriented auth/session/authz/RLS assessment remains outstanding. | Engineering | Enable leaked-password protection if available on the current plan; verify service-role-only access and PostgREST schema exposure; complete ASVS-oriented review and Worker secret/binding audit |
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
- PR #185 head 573897deababaaceec4361de487e52a326ac98a9 passed Valoria CI run #1343, platform tests run #790 and Cloudflare Worker validation run #293; staging deployment was skipped and no production deployment was performed.
- The external Vercel status reported failure with build-rate-limit; no Vercel operation was performed.
- Node 22 is used in CI; runtime/package Node compatibility should be explicitly documented and kept consistent.

## Critical journey acceptance
| Journey | Status | Evidence |
|---|---|---|
| Taster save, resume and server-confirmed completion | NOT VERIFIED | Regression tests exist; real browser acceptance not completed |
| Registration, privacy, optional consent and dashboard handoff | NOT VERIFIED | Source-contract tests exist; real browser acceptance not completed |
| Independent full assessment, checkpoint and resume | NOT VERIFIED | Assessment journey tests exist; real browser acceptance not completed |
| VALU points, PRIME dimensions and merit boundaries | FAIL | Canonical contract tests exist, but active rapid-service email function contains conflicting merit bands (issue #183) and 18 historical records retain legacy labels (issue #186). PR #185 fixes four server-side consumers in source; deployment and remaining readers are unverified. |
| Marketplace eligibility, capability and privacy rules | NOT VERIFIED | Contract tests exist; end-to-end acceptance pending |
| Lead capture, consent-preserving sync and email failure recovery | NOT VERIFIED | Integration and consent discrepancy review pending; do not alter participant consent without explicit authorisation |

Update status only with traceable evidence. Known Critical or High defects block production release.
