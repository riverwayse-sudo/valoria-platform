"use strict";

// The taster and the formal VALU assessment are separate instruments.
// The nine taster questions are never included in, seeded into, or subtracted
// from the formal 58-question answer set.

const fs = require("fs");
const path = require("path");

const {
  ASSESSMENT_ORDER,
  OPENING_POSITIONS,
  OPENING_SESSION_LENGTH,
  REMAINING_POSITIONS,
  REMAINING_SESSION_LENGTH,
  TOTAL_QUESTIONS,
  seedAnswersFromOpening,
  nextPlaceToAnswer,
  answeredCount,
  placeForPosition,
} = require("../assessmentJourney");
const { QUESTIONS } = require("../questions");
const { TASTER_QUESTIONS } = require("../valuTaster");

const readSource = relative => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
const readApi = name => fs.readFileSync(path.join(__dirname, "../../api", name), "utf8");
const gateSource = () => readSource("VALUIndexV4GateNext.jsx");
const fullSource = () => readSource("FullVALUAssessment.jsx");

describe("separate taster and formal assessment contracts", () => {
  test("the taster contains nine questions and the formal instrument contains 58", () => {
    expect(TASTER_QUESTIONS).toHaveLength(9);
    expect(QUESTIONS).toHaveLength(58);
    expect(TOTAL_QUESTIONS).toBe(58);
  });

  test("all 58 canonical questions belong to the formal assessment from Question 1", () => {
    expect(OPENING_POSITIONS).toEqual([]);
    expect(OPENING_SESSION_LENGTH).toBe(0);
    expect(REMAINING_POSITIONS).toEqual(Array.from({ length: 58 }, (_, index) => index));
    expect(REMAINING_SESSION_LENGTH).toBe(58);
    expect(ASSESSMENT_ORDER).toEqual(Array.from({ length: 58 }, (_, index) => index));
    expect(new Set(ASSESSMENT_ORDER).size).toBe(58);
  });

  test("taster answers can never seed or contribute to formal assessment answers", () => {
    const tasterAnswers = { 0: 2, 1: 1, 2: 0, 3: 3, 4: 2, 5: 1, 6: 0, 7: 3, 8: 2 };
    expect(seedAnswersFromOpening(tasterAnswers)).toEqual({});
    expect(answeredCount(seedAnswersFromOpening(tasterAnswers))).toBe(0);
  });

  test("formal progress starts at Question 1 and counts only formal answers", () => {
    expect(nextPlaceToAnswer({}, 1)).toBe(1);
    const formalAnswers = { 0: 2, 2: 1 };
    expect(answeredCount(formalAnswers)).toBe(2);
    expect(nextPlaceToAnswer(formalAnswers, 1)).toBe(2);
    expect(placeForPosition(ASSESSMENT_ORDER[0])).toBe(1);
    expect(placeForPosition(ASSESSMENT_ORDER[57])).toBe(58);
  });

  test("the next formal question is null only after all 58 are answered", () => {
    const full = Object.fromEntries(ASSESSMENT_ORDER.map(position => [position, 0]));
    expect(answeredCount(full)).toBe(58);
    expect(nextPlaceToAnswer(full, 1)).toBe(null);
  });
});

describe("nine-question taster and account bridge", () => {
  test("lead registration precedes the separate taster and no question counts are exposed", () => {
    const source = gateSource();
    expect(source).toContain("TASTER_QUESTIONS.length");
    expect(source).toContain("VALUAssessmentJourney stage=\"registration\"");
    expect(source).toContain("VALUAssessmentJourney stage=\"taster\"");
    expect(source).toContain("YOUR PROGRESS IS SAVED");
    expect(source).toContain("privacy_acknowledged:privacyAcknowledged");
    expect(source).toContain("marketing_consent:marketingConsent");
    expect(source).not.toMatch(/of 9|1 of 9|Question \\{[^}]+\\} of/);
    expect(source).not.toContain("OPENING_SESSION_LENGTH");
    expect(source).not.toContain("TOTAL_QUESTIONS");
  });

  test("taster completion leads to account creation and does not promise automatic Marketplace listing", () => {
    const source = gateSource();
    expect(source).toContain("Your responses are safely saved. Create your account to continue your Valoria journey.");
    expect(source).toContain("Completing the assessment does not grant marketplace listing.");
    expect(source).toContain("Listing eligibility depends on the full assessment, professional profile, capabilities, and applicable eligibility checks.");
    expect(source).not.toContain("will not prefill or count toward it");
    expect(source).not.toContain("58 formal questions from Question 1");
    expect(source).not.toContain("remaining 49 questions");
    expect(source).not.toContain("Question 10");
  });

  test("registration, answer saves and completion remain linked to the same lead", () => {
    const source = gateSource();
    expect(source).toContain("action:'register'");
    expect(source).toContain("action:'save'");
    expect(source).toContain("action:'complete'");
    expect(source).toContain("localStorage.setItem('pending_taster_id',data.taster_id)");
    expect(source).toContain("'/professional-signup/?'+params.toString()");
    expect(source).not.toContain("action:'identify'");
  });

  test("the taster never computes or presents an official VALU Index", () => {
    const source = gateSource();
    expect(source).not.toContain("computeTasterResult");
    expect(source).not.toContain("YOUR PRIME SNAPSHOT");
    expect(source).not.toContain("OFFICIAL VALU INDEX");
  });
});

