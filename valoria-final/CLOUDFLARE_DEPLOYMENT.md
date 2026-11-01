# Cloudflare Workers deployment

This Worker serves the Vite assessment application under `/valu/assessment/` and routes the existing API handlers under `/api/*`. Supabase remains the system of record; no database migration is part of this hosting move.

## Required GitHub Actions secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`
- `VALU_SITE_ORIGIN`
- `VALU_PRODUCTION_SUPABASE_URL`

Do not put secret values in the repository or chat. Preview-specific Supabase values must be configured separately before deploying a preview Worker.

## Deployment

The `Cloudflare Workers` GitHub Actions workflow deploys this Worker to its `workers.dev` hostname. It does not change DNS or attach the production assessment hostname. Verify the Worker health endpoint and the complete assessment journey before configuring a custom domain.

The Worker uses the Node.js compatibility layer and populates `process.env` from Worker variables/secrets because existing handlers read their configuration through `process.env`. This is deliberate compatibility scaffolding; handler logic and scoring rules are not rewritten.
