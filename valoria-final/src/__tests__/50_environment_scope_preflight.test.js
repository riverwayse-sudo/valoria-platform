// valoria-final/src/__tests__/50_environment_scope_preflight.test.js
//
// Regression coverage for lib/environment-scope.js and the
// scripts/verify-environment-scope.mjs preflight.
//
// Purpose: the environment write guard (PR #67) fails closed, so a misconfigured
// deployment fails at the first participant write rather than at deploy time. The
// configuration that produces that failure — a non-production deployment pointed
// at the production database — is the same configuration that would write to
// production if the guard were absent. This preflight is what lets that be
// detected before a journey is run against the environment.
//
// Two things are asserted here that a plain unit test would miss:
//
//   1. Redaction. A secret value must never appear in the rendered output. This is
//      asserted by putting a distinctive value in and searching the output for it,
//      rather than by reading the code and believing it.
//
//   2. Agreement with the real guard. lib/environment-guard.js ships in PR #67 and
//      is not on main, so the cross-check runs only when it is present. When it is,
//      the two implementations are compared over the same inputs; a disagreement is
//      a failure. When it is absent, the cross-check reports itself as skipped
//      rather than silently passing.

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  supabaseProjectRef,
  normalizeRef,
  parseEnvFile,
  describeValue,
  evaluateScope,
  render,
} = require("../../lib/environment-scope.js");

const PROD_REF = "sbkgpisgkuhbalsxqkdr";
const STAGE_REF = "stgvaloria0000000001";
const prodUrl = `https://${PROD_REF}.supabase.co`;
const stageUrl = `https://${STAGE_REF}.supabase.co`;
const SECRET_VALUE = "a-distinctive-service-role-secret-9f3a1c";

function stageEnv(overrides = {}) {
  return {
    VERCEL_ENV: "preview",
    SUPABASE_URL: stageUrl,
    PRODUCTION_SUPABASE_PROJECT_REF: PROD_REF,
    STAGING_SUPABASE_PROJECT_REF: STAGE_REF,
    SUPABASE_SERVICE_ROLE_KEY: SECRET_VALUE,
    ...overrides,
  };
}

function checkNamed(evaluation, name) {
  const found = evaluation.checks.find((c) => c.name === name);
  if (!found) throw new Error(`no check named "${name}"`);
  return found;
}

describe("supabaseProjectRef", () => {
  test("extracts a 20-character ref from a Supabase URL", () => {
    expect(supabaseProjectRef(prodUrl)).toBe(PROD_REF);
    expect(supabaseProjectRef("https://abcdefghij0123456789.supabase.in")).toBe(
      "abcdefghij0123456789"
    );
  });

  test("returns null for anything that is not a Supabase URL", () => {
    for (const bad of ["", null, undefined, "not a url", "https://example.com", "https://x.supabase.co"]) {
      expect(supabaseProjectRef(bad)).toBeNull();
    }
  });
});

describe("normalizeRef", () => {
  test("trims and lowercases, so a copy-paste error does not lock a deployment out", () => {
    expect(normalizeRef("  ABCDEFGHIJ0123456789\n")).toBe("abcdefghij0123456789");
  });

  test("leaves non-strings alone", () => {
    expect(normalizeRef(undefined)).toBeUndefined();
    expect(normalizeRef(null)).toBeNull();
  });
});

describe("parseEnvFile", () => {
  test("reads keys, ignores comments and blanks, strips quotes", () => {
    const parsed = parseEnvFile(
      ["# comment", "", "A=1", 'B="two"', "C='three'", "D=  spaced  ", "malformed"].join("\n")
    );
    expect(parsed).toEqual({ A: "1", B: "two", C: "three", D: "spaced" });
  });

  test("a value containing '=' is preserved after the first '='", () => {
    expect(parseEnvFile("TOKEN=abc=def==").TOKEN).toBe("abc=def==");
  });
});

