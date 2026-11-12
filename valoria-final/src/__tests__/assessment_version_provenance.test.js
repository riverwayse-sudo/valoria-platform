"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");
const submit = fs.readFileSync(path.join(root, "api/submit-assessment.js"), "utf8");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261021145000_require_assessment_version_provenance.sql"),
  "utf8"
);

describe("Assessment version provenance contract", () => {
  test("new full VALU submissions explicitly persist the assessment instrument version", () => {
    expect(submit).toContain("assessment_version: 'FULL_VALU_V1'");
  });

  test("historical unknown versions are labelled honestly instead of inferred from scoring version", () => {
    expect(migration).toContain("SET assessment_version = 'LEGACY_UNVERSIONED'");
    expect(migration).toContain("WHERE assessment_version IS NULL");
    expect(migration).not.toContain("VALU-v4.0");
    expect(migration).not.toContain("FULL_VALU_V1");
  });

  test("future rows cannot omit assessment version provenance", () => {
    expect(migration).toContain("ALTER COLUMN assessment_version SET NOT NULL");
  });
});
