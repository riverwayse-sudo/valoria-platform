import { canonicalDesignationName } from "../../api/_canonicalDesignation.js";
import fs from "node:fs";
import path from "node:path";

const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("canonical VALU designation consumers", () => {
  const readRoot = relative => fs.readFileSync(path.join(process.cwd(), "..", relative), "utf8");

  test.each([
    [0, "At the Starting Point"],
    [34, "At the Starting Point"],
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

  test.each([null, undefined, "", " ", false, "not-a-score", -1, 101, Infinity])(
    "invalid score %s has no designation",
    (score) => {
      expect(canonicalDesignationName(score)).toBeNull();
    }
  );

  test("the app and rapid-service consume one shared, versioned VALU contract", () => {
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
    const sharedContract = readRoot("supabase/functions/_shared/valuV4Contract.js");
    expect(edgeFunction).not.toContain("tier?: string");
    expect(edgeFunction).not.toContain("body.tier");
    expect(edgeFunction).toContain("Number.isInteger(score)");
    expect(edgeFunction).toContain("score < 0 || score > 100");
    expect(edgeFunction).not.toContain("Platinum");
    expect(edgeFunction).not.toContain("Gold");
    expect(sharedContract).toContain('name: "Force to Align With"');
    expect(sharedContract).toContain('name: "Emerging Force"');
    expect(sharedContract).toContain('name: "Developing Professional"');
    expect(sharedContract).toContain('name: "Building Foundations"');
    for (const retired of ["Elite", "Distinguished", "Proficient", "Standard"]) expect(sharedContract).not.toContain(`name: "${retired}"`);
    expect(sharedContract).toContain('name: "At the Starting Point"');
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

  test("legacy public assets use the current assessment and designation language", () => {
    const landing = read("public/Index.html");
    const about = read("public/About_Valoria.html");
    const waitlist = read("public/Waitlist.html");
    expect(landing).toContain("58-question formal assessment");
    expect(landing).toContain("9-question Taster");
    expect(landing).not.toContain("55 questions across five clusters");
    expect(landing).not.toContain("professional credential of its kind");
    expect(landing).toContain("At the Starting Point");
    expect(landing).not.toContain("independently assessed");
    expect(about).toContain("not itself a certification or professional credential");
    expect(about).not.toContain("A certification body");
    expect(waitlist).toContain("confirm your email first");
    expect(waitlist).toContain("58-question full VALU Index");
    expect(waitlist).toContain("/valu/register/?journey=valu_taster");
    expect(waitlist).not.toContain("Registration routes you directly to the assessment");
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
