// valoria-final/src/__tests__/33_environment_write_guard.test.js
//
// Regression coverage for lib/environment-guard.js and its use in the handlers.
//
// Incident: Vercel's preview environment is configured with the same Supabase URL
// and service-role key as production. Twenty API handlers perform privileged
// writes (REST inserts/updates plus /auth/v1/admin calls) and none of them checked
// which environment it was running in. A preview deployment therefore wrote to the
// production database — which is why the staging acceptance suite could not be run.
//
// The first version of this guard allowed any write when VERCEL_ENV was unset,
// reasoning that Vercel always sets it. That was itself a hole: a deployment whose
// VERCEL_ENV failed to propagate, or any runtime Vercel does not manage, would have
// been treated as local development and allowed to write with production
// credentials. Nothing is allowed by default now — the runtime and the target
// project must both be positively identified.
//
// The decision function is pure, so every combination is exercised here without a
// deployment. The handler tests assert the guard is actually wired in, so deleting
// the call fails the suite rather than silently reopening the hole.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  decideWriteAllowed,
  supabaseProjectRef,
} = require("../../lib/environment-guard.js");

const PROD_REF = "abcdefghijklmnopqrst"; // 20 chars
const STAGE_REF = "zyxwvutsrqponmlkjihg"; // 20 chars
const prodUrl = `https://${PROD_REF}.supabase.co`;
const stageUrl = `https://${STAGE_REF}.supabase.co`;

describe("supabaseProjectRef", () => {
  test("reads the ref from a standard Supabase URL", () => {
    expect(supabaseProjectRef(prodUrl)).toBe(PROD_REF);
  });

  test("accepts the .in domain as well as .co", () => {
    expect(supabaseProjectRef(`https://${PROD_REF}.supabase.in`)).toBe(PROD_REF);
  });

  test("returns null for a non-Supabase or malformed URL", () => {
    expect(supabaseProjectRef("https://example.com")).toBeNull();
    expect(supabaseProjectRef("not a url")).toBeNull();
    expect(supabaseProjectRef("")).toBeNull();
    expect(supabaseProjectRef(undefined)).toBeNull();
    expect(supabaseProjectRef(null)).toBeNull();
  });
});

