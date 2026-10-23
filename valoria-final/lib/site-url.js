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
//   1. VALORIA_SITE_URL   — explicit, environment-specific; set this on staging.
//   2. SITE_ORIGIN        — already used by generate-and-send-report.js.
//   3. NEXT_PUBLIC_SITE_URL — the name valoria-site uses, for parity.
//   4. VERCEL_URL         — the deployment's own host, correct-by-construction.
//   5. Production origin  — last-resort default for local runs.
//
// Never point this at a preview deployment host as a permanent value; preview
// hosts are per-deploy and change on every push.

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
  return originOf(env.VALORIA_SITE_URL)
    || originOf(env.SITE_ORIGIN)
    || originOf(env.NEXT_PUBLIC_SITE_URL)
    || originOf(env.VERCEL_URL)
    || PRODUCTION_SITE_URL;
}
