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
// The rule: a privileged write is allowed only when the runtime identity AND the
// target database are both positively identified. Nothing is allowed by default.
//
//   1. VERCEL_ENV=production  -> the target must be the declared production
//                                project (PRODUCTION_SUPABASE_PROJECT_REF).
//   2. VERCEL_ENV set, other  -> the target must be the declared staging project
//      (preview, development,   (STAGING_SUPABASE_PROJECT_REF), and the declared
//       or anything unknown)     production project must be known and different.
//   3. VERCEL_ENV unset/empty -> refused unless local writes are explicitly
//                                enabled (ALLOW_LOCAL_PRIVILEGED_WRITES=true),
//                                and then the target must still be the declared
//                                staging project, with production declared and
//                                different.
//
// There is deliberately no bare "not on Vercel, so allow" branch. An earlier
// version had one, and it was a hole: a deployment whose VERCEL_ENV failed to
// propagate, or any runtime Vercel does not manage, would have been treated as
// local development and allowed to write with production credentials.
//
// Case 3 is the local-development and test-runner path. It is opt-in through a
// named variable rather than inferred from an absent one, and it still requires
// the target to be the declared staging project. It therefore cannot reach
// production without someone deliberately declaring the production ref as the
// staging ref.
//
// Every branch fails closed: a missing declaration, an unreadable Supabase URL,
// or a target that does not match the declaration all refuse the write with a
// clear reason. The failure mode is a refused write, not a silent write.

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
 * Canonical form of a declared project ref.
 *
 * Supabase refs are lowercase and carry no surrounding whitespace, but the value
 * arrives through an operator-managed environment variable, where a copy-paste
 * error (an uppercased ref, a trailing newline) is a realistic way to lock a
 * deployment out of its own database. Normalising the *declaration* cannot widen
 * access: it only ever maps a declaration onto the same project, never onto a
 * different one. The URL side is already lowercased by the WHATWG URL parser.
 */
function normalizeRef(ref) {
  return typeof ref === 'string' ? ref.trim().toLowerCase() : ref
}

/** The environment label used in refusal messages. */
function environmentLabel(vercelEnv) {
  return vercelEnv ? `VERCEL_ENV=${vercelEnv}` : 'an unidentified runtime (VERCEL_ENV is unset)'
}

/**
 * Decide whether a privileged write may proceed.
 *
 * Pure: takes the environment as an argument rather than reading process.env, so
 * every combination is reachable in a test.
 *
 * @returns {{ allowed: boolean, reason: string }}
 */
export function decideWriteAllowed({
  vercelEnv,
  supabaseUrl,
  productionProjectRef,
  stagingProjectRef,
  allowLocalWrites,
}) {
  const target = supabaseProjectRef(supabaseUrl)
  const declaredProduction = normalizeRef(productionProjectRef)
  const declaredStaging = normalizeRef(stagingProjectRef)

  if (vercelEnv === 'production') {
    if (!declaredProduction) {
      return {
        allowed: false,
        reason:
          'refusing a privileged write from VERCEL_ENV=production because the production database is not declared (set PRODUCTION_SUPABASE_PROJECT_REF to the production project ref)',
      }
    }
    if (!target) {
      return {
        allowed: false,
        reason:
          'refusing a privileged write from VERCEL_ENV=production because SUPABASE_URL does not identify a Supabase project',
      }
    }
    if (target !== declaredProduction) {
      return {
        allowed: false,
        reason: `refusing a privileged write from VERCEL_ENV=production: SUPABASE_URL points at project ${target}, which is not the declared production project ${declaredProduction}`,
      }
    }
    return { allowed: true, reason: 'production' }
  }

  if (!vercelEnv && allowLocalWrites !== true) {
    return {
      allowed: false,
      reason:
        'refusing a privileged write because VERCEL_ENV is unset and local writes are not explicitly enabled (set ALLOW_LOCAL_PRIVILEGED_WRITES=true to permit local development against a declared project)',
    }
  }

  if (!declaredStaging) {
    return {
      allowed: false,
      reason: `refusing a privileged write from ${environmentLabel(vercelEnv)} because no staging database is declared (set STAGING_SUPABASE_PROJECT_REF to the staging project ref)`,
    }
  }
  if (!declaredProduction) {
    // A non-production runtime must prove its target is not production, and it
    // cannot do that without knowing which project production is. Skipping the
    // check when the production ref is absent is unsound: a staging declaration
    // that names the production project would then be honoured, and that is
    // exactly the misconfiguration that lets a preview (or a runtime whose
    // VERCEL_ENV is misspelled) write to production. Fail closed instead.
    return {
      allowed: false,
      reason: `refusing a privileged write from ${environmentLabel(vercelEnv)} because the production database is not declared (set PRODUCTION_SUPABASE_PROJECT_REF to the production project ref); without it a non-production runtime cannot be shown to be pointed away from production`,
    }
  }
  if (declaredStaging === declaredProduction) {
    // If the staging declaration names the production project, the declaration is
    // wrong and the write is refused rather than honoured.
    return {
      allowed: false,
      reason: `refusing a privileged write from ${environmentLabel(vercelEnv)} because STAGING_SUPABASE_PROJECT_REF names the production project; a non-production runtime must not target production`,
    }
  }
  if (!target) {
    return {
      allowed: false,
      reason: `refusing a privileged write from ${environmentLabel(vercelEnv)} because SUPABASE_URL does not identify a Supabase project`,
    }
  }
  if (target !== declaredStaging) {
    return {
      allowed: false,
      reason: `refusing a privileged write from ${environmentLabel(vercelEnv)}: SUPABASE_URL points at project ${target}, which is not the declared staging project ${declaredStaging}`,
    }
  }
  return {
    allowed: true,
    reason: vercelEnv ? 'declared staging database' : 'local development against the declared staging database',
  }
}

/**
 * Evaluate the guard against the live process environment.
 * Convenience wrapper for handlers; the decision itself stays pure above.
 */
export function privilegedWriteAllowed() {
  return decideWriteAllowed({
    vercelEnv: process.env.VERCEL_ENV,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    productionProjectRef: process.env.PRODUCTION_SUPABASE_PROJECT_REF,
    stagingProjectRef: process.env.STAGING_SUPABASE_PROJECT_REF,
    allowLocalWrites: process.env.ALLOW_LOCAL_PRIVILEGED_WRITES === 'true',
  })
}
