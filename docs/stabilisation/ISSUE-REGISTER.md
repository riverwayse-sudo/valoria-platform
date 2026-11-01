# Valoria Issue Register — Platform

This register is evidence-led. An issue remains OPEN/INVESTIGATING until its root cause is demonstrated and its regression test passes.

| ID | Module | Severity | Status | Evidence / observed behaviour | Root cause | Next action |
|---|---|---:|---|---|---|---|
| INF-001 | INF / ASM | S1 | INVESTIGATING | Paired site PR [#161](https://github.com/riverwayse-sudo/valoria-site/pull/161) records assessment HTML 200 but nested JS/CSS 404 and proxied taster/assessment API routes 404 in its tested Vercel preview. Platform PR [#60](https://github.com/riverwayse-sudo/valoria-platform/pull/60) adds a rewrite for `/valu/assessment/api/:path*` before SPA fallback and records that automated Jest/build checks and live endpoint probes were not run from the connector. Both commits have successful recorded CI workflows; that is not end-to-end proof. | UNKNOWN — platform route, project root, asset base path and upstream host must be verified together. | Confirm configured deployment root, inspect generated Vite asset paths and deployed handler paths, test direct platform requests and then paired site-proxy requests. Do not merge or deploy based on build status alone. |
| SCO-001 | SCO / TAS | S1 | INVESTIGATING | Platform PR [#60](https://github.com/riverwayse-sudo/valoria-platform/pull/60) records the snapshot RPC payload correction from `results.normalisedScores` to `results.points` and adds a source-level regression assertion. The PR states that live endpoint probes and automated checks were not run from the connector. | The payload contract mismatch is addressed in that PR's branch; production/current-main state still requires verification. | Verify canonical scoring function output, RPC argument contract and persisted taster result in isolated staging. Add/retain an executable contract test, not only source-string matching. |

## Severity
- S0: security exposure, data loss/corruption or cross-user data access.
- S1: critical user journey blocked.
- S2: major feature impaired with a viable workaround.
- S3: cosmetic/minor issue.

## Required fields for new issues
ID, module, expected/actual behaviour, exact route/action, environment and commit, severity, reproducible evidence, root cause (UNKNOWN until proven), affected files/API/schema, dependencies, fix scope, regression test, verification evidence and status.

## Status definitions
NOT AUDITED; OPEN; INVESTIGATING; FIXED—UNVERIFIED; VERIFIED IN PREVIEW; RELEASED; MONITORING.

Do not infer root cause from symptoms. Do not mark RELEASED without production smoke evidence.