describe("decideWriteAllowed — production", () => {
  test("allows production only when the target is the declared production project", () => {
    expect(
      decideWriteAllowed({
        vercelEnv: "production",
        supabaseUrl: prodUrl,
        productionProjectRef: PROD_REF,
      })
    ).toEqual({ allowed: true, reason: "production" });
  });

  test("DENIES production when no production project is declared", () => {
    // The runtime says production but the target is unidentified, so nothing
    // proves this write is going where production writes are supposed to go.
    const d = decideWriteAllowed({
      vercelEnv: "production",
      supabaseUrl: prodUrl,
      productionProjectRef: undefined,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("PRODUCTION_SUPABASE_PROJECT_REF");
  });

  test("DENIES production when the target is a different project", () => {
    const d = decideWriteAllowed({
      vercelEnv: "production",
      supabaseUrl: stageUrl,
      productionProjectRef: PROD_REF,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain(STAGE_REF);
    expect(d.reason).toContain(PROD_REF);
  });

  test("DENIES production when the Supabase URL is unreadable", () => {
    expect(
      decideWriteAllowed({
        vercelEnv: "production",
        supabaseUrl: "https://example.com",
        productionProjectRef: PROD_REF,
      }).allowed
    ).toBe(false);
  });

  test("does not let a staging declaration authorise a production write", () => {
    expect(
      decideWriteAllowed({
        vercelEnv: "production",
        supabaseUrl: prodUrl,
        stagingProjectRef: PROD_REF,
      }).allowed
    ).toBe(false);
  });
});

describe("decideWriteAllowed — VERCEL_ENV unset or empty (unidentified runtime)", () => {
  // The second defect. An absent environment is not evidence of local
  // development; it is absence of evidence, and it must not permit a write.

  test("DENIES when VERCEL_ENV is unset, with no opt-in", () => {
    const d = decideWriteAllowed({
      vercelEnv: undefined,
      supabaseUrl: prodUrl,
      stagingProjectRef: STAGE_REF,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("ALLOW_LOCAL_PRIVILEGED_WRITES");
  });

  test("DENIES when VERCEL_ENV is an empty string, with no opt-in", () => {
    expect(
      decideWriteAllowed({
        vercelEnv: "",
        supabaseUrl: prodUrl,
        stagingProjectRef: STAGE_REF,
      }).allowed
    ).toBe(false);
  });

  test("DENIES an unset environment that points at production, even WITH the opt-in", () => {
    // The opt-in enables local development; it does not authorise production.
    const d = decideWriteAllowed({
      vercelEnv: undefined,
      supabaseUrl: prodUrl,
      stagingProjectRef: STAGE_REF,
      allowLocalWrites: true,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain(PROD_REF);
  });

  test("DENIES an unset environment with the opt-in but no declared project", () => {
    expect(
      decideWriteAllowed({
        vercelEnv: undefined,
        supabaseUrl: stageUrl,
        stagingProjectRef: undefined,
        allowLocalWrites: true,
      }).allowed
    ).toBe(false);
  });

  test("allows local development only when opted in AND the target is the declared project", () => {
    expect(
      decideWriteAllowed({
        vercelEnv: undefined,
        supabaseUrl: stageUrl,
        stagingProjectRef: STAGE_REF,
        allowLocalWrites: true,
      })
    ).toEqual({ allowed: true, reason: "local development against the declared staging database" });
  });

  test("the opt-in must be exactly true, not merely truthy", () => {
    for (const value of ["true", 1, "yes", {}]) {
      expect(
        decideWriteAllowed({
          vercelEnv: undefined,
          supabaseUrl: stageUrl,
          stagingProjectRef: STAGE_REF,
          allowLocalWrites: value,
        }).allowed
      ).toBe(false);
    }
  });
});

describe("decideWriteAllowed — preview and other non-production environments", () => {
  // The original defect: a preview deployment holding production credentials.
  test("DENIES a preview deployment pointing at production", () => {
    const d = decideWriteAllowed({
      vercelEnv: "preview",
      supabaseUrl: prodUrl,
      stagingProjectRef: STAGE_REF,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain(PROD_REF);
    expect(d.reason).toContain(STAGE_REF);
  });

  test("denies a preview deployment when no staging database is declared", () => {
    const d = decideWriteAllowed({
      vercelEnv: "preview",
      supabaseUrl: stageUrl,
      stagingProjectRef: undefined,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("no staging database is declared");
  });

  test("denies when the Supabase URL does not identify a project", () => {
    const d = decideWriteAllowed({
      vercelEnv: "preview",
      supabaseUrl: "https://example.com",
      stagingProjectRef: STAGE_REF,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("does not identify");
  });

  test("denies when the Supabase URL is missing entirely", () => {
    expect(
      decideWriteAllowed({
        vercelEnv: "preview",
        supabaseUrl: undefined,
        stagingProjectRef: STAGE_REF,
      }).allowed
    ).toBe(false);
  });

  test("allows a preview deployment only when it points at the declared staging project", () => {
    expect(
      decideWriteAllowed({
        vercelEnv: "preview",
        supabaseUrl: stageUrl,
        stagingProjectRef: STAGE_REF,
      })
    ).toEqual({ allowed: true, reason: "declared staging database" });
  });

  test("applies the same rule to development and to any unexpected VERCEL_ENV value", () => {
    // A value nobody anticipated must be treated like preview, not like production.
    for (const vercelEnv of ["development", "staging", "test", "PREVIEW", "prod", "0"]) {
      expect(
        decideWriteAllowed({ vercelEnv, supabaseUrl: prodUrl, stagingProjectRef: STAGE_REF }).allowed
      ).toBe(false);
      expect(
        decideWriteAllowed({ vercelEnv, supabaseUrl: stageUrl, stagingProjectRef: STAGE_REF }).allowed
      ).toBe(true);
    }
  });

  test("a preview cannot reach production by leaving the staging ref unset", () => {
    // The misconfiguration case: preview + production credentials + nothing declared.
    expect(
      decideWriteAllowed({ vercelEnv: "preview", supabaseUrl: prodUrl }).allowed
    ).toBe(false);
  });
});

describe("handlers enforce the guard", () => {
  const API_DIR = path.join(__dirname, "../../api");

  // Every handler that performs a privileged Supabase write.
  const PRIVILEGED_WRITERS = [
    "assessment-progress.js",
    "claim-listing.js",
    "claim-taster.js",
    "create-account.js",
    "finalize-report.js",
    "generate-and-send-report.js",
    "link-assessment-to-taster.js",
    "notifications.js",
    "process-readiness-queue.js",
    "reconciliation-health.js",
    "report.js",
    "resend-confirmation.js",
    "save-report.js",
    "send-email.js",
    "send-profile-reminder.js",
    "submit-assessment.js",
    "submit-taster.js",
    "sweep-unsent-reports.js",
    "taster-progress.js",
    "update-assessment.js",
  ];

  test.each(PRIVILEGED_WRITERS)("%s imports and calls privilegedWriteAllowed", file => {
    const src = fs.readFileSync(path.join(API_DIR, file), "utf8");
    expect(src).toContain("privilegedWriteAllowed");
    // The call, not just the import.
    expect(src).toMatch(/privilegedWriteAllowed\(\)/);
    // And it must actually refuse when not allowed.
    expect(src).toMatch(/!__guard\.allowed/);
  });

  test("no privileged writer is missing from this list", () => {
    const writers = fs
      .readdirSync(API_DIR)
      .filter(f => f.endsWith(".js") && !f.startsWith("_"))
      .filter(f => {
        const src = fs.readFileSync(path.join(API_DIR, f), "utf8");
        const privileged = src.includes("SUPABASE_SERVICE_ROLE_KEY");
        // Any quote style, so a double-quoted method cannot slip past the check.
        const writes =
          /method:\s*["'](POST|PATCH|DELETE|PUT)["']/.test(src) || src.includes("/auth/v1/admin");
        return privileged && writes;
      })
      .sort();
    expect(writers).toEqual([...PRIVILEGED_WRITERS].sort());
  });
});

describe("the wrapper reads the declarations from the environment", () => {
  const { privilegedWriteAllowed } = require("../../lib/environment-guard.js");
  const KEYS = [
    "VERCEL_ENV",
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "PRODUCTION_SUPABASE_PROJECT_REF",
    "STAGING_SUPABASE_PROJECT_REF",
    "ALLOW_LOCAL_PRIVILEGED_WRITES",
  ];

  function withEnv(values, fn) {
    const saved = {};
    for (const k of KEYS) saved[k] = process.env[k];
    for (const k of KEYS) delete process.env[k];
    Object.assign(process.env, values);
    try {
      return fn();
    } finally {
      for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  }

  test("refuses a bare process with no declarations at all", () => {
    // This is the shape that used to be allowed. It must not be.
    withEnv({ SUPABASE_URL: prodUrl }, () => {
      expect(privilegedWriteAllowed().allowed).toBe(false);
    });
  });

  test("allows production when PRODUCTION_SUPABASE_PROJECT_REF matches", () => {
    withEnv({ VERCEL_ENV: "production", SUPABASE_URL: prodUrl, PRODUCTION_SUPABASE_PROJECT_REF: PROD_REF }, () => {
      expect(privilegedWriteAllowed().allowed).toBe(true);
    });
  });

  test("refuses a preview deployment holding production credentials", () => {
    withEnv({ VERCEL_ENV: "preview", SUPABASE_URL: prodUrl, STAGING_SUPABASE_PROJECT_REF: STAGE_REF }, () => {
      expect(privilegedWriteAllowed().allowed).toBe(false);
    });
  });

  test("allows the local opt-in against the declared staging project", () => {
    withEnv(
      {
        SUPABASE_URL: stageUrl,
        STAGING_SUPABASE_PROJECT_REF: STAGE_REF,
        ALLOW_LOCAL_PRIVILEGED_WRITES: "true",
      },
      () => {
        expect(privilegedWriteAllowed().allowed).toBe(true);
      }
    );
  });

  test("the opt-in variable must be exactly the string 'true'", () => {
    // The wrapper parses the variable; the pure function is not the only place a
    // truthy value could slip through. '1', 'yes' and 'TRUE' must not count.
    for (const value of ["1", "yes", "TRUE", "on", " true"]) {
      withEnv(
        {
          SUPABASE_URL: stageUrl,
          STAGING_SUPABASE_PROJECT_REF: STAGE_REF,
          ALLOW_LOCAL_PRIVILEGED_WRITES: value,
        },
        () => {
          expect(privilegedWriteAllowed().allowed).toBe(false);
        }
      );
    }
  });

  test("falls back to VITE_SUPABASE_URL when SUPABASE_URL is absent", () => {
    withEnv(
      {
        VITE_SUPABASE_URL: stageUrl,
        STAGING_SUPABASE_PROJECT_REF: STAGE_REF,
        ALLOW_LOCAL_PRIVILEGED_WRITES: "true",
      },
      () => {
        expect(privilegedWriteAllowed().allowed).toBe(true);
      }
    );
  });
});
