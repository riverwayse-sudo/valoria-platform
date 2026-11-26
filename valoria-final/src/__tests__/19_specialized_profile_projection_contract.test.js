"use strict";

const fs = require("fs");
const path = require("path");

const readMigration = () => fs.readFileSync(
  path.join(__dirname, "../../supabase/migrations/20261126191000_project_specialized_profile_evidence_and_canonical_designations.sql"),
  "utf8"
);

describe("public profile capability projection contract", () => {
  test("the public roster exposes only the declared specialist evidence fields", () => {
    const sql = readMigration();
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS experience_years integer");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS facilitation_topics text[]");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS format_capabilities text[]");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS audience_sizes text[]");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS past_events jsonb");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS past_clients jsonb");
    expect(sql).not.toContain("'BASIC'");
    expect(sql).toContain('p.availability, null, null, null, p.fee_range');
  });

  test("both Full and Basic public projections carry specialist evidence", () => {
    const sql = readMigration();
    expect((sql.match(/p\.facilitation_topics/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((sql.match(/p\.format_capabilities/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((sql.match(/p\.audience_sizes/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((sql.match(/p\.past_events/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((sql.match(/p\.past_clients/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  test("database designation writes use the canonical VALU point bands", () => {
    const sql = readMigration();
    expect(sql).toContain("when canonical_valu_index between 80 and 100 then 'Force to Align With'");
    expect(sql).toContain("when canonical_valu_index between 65 and 79 then 'Emerging Force'");
    expect(sql).toContain("when canonical_valu_index between 50 and 64 then 'Developing Professional'");
    expect(sql).toContain("when canonical_valu_index between 35 and 49 then 'Building Foundations'");
    expect(sql).not.toContain("'Elite'");
    expect(sql).not.toContain("'Distinguished'");
    expect(sql).not.toContain("'Proficient'");
    expect(sql).not.toContain("'Standard'");
  });

  test("designation backfill does not mutate assessment scores or answers", () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/SET\\s+total_score\\s*=/i);
    expect(sql).not.toMatch(/SET\\s+answers\\s*=/i);
    expect(sql).not.toMatch(/DELETE\\s+FROM\\s+public\\.valu_assessments/i);
    expect(sql).not.toMatch(/DELETE\\s+FROM\\s+public\\.professional_profiles/i);
  });

  test("the projection backfill is consent-gated and excludes test or revoked profiles", () => {
    const sql = readMigration();
    expect(sql).toContain("visibility IN ('public', 'marketplace')");
    expect(sql).toContain("revoked_at IS NULL");
    expect(sql).toContain("COALESCE(is_test, false) = false");
    expect(sql).toContain("PERFORM public.refresh_marketplace_public_roster(profile_row.id)");
  });
});
