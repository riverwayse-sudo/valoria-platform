# Valoria Issue Register — Platform

This register is evidence-led. An issue remains OPEN/INVESTIGATING until its root cause is demonstrated and its regression test passes.

| ID | Module | Severity | Status | Evidence / observed behaviour | Root cause | Next action |
|---|---|---:|---|---|---|---|
| INF-001 | INF / ASM | S1 | INVESTIGATING | Paired site PR [#161](https://github.com/riverwayse-sudo/valoria-site/pull/161) records assessment HTML 200 but nested JS/CSS and proxied taster/assessment API routes 404. Live inspection on 2026-11-01: a Vercel platform preview served built HTML with hashed `/valu/assessment/assets/index-*.js` and CSS; those assets were directly fetchable with 200. Its `GET /api/taster-progress` returned 405, expected because the handler accepts POST only; POST has not yet been exercised. The site PR preview returned stale/dev HTML referencing `/src/main.jsx`, with Cloudflare cache headers, and returned 404 for tested nested asset and `/api/taster-progress` paths. Platform PR [#60](https://github.com/riverwayse-sudo/valoria-platform/pull/60) adds a rewrite for `/valu/assessment/api/:path*` before SPA fallback, but its PR description says live endpoint probes were not run. CI success is not end-to-end proof. | Partially isolated: Vite build base is `/valu/assessment/`; platform Vercel rewrites `/valu/assessment/assets/:path*` to `/assets/:path*` before SPA fallback. The paired site preview appears to resolve to a different/stale upstream response. Exact cause (alias/environment selection, Cloudflare routing/cache, or deployment mismatch) remains UNKNOWN. | Confirm the platform deployment selected by the site's actual `VALU_UPSTREAM_ORIGIN` for that exact preview commit. Verify project root and deployment alias; then test identical HTML, hashed JS/CSS and POST API paths direct and through site proxy. Do not merge/deploy based on build status alone. |
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
