"use strict";

// Two-session VALU journey contract.
//
// There is ONE 58-question assessment, completed in two sessions:
//   Session 1 — the approved opening nine (direct entry, no account required).
//   Session 2 — the remaining 49 questions (after account confirmation).
//
// These tests pin the shape of that journey so it cannot silently regress into
// the previous "taster is a separate product, then start a second assessment"
// flow, which is exactly what left a participant unable to continue.

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
const gateSource = () => readSource("VALUIndexV4GateNext.jsx");
const fullSource = () => readSource("FullVALUAssessment.jsx");

describe("one continuous VALU assessment with an account-confirmation bridge", () => {
  test("the canonical assessment is exactly 58 questions", () => {
    expect(QUESTIONS.length).toBe(58);
    expect(TOTAL_QUESTIONS).toBe(58);
  });

  test("the opening session is the approved nine and the second session is the remaining 49", () => {
    expect(OPENING_SESSION_LENGTH).toBe(9);
    expect(REMAINING_SESSION_LENGTH).toBe(49);
    expect(ASSESSMENT_ORDER.length).toBe(58);
  });

  test("the approved opening nine are the same questions as the canonical taster", () => {
    const openingIds = OPENING_POSITIONS.map(position => QUESTIONS[position].id);
    expect(openingIds).toEqual(TASTER_QUESTIONS.map(question => question.id));
  });

  test("the opening nine and the remaining 49 partition the bank with no duplicates", () => {
    const combined = [...OPENING_POSITIONS, ...REMAINING_POSITIONS].sort((a, b) => a - b);
    expect(combined).toEqual(Array.from({ length: 58 }, (_, index) => index));
    expect(new Set(ASSESSMENT_ORDER).size).toBe(58);
  });

  test("the opening nine span all five PRIME clusters", () => {
    const clusters = new Set(OPENING_POSITIONS.map(position => QUESTIONS[position].cluster));
    for (const cluster of ["P", "R", "I", "M", "E"]) expect(clusters.has(cluster)).toBe(true);
  });
});

describe("session 1 → session 2 continuity", () => {
  test("the saved opening nine seed their canonical bank positions", () => {
    const openingAnswers = { 0: 2, 1: 1, 2: 0, 3: 3, 4: 2, 5: 1, 6: 0, 7: 3, 8: 2 };
    const seeded = seedAnswersFromOpening(openingAnswers);
    expect(Object.keys(seeded).length).toBe(9);
    OPENING_POSITIONS.forEach((position, index) => {
      expect(seeded[position]).toBe(openingAnswers[index]);
    });
    expect(answeredCount(seeded)).toBe(9);
  });

  test("the participant resumes at question 10, not back at question 1", () => {
    const seeded = seedAnswersFromOpening({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 });
    expect(nextPlaceToAnswer(seeded, 1)).toBe(10);
    expect(placeForPosition(ASSESSMENT_ORDER[9])).toBe(10);
  });

  test("resuming skips questions already answered anywhere in the order", () => {
    const seeded = seedAnswersFromOpening({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 });
    const answers = { ...seeded, [ASSESSMENT_ORDER[9]]: 1, [ASSESSMENT_ORDER[10]]: 1 };
    expect(nextPlaceToAnswer(answers, 10)).toBe(12);
  });

  test("nextPlaceToAnswer returns null only when all 58 are answered", () => {
    const full = {};
    ASSESSMENT_ORDER.forEach(position => { full[position] = 0; });
    expect(answeredCount(full)).toBe(58);
    expect(nextPlaceToAnswer(full, 1)).toBe(null);
  });
});

