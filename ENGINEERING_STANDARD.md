# Riverways Engineering Quality Standard (REQS)

**Status:** Mandatory for Valoria production changes. Applies to the site, platform, Supabase and Cloudflare integrations.

## Authority
This standard operationalises ISO/IEC 25010, Google SRE practices, OWASP ASVS 5.0 Level 2 as the security target, NIST SSDF and WCAG 2.2 AA. It does not claim certification. A passing build is not proof a feature works.

## Non-negotiable product invariants
- The nine-question taster and 58-question full assessment are separate journeys; do not expose internal question counts in participant UI.
- Both journeys persist and resume independently without answer loss.
- Privacy acknowledgement and optional marketing consent are separate. Consent is never inferred, preselected or silently changed.
- Never show completion until the authoritative server confirms it.
- VALU Index uses PRIME points, never percentages or a /100 representation.
- Merit, eligibility and scoring rules have one authoritative implementation and are enforced server-side.
- Marketplace visibility and participant data respect consent and eligibility. Never fabricate profiles or alter participant data to satisfy a visual target.
- CRM/email states distinguish queued, attempted, accepted, delivered and failed. Retries must be idempotent.

## Ten mandatory engineering gates
1. **Architecture:** clear boundaries and ownership; no unexplained duplication, circular dependencies or business-rule drift.
2. **Static quality:** lint, type checks where configured, build, dead-code/error-path review; no new swallowed errors, unhandled promises or unsafe casts masking defects.
3. **Data integrity:** constraints for critical invariants, safe migrations, partial-failure analysis, idempotent writes and recovery plan. No destructive change without explicit approval.
4. **API contracts:** documented inputs/outputs, server-side authorization, validation, timeouts, bounded retries, consistent errors and compatibility checks.
5. **Business correctness:** authoritative rules, boundary tests and frontend/backend consistency.
6. **Security:** secret and dependency scans, auth/session/authz review, input/output safety, RLS review for data-access changes, ASVS L2 mapping for sensitive flows.
7. **Accessibility/UX:** WCAG 2.2 AA review for changed UI; keyboard/screen-reader support; responsive layouts; loading, empty, validation, error and success states.
8. **Regression:** defect-specific regression tests, unit tests, integration/contract tests, and browser automation for critical journeys where supported.
9. **Release:** deterministic locked install, production build, environment parity, correct Cloudflare routes/bindings, traceable deployment and rollback instructions.
10. **Operations:** actionable logs, failure visibility, recovery paths and monitoring for critical journeys.

## Verification policy
Use layered verification. Static analysis, type checks and unit tests do not prove runtime behaviour. Integration/contract tests verify boundaries; browser automation verifies user interactions; production smoke/synthetic checks verify deployed routes. Manual acceptance remains necessary for high-risk journeys when automation cannot faithfully exercise them. If live testing is unavailable, mark the item **NOT VERIFIED** with reason and owner. Never claim it passed by inference or invent test data, consent, user actions or outcomes.

## Critical journey coverage
Track taster entry/validation/save/resume/submit/completion; registration/privacy/optional consent/account linking/dashboard; independent full assessment/checkpoint/resume/submit/completion; VALU points and merit boundaries; marketplace filtering/capabilities/privacy; lead capture and consent-preserving CRM/email sync with failure and retry handling.

## Defect closure record
Every fix records: (1) root cause, (2) impact/scope, (3) correction and rationale, (4) verification evidence including commands/tests/CI/staging/production, and (5) recurrence prevention via test, invariant, constraint, alert or architecture safeguard. Without these, the issue remains open. If code is changed but verification is blocked, status is **FIXED IN CODE — NOT VERIFIED**.

## Pull request and release rules
- Keep changes scoped and use deterministic installs (npm ci where supported).
- Complete the repository PR template.
- All applicable CI checks must pass; failed, skipped or cancelled required checks block release.
- Review secrets, privacy, consent, data exposure, migrations, accessibility and rollback impact.
- Production operations target Cloudflare only; do not initiate Vercel operations.
- Verify exact deployed commit/version and production route.
- Changes to participant data or consent require explicit authorization.

## Severity
- **Critical:** auth bypass, cross-user data exposure, consent violation, data loss/corruption, scoring integrity failure or critical journey outage. Block release.
- **High:** major journey unavailable, incorrect eligibility/merit, persistent save/resume failure or duplicate account/lead effects. Block release.
- **Medium:** material degradation with safe workaround; document owner and mitigation.
- **Low:** cosmetic/low-impact; track and schedule.
Known Critical or High defects block production release. Scores cannot override a failed critical gate.

## Engineering scorecard
Score each repository independently: architecture 10; static quality 10; data integrity 15; APIs/integrations 10; business correctness 15; security 15; accessibility/UX 5; automated regression 10; release readiness 5; observability/recovery 5. 90–100 is release-eligible only when all critical gates pass; 80–89 is conditional and not production-eligible until material gaps are resolved; below 80 is not release-eligible. This score is an audit aid, not evidence by itself.

## Quality register
Maintain a repository-level register with each gate marked PASS, FAIL or NOT VERIFIED, linked evidence, owner and remediation. Reassess after material architecture, security, data or deployment changes.