describe("independent 58-question formal assessment", () => {
  test("the formal UI starts at Question 1 with a clean answer map", () => {
    const source = fullSource();
    expect(source).toContain("setCurrent(0)");
    expect(source).toContain("nextPlaceToAnswer(restoredAnswers, 1)");
    expect(source).toContain('VALUAssessmentJourney stage="full"');
    expect(source).toContain("const answeredTotal = Object.keys(answers).length");
    expect(source).not.toContain("OPENING_SESSION_LENGTH");
    expect(source).not.toContain("OPENING_POSITIONS");
    expect(source).not.toContain("seedAnswersFromOpening");
  });

  test("formal answers are persisted independently under the 58-question contract", () => {
    const api = readApi("assessment-progress.js");
    expect(api).toContain('const FULL_ASSESSMENT_VERSION = "FULL_VALU_V2_SEPARATE_TASTER"');
    expect(api).toContain("assessment_version: FULL_ASSESSMENT_VERSION");
    expect(api).toContain("totalQuestions !== QUESTIONS.length");
    expect(api).toContain("Formal answers must use valid canonical question positions and options");
    expect(api).not.toContain("taster_answers");
    expect(api).not.toContain("seedAnswersFromOpening");
  });

  test("formal submission requires all 58 answers and never reads taster answer values", () => {
    const api = readApi("submit-assessment.js");
    expect(api).toContain("All 58 formal assessment answers are required");
    expect(api).toContain("const completeAnswers = answers");
    expect(api).toContain("assessment_version: 'FULL_VALU_V2_SEPARATE_TASTER'");
    expect(api).not.toContain("taster_answers");
    expect(api).not.toContain("seedAnswersFromOpening");
    expect(api).not.toContain("openingAnswers");
  });

  test("progress restore is scoped to the new formal assessment version", () => {
    const api = readApi("assessment-progress.js");
    expect(api).toContain("assessment_version: `eq.${FULL_ASSESSMENT_VERSION}`");
    expect(api).toContain("assessment_version=eq.${FULL_ASSESSMENT_VERSION}");
  });

  test("the shared journey indicator distinguishes registration, snapshot, account and full assessment", () => {
    const source = readSource("VALUAssessmentJourney.jsx");
    expect(source).toContain("title: 'Register'");
    expect(source).toContain("title: 'Snapshot'");
    expect(source).toContain("title: 'Account'");
    expect(source).toContain("title: 'Assessment'");
    expect(source).toContain("YOUR VALU JOURNEY");
    expect(source).not.toContain("9 questions");
    expect(source).not.toContain("58 questions");
    expect(source).not.toContain("QUESTION ${currentQuestion} OF");
    expect(source).not.toContain("ONE VALU ASSESSMENT");
  });

  test("staging assessment traffic is isolated to the staging site and Supabase project", () => {
    const taster = gateSource();
    const wrangler = fs.readFileSync(path.join(__dirname, "../../wrangler.jsonc"), "utf8");
    expect(taster).toContain("if (host.includes('staging')) return 'https://staging.valoriainstitute.com'");
    expect(taster).toContain("return typeof window !== 'undefined' ? window.location.origin : ''");
    expect(wrangler).toContain('"SUPABASE_URL": "https://yccxgjdqworgcbircnvn.supabase.co"');
    expect(wrangler).toContain('"VALU_PRODUCTION_SUPABASE_URL": "https://yccxgjdqworgcbircnvn.supabase.co"');
    expect(wrangler).toContain('"VALU_STAGING_API_ENABLED": "1"');
    expect(wrangler).toContain('"name": "valoria-staging-assessment"');
  });
});
