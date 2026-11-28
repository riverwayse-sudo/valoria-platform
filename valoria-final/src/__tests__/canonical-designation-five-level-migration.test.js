"use strict";

const fs = require("fs");
const path = require("path");

const contract = fs.readFileSync(
  path.join(__dirname, "../../../supabase/functions/_shared/valuV4Contract.js"),
  "utf8"
);
const migration = fs.readFileSync(
  path.join(__dirname, "../../supabase/migrations/20261128122216_restore_five_level_valu_designations.sql"),
  "utf8"
);

describe("Five-level VALU designation contract", () => {
  test("the canonical contract includes the source-approved lowest designation", () => {
    expect(contract).toContain('Object.freeze({ min: 0, name: "At the Starting Point"');
    expect(contract).toContain("export const MARKETPLACE_SCORE_THRESHOLD = 35");
    expect(contract).toContain("points < 0 || points > MAX_SCORE");
  });

  test("the database trigger and roster projection derive the fifth designation", () => {
    expect(migration).toContain("NEW.designation := 'At the Starting Point'");
    expect(migration).toContain("else 'At the Starting Point'");
    expect(migration).toContain("'Emerging Force'");
    expect(migration).toContain("'Developing Professional'");
    expect(migration).toContain("'Building Foundations'");
    expect(migration).toContain("'''Distinguished'''") ;
    expect(migration).toContain("'''Proficient'''");
    expect(migration).toContain("'''Standard'''");
    expect(migration).toContain("when canonical_valu_index is null then null");
    expect(migration).toContain("canonicalize_valu_designation_before_write()");
    expect(migration).toContain("NEW.total_score BETWEEN 90 AND 100");
    expect(migration).toContain("NEW.total_score BETWEEN 80 AND 100");
    expect(migration).toContain("canonical_valu_index between 90 and 100");
    expect(migration).toContain("canonical_valu_index between 80 and 100");
    expect(migration).toContain("refresh_marketplace_public_roster(uuid)");
  });

  test("the migration does not rewrite historical participant records", () => {
    expect(migration).not.toMatch(/UPDATE\s+public\.(valu_assessments|professional_profiles)/i);
    expect(migration).toContain("No historical rows are rewritten");
  });

  test("the migration fails closed when the live function definitions differ", () => {
    expect(migration).toContain("Unexpected canonical designation trigger definition");
    expect(migration).toContain("Unexpected marketplace designation projection");
  });
});
