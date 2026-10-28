# Cross-repository callback and redirect contract

The assessment app (this repository, `valoria-platform`) and the main site
(`valoria-site`) deploy separately but present to the participant as one product.
The site embeds the assessment at `/valu/assessment/`. This document records the
exact handoff contract, so a staging deployment can be configured correctly and a
preview host is never written down as a permanent destination.

Nothing here changes shared production configuration. It states what would have to
be set for a staging environment to work, and what is already correct.

## 1. Who owns what

| Concern | Owner | Evidence |
| --- | --- | --- |
| Supabase Auth signup, email confirmation, recovery | `valoria-site` | `src/lib/site-url.js` builds `/auth/callback` and `/reset-password` |
| Assessment rendering and scoring | `valoria-platform` | `src/FullVALUAssessment.jsx`, `src/VALUIndexV4GateNext.jsx` |
| Profile creation after the assessment | `valoria-site` | platform links to `/profile/onboarding` |

The assessment app **does not** perform Supabase Auth signup or confirmation. It
hands the participant to a site route and the site completes the flow. That is why
the platform's redirects point at site paths rather than at its own `/auth/*`
routes — the site's `/auth/callback` does not exist inside this repository, and
`VERCEL_URL` is deliberately excluded as a fallback for the same reason
(`AGENTS.md`).

## 2. How each side resolves its origin

Both sides resolve the origin at runtime from environment-specific values. Neither
hardcodes a preview host, and production is only a last-resort fallback.

**Site** — `valoria-site/src/lib/site-url.js`:

1. `NEXT_PUBLIC_SITE_URL` — the intended control point. Set per environment.
2. `window.location.origin` — fallback so unconfigured environments still work.
3. `https://valoriainstitute.com` — last resort for server rendering.

Produces `authCallbackUrl()` → `{origin}/auth/callback` and `passwordResetUrl()` →
`{origin}/reset-password`.

**Platform** — `valoria-platform/src/siteOrigin.js`, baked in at build time by
`vite.config.js`:

1. `VALORIA_SITE_URL` → `__SITE_ORIGIN__` (build-time substitution).
2. `https://valoriainstitute.com` — last resort, and documented as such.

Produces `siteUrl(path)` → `{origin}{path}`.

## 3. The routes the platform hands off to

From `siteUrl(...)` call sites in `src/`:

| Route | Purpose |
| --- | --- |
| `/professional-signup/` | new participant signup, carries assessment parameters |
| `/login` | existing participant sign-in; may carry `pending_taster_id` |
| `/journey/continue?stage=assess&taster_id=…` | resume an in-progress journey |
| `/profile/onboarding` | profile completion after the assessment |
| `/report` | view the VALU report |
| `/marketplace`, `/prime`, `/about-us`, `/`, `/terms-of-use` | site navigation and branding |

The site's own callback routes, which Supabase Auth must be allowed to redirect to:

| Route | Set by |
| --- | --- |
| `/auth/callback` | `authCallbackUrl()` — email confirmation |
| `/reset-password` | `passwordResetUrl()` — password recovery |

## 4. Environment variables per environment

Not applied here — this is the change list a staging environment needs.

| Variable | Repository | Environment | Value |
| --- | --- | --- | --- |
| `VALORIA_SITE_URL` | `valoria-platform` | staging | the staging site origin, e.g. `https://<staging-site-host>` |
| `VALORIA_SITE_URL` | `valoria-platform` | production | `https://valoriainstitute.com` |
| `NEXT_PUBLIC_SITE_URL` | `valoria-site` | staging | the same staging site origin |
| `NEXT_PUBLIC_SITE_URL` | `valoria-site` | production | `https://valoriainstitute.com` |

Both must name the **same** origin for one environment. If they disagree, the
assessment sends the participant to one host and the confirmation email returns
them to another, and the journey breaks between the two.

Use the environment's stable origin, not a per-deployment preview host. Preview
hosts expire and are not allowlisted, which is the failure recorded in the comment
at the top of `valoria-site/src/lib/site-url.js`.

## 5. Supabase Auth configuration

`SUPABASE_AUTH_URL_ALLOWLIST` is not a real variable name; the allowlist is set in
the Supabase dashboard, and this is the part that cannot be done from either
repository. For each environment, the Auth **Redirect URLs** allowlist must
contain:

- `{site origin}/auth/callback`
- `{site origin}/reset-password`

And the Auth email templates (confirm signup, magic link, recovery) must use
`{{ .ConfirmationURL }}` or an equivalent that resolves to the same
`/auth/callback` route. A template with a hardcoded production URL will send a
staging participant to production, which is the defect the `site-url.js` comment
describes as already having happened once.

Until the staging origin is in the allowlist, Supabase rejects the redirect and the
confirmation flow fails even though both applications are configured correctly.
This is the most likely cause of a "confirmation email arrives but the link does
not work" report on a new environment.

## 6. Verification status

| Item | Status |
| --- | --- |
| Platform resolves handoff links from `VALORIA_SITE_URL`, no hardcoded hosts | PASS — `src/siteOrigin.js` |
| Site resolves callback links from `NEXT_PUBLIC_SITE_URL` | PASS — `src/lib/site-url.js` |
| No staging-to-production redirect introduced by `remediation/staging-2026-10-23` | PASS — the branch adds no redirect or host literal |
| Staging origins registered in Supabase Auth allowlist | BLOCKED — dashboard change, requires authorization |
| End-to-end confirmation on staging | BLOCKED — no staging credentials; previews are SSO-gated |
