# Valoria Assessment Experience — Separation and Staging Plan

## Non-negotiable assessment model
The 9-question taster and 58-question formal assessment are separate instruments. The taster is not the opening section of the formal assessment. The current implementation contains legacy assumptions that treat the taster's nine questions as the first nine of one 58-question instrument; these assumptions must be removed only after the persistence and scoring contracts are mapped.

## Required target journey
Taster (9) -> save taster snapshot -> account creation / confirmation -> authenticated dashboard -> separately start or resume formal assessment (58) -> formal submission -> official VALU Index points report -> development and Registry pathways.

## Separation requirements
- Distinct assessment identifiers and lifecycle statuses.
- Distinct answer payloads and persistence records.
- Taster snapshot must never seed, prefill, or count toward the 58 formal answers.
- Formal assessment progress must be 0/58 on first start.
- The VALU Index scoring endpoint must accept only a completed formal assessment payload.
- A taster result, if shown, must be labelled directional and must not be presented as the official VALU Index.
- Dashboard must show separate statuses for taster and formal assessment.
- Resume tokens must be scoped to their respective assessment type.
- Idempotency and duplicate-submission protections must remain intact.

## Staging-only acceptance
- Dedicated staging origin and isolated test backend/fixtures.
- No production Supabase credentials, production API fallback, or production session handoff.
- No genuine participant data in staging previews.
- Test accounts and test answers only.
- Staging visual experience may use deterministic fixtures until a fully isolated staging backend is verified, but must clearly label simulated report data.
- Never silently route a staging participant to production authentication or APIs.

## Current code areas requiring audit before implementation
- `valoria-final/src/VALUIndexV4GateNext.jsx`: taster entry, save, account bridge, current continuation assumptions.
- `valoria-final/src/FullVALUAssessment.jsx`: currently references OPENING_SESSION_LENGTH, OPENING_POSITIONS, and a seeded opening-session flow.
- `valoria-final/src/assessmentJourney.js`: currently defines one 58-question assessment split into 9 + 49; this model conflicts with the separate-assessment requirement.
- `valoria-final/src/valuTaster.js`: defines the nine-question directional taster and computes taster-specific points.
- API handlers for taster progress, full assessment progress, submission, scoring, account creation, and dashboard handoff must be mapped before changing schemas.

## Safe implementation sequence
1. Map API routes, tables, RPCs, token contracts, and scoring dependencies.
2. Define separate taster and formal-assessment contracts.
3. Add isolated staging fixtures and a staging-only journey simulator.
4. Implement the 58-question standalone formal assessment.
5. Update dashboard status and resume/start actions.
6. Verify formal scoring and points report.
7. Run unit, integration, route, and end-to-end tests.
8. Visual QA at desktop/mobile; no production promotion without approval.