describe("redaction", () => {
  test("describeValue never reveals a secret value", () => {
    expect(describeValue("SUPABASE_SERVICE_ROLE_KEY", SECRET_VALUE)).toBe(
      `set (${SECRET_VALUE.length} chars, value not shown)`
    );
    expect(describeValue("SUPABASE_SERVICE_ROLE_KEY", "")).toBe("unset");
    expect(describeValue("MY_TOKEN", "x")).not.toContain("x");
    expect(describeValue("DB_PASSWORD", "hunter2")).not.toContain("hunter2");
  });

  test("a project ref is NOT treated as a secret", () => {
    expect(describeValue("STAGING_SUPABASE_PROJECT_REF", STAGE_REF)).toBe(STAGE_REF);
  });

  test("the rendered report contains no secret value, in text or JSON form", () => {
    const evaluation = evaluateScope("preview", stageEnv());
    expect(render(evaluation)).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(evaluation)).not.toContain(SECRET_VALUE);
    // It must still say the key is present, or the redaction is hiding a finding.
    expect(render(evaluation)).toContain("SUPABASE_SERVICE_ROLE_KEY is present");
  });
});

describe("evaluateScope: preview", () => {
  test("a correctly configured staging scope passes every check", () => {
    const evaluation = evaluateScope("preview", stageEnv());
    expect(evaluation.failed).toBe(0);
    expect(evaluation.checks.every((c) => c.ok)).toBe(true);
  });

  test("refuses when the target is the production database", () => {
    const evaluation = evaluateScope("preview", stageEnv({ SUPABASE_URL: prodUrl }));
    expect(evaluation.failed).toBeGreaterThan(0);
    expect(checkNamed(evaluation, "target is NOT the production project").ok).toBe(false);
    expect(checkNamed(evaluation, "target is the declared staging project").ok).toBe(false);
  });

  test("refuses when no staging ref is declared", () => {
    const evaluation = evaluateScope("preview", stageEnv({ STAGING_SUPABASE_PROJECT_REF: "" }));
    expect(checkNamed(evaluation, "STAGING_SUPABASE_PROJECT_REF is declared").ok).toBe(false);
  });

  test("refuses when no production ref is declared, even with a staging-looking target", () => {
    // This is the case that matters: a staging URL is not proof of isolation,
    // because the guard cannot show the target is not production without knowing
    // which project production is.
    const evaluation = evaluateScope("preview", stageEnv({ PRODUCTION_SUPABASE_PROJECT_REF: "" }));
    expect(evaluation.failed).toBeGreaterThan(0);
    expect(checkNamed(evaluation, "PRODUCTION_SUPABASE_PROJECT_REF is declared").ok).toBe(false);
  });

  test("refuses when the staging declaration names the production project", () => {
    const evaluation = evaluateScope(
      "preview",
      stageEnv({ STAGING_SUPABASE_PROJECT_REF: PROD_REF, SUPABASE_URL: prodUrl })
    );
    expect(checkNamed(evaluation, "staging ref does NOT name the production project").ok).toBe(false);
  });

  test("refuses a ref of the wrong length", () => {
    const evaluation = evaluateScope(
      "preview",
      stageEnv({ STAGING_SUPABASE_PROJECT_REF: "tooshort", SUPABASE_URL: "https://tooshort.supabase.co" })
    );
    expect(checkNamed(evaluation, "staging ref is the expected length").ok).toBe(false);
  });
});

describe("evaluateScope: production", () => {
  test("a correctly configured production scope passes", () => {
    const evaluation = evaluateScope(
      "production",
      stageEnv({ VERCEL_ENV: "production", SUPABASE_URL: prodUrl })
    );
    expect(evaluation.failed).toBe(0);
  });

  test("refuses when the production ref is undeclared", () => {
    const evaluation = evaluateScope(
      "production",
      stageEnv({ VERCEL_ENV: "production", SUPABASE_URL: prodUrl, PRODUCTION_SUPABASE_PROJECT_REF: "" })
    );
    expect(checkNamed(evaluation, "PRODUCTION_SUPABASE_PROJECT_REF is declared").ok).toBe(false);
  });

  test("refuses when production points at the staging project", () => {
    const evaluation = evaluateScope(
      "production",
      stageEnv({ VERCEL_ENV: "production", SUPABASE_URL: stageUrl })
    );
    expect(checkNamed(evaluation, "target is the declared production project").ok).toBe(false);
  });
});

