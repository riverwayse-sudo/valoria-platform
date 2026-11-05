"use strict";

// Contract for two independent assessment records:
// 1) the 9-question taster; 2) the separate 58-question full VALU assessment.

const fs = require("fs");
const path = require("path");
const {
  ASSESSMENT_ORDER,
  TOTAL_QUESTIONS,
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

describe("independent taster and full VALU assessment structure", () => {
  test("the full VALU assessment contains exactly 58 canonical questions", () => {
    expect(QUESTIONS).toHaveLength(58);
    expect(TOTAL_QUESTIONS).toBe(58);
    expect(ASSESSMENT_ORDER).toEqual(Array.from({ length: 58 }, (_, index) => index));
    expect(new Set(ASSESSMENT_ORDER).size).toBe(58);
  });

  test("the taster has its own nine-question count and is not imported into full assessment order", () => {
    expect(TASTER_QUESTIONS).toHaveLength(9);
    const journey = readSource("assessmentJourney.js");
    expect(journey).not.toContain("valuTaster");
    expect(journey).not.toContain("OPENING_POSITIONS");
    expect(journey).not.toContain("seedAnswersFromOpening");
  });

  test("full assessment starts at Question 1 and counts only its own answers", () => {
    expect(nextPlaceToAnswer({}, 1)).toBe(1);
    expect(placeForPosition(0)).toBe(1);
    const answers = { 0: 2, 1: 1, 2: 0 };
    expect(answeredCount(answers)).toBe(3);
    expect(nextPlaceToAnswer(answers, 1)).toBe(4);
  });

  test("full assessment progress reaches 58 only after 58 full answers", () => {
    const answers = Object.fromEntries(ASSESSMENT_ORDER.map(position => [position, 0]));
    expect(answeredCount(answers)).toBe(58);
    expect(nextPlaceToAnswer(answers, 1)).toBe(null);
  });
});

describe("standalone 9-question taster", () => {
  test("taster UI labels and counts only its own nine questions", () => {
    const source = gateSource();
    expect(source).toContain("Question {placeInAssessment} of {TASTER_QUESTIONS.length}");
    expect(source).toContain('VALUAssessmentJourney stage="taster"');
    expect(source).toContain("TASTER_QUESTIONS.length");
    expect(source).not.toContain("TOTAL_QUESTIONS");
    expect(source).not.toContain("Question 10");
    expect(source).not.toContain("remaining 49");
  });

  test("taster progress is saved to its own progress API and record", () => {
    const source = gateSource();
    const progressApi = readApi("taster-progress.js");
    expect(source).toContain('API_BASE+"/api/taster-progress"');
    expect(source).toContain('API_BASE+"/api/submit-taster"');
    expect(progressApi).toContain("taster_progress");
    expect(source).toContain("localStorage.setItem('pending_taster_id'");
  });

  test("the taster result sends the user to account confirmation before the separate full assessment", () => {
    const source = gateSource();
    expect(source).toContain("Your 9-question taster is");
    expect(source).toContain("separate 58-question full assessment at Question 1");
    expect(source).toContain("Your taster answers are saved separately");
    expect(source).toContain("VALUAssessmentJourney stage=\"account\"");
    expect(source).not.toContain("Continue at Question 10");
    expect(source).not.toContain("remaining 49 questions");
  });
});

describe("separate 58-question full VALU assessment", () => {
  test("the full assessment renders the canonical bank in order", () => {
    const source = fullSource();
    expect(source).toContain("QUESTIONS[ASSESSMENT_ORDER[current]]");
    expect(source).toContain('VALUAssessmentJourney stage="full"');
    expect(source).toContain("TOTAL_QUESTIONS");
    expect(source).not.toContain("OPENING_POSITIONS");
    expect(source).not.toContain("OPENING_SESSION_LENGTH");
    expect(source).not.toContain("Question 10");
  });

  test("a new full assessment starts at Question 1", () => {
    const source = fullSource();
    expect(source).toContain("setCurrent(0)");
    expect(source).toContain("nextPlaceToAnswer(restoredAnswers, 1)");
    expect(source).not.toContain("setCurrent(OPENING_SESSION_LENGTH)");
    expect(source).not.toContain("seedAnswersFromOpening");
  });

  test("saved full-assessment progress resumes at its first unanswered question", () => {
    const source = fullSource();
    expect(source).toContain("nextPlaceToAnswer(restoredAnswers, 1)");
    expect(source).toContain("setCurrent(nextPlace ? nextPlace - 1 : ASSESSMENT_ORDER.length - 1)");
    expect(source).toContain("The authenticated server restore is the source of truth");
    expect(source).toContain("remoteRestoreComplete");
  });

  test("full progress is stored independently from taster progress and never reads taster answers", () => {
    const api = readApi("assessment-progress.js");
    expect(api).toContain("valu_assessment_progress");
    expect(api).not.toContain("taster_answers");
    expect(api).not.toContain("seedAnswersFromOpening");
    expect(api).toContain("Taster answers are stored separately");
  });

  test("final submission requires all 58 full-assessment answers and never merges taster answers", () => {
    const api = readApi("submit-assessment.js");
    expect(api).toContain("validateAnswers(answers)");
    expect(api).toContain("const completeAnswers = answers");
    expect(api).not.toContain("validateRemainingAnswers");
    expect(api).not.toContain("seedAnswersFromOpening");
    expect(api).not.toContain("taster_answers");
    expect(api).toContain("computeResults(completeAnswers, timings, shuffleMap, QUESTIONS)");
  });

  test("the shared journey indicator distinguishes taster, account and full assessment", () => {
    const progress = readSource("VALUAssessmentJourney.jsx");
    expect(progress).toContain("9 separate questions");
    expect(progress).toContain("Create & confirm");
    expect(progress).toContain("58 questions");
    expect(gateSource()).toContain('VALUAssessmentJourney stage="taster"');
    expect(gateSource()).toContain('VALUAssessmentJourney stage="account"');
    expect(fullSource()).toContain('VALUAssessmentJourney stage="full"');
  });
});
