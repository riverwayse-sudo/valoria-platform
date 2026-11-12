import { canonicalDesignationName } from "../../api/_canonicalDesignation.js";
import fs from "node:fs";
import path from "node:path";

const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("canonical VALU designation consumers", () => {
  test.each([
    [34, null],
    [35, "Standard"],
    [54, "Standard"],
    [55, "Proficient"],
    [74, "Proficient"],
    [75, "Distinguished"],
    [89, "Distinguished"],
    [90, "Elite"],
    [100, "Elite"],
  ])("score %i resolves to %s", (score, expected) => {
    expect(canonicalDesignationName(score)).toBe(expected);
  });

  test.each([null, undefined, "not-a-score", -1, 101, Infinity])(
    "invalid score %s has no designation",
    (score) => {
      expect(canonicalDesignationName(score)).toBeNull();
    }
  );

  test("the app and rapid-service consume one shared, versioned VALU contract", () => {
    const appContract = read("valoria-final/src/valuV4Contract.js");
    const sharedContract = read("supabase/functions/_shared/valuV4Contract.js");
    const edgeFunction = read("supabase/functions/rapid-service/index.ts");
    expect(appContract).toContain("../../supabase/functions/_shared/valuV4Contract.js");
    expect(sharedContract).toContain("MARKETPLACE_SCORE_THRESHOLD = 35");
    expect(edgeFunction).toContain('from "../_shared/valuV4Contract.js"');
    expect(edgeFunction).toContain("getDesignation(score)");
  });

  test("rapid-service rejects caller-supplied designations and validates score boundaries", () => {
    const edgeFunction = read("supabase/functions/rapid-service/index.ts");
    expect(edgeFunction).not.toContain("tier?: string");
    expect(edgeFunction).not.toContain("body.tier");
    expect(edgeFunction).toContain("Number.isInteger(score)");
    expect(edgeFunction).toContain("score < 0 || score > 100");
    expect(edgeFunction).not.toContain("Platinum");
    expect(edgeFunction).not.toContain("Gold");
    expect(edgeFunction).not.toContain("Force to Align With");
    expect(edgeFunction).not.toContain("/100");
  });

  test("participant-facing API consumers derive labels from canonical points", () => {
    for (const file of [
      "api/submit-assessment.js",
      "api/create-account.js",
      "api/claim-listing.js",
      "api/send-profile-reminder.js",
    ]) {
      const source = read(file);
      expect(source).toContain("canonicalDesignationName");
      expect(source).not.toContain("assessment.designation");
    }
  });
});