describe("agreement with lib/environment-guard.js", () => {
  const guardPath = path.resolve(__dirname, "..", "..", "lib", "environment-guard.js");
  const guardPresent = fs.existsSync(guardPath);

  // The guard ships in PR #67 and is not on main. Skipping silently would hide a
  // divergence, so the skip is reported in the test name.
  const maybe = guardPresent ? test : test.skip;

  maybe("the preflight's allow/refuse decision matches the guard over the same inputs", () => {
    const { decideWriteAllowed } = require(guardPath);

    const inputs = [
      { vercelEnv: "production", supabaseUrl: prodUrl, productionProjectRef: PROD_REF, stagingProjectRef: STAGE_REF },
      { vercelEnv: "production", supabaseUrl: prodUrl, productionProjectRef: "", stagingProjectRef: STAGE_REF },
      { vercelEnv: "production", supabaseUrl: prodUrl, productionProjectRef: STAGE_REF, stagingProjectRef: STAGE_REF },
      { vercelEnv: "preview", supabaseUrl: stageUrl, productionProjectRef: PROD_REF, stagingProjectRef: STAGE_REF },
      { vercelEnv: "preview", supabaseUrl: prodUrl, productionProjectRef: PROD_REF, stagingProjectRef: STAGE_REF },
      { vercelEnv: "preview", supabaseUrl: prodUrl, productionProjectRef: PROD_REF, stagingProjectRef: PROD_REF },
      { vercelEnv: "preview", supabaseUrl: stageUrl, productionProjectRef: PROD_REF, stagingProjectRef: "" },
      { vercelEnv: "preview", supabaseUrl: stageUrl, productionProjectRef: "", stagingProjectRef: STAGE_REF },
    ];

    for (const input of inputs) {
      const guardAllows = decideWriteAllowed({ ...input, allowLocalWrites: false }).allowed;
      // The preflight has no notion of "allowed"; it reports zero failed checks.
      const preflightAllows =
        evaluateScope(input.vercelEnv === "production" ? "production" : "preview", {
          VERCEL_ENV: input.vercelEnv,
          SUPABASE_URL: input.supabaseUrl,
          PRODUCTION_SUPABASE_PROJECT_REF: input.productionProjectRef,
          STAGING_SUPABASE_PROJECT_REF: input.stagingProjectRef,
          SUPABASE_SERVICE_ROLE_KEY: "present",
        }).failed === 0;

      expect({ input, preflightAllows }).toEqual({ input, preflightAllows: guardAllows });
    }
  });
});

describe("CLI", () => {
  const { spawnSync } = require("node:child_process");
  const cli = path.resolve(__dirname, "..", "..", "scripts", "verify-environment-scope.mjs");

  function runCli(env) {
    return spawnSync(process.execPath, [cli], { env: { ...env, PATH: process.env.PATH }, encoding: "utf8" });
  }

  test("exits 0 and reports success for a correct staging scope", () => {
    const res = runCli(stageEnv());
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("every check passed");
    expect(res.stdout).not.toContain(SECRET_VALUE);
  });

  test("exits 1 when the target is production", () => {
    const res = runCli(stageEnv({ SUPABASE_URL: prodUrl }));
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("FAIL");
  });

  test("--json emits machine-readable output with no secret value", () => {
    const res = spawnSync(process.execPath, [cli, "--json"], {
      env: { ...stageEnv(), PATH: process.env.PATH },
      encoding: "utf8",
    });
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.scope).toBe("preview");
    expect(parsed.failed).toBe(0);
    expect(res.stdout).not.toContain(SECRET_VALUE);
  });
});
