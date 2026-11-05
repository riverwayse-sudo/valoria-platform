"use strict";

const fs = require("fs");
const path = require("path");
const { ASSESSMENT_ORDER, TOTAL_QUESTIONS, nextPlaceToAnswer, answeredCount, placeForPosition } = require("../assessmentJourney");
const { QUESTIONS } = require("../questions");
const { TASTER_QUESTIONS } = require("../valuTaster");

const readSource = relative => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

describe("separate VALU taster and full assessment contracts", () => {
  test("the taster contains nine questions and is separate from the 58-question full bank", () => {
    expect(TASTER_QUESTIONS).toHaveLength(9);
    expect(QUESTIONS).toHaveLength(58);
    expect(TOTAL_QUESTIONS).toBe(58);
    expect(TOTAL_QUESTIONS).not.toBe(TASTER_QUESTIONS.length);
  });

  test("the full assessment covers all 58 canonical positions in order", () => {
    expect(ASSESSMENT_ORDER).toEqual(Array.from({ length: 58 }, (_, index) => index));
    expect(new Set(ASSESSMENT_ORDER).size).toBe(58);
    expect(placeForPosition(0)).toBe(1);
    expect(placeForPosition(57)).toBe(58);
  });

  test("the full assessment starts at Question 1 and resumes at the first unanswered full question", () => {
    expect(nextPlaceToAnswer({}, 1)).toBe(1);
    const saved = { 0: 2, 1: 1, 2: 0, 3: 3 };
    expect(answeredCount(saved)).toBe(4);
    expect(nextPlaceToAnswer(saved, 1)).toBe(5);
  });

  test("all 58 full-assessment answers are required before completion", () => {
    const full = Object.fromEntries(ASSESSMENT_ORDER.map(position => [position, 0]));
    expect(answeredCount(full)).toBe(58);
    expect(nextPlaceToAnswer(full, 1)).toBe(null);
  });

  test("the taster UI counts its own nine questions, not the full 58", () => {
    const source = readSource("VALUIndexV4GateNext.jsx");
    expect(source).toContain('VALUAssessmentJourney stage="taster"');
    expect(source).toContain("Question {placeInAssessment} of {TASTER_QUESTIONS.length}");
    expect(source).not.toContain("Question {placeInAssessment} of {TOTAL_QUESTIONS}");
  });

  test("the account bridge explicitly separates the taster from the full assessment", () => {
    const source = readSource("VALUIndexV4GateNext.jsx");
    expect(source).toContain("separate snapshot");
    expect(source).toContain("not part of the full 58-question VALU Index");
    expect(source).toContain("answers do not carry into the full assessment");
    expect(source).toContain("start the separate 58-question full assessment at Question 1");
  });

  test("the full assessment opens at Question 1 and uses its own answer map", () => {
    const source = readSource("FullVALUAssessment.jsx");
    expect(source).toContain('VALUAssessmentJourney stage="full"');
    expect(source).toContain("setCurrent(0)");
    expect(source).toContain("nextPlaceToAnswer(restoredAnswers, 1)");
    expect(source).not.toContain("OPENING_SESSION_LENGTH");
    expect(source).not.toContain("OPENING_POSITIONS");
  });

  test("the taster answer payload is never merged into the full scoring payload", () => {
    const submit = fs.readFileSync(path.join(__dirname, "../../api/submit-assessment.js"), "utf8");
    const journey = readSource("assessmentJourney.js");
    expect(submit).not.toContain("taster_answers");
    expect(submit).not.toContain("seedAnswersFromOpening");
    expect(submit).toContain("const completeAnswers = answers");
    expect(submit).toContain("validateAnswers(answers)");
    expect(journey).not.toContain("seedAnswersFromOpening");
    expect(journey).not.toContain("TASTER_QUESTIONS");
  });

  test("the full assessment progress restore preserves full-answer work without reading taster answers", () => {
    const api = fs.readFileSync(path.join(__dirname, "../../api/assessment-progress.js"), "utf8");
    expect(api).not.toContain("taster_answers");
    expect(api).not.toContain("seedAnswersFromOpening");
    expect(api).toContain("validFullAnswerMap");
    expect(api).toContain("totalQuestions !== QUESTIONS.length");
  });

  test("the server requires a complete 58-answer map for full VALU scoring", () => {
    const api = fs.readFileSync(path.join(__dirname, "../../api/submit-assessment.js"), "utf8");
    expect(api).toContain("The full VALU Index requires all 58 valid answers.");
    expect(api).toContain("assessment_version: 'FULL_VALU_V2'");
  });
});
