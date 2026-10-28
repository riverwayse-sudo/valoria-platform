// valoria-final/lib/environment-scope.js
//
// Pre-flight inspection of a deployment's environment scope, without revealing
// any secret value.
//
// Relationship to lib/environment-guard.js (PR #67): the guard decides, at
// request time, whether a privileged write may proceed. This module answers the
// same question earlier — before a deployment is tested against — by inspecting
// the configured variables. It is a separate implementation on purpose: if the
// two ever disagree about the same inputs, that disagreement is itself a finding.
// (The decision rules were cross-checked against the guard in the PR that
// introduced this module; see the accompanying notes.)
//
// Why this is worth having: the guard fails closed, so a misconfigured deployment
// does not fail at deploy time — it fails at the first participant write, with a
// 503. Worse, the configuration that produces that 503 (a staging deployment
// pointed at the production database) is exactly the configuration that would
// write to production if the guard were not there. Checking the scope before
// testing moves the discovery from "during a participant journey" to "before it".
//
// Redaction rule: a variable whose NAME contains KEY, TOKEN, SECRET or PASSWORD is
// reported as present/absent plus its length, never its value. Supabase project
// refs and URLs are reported in full, because a project ref is public — it appears
// in every client-side storage URL — and the point of the check is to confirm the
// target is the intended one.

const SECRET_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD)/i;
const SUPABASE_HOST_PATTERN = /^([a-z0-9]{20})\.supabase\.(?:co|in)$/;

/** Supabase project refs are always 20 lowercase alphanumeric characters. */
export const REF_LENGTH = 20;

/** Extract the project ref from a Supabase URL, or null if it is not one. */
export function supabaseProjectRef(url) {
  if (typeof url !== "string" || !url) return null;
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  const match = host.match(SUPABASE_HOST_PATTERN);
  return match ? match[1] : null;
}

/**
 * Canonical form of a declared ref. Mirrors the guard: the declaration is
 * operator-managed, so a stray newline or an uppercased ref is a realistic
 * copy-paste error. Normalising only ever maps a declaration onto the same
 * project, so it cannot widen access.
 */
export function normalizeRef(ref) {
  return typeof ref === "string" ? ref.trim().toLowerCase() : ref;
}

/** Parse a dotenv-style file into an object. Values are never logged. */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length > 1 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/** Describe a variable without revealing a secret. */
export function describeValue(name, value) {
  const present = typeof value === "string" && value.length > 0;
  if (SECRET_PATTERN.test(name)) {
    return present ? `set (${value.length} chars, value not shown)` : "unset";
  }
  return present ? value : "unset";
}

const REPORTED_VARIABLES = [
  "VERCEL_ENV",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "PRODUCTION_SUPABASE_PROJECT_REF",
  "STAGING_SUPABASE_PROJECT_REF",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
];

/**
 * Evaluate one scope's environment. Pure: the environment is an argument.
 *
 * @param {"production"|"preview"} scope
 * @param {object} env
 * @returns {{ scope: string, checks: Array<{name: string, ok: boolean, detail: string}>, variables: object, failed: number }}
 */
export function evaluateScope(scope, env = {}) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const targetRef = supabaseProjectRef(supabaseUrl);
  const declaredProduction = normalizeRef(env.PRODUCTION_SUPABASE_PROJECT_REF);
  const declaredStaging = normalizeRef(env.STAGING_SUPABASE_PROJECT_REF);

  add(
    "SUPABASE_URL identifies a Supabase project",
    Boolean(targetRef),
    targetRef
      ? `ref ${targetRef}`
      : supabaseUrl
        ? `not a recognised Supabase URL: ${supabaseUrl}`
        : "SUPABASE_URL (and VITE_SUPABASE_URL) are unset"
  );

  // The production declaration is required in BOTH scopes. In preview it is what
  // lets the guard prove the target is not production; without it the guard
  // refuses every write, which is safe but makes the environment untestable.
  add(
    "PRODUCTION_SUPABASE_PROJECT_REF is declared",
    Boolean(declaredProduction),
    declaredProduction
      ? `ref ${declaredProduction} (${declaredProduction.length} chars)`
      : "unset — the guard refuses every non-production write without it"
  );
  if (declaredProduction) {
    add(
      "production ref is the expected length",
      declaredProduction.length === REF_LENGTH,
      `${declaredProduction.length} chars (expected ${REF_LENGTH})`
    );
  }

  if (scope === "production") {
    add(
      "target is the declared production project",
      Boolean(targetRef && declaredProduction && targetRef === declaredProduction),
      targetRef && declaredProduction
        ? `target ${targetRef} vs declared ${declaredProduction}`
        : "cannot compare without both a target ref and a declared production ref"
    );
  } else {
    add(
      "STAGING_SUPABASE_PROJECT_REF is declared",
      Boolean(declaredStaging),
      declaredStaging
        ? `ref ${declaredStaging} (${declaredStaging.length} chars)`
        : "unset — the guard refuses every non-production write without it"
    );
    if (declaredStaging) {
      add(
        "staging ref is the expected length",
        declaredStaging.length === REF_LENGTH,
        `${declaredStaging.length} chars (expected ${REF_LENGTH})`
      );
      add(
        "staging ref does NOT name the production project",
        !declaredProduction || declaredStaging !== declaredProduction,
        !declaredProduction
          ? "production ref unset, so distinctness cannot be proven"
          : declaredStaging === declaredProduction
            ? "STAGING names the production project — the guard refuses this"
            : "distinct from production"
      );
      add(
        "target is the declared staging project",
        Boolean(targetRef && targetRef === declaredStaging),
        targetRef ? `target ${targetRef} vs declared ${declaredStaging}` : "no target ref"
      );
      add(
        "target is NOT the production project",
        !declaredProduction || targetRef !== declaredProduction,
        !declaredProduction
          ? "production ref unset, so this cannot be proven"
          : targetRef === declaredProduction
            ? "SUPABASE_URL points at PRODUCTION"
            : "does not point at production"
      );
    }
  }

  add(
    "SUPABASE_SERVICE_ROLE_KEY is present",
    Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    describeValue("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const variables = {};
  for (const name of REPORTED_VARIABLES) {
    variables[name] = describeValue(name, env[name]);
  }

  return { scope, checks, variables, failed: checks.filter((c) => !c.ok).length };
}

/** Render an evaluation as text. */
export function render(evaluation) {
  const lines = [`Scope: ${evaluation.scope}`, "", "Variables"];
  for (const [name, value] of Object.entries(evaluation.variables)) {
    lines.push(`  ${name.padEnd(38)} ${value}`);
  }
  lines.push("", "Checks");
  for (const c of evaluation.checks) {
    lines.push(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
    lines.push(`        ${c.detail}`);
  }
  lines.push("");
  lines.push(
    evaluation.failed === 0
      ? "Result: every check passed. A privileged write from this scope would reach the declared target."
      : `Result: ${evaluation.failed} check(s) failed. The guard would refuse privileged writes from this scope, or they would reach the wrong database.`
  );
  return lines.join("\n");
}