describe("session 1 presents questions directly, with no account gate", () => {
  test("the gate starts at Question 1 without an intro details form", () => {
    const source = gateSource();
    expect(source).toContain("Question {placeInAssessment} of {TOTAL_QUESTIONS}");
    expect(source).toContain('VALUAssessmentJourney stage="opening"');
    expect(source).not.toContain("SESSION 1 OF 2");
    // The old pre-assessment details form is gone; identity is captured at the break.
    expect(source).not.toContain("YOUR DETAILS · 01 / 03");
    expect(source).not.toContain("Tell us about yourself.");
    expect(source).not.toContain("START MY 9-QUESTION TASTER");
  });

  test("the opening session persists the ninth answer before showing the account break", () => {
    const source = gateSource();
    // The break phase is entered only inside answer() after the save resolves.
    expect(source).toContain("setPhase('break')");
    const answerBody = source.slice(source.indexOf("async function answer(index)"), source.indexOf("function choose(index)"));
    expect(answerBody).toContain("await postProgress(");
    expect(answerBody).toContain("current_question:isLast?TASTER_QUESTIONS.length:current+1");
    expect(answerBody).toContain("setPhase('break')");
  });

  test("the account is requested after the break, not before the questions", () => {
    const source = gateSource();
    const breakIndex = source.indexOf("phase==='break'");
    const sessionIndex = source.indexOf('mode="taster"');
    expect(breakIndex).toBeGreaterThan(-1);
    expect(sessionIndex).toBeGreaterThan(-1);
    expect(source).toContain("CREATE MY ACCOUNT & CONTINUE");
    expect(source).toContain("action:'identify'");
  });

  test("creating the account carries the exact session reference to signup", () => {
    const source = gateSource();
    expect(source).toContain("professional-signup/?");
    expect(source).toContain("taster_id:data.taster_id");
    expect(source).toContain("new URLSearchParams({taster_id:data.taster_id");
    expect(source).toContain("localStorage.setItem('pending_taster_id',data.taster_id)");
  });

  test("the session 1 gate never scores or displays a VALU Index", () => {
    const source = gateSource();
    expect(source).not.toContain("computeTasterResult");
    expect(source).not.toContain("YOUR PRIME SNAPSHOT");
    expect(source).not.toContain("directional");
  });

  test("a returning participant with a pending assessment is sent to continuation, not a new session", () => {
    const source = gateSource();
    expect(source).toContain("localStorage.getItem('pending_taster_id')");
    expect(source).toContain("'/journey/continue?stage=assess&taster_id='+encodeURIComponent(pending)");
  });

  test("a stale or expired resume token is discarded instead of blocking entry", () => {
    const source = gateSource();
    const begin = source.slice(source.indexOf("async function begin()"), source.indexOf("begin();"));
    expect(begin).toContain("localStorage.removeItem(RESUME_TOKEN_KEY)");
    expect(begin).toContain("postProgress({action:'init'})");
  });

  test("API requests use the deployment-root API host, not the Vite asset base", () => {
    expect(gateSource()).toContain("VITE_VALU_API_ORIGIN");
    expect(gateSource()).toContain("https://assessment.valoriainstitute.com");
    expect(gateSource()).not.toContain("import.meta.env.BASE_URL");
    expect(fullSource()).not.toContain("import.meta.env.BASE_URL");
  });
});

describe("session 2 presents the remaining questions and restores progress", () => {
  test("the full assessment renders questions in the two-session completion order", () => {
    const source = fullSource();
    expect(source).toContain("QUESTIONS[ASSESSMENT_ORDER[current]]");
    expect(source).toContain('VALUAssessmentJourney stage="continuation"');
    expect(source).not.toContain("SESSION 2 OF 2");
  });

  test("session 2 seeds the saved opening nine and lands on the first unanswered question", () => {
    const source = fullSource();
    expect(source).toContain("data.seeded_answers");
    expect(source).toContain("nextPlaceToAnswer(seeded, 1)");
  });

  test("the assessment-progress API seeds the opening nine from the stored snapshot", () => {
    const api = fs.readFileSync(path.join(__dirname, "../../api/assessment-progress.js"), "utf8");
    expect(api).toContain("taster_answers");
    expect(api).toContain("seedAnswersFromOpening");
    expect(api).toContain("seeded_answers");
  });

  test("answers are stored against canonical bank positions, not presentation order", () => {
    const source = fullSource();
    expect(source).toContain("const position = ASSESSMENT_ORDER[current]");
    expect(source).toContain("nextAnswers = { ...answers, [position]: optionIndex }");
  });
});
