"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

describe("Canonical VALU designation read paths", () => {
  test("assessment recovery never returns a historical stored designation", () => {
    const endpoint = read("api/get-assessment-data.js");
    expect(endpoint).toContain('import { canonicalDesignationName } from "./_canonicalDesignation.js"');
    expect(endpoint).not.toContain("skill_scores,designation,ai_report");
    expect(endpoint).toContain("designation: canonicalDesignationName(row.total_score)");
  });

  test("live designation writers use approved bands without rewriting participant rows", () => {
    const historicalMigration = read("supabase/migrations/20261126004120_align_valu_designation_bands.sql");
    const migration = read("supabase/migrations/20261127140000_project_specialized_profile_evidence_and_approved_designations.sql");
    expect(historicalMigration).toContain("NEW.total_score >= 80");
    expect(migration).toContain("NEW.total_score BETWEEN 90 AND 100");
    expect(migration).toContain("NEW.total_score BETWEEN 75 AND 89");
    expect(migration).toContain("NEW.total_score BETWEEN 55 AND 74");
    expect(migration).toContain("NEW.total_score BETWEEN 35 AND 54");
    expect(migration).toContain("Elite");
    expect(migration).toContain("Distinguished");
    expect(migration).toContain("Proficient");
    expect(migration).toContain("Standard");
    expect(migration).toContain("below 35 has no public merit designation");
    expect(migration).not.toMatch(/UPDATE\\s+public\\.(valu_assessments|professional_profiles)/i);
  });

  test("marketplace roster writer derives merit designation from points, not stored labels", () => {
    const migration = read("supabase/migrations/20261112160000_derive_marketplace_designation_from_canonical_valu_points.sql");
    expect(migration).toContain("when canonical_valu_index between 90 and 100 then 'Elite'");
    expect(migration).toContain("when canonical_valu_index between 75 and 89 then 'Distinguished'");
    expect(migration).toContain("when canonical_valu_index between 55 and 74 then 'Proficient'");
    expect(migration).toContain("when canonical_valu_index between 35 and 54 then 'Standard'");
    expect(migration).toContain("position('v.designation' IN v_definition) > 0");
    expect(migration).toContain("position('p.designation' IN v_definition) > 0");
  });
});
