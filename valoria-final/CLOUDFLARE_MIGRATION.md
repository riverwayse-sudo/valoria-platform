# Cloudflare Workers migration — assessment platform

This migration deploys the existing Vite assessment interface and routes its existing API handlers through a Cloudflare Worker. Supabase remains the system of record; no database migration or participant-data rewrite is part of this release.

## GitHub Actions secrets

Add these to the repository's Actions secrets:

- `CLOUDFLARE_API_TOKEN`: API token scoped to the target account with permission to edit/deploy Workers.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
- `VITE_SUPABASE_URL`: existing Supabase project URL used by the browser client.
- `VITE_SUPABASE_ANON_KEY`: existing public/anon key used by the browser client.

Do not paste secrets into chat or commit them.

## Cloudflare Worker secrets

Before the first live API test, configure these as Worker secrets/variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`
- `VALU_SITE_ORIGIN`
- `VALU_PRODUCTION_SUPABASE_URL`

Use Worker secrets for all credentials. Keep production and preview Supabase credentials separate. The Worker uses `nodejs_compat` and `nodejs_compat_populate_process_env` so existing server modules can continue reading environment variables without changing shared global state per request.

## Routes

- `/valu/assessment` and `/valu/assessment/` serve the Vite entry point.
- `/valu/assessment/assets/*` serves built Vite assets.
- `/api/*` dispatches to the existing API handlers.

## Scheduled tasks

The existing Vercel cron schedules are carried across:

- `0 2 * * *` UTC — `/api/sweep-unsent-reports`
- `0 3 * * *` UTC — `/api/assessment-progress` (the authenticated reminder sweep branch)

The scheduled calls include the `CRON_SECRET` bearer token. Verify both tasks in Worker logs after deployment.

## Release gates

Deploy to the generated `workers.dev` URL first. Do not attach `assessment.valoriainstitute.com` or change DNS until all of these pass:

1. Worker health/status endpoint responds as expected.
2. Vite entry point and JS/CSS assets load under `/valu/assessment/`.
3. Taster start, save/resume and 9-question submission persist correctly.
4. Email confirmation and authenticated dashboard handoff work end-to-end.
5. Full 58-question assessment resumes and submits; VALU Index points persist.
6. Report generation and delivery work.
7. Marketplace profile creation, readiness and listing rules remain unchanged.

No production DNS cutover is performed by this workflow.
