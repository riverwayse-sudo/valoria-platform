"use strict";

const fs = require("fs");
const path = require("path");
const {
  MARKETPLACE_SCORE_THRESHOLD,
  getDesignation,
  isMarketplaceScoreEligible,
} = require("../valuV4Contract");

const stagingConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../wrangler.jsonc"), "utf8")
);
const projectionMigration = fs.readFileSync(
  path.join(
    __dirname,
    "../../../supabase/migrations/20261127140000_project_specialized_profile_evidence_and_approved_designations.sql"
  ),
  "utf8"
);

describe("approved merit and staging release contract", () => {
  test("four approved merit bands remain separate from the 35-point listing gate", () => {
    expect(MARKETPLACE_SCORE_THRESHOLD).toBe(35);
    expect(getDesignation(34)).toBeNull();
    expect(getDesignation(35).name).toBe("Standard");
    expect(getDesignation(54).name).toBe("Standard");
    expect(getDesignation(55).name).toBe("Proficient");
    expect(getDesignation(74).name).toBe("Proficient");
    expect(getDesignation(75).name).toBe("Distinguished");
    expect(getDesignation(89).name).toBe("Distinguished");
    expect(getDesignation(90).name).toBe("Elite");
    expect(getDesignation(100).name).toBe("Elite");
    expect(isMarketplaceScoreEligible(34)).toBe(false);
    expect(isMarketplaceScoreEligible(35)).toBe(true);
  });

  test("invalid values do not coerce into a public designation", () => {
    for (const value of [null, undefined, "", " ", false, "not-a-score", -1, 101, Infinity]) {
      expect(getDesignation(value)).toBeNull();
    }
  });

  test("staging Worker targets only the staging Supabase project", () => {
    expect(stagingConfig.env.staging.name).toBe("valoria-staging-assessment");
    expect(stagingConfig.env.staging.vars.SUPABASE_URL).toBe(
      "https://yccxgjdqworgcbircnvn.supabase.co"
    );
    expect(stagingConfig.env.staging.vars.VALU_STAGING_API_ENABLED).toBe("1");
    expect(stagingConfig.env.staging.vars.VALU_PREVIEW).toBe("1");
    expect(stagingConfig.env.staging.vars.VALU_PRODUCTION_SUPABASE_URL).toBeUndefined();
  });

  test("specialist projection is consent-gated and preserves historical participant rows", () => {
    expect(projectionMigration).toContain("private.has_public_profile_consent(p_professional_id)");
    expect(projectionMigration).toContain("p.listing_status = 'listed'");
    expect(projectionMigration).toContain("p.visibility in ('public','marketplace')");
    expect(projectionMigration).not.toMatch(
      /UPDATE\\s+public\\.(valu_assessments|professional_profiles)/i
    );
  });
});
