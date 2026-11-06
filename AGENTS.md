# Valoria Platform — Agent and Engineering Charter

## Mission
Build and operate the trusted product core: authentication, assessment lifecycles, scoring, VALU Index reports, PRIME, member dashboard, professional profiles, Registry, learning and opportunity workflows.

## Authority and source of truth
- Follow root PRD, ARCHITECTURE, RULES, DESIGN, TESTING and RELEASE documents where present.
- Assessment lifecycle, scoring, identity, eligibility and profile rules belong in this repository and must have one canonical implementation.
- The public site consumes approved platform contracts; it must not invent or independently calculate platform business rules.
- Record consequential architectural changes and data-contract changes in `docs/decisions/`.

## Role expectations
- Principal architect: map existing API, database, RPC, token and scoring contracts before changing them.
- Product manager: define user outcomes, acceptance criteria and rollout constraints.
- Frontend engineer: implement accessible, responsive assessment, report and dashboard states.
- Backend engineer: enforce lifecycle, ownership, idempotency, validation and error handling server-side.
- Database engineer: preserve data integrity, least privilege, RLS and migration discipline.
- Assessment specialist: review constructs, question mapping, scoring interpretation, fairness and limitations.
- QA engineer: test lifecycle boundaries, persistence, resume, duplicate submissions and regressions independently.
- Security/privacy reviewer: challenge authorization, data exposure, session continuity and retention.
- Release engineer: isolate staging, verify builds and prepare rollback before production promotion.

## Non-negotiable assessment contract
- The 9-question taster and 58-question formal assessment are two separate instruments.
- They have separate identifiers, lifecycle statuses, answer payloads, persistence/progress records and resume semantics.
- Taster answers must never seed, prefill, count toward or be submitted as formal assessment answers.
- A new formal assessment begins at 0/58.
- Only a completed formal assessment may produce the official VALU Index.
- Taster output, if shown, is explicitly directional and is not the official VALU Index.
- Display VALU and PRIME results in points, never percentages.
- Do not change database schemas or scoring behaviour until API, table, RPC, token and migration dependencies have been mapped and reviewed.

## Security and data rules
- Never expose service-role or secret keys to client code.
- Never rely on user-editable metadata for authorization.
- Apply ownership checks and least privilege in addition to authenticated-session checks.
- RLS must be enabled and correctly scoped for exposed user-data tables.
- Do not use production credentials, production participant records or production APIs in staging.
- No destructive migrations, production SQL, production deployments or production setting changes without explicit approval.

## Engineering rules
- Inspect the current code and tests before editing; preserve idempotency and existing valid records.
- Prefer existing dependencies. New packages require documented justification and approval.
- Add tests for every changed business rule, including negative and boundary cases.
- Treat client-side validation as usability only; enforce critical rules on the server.
- Log actionable errors without exposing credentials or sensitive assessment responses.
- Never claim a test, audit or deployment passed unless it was run and inspected.

## Definition of done
A change is complete only when contract tests, unit/integration tests, relevant end-to-end tests, security checks and staging verification pass. Assessment methodology changes additionally require qualified human review. Production promotion requires explicit human approval.
