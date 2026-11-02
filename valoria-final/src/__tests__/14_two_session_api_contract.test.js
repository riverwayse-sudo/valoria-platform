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

  test("identity columns are nullable so anonymous init can create the row", () => {
    const migrations = path.join(__dirname, "../../supabase/migrations");
    const files = fs.readdirSync(migrations).filter(n => n.endsWith(".sql")).sort();
    const relax = files.filter(n => {
      const sql = fs.readFileSync(path.join(migrations, n), "utf8");
      return sql.includes("ALTER TABLE public.taster_progress") && /DROP NOT NULL/.test(sql);
    });
    // Without this, init's NULL identity insert fails the NOT NULL constraint and
    // repeats "We could not establish a resumable session" for every participant.
    expect(relax.length).toBeGreaterThan(0);
    const sql = fs.readFileSync(path.join(migrations, relax[relax.length - 1]), "utf8");
    for (const col of ["name", "role", "experience", "email"]) {
      expect(sql).toMatch(new RegExp(`ALTER COLUMN ${col} DROP NOT NULL`, "i"));
    }
    expect(relax[relax.length - 1]).toBe("20261030120000_relax_taster_progress_identity_nullable.sql");
  });
});

describe("assessment-progress defers opening-answer recall until final submission", () => {
  const progressApi = readApi("assessment-progress.js");
  const submitApi = readApi("submit-assessment.js");

  test("continuation restore does not read the taster answer payload", () => {
    expect(progressApi).not.toContain("taster_answers");
    expect(progressApi).not.toContain("seedAnswersFromOpening");
    expect(progressApi).not.toContain("seeded_answers");
    expect(progressApi).toContain("Continuation deliberately restores only the saved Questions 10–58 work");
  });

  test("a participant with no saved continuation progress is sent straight to Question 10", () => {
    const block = progressApi.slice(progressApi.indexOf("const progress = await getProgressByTasterId(tasterId);"), progressApi.indexOf("if (progress.user_id"));
    expect(block).toContain("progress: null");
    expect(block).not.toContain("seeded_answers");
  });

  test("the final submit retrieves and merges the verified opening answers before scoring", () => {
    expect(submitApi).toContain("seedAnswersFromOpening(taster.taster_answers || {})");
    expect(submitApi).toContain("completeAnswers = { ...openingAnswers, ...answers }");
    expect(submitApi).toContain("computeResults(completeAnswers, timings, shuffleMap, QUESTIONS)");
    expect(submitApi).toContain("answers: completeAnswers");
  });
});

describe("submit-assessment accepts a two-session timing subset", () => {
  const api = readApi("submit-assessment.js");

  test("timings are validated as a bounded subset, not exactly 58", () => {
    expect(api).toContain("timings.length < 1 || timings.length > MAX_TIMINGS_LENGTH");
    expect(api).not.toContain("timings.length !== MAX_TIMINGS_LENGTH");
  });

  test("canonical 58-answer scoring is unchanged", () => {
    expect(api).toContain("computeResults(completeAnswers, timings, shuffleMap, QUESTIONS)");
    expect(api).toContain("import { QUESTIONS } from '../src/questions.js'");
  });
});
