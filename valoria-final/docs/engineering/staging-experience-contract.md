# Valoria Staging Experience Contract

Status: staging-only
Branch: experience/staging-redesign-20261106
Production release: prohibited without explicit approval.

## Isolation rules

- The staging Worker is a separate Cloudflare Worker service from valoria-assessment.
- Build-time and runtime Supabase values must be non-production placeholders until a dedicated staging Supabase project is explicitly approved and provisioned.
- Never inherit production Worker secrets or production service bindings.
- Do not execute database migrations, email delivery, password recovery, invitation delivery, or profile writes from staging.
- Assessment API calls in the public staging preview may be intentionally unavailable; display a clear preview-safe state rather than silently falling through to production.
- Keep all existing production assessment routes, domains, auth settings, and member records unchanged.

## Product contract to preserve

- The nine-question taster is a separate assessment.
- The full assessment contains 58 questions.
- The taster is not a partial completion of the full assessment.
- Official VALU Index and PRIME results use points, never percentages.
- Assessment progress, answer persistence, authenticated handoff, eligibility and profile access rules remain owned by the existing application state and API contracts.
- Visual changes must not change scoring, eligibility, data schemas or assessment state transitions.

## Staging review scope

The staging review should cover the question-taking shell, assessment progress presentation, loading and validation states, completion/continuation states and responsive layouts. If live assessment APIs are unavailable due to safe isolation, use non-persistent visual fixtures clearly marked as preview data. Do not create fake production records or imply that preview results are official.

## Deployment target
The staging assessment application is built and deployed to the isolated Cloudflare Worker named valoria-staging-assessment. It must not deploy to valoria-assessment or bind the production assessment hostname.

## Release gate

The staging version must pass the existing worker tests, Vite build and Wrangler dry-run. Browser verification at 1440, 1280, 768 and 390 pixels is required before acceptance. No production deployment or migration is permitted as part of this branch.
