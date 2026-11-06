# Assessment Separation — Current Contract Map

**Status: staging audit in progress. This is not an implementation sign-off.**

## Confirmed client-side structure

| Area | Current file | Confirmed behaviour |
|---|---|---|
| Taster questions and directional scoring | `valoria-final/src/valuTaster.js` | Defines nine question IDs and computes a taster-specific result. |
| Formal question bank | `valoria-final/src/questions.js` | Canonical question bank contains the formal 58 questions. |
| Journey ordering | `valoria-final/src/assessmentJourney.js` | Legacy model imports taster questions as the opening nine, builds a 9 + 49 order, and exports answer seeding from opening answers. |
| Taster UI | `valoria-final/src/VALUIndexV4GateNext.jsx` | Calls the taster progress API, saves nine answers, then describes the account bridge as part of one assessment. |
| Formal assessment UI | `valoria-final/src/FullVALUAssessment.jsx` | Imports opening positions and session length; initializes answered count with the opening nine and uses a combined 58-question order. |
| Journey progress UI | `valoria-final/src/VALUAssessmentJourney.jsx` | Displays Opening (1–9), Account bridge, Continuation (10–58). |
| Application entry | `valoria-final/src/VALUIndexV4App.jsx` | Selects taster/legacy opening UI or formal continuation based on the `full=1` query parameter. |

## Confirmed API and persistence structure

| Area | Current file | Confirmed behaviour / dependency |
|---|---|---|
| Taster progress | `valoria-final/api/taster-progress.js` | Creates and resumes records in `taster_progress`; answer keys are constrained to the nine taster questions. |
| Taster submission | `valoria-final/api/submit-taster.js` | Validates all nine taster answers, computes directional cluster points and calls `submit_taster_with_identity_candidate`. |
| Formal progress | `valoria-final/api/assessment-progress.js` | Uses `valu_assessment_progress`; its current identity resolution requires a completed, account-linked taster record and the progress schema includes `taster_id`. |
| Formal submission / handoff | `valoria-final/api/submit-assessment.js` | Imports the legacy combined journey helpers and currently relies on taster-linked identity/handoff paths. Full route-level review is still required. |

## Architectural conclusion

The taster has its own progress table and submission endpoint, but the overall product journey is not yet two independent assessment instruments. The formal assessment client and server still depend on the legacy opening-nine model, and formal progress resolution is coupled to a completed taster record.

Therefore, changing only the UI labels, question counter or dashboard copy would be unsafe and incomplete.

## Required contract changes to design

1. Define independent instrument identifiers and lifecycle states for taster and formal assessment.
2. Define how a verified account starts a formal assessment without copying taster answers or requiring a taster record as the formal assessment's data parent.
3. Map the existing formal progress table, foreign keys, unique constraints, RPCs and report linkage before changing persistence.
4. Preserve historical records and provide an explicit compatibility/read strategy for existing in-progress and completed participants.
5. Replace the legacy 9 + 49 presentation order with the canonical 58-question formal order, subject to assessment-owner approval.
6. Make formal scoring accept only a complete, valid formal answer set and derive the official VALU Index only from that set.
7. Keep taster directional results in their own result namespace and never expose them as the official VALU Index.
8. Update dashboard status, handoff, email reminders, profile/Registry eligibility and analytics to use the correct instrument state.
9. Add contract, migration, API, resume, idempotency, regression and end-to-end tests.

## Safety constraints

- No schema migration, production SQL, record rewrite, or production deployment during this audit.
- No genuine participant records in staging previews.
- Use deterministic synthetic fixtures for test coverage.
- Preserve idempotency and historical report access.
- Require assessment-specialist review of the measurement model and human approval of any migration affecting participant data.

## Next engineering sequence

1. Complete the route, RPC, table, trigger, migration and foreign-key map.
2. Write the new independent formal-assessment contract and migration plan.
3. Add tests that prove taster/formal isolation.
4. Implement the formal assessment lifecycle and API changes on staging.
5. Update dashboard and report journeys.
6. Run staging end-to-end tests and reconcile historical-record compatibility.
