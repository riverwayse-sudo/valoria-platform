"use strict";

const fs = require("fs");
const path = require("path");

const migration = fs.readFileSync(
  path.join(
    __dirname,
    "../../supabase/migrations/20261112150000_enforce_valu_assessment_score_integrity_and_validate_taster_lead_foreign_keys.sql"
  ),
  "utf8"
);

describe("VALU data-integrity migration", () => {
  test("allows NULL scores only on incomplete assessment rows", () => {
    expect(migration).toContain("(total_score IS NULL OR total_score BETWEEN 0 AND 100)");
    expect(migration).toContain("(completed_at IS NULL OR total_score IS NOT NULL)");
    expect(migration).toContain("VALIDATE CONSTRAINT valu_assessments_total_score_integrity_check");
  });

  test.each([
    "taster_progress_lead_capture_id_fkey",
    "taster_sessions_lead_capture_id_fkey",
    "taster_identity_candidates_lead_capture_id_fkey",
  ])("validates existing %s references", constraint => {
    expect(migration).toContain(`VALIDATE CONSTRAINT ${constraint}`);
  });

  test("fails closed if any score or lead-capture reference remains invalid", () => {
    expect(migration).toContain("v_invalid_scores <> 0");
    expect(migration).toContain("v_orphans <> 0");
    expect(migration).toContain("NOT convalidated");
  });
});
