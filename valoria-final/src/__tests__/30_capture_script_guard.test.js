// valoria-final/src/__tests__/30_capture_script_guard.test.js
//
// The schema-capture script reads the staging database, and the whole point of
// --expect-host is that it cannot be pointed at production by mistake. That guard
// is the only thing standing between a mistyped environment variable and a
// production connection, so it is worth a test rather than trust.
//
// The guard runs before any query is issued. This checks the three refusal paths
// by running the script with controlled environment variables and no database:
// a correct guard refuses and exits non-zero without attempting a connection.

"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const SCRIPT = path.join(__dirname, "..", "..", "scripts", "capture-staging-schema.mjs");

function run(env, args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, ...env },
  });
}

// A connection string whose host is a placeholder. Nothing is ever connected to:
// the guard refuses first.
const STAGING = "postgresql://u:p@db.staging.example.supabase.co:5432/postgres";
const PRODUCTION = "postgresql://u:p@db.production.example.supabase.co:5432/postgres";

describe("schema capture script — production guard", () => {
  test("refuses with no connection string", () => {
    const r = run({ STAGING_DATABASE_URL: "", SUPABASE_DB_URL: "", DATABASE_URL: "" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no connection string/i);
  });

  test("refuses without --expect-host", () => {
    const r = run({ STAGING_DATABASE_URL: STAGING });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/--expect-host=<db-host> is required/);
  });

  test("refuses when the host does not match --expect-host", () => {
    // The case the guard exists for: a production URL with a staging expectation.
    const r = run({ STAGING_DATABASE_URL: PRODUCTION }, [
      "--expect-host=db.staging.example.supabase.co",
    ]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/does not match --expect-host/);
  });

  test("the mismatch message names both hosts, so the error is diagnosable", () => {
    const r = run({ STAGING_DATABASE_URL: PRODUCTION }, [
      "--expect-host=db.staging.example.supabase.co",
    ]);
    expect(r.stderr).toContain("db.production.example.supabase.co");
    expect(r.stderr).toContain("db.staging.example.supabase.co");
  });

  test("a matching host passes the guard (and then fails only on connecting)", () => {
    // Proves the guard is not refusing everything: with a matching host it
    // proceeds past the checks. It cannot connect, which is the expected outcome
    // here and is reported as a connection failure rather than a refusal.
    const r = run({ STAGING_DATABASE_URL: STAGING }, [
      "--expect-host=db.staging.example.supabase.co",
    ]);
    expect(r.stderr).not.toMatch(/Refusing to run/);
  });

  test("every refusal path exits non-zero, so a caller cannot mistake it for success", () => {
    const cases = [
      run({ STAGING_DATABASE_URL: "", SUPABASE_DB_URL: "", DATABASE_URL: "" }),
      run({ STAGING_DATABASE_URL: STAGING }),
      run({ STAGING_DATABASE_URL: PRODUCTION }, ["--expect-host=db.staging.example.supabase.co"]),
    ];
    for (const r of cases) expect(r.status).toBe(1);
  });
});
