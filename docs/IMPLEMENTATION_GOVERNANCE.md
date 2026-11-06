# Platform Implementation Governance

## Scope
This repository owns identity and access, assessment instruments, question bank, answer persistence, scoring, VALU Index reports, PRIME, member dashboard, profiles, Registry eligibility and opportunity/learning workflows.

## Role-to-tool allocation
| Role | Primary tools | Repository responsibility |
|---|---|---|
| Principal architect | GitHub, Mermaid, API/schema maps | System boundaries and data contracts |
| Product manager | GitHub Issues/Projects, acceptance specs | Requirements and delivery sequencing |
| Frontend engineer | React, Vite, browser DevTools | Assessment/report/dashboard UI |
| Backend engineer | Supabase MCP/CLI, SQL, API tests | Auth, APIs, persistence and scoring |
| Database engineer | Supabase migrations, SQL, advisors | Schema, RLS, integrity and recovery |
| Assessment scientist | R, JASP/jamovi, Python, controlled datasets | Validity, reliability, fairness and interpretation |
| QA automation engineer | Jest/Vitest as compatible, Playwright | Lifecycle, scoring, API and regression tests |
| Security engineer | Semgrep, Gitleaks, OWASP ASVS, Supabase advisors | Authorization, secret and data controls |
| Accessibility specialist | axe-core, NVDA/VoiceOver, keyboard testing | WCAG 2.2 AA verification |
| Release engineer | GitHub Actions, Cloudflare/Vercel as configured | Staging isolation, deploy verification and rollback |

## Required controls
- Model the taster and formal assessment as separate instruments and lifecycles.
- Keep assessment rules canonical; do not duplicate scoring in the browser or site repository.
- Test ownership, authorization, RLS, idempotency, save/resume, duplicate submissions and invalid transitions.
- Every schema change requires a reviewed migration, staging validation, backup/recovery consideration and documented rollback.
- Never use production data or credentials in staging fixtures.
- Do not expose service-role keys or use user-editable metadata as an authorization source.
- Use synthetic, deterministic test fixtures and label simulated reports clearly.

## Assessment validation
A qualified assessment specialist must review question-to-construct mapping, scoring assumptions, interpretation language, fairness and limitations. Software tests can verify calculations against approved fixtures; they cannot establish psychometric validity by themselves.

## Release evidence
Record commit SHA, workflow result, migration status, contract test results, security/accessibility findings, staging journey results, known defects and rollback plan. Staging success is not production approval.
