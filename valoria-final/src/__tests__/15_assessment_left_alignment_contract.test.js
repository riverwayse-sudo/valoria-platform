"use strict";

const fs = require("fs");
const path = require("path");

const read = relative => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

describe("VALU assessment left-alignment contract", () => {
  test("the shared assessment stylesheet is loaded by the application entry point", () => {
    expect(read("main.jsx")).toContain("import './assessment.css'");
  });

  test("the full assessment shell receives the same page class as the taster", () => {
    const full = read("FullVALUAssessment.jsx");
    expect(full).toContain('className="valu-assessment-page valu-assessment-full"');
    expect(full).toContain('className="valu-assessment-shell"');
  });

  test("all full and taster assessment copy is left aligned, including inline-styled controls", () => {
    const css = read("assessment.css");
    expect(css).toMatch(/\.valu-assessment-page,\s*\.valu-assessment-page\s*\*\s*\{\s*text-align:\s*left\s*!important;/);
  });

  test("assessment typography is loaded once from the shared stylesheet", () => {
    const css = read("assessment.css");
    const legacyPrime = read("PRIMEAssessment.jsx");
    expect((css.match(/fonts\\.googleapis\\.com/g) || []).length).toBe(1);
    expect(legacyPrime).not.toContain("fonts.googleapis.com");
  });

  test("assessment journey status and progress labels are left aligned", () => {
    const journey = read("VALUAssessmentJourney.jsx");
    expect(journey).toContain("textAlign:'left'");
    expect(journey).toContain("alignItems:'flex-start'");
  });

  test("the completion state has one primary profile action and does not mislabel a Full assessment as Basic", () => {
    const full = read("FullVALUAssessment.jsx");
    expect(full).toContain("Your VALU Index is complete.");
    expect(full).toContain("Your Full VALU assessment is complete.");
    expect(full).toContain("COMPLETE MY PROFILE");
    expect(full).toContain("RETURN TO DASHBOARD");
    expect(full).not.toContain("Basic · Incomplete");
    expect(full).not.toContain("current + 1} / TOTAL_QUESTIONS");
  });

  test("the legacy taster no longer queries public profiles with an anonymous key", () => {
    const legacyGate = read("VALUIndexV4Gate.jsx");
    const activeApp = read("VALUIndexV4App.jsx");
    expect(activeApp).toContain("VALUIndexV4GateNext");
    expect(legacyGate).not.toContain("SUPABASE_ANON_KEY");
    expect(legacyGate).not.toContain("professional_profiles?\u0024{params}");
    expect(legacyGate).not.toContain("AssessmentProof");
  });

  test("assessment navigation title begins at the left edge of its own grid cell", () => {
    const navigation = read("AssessmentNavigation.jsx");
    expect(navigation).toContain("justifyContent:'flex-start'");
    expect(navigation).toContain("textAlign:'left'");
  });
});
