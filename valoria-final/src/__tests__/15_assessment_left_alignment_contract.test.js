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

  test("assessment journey status and progress labels are left aligned", () => {
    const journey = read("VALUAssessmentJourney.jsx");
    expect(journey).toContain("textAlign:'left'");
    expect(journey).toContain("alignItems:'flex-start'");
  });

  test("assessment navigation title begins at the left edge of its own grid cell", () => {
    const navigation = read("AssessmentNavigation.jsx");
    expect(navigation).toContain("justifyContent:'flex-start'");
    expect(navigation).toContain("textAlign:'left'");
  });
});
