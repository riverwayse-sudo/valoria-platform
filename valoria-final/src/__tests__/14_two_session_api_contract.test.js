"use strict";

// API contract for the two-session journey.
//
// Session 1 must be startable anonymously (no account before Question 1), and
// identity is attached at the break with a non-destructive metadata update.
// Session 2 must seed the saved opening nine answers from the stored snapshot.

const fs = require("fs");
const path = require("path");

const readApi = name => fs.readFileSync(path.join(__dirname, "../../api", name), "utf8");

describe("taster-progress supports anonymous entry and a late identity step", () => {
  const api = readApi("taster-progress.js");

  test("init creates a resumable session with no personal details", () => {
    expect(api).toContain("action === 'init'");
    expect(api).toContain("name: null, role: null, experience: null, email: null");
  });

  test("an identify action attaches identity without resetting answers or progress", () => {
    expect(api).toContain("action === 'identify'");
    const identifyBlock = api.slice(api.indexOf("if (action === 'identify')"), api.indexOf("if (action === 'load')"));
    expect(identifyBlock).toContain("name, role, experience, email");
    // It must not touch answers or current_question.
    expect(identifyBlock).not.toContain("answers");
    expect(identifyBlock).not.toContain("current_question");
  });

  test("the action allow-list includes identify", () => {
    expect(api).toContain("['init', 'load', 'save', 'identify', 'complete']");
  });
});

describe("assessment-progress seeds the opening nine for session 2", () => {
  const api = readApi("assessment-progress.js");

  test("the stored snapshot answers are read for seeding", () => {
    expect(api).toContain("taster_answers");
    expect(api).toContain("seedAnswersFromOpening");
  });

  test("seeded answers are returned only when no second-session progress exists", () => {
    const block = api.slice(api.indexOf("const progress = await getProgressByTasterId(tasterId);"), api.indexOf("if (progress.user_id"));
    expect(block).toContain("seeded_answers");
    expect(block).toContain("progress: null");
  });
});

describe("submit-assessment accepts a two-session timing subset", () => {
  const api = readApi("submit-assessment.js");

  test("timings are validated as a bounded subset, not exactly 58", () => {
    expect(api).toContain("timings.length < 1 || timings.length > MAX_TIMINGS_LENGTH");
    expect(api).not.toContain("timings.length !== MAX_TIMINGS_LENGTH");
  });

  test("canonical 58-answer scoring is unchanged", () => {
    expect(api).toContain("computeResults(answers, timings, shuffleMap, QUESTIONS)");
    expect(api).toContain("import { QUESTIONS } from '../src/questions.js'");
  });
});
