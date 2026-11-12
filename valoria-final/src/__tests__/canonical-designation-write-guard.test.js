"use strict";

const fs = require("fs");
const path = require("path");

const migration = fs.readFileSync(
  path.join(
    __dirname,
    "../../supabase/migrations/20261112180000_enforce_canonical_valu_designation_on_writes.sql"
  ),
  "utf8"
);

describe("Canonical VALU designation write guard", () => {
  test("derives every merit designation from canonical score bands", () => {
    expect(migration).toContain("NEW.total_score BETWEEN 90 AND 100");
    expect(migration).toContain("NEW.total_score BETWEEN 75 AND 89");
    expect(migration).toContain("NEW.total_score BETWEEN 55 AND 74");
    expect(migration).toContain("NEW.total_score BETWEEN 35 AND 54");
    expect(migration).toContain("NEW.designation := NULL");
  });

  test("runs before insert and score/designation updates", () => {
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF total_score, designation");
    expect(migration).toContain("trg_canonicalize_valu_designation_before_write");
  });

  test("does not grant clients direct execution of the trigger function", () => {
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("has_function_privilege('anon'");
    expect(migration).toContain("has_function_privilege('authenticated'");
  });

  test("explicitly preserves untouched historical rows", () => {
    expect(migration).toContain("Existing historical rows are not rewritten");
    expect(migration).not.toMatch(/UPDATE\s+public\.valu_assessments\s+SET/i);
  });
});
