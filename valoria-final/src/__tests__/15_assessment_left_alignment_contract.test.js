"use strict";

const fs = require("fs");
const path = require("path");

const read = relative => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
const readRoot = relative => fs.readFileSync(path.join(__dirname, "..", "..", relative), "utf8");

describe("VALU assessment left-alignment contract", () => {
  test("the shared assessment stylesheet is loaded by the application entry point", () => {
    expect(read("main.jsx")).toContain("import './assessment.css'");
  });

  test("participant-facing report and waitlist copy use VALU Index as the product name", () => {
    const report = readRoot("run-report.js");
    const sendEmail = readRoot("api/send-email.js");
    const generatedReport = readRoot("api/generate-and-send-report.js");
    const waitlist = readRoot("public/Waitlist.html");
    const reportPrompt = read("PRIMEAssessment.jsx");
    expect([report, sendEmail, generatedReport, waitlist].join("\\n")).not.toMatch(/VALU\s+Index\s+assessment/i);
    expect(sendEmail).toContain("Your VALU Index is complete.");
    expect(waitlist).toContain("begin the VALU Index.");
    expect(reportPrompt).not.toContain("VALU Index assessment");
    expect(reportPrompt).toContain("just completed the VALU Index");
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
    expect((css.match(/fonts\.googleapis\.com/g) || []).length).toBe(1);
    expect(legacyPrime).not.toContain("fonts.googleapis.com");
  });

  test("both assessment stages expose a keyboard skip link to the main region", () => {
    const navigation = read("AssessmentNavigation.jsx");
    const full = read("FullVALUAssessment.jsx");
    const taster = read("VALUIndexV4GateNext.jsx");
    const css = read("assessment.css");
    expect(navigation).toContain('href="#main-content"');
    expect(full).toContain('id="main-content" tabIndex={-1}');
    expect(taster).toContain('id="main-content" tabIndex={-1}');
    expect(css).toContain(".assessment-skip-link");
  });

  test("participant-facing assessment navigation and stages use VALU Index naming", () => {
    const navigation = read("AssessmentNavigation.jsx");
    const full = read("FullVALUAssessment.jsx");
    const taster = read("VALUIndexV4GateNext.jsx");
    expect(navigation).toContain("label = 'VALU INDEX'");
    expect(full).not.toContain("VALU ASSESSMENT");
    expect(full).toContain("SUBMIT VALU INDEX");
    expect(taster).toContain("VALU TASTER");
    expect(taster).not.toContain("VALU TASTER");
  });

  test("assessment screens respect reduced-motion preferences", () => {
    const css = read("assessment.css");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.01ms !important");
  });

  test("assessment journey status and progress labels are left aligned", () => {
    const journey = read("VALUAssessmentJourney.jsx");
    expect(journey).toContain("textAlign:'left'");
    expect(journey).toContain("alignItems:'flex-start'");
  });

  test("the completion state has one primary profile action and does not mislabel a Full assessment as Basic", () => {
    const full = read("FullVALUAssessment.jsx");
    expect(full).toContain("Your VALU Index is complete.");
    expect(full).toContain("Your Full VALU Index is complete.");
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

  test("assessment layouts use a restrained content width and consistent compact spacing", () => {
    const css = read("assessment.css");
    expect(css).toContain("max-width: 760px");
    expect(css).toContain("min-height: 52px !important");
    expect(css).toContain("gap: 10px !important");
    expect(css).toContain("font-size: clamp(25px, 2.7vw, 34px) !important");
    expect(css).toContain(".valu-intro-benefits small");
    expect(css).toContain("display: none");
  });
});
