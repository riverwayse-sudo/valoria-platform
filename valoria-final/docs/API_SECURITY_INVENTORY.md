# Valoria API Security Inventory

This is the protocol contract for the server API. Every new endpoint must be added here before production release.

| Endpoint | Method | Trust class | Primary data | Required control | External dependency |
|---|---|---|---|---|---|
| `/api/submit-assessment` | POST | Public | Assessment answers | Input bounds, duplicate protection, rate limit | Supabase |
| `/api/update-assessment` | POST | Authenticated | Assessment | Auth + email ownership | Supabase |
| `/api/get-assessment-data` | POST | Internal | Assessment/report | CRON secret (service-role read) | Supabase |
| `/api/create-account` | POST | Public | Identity/account | Auth verification, email ownership, rate limit | Supabase/Auth |
| `/api/claim-listing` | POST | Authenticated | Professional identity | Auth + assessment ownership | Supabase |
| `/api/claim-taster` | POST | Authenticated | Snapshot claim | Auth + taster ownership | Supabase |
| `/api/link-assessment-to-taster` | POST | Authenticated | Snapshot/full linkage | Auth + token binding | Supabase |
| `/api/assessment-progress` | POST | Authenticated | Full assessment progress | Auth + ownership, resume/idempotency | Supabase |
| `/api/taster-progress` | POST | Capability token | Snapshot progress | Hashed resume token, rate limit, submission-key binding | Supabase |
| `/api/submit-taster` | POST | Capability token | Snapshot result | Submission-key idempotency | Supabase |
| `/api/generate-and-send-report` | POST | Public trigger + internal worker | Assessment/report | Opaque report token for public triggers, CRON secret for worker, IP/token rate limits, idempotency, state machine | Supabase, Anthropic, Resend |
| `/api/save-report` | POST | Internal | AI report | CRON secret, write confirmed via return=representation | Supabase |
| `/api/finalize-report` | POST | Internal | Report status | CRON secret, mark-sent write confirmed | Supabase |
| `/api/report` | POST | Internal | AI report generation | CRON secret, requires a completed assessment | Supabase, Anthropic |
| `/api/send-email` | POST | Internal | Email/report | Internal auth, destination validation | Resend |
| `/api/resend-confirmation` | POST | Public | Confirmation email | Rate limit, generic response | Supabase, Resend |
| `/api/send-profile-reminder` | POST | Internal | Reminder email | Internal auth, rate limit | Supabase, Resend |
| `/api/sweep-unsent-reports` | GET | Internal | Report queue | CRON secret, bounded batch (Vercel cron target) | Supabase |
| `/api/process-readiness-queue` | GET | Internal | Readiness queue | CRON secret, bounded batch | Supabase |
| `/api/notifications` | POST | Internal | Notifications | CRON secret | Supabase, Resend |
| `/api/system-status` | GET | Internal | Operational metadata | CRON secret, no-store | Supabase |
| `/api/reconciliation-health` | GET | Internal | Aggregate reconciliation health | CRON secret or Vault-backed private invocation key, service-role database access, no participant-level output | Supabase |

`get-assessment-data` is recorded here as POST/Internal because that is what the
code enforces (`req.method !== "POST"` → 405, CRON secret required). The table
previously described it as GET/Authenticated, which matched neither the handler
nor its only caller (`run-report.js`, which POSTs with the CRON secret). A
runtime test now pins the actual behaviour.

## Data classification

- **Public:** marketing/profile fields explicitly designated public.
- **Private:** email, assessment answers, assessment scores, reports, identity hashes.
- **Internal:** service configuration, operational counters, rate-limit state.
- **Secrets:** Supabase service-role key, Anthropic key, Resend key, CRON secret.

## Trust boundaries

1. Browser → Vercel API: browser input is untrusted.
2. Browser → Supabase REST: permitted only through explicit RLS policy; never assume the public key provides authorization.
3. Vercel → Supabase: service-role access is server-only and must be narrowly scoped by endpoint logic.
4. Vercel → Anthropic: prompt and model output are untrusted external data; validate response shape and bound tokens/time.
5. Vercel → Resend: email delivery is an external side effect; use idempotency/state to prevent duplicate sends.

## Release requirements

A new endpoint is not production-ready until it has:

- explicit trust classification;
- method allowlist;
- input validation and size bounds;
- authentication/authorization decision documented;
- rate-limit decision documented;
- no sensitive data in client-visible errors;
- external calls with bounded timeout/retry behavior;
- regression test covering the authorization boundary;
- CI and Vercel deployment verification.
