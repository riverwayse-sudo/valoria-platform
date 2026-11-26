import { canonicalDesignationName } from "../../api/_canonicalDesignation.js";
import fs from "node:fs";
import path from "node:path";

const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("canonical VALU designation consumers", () => {
  test.each([
    [34, null],
    [35, "Building Foundations"],
    [49, "Building Foundations"],
    [50, "Developing Professional"],
    [64, "Developing Professional"],
    [65, "Emerging Force"],
    [79, "Emerging Force"],
    [80, "Force to Align With"],
    [100, "Force to Align With"],
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
    const readRoot = relative => fs.readFileSync(path.join(process.cwd(), "..", relative), "utf8");
    const appContract = readRoot("valoria-final/src/valuV4Contract.js");
    const sharedContract = readRoot("supabase/functions/_shared/valuV4Contract.js");
    const edgeFunction = readRoot("supabase/functions/rapid-service/index.ts");
    expect(appContract).toContain("../../supabase/functions/_shared/valuV4Contract.js");
    expect(sharedContract).toContain("MARKETPLACE_SCORE_THRESHOLD = 35");
    expect(edgeFunction).toContain('from "../_shared/valuV4Contract.js"');
    expect(edgeFunction).toContain("getDesignation(score)");
  });

  test("rapid-service rejects caller-supplied designations and validates score boundaries", () => {
    const edgeFunction = fs.readFileSync(path.join(process.cwd(), "..", "supabase/functions/rapid-service/index.ts"), "utf8");
    expect(edgeFunction).not.toContain("tier?: string");
    expect(edgeFunction).not.toContain("body.tier");
    expect(edgeFunction).toContain("Number.isInteger(score)");
    expect(edgeFunction).toContain("score < 0 || score > 100");
    expect(edgeFunction).not.toContain("Platinum");
    expect(edgeFunction).not.toContain("Gold");
    expect(edgeFunction).toContain("Force to Align With");
    expect(edgeFunction).toContain("Emerging Force");
    expect(edgeFunction).toContain("Developing Professional");
    expect(edgeFunction).toContain("Building Foundations");
    for (const retired of ["Elite", "Distinguished", "Proficient"]) expect(sharedContract).not.toContain(`name: "${retired}"`);
    expect(edgeFunction).not.toContain("/100");
  });

  test("email and report generation share the canonical designation helper", () => {
    for (const file of ["api/send-email.js", "api/generate-and-send-report.js"]) {
      const source = read(file);
      expect(source).toContain('import { canonicalDesignationName } from "./_canonicalDesignation.js"');
      expect(source).not.toContain('return "Elite"');
      expect(source).not.toContain('return "Distinguished"');
      expect(source).not.toContain('return "Proficient"');
      expect(source).not.toContain('return "Standard"');
      expect(source).toContain("No merit designation");
    }
  });

  test("rapid-service email code is syntactically singular and uses canonical bands", () => {
    const edgeFunction = readRoot("supabase/functions/rapid-service/index.ts");
    expect(edgeFunction).toContain("function getNextSteps(score: number | null)");
    expect(edgeFunction).toContain("serve(async (req: Request) =>");
    expect(edgeFunction).not.toContain("function getNextStepsfunction");
    expect(edgeFunction).not.toContain("serve(asyncserve");
    expect(edgeFunction).toContain("No merit designation");
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
