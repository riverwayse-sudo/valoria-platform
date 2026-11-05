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

describe("assessment-progress preserves independent full-assessment answers", () => {
  const progressApi = readApi("assessment-progress.js");
  const submitApi = readApi("submit-assessment.js");

  test("restore does not read or merge the taster answer payload", () => {
    expect(progressApi).not.toContain("taster_answers");
    expect(progressApi).not.toContain("seedAnswersFromOpening");
    expect(progressApi).toContain("validFullAnswerMap");
    expect(progressApi).toContain("The separate 9-question taster is never merged");
  });

  test("full-assessment progress is validated against the canonical 58-question bank", () => {
    expect(progressApi).toContain('import { QUESTIONS } from "../src/questions.js"');
    expect(progressApi).toContain("totalQuestions !== QUESTIONS.length");
    expect(progressApi).toContain("validFullAnswerMap(answers || {})");
  });

  test("full assessment submission requires 58 answers and uses them directly", () => {
    expect(submitApi).toContain("The full VALU Index requires all 58 valid answers.");
    expect(submitApi).toContain("const completeAnswers = answers");
    expect(submitApi).not.toContain("seedAnswersFromOpening");
    expect(submitApi).not.toContain("taster_answers");
    expect(submitApi).toContain("computeResults(completeAnswers, timings, shuffleMap, QUESTIONS)");
    expect(submitApi).toContain("answers: completeAnswers");
  });
});

describe("submit-assessment accepts bounded timing diagnostics", () => {
  const api = readApi("submit-assessment.js");

  test("timings are validated as a bounded subset, not as scoring inputs", () => {
    expect(api).toContain("timings.length < 1 || timings.length > MAX_TIMINGS_LENGTH");
    expect(api).not.toContain("timings.length !== MAX_TIMINGS_LENGTH");
  });

  test("the 58-question canonical scoring bank remains authoritative", () => {
    expect(api).toContain("computeResults(completeAnswers, timings, shuffleMap, QUESTIONS)");
    expect(api).toContain("import { QUESTIONS } from '../src/questions.js'");
  });
});
