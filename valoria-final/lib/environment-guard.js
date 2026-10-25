// lib/environment-guard.js
//
// Stops a non-production deployment from writing to the production database.
//
// The risk this closes: Vercel's preview environment is configured with the same
// Supabase URL and service-role key as production. Nothing in the handlers checks
// which environment it is running in, so a preview deployment — including one
// built from an unreviewed branch — can register participants, submit assessments
// and mutate real data. Running the staging acceptance suite against such a
// deployment would write to production, which is why that suite has not been run.
//
// The guard is a pure decision function so it can be tested exhaustively without a
// deployment. The handlers call it before any privileged write.
//
// The rule, in order:
//
//   1. VERCEL_ENV=production        -> allow. This is production.
//   2. VERCEL_ENV unset or empty    -> allow. Not a Vercel-managed deployment, so
//                                      this is local development or a test runner.
//                                      Vercel always sets VERCEL_ENV on deployments,
//                                      so an unset value cannot be a preview.
//   3. anything else (preview, ...) -> allow only when the configured Supabase
//                                      project is the one declared as staging.
//
// Rule 3 fails closed at every step: no declared staging project, no Supabase URL,
// or a URL whose project ref cannot be read all deny the write. The failure mode
// is a refused write with a clear message, not a silent write to production.

/** Extract the project ref from a Supabase URL, or null if it is not one. */
export function supabaseProjectRef(url) {
  if (typeof url !== 'string' || !url) return null
  let host
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }
  const match = host.match(/^([a-z0-9]{20})\.supabase\.(?:co|in)$/)
  return match ? match[1] : null
}

/**
 * Decide whether a privileged write may proceed.
 *
 * Pure: takes the environment as an argument rather than reading process.env, so
 * every combination is reachable in a test.
 *
 * @returns {{ allowed: boolean, reason: string }}
 */
export function decideWriteAllowed({ vercelEnv, supabaseUrl, stagingProjectRef }) {
  if (vercelEnv === 'production') {
    return { allowed: true, reason: 'production' }
  }
  if (!vercelEnv) {
    // Not on Vercel. Local development and the test runner live here.
    return { allowed: true, reason: 'non-vercel' }
  }

  if (!stagingProjectRef) {
    return {
      allowed: false,
      reason: `refusing a privileged write from VERCEL_ENV=${vercelEnv} because no staging database is declared (set STAGING_SUPABASE_PROJECT_REF to the staging project ref)`,
    }
  }
  const ref = supabaseProjectRef(supabaseUrl)
  if (!ref) {
    return {
      allowed: false,
      reason: `refusing a privileged write from VERCEL_ENV=${vercelEnv} because SUPABASE_URL does not identify a Supabase project`,
    }
  }
  if (ref !== stagingProjectRef) {
    return {
      allowed: false,
      reason: `refusing a privileged write from VERCEL_ENV=${vercelEnv}: SUPABASE_URL points at project ${ref}, which is not the declared staging project ${stagingProjectRef}`,
    }
  }
  return { allowed: true, reason: 'declared staging database' }
}

/**
 * Evaluate the guard against the live process environment.
 * Convenience wrapper for handlers; the decision itself stays pure above.
 */
export function privilegedWriteAllowed() {
  return decideWriteAllowed({
    vercelEnv: process.env.VERCEL_ENV,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    stagingProjectRef: process.env.STAGING_SUPABASE_PROJECT_REF,
  })
}
