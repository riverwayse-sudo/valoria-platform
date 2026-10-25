// valoria-final/src/__tests__/33_environment_write_guard.test.js
//
// Regression coverage for lib/environment-guard.js and its use in the handlers.
//
// Incident: Vercel's preview environment is configured with the same Supabase URL
// and service-role key as production. Twelve API handlers performed privileged
// writes (REST inserts/updates plus /auth/v1/admin calls) and none of them checked
// which environment it was running in. A preview deployment therefore wrote to the
// production database — which is why the staging acceptance suite could not be run.
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
  test("allows production even when the URL is not a staging project", () => {
    expect(
      decideWriteAllowed({ vercelEnv: "production", supabaseUrl: prodUrl, stagingProjectRef: STAGE_REF })
    ).toEqual({ allowed: true, reason: "production" });
  });

  test("allows production with no staging ref declared", () => {
    expect(
      decideWriteAllowed({ vercelEnv: "production", supabaseUrl: prodUrl, stagingProjectRef: undefined }).allowed
    ).toBe(true);
  });
});

describe("decideWriteAllowed — not on Vercel (local dev, test runners)", () => {
  test("allows when VERCEL_ENV is unset", () => {
    expect(
      decideWriteAllowed({ vercelEnv: undefined, supabaseUrl: prodUrl, stagingProjectRef: undefined }).allowed
    ).toBe(true);
  });

  test("allows when VERCEL_ENV is an empty string", () => {
    expect(
      decideWriteAllowed({ vercelEnv: "", supabaseUrl: prodUrl, stagingProjectRef: undefined }).allowed
    ).toBe(true);
  });
});

describe("decideWriteAllowed — preview and other non-production environments", () => {
  // The exact defect: a preview deployment holding production credentials.
  test("DENIES a preview deployment pointing at production", () => {
    const d = decideWriteAllowed({ vercelEnv: "preview", supabaseUrl: prodUrl, stagingProjectRef: STAGE_REF });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain(PROD_REF);
    expect(d.reason).toContain(STAGE_REF);
  });

  test("denies a preview deployment when no staging database is declared", () => {
    const d = decideWriteAllowed({ vercelEnv: "preview", supabaseUrl: stageUrl, stagingProjectRef: undefined });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("no staging database is declared");
  });

  test("denies when the Supabase URL does not identify a project", () => {
    const d = decideWriteAllowed({ vercelEnv: "preview", supabaseUrl: "https://example.com", stagingProjectRef: STAGE_REF });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("does not identify");
  });

  test("denies when the Supabase URL is missing entirely", () => {
    expect(
      decideWriteAllowed({ vercelEnv: "preview", supabaseUrl: undefined, stagingProjectRef: STAGE_REF }).allowed
    ).toBe(false);
  });

  test("allows a preview deployment only when it points at the declared staging project", () => {
    expect(
      decideWriteAllowed({ vercelEnv: "preview", supabaseUrl: stageUrl, stagingProjectRef: STAGE_REF })
    ).toEqual({ allowed: true, reason: "declared staging database" });
  });

  test("applies the same rule to any other non-production VERCEL_ENV value", () => {
    expect(
      decideWriteAllowed({ vercelEnv: "development", supabaseUrl: prodUrl, stagingProjectRef: STAGE_REF }).allowed
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
