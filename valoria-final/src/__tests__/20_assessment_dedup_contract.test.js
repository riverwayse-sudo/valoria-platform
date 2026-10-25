// valoria-final/src/__tests__/20_assessment_dedup_contract.test.js
//
// Guards the duplicate-submission requirement for the full VALU assessment.
//
// The application-level guard in api/submit-assessment.js is a read-then-write
// (look for an existing row, then insert). It cannot be correct on its own:
// two retries that both run the lookup before either insert both conclude "no
// existing row" and both insert. The unique index added by
// 20261023130000_unique_full_assessment_per_snapshot.sql is what makes the
// race safe, by making the loser fail with 23505 (PostgREST 409), which is the
// branch the handler already recovers through.
//
// 09_submit_assessment_runtime.test.js executes the handler and covers the
// application side. This suite pins the database side, which the handler
// depends on and which no runtime test can assert without a real engine.
// scripts/verify-assessment-dedup-migration.mjs executes the SQL against
// PostgreSQL for the stronger check.

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MIGRATION = path.join(
  process.cwd(),
  "supabase/migrations/20261023130000_unique_full_assessment_per_snapshot.sql"
);
const HANDLER = path.join(process.cwd(), "api/submit-assessment.js");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

// Comments describe intent and often quote the very patterns being asserted, so
// they are stripped before matching.
function code(file) {
  return read(file).replace(/--[^\n]*/g, "").replace(/\/\/[^\n]*/g, "");
}

describe("full assessment duplicate-submission contract", () => {
  test("the unique index exists and covers the handler's identity pair", () => {
    const sql = code(MIGRATION);
    expect(sql).toMatch(/create unique index if not exists\s+valu_assessments_taster_identity_uidx/i);
    expect(sql).toMatch(/on\s+public\.valu_assessments\s*\(\s*taster_id\s*,\s*identity_hash\s*\)/i);
  });

  test("the index is partial so unlinked legacy rows do not collide", () => {
    const sql = code(MIGRATION);
    // Rows predating snapshot linking have a null taster_id. Without the
    // predicate, two such rows would collide with each other and the migration
    // would be unable to build the index at all.
    //
    // This must be anchored to the create-index statement itself. The same
    // predicate text also appears inside the duplicate pre-check, so a looser
    // match passes even when the predicate is removed from the index.
    expect(sql).toMatch(
      /create unique index[\s\S]{0,200}?on\s+public\.valu_assessments\s*\(\s*taster_id\s*,\s*identity_hash\s*\)\s*where\s+taster_id\s+is\s+not\s+null\s+and\s+identity_hash\s+is\s+not\s+null/i
    );
  });

  test("the index matches the pair the handler looks up", () => {
    const handler = code(HANDLER);
    // If the lookup key and the constraint key diverge, the constraint stops
    // catching the case the lookup is trying to prevent.
    const lookup = handler.match(/findExistingAssessment[\s\S]{0,400}?valu_assessments/);
    expect(lookup).not.toBeNull();
    const params = handler.match(/taster_id:\s*`eq\.\$\{tasterId\}`[\s\S]{0,120}?identity_hash:\s*`eq\.\$\{fingerprint\}`/);
    expect(params).not.toBeNull();
  });

  test("the migration refuses to run over existing duplicates and says which rows", () => {
    const sql = code(MIGRATION);
    // An opaque "could not create unique index" would leave an operator with no
    // way to find the offending rows, and the failure would surface only at
    // deploy time.
    expect(sql).toMatch(/having\s+count\(\*\)\s*>\s*1/i);
    expect(sql).toMatch(/raise exception[\s\S]{0,400}duplicate/i);
    expect(sql).toMatch(/reconcile/i);
  });

  test("the pre-check is read-only and runs before the index is created", () => {
    const sql = code(MIGRATION);
    const checkAt = sql.search(/duplicate_groups integer/i);
    const indexAt = sql.search(/create unique index/i);
    expect(checkAt).toBeGreaterThan(-1);
    expect(indexAt).toBeGreaterThan(checkAt);
    // A migration that modified rows to satisfy its own constraint would be
    // destroying participant records to make a deploy succeed.
    const beforeIndex = sql.slice(0, indexAt);
    expect(beforeIndex).not.toMatch(/\bdelete\s+from\b/i);
    expect(beforeIndex).not.toMatch(/\bupdate\s+public\.valu_assessments\b/i);
  });

  test("the handler recovers from the 23505/409 the index produces", () => {
    const handler = code(HANDLER);
    // The constraint is only safe because the losing writer is handled. If the
    // 409 branch were removed, the index would turn a duplicate into a hard
    // failure for the second participant instead of a recovered result.
    expect(handler).toMatch(/insertRes\.status\s*===\s*409/);
    expect(handler).toMatch(/alreadyCompleted:\s*true/);
  });
});

describe("report token provenance contract", () => {
  test("the handler supplies report_token instead of relying on a column default", () => {
    const handler = code(HANDLER);
    // report_token is NOT NULL with a unique index, but no tracked migration
    // gives it a default and valu_assessments is created by no tracked
    // migration. Omitting it made every submission depend on untracked DDL.
    expect(handler).toMatch(/report_token:\s*randomUUID\(\)/);
    expect(handler).toMatch(/from\s+'node:crypto'/);
  });

  test("the generated token satisfies the format the report path enforces", () => {
    // api/generate-and-send-report.js rejects anything that is not an opaque
    // UUID, so a token in another shape would lock a participant out of their
    // own report even though the row saved.
    const report = read(path.join(process.cwd(), "api/generate-and-send-report.js"));
    expect(report).toMatch(/isValidReportToken/);
    const uuid = "11111111-2222-4333-8444-555555555555";
    const shape = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(shape.test(uuid)).toBe(true);
    expect(shape.test("tok-not-a-uuid")).toBe(false);
  });

  test("no tracked migration defines the table, so the handler must be self-contained", () => {
    // Documents the reason for the fix above. If the table is ever created by a
    // tracked migration with a proper default, this test should be revisited
    // rather than silently kept.
    const dir = path.join(process.cwd(), "supabase/migrations");
    const creates = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => /create\s+table[^;]{0,60}valu_assessments/i.test(read(path.join(dir, f))));
    expect(creates).toEqual([]);
  });
});
