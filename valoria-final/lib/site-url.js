// lib/site-url.js
//
// Resolves the public origin of the valoria-site deployment that this platform
// instance belongs to, for building auth redirects and journey links.
//
// These were hardcoded to https://valoriainstitute.com in create-account.js,
// resend-confirmation.js and assessment-progress.js. On staging that is a real
// defect: a participant who registers on staging is handed a Supabase
// confirmation link whose redirect_to points at production, and assessment
// reminders send them to the production journey. The account is created in the
// staging database, so the user is then stranded — confirmed on one deployment,
// recorded on another.
//
// Resolution order:
//   1. VALORIA_SITE_URL     — explicit, environment-specific; set this on staging.
//   2. SITE_ORIGIN          — legacy name, still honoured for existing deployments.
//   3. NEXT_PUBLIC_SITE_URL — the name valoria-site uses, for parity.
//   4. Production origin    — last resort.
//
// VERCEL_URL is deliberately NOT in this chain. This platform and valoria-site
// are separate Vercel projects (valoria-final-* vs valoria-site-*), so Vercel's
// automatic VERCEL_URL names *this* deployment, not the site. Using it would
// build auth callbacks like https://valoria-final-<hash>.vercel.app/auth/callback,
// which is wrong three ways: /auth/callback is a site route that does not exist
// here, the host is ephemeral and changes every deploy, and preview hosts are
// Deployment-Protection gated so the link would dead-end at a Vercel login.
//
// If none of the above is set we fall back to production, because production
// legitimately needs no override. That fallback is only correct for production,
// so warn loudly elsewhere rather than silently mailing a production link.

export const PRODUCTION_SITE_URL = 'https://valoriainstitute.com';

function originOf(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveSiteUrl(env = process.env) {
  const explicit = originOf(env.VALORIA_SITE_URL)
    || originOf(env.SITE_ORIGIN)
    || originOf(env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;

  // Vercel sets VERCEL_ENV to 'production' | 'preview' | 'development'.
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') {
    console.error(
      `site-url: no site origin configured (VERCEL_ENV=${env.VERCEL_ENV}); ` +
      `falling back to ${PRODUCTION_SITE_URL}. Auth redirects and journey links ` +
      `will point at production. Set VALORIA_SITE_URL for this environment.`
    );
  }
  return PRODUCTION_SITE_URL;
}

