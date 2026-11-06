"use strict";

// API contract for two independent VALU assessment records.

const fs = require("fs");
const path = require("path");

const readApi = name => fs.readFileSync(path.join(__dirname, "../../api", name), "utf8");

describe("taster-progress supports anonymous entry and a late identity step", () => {
  const api = readApi("taster-progress.js");

  test("init creates a resumable taster session without personal details", () => {
    expect(api).toContain("action === 'init'");
    expect(api).toContain("name: null, role: null, experience: null, email: null");
  });

  test("identify attaches identity without resetting taster answers or progress", () => {
    expect(api).toContain("action === 'identify'");
    const identifyBlock = api.slice(api.indexOf("if (action === 'identify')"), api.indexOf("if (action === 'load')"));
    expect(identifyBlock).toContain("name, role, experience, email");
    expect(identifyBlock).not.toContain("answers");
    expect(identifyBlock).not.toContain("current_question");
  });

  test("the action allow-list includes identify", () => {
    expect(api).toContain("['init', 'load', 'save', 'identify', 'complete']");
  });

  test("identity columns remain nullable for anonymous taster initialization", () => {
    const migrations = path.join(__dirname, "../../supabase/migrations");
    const files = fs.readdirSync(migrations).filter(n => n.endsWith(".sql")).sort();
    const relax = files.filter(n => {
      const sql = fs.readFileSync(path.join(migrations, n), "utf8");
      return sql.includes("ALTER TABLE public.taster_progress") && /DROP NOT NULL/.test(sql);
    });
    expect(relax.length).toBeGreaterThan(0);
    const sql = fs.readFileSync(path.join(migrations, relax[relax.length - 1]), "utf8");
    for (const col of ["name", "role", "experience", "email"]) {
      expect(sql).toMatch(new RegExp(`ALTER COLUMN ${col} DROP NOT NULL`, "i"));
    }
    expect(relax[relax.length - 1]).toBe("20261030120000_relax_taster_progress_identity_nullable.sql");
  });
});

describe("full-assessment progress is independent of taster progress", () => {
  const progressApi = readApi("assessment-progress.js");
  const submitApi = readApi("submit-assessment.js");

  test("full progress restore reads its own table and never reads taster answers", () => {
    expect(progressApi).toContain("valu_assessment_progress");
    expect(progressApi).not.toContain("taster_answers");
    expect(progressApi).not.toContain("seedAnswersFromOpening");
    expect(progressApi).not.toContain("seeded_answers");
    expect(progressApi).toContain("Taster answers are stored separately");
  });

  test("a participant without saved full progress starts at the beginning of the full assessment", () => {
    const component = fs.readFileSync(path.join(__dirname, "../FullVALUAssessment.jsx"), "utf8");
    expect(component).toContain("setCurrent(0)");
    expect(component).toContain("nextPlaceToAnswer(restoredAnswers, 1)");
  });

  test("final submission scores the full 58-answer map without merging the taster", () => {
    expect(submitApi).toContain("if (!validateAnswers(answers))");
    expect(submitApi).toContain("const completeAnswers = answers");
    expect(submitApi).toContain("computeResults(completeAnswers, timings, shuffleMap, QUESTIONS)");
    expect(submitApi).toContain("answers: completeAnswers");
    expect(submitApi).not.toContain("seedAnswersFromOpening");
    expect(submitApi).not.toContain("taster_answers");
    expect(submitApi).not.toContain("validateRemainingAnswers");
  });

  test("taster identity is used only to verify account ownership and journey provenance", () => {
    expect(submitApi).toContain("taster.user_id !== handoff.sub");
    expect(submitApi).toContain("taster_id: tasterId, user_id: resolvedUserId");
    expect(submitApi).not.toContain("select: 'id,user_id,name,role,completed_at,taster_answers'");
  });
});

describe("full assessment submission validates a complete answer map", () => {
  const api = readApi("submit-assessment.js");

  test("timings are bounded integrity diagnostics and never part of scoring", () => {
    expect(api).toContain("timings.length < 1 || timings.length > MAX_TIMINGS_LENGTH");
    expect(api).not.toContain("timings.length !== MAX_TIMINGS_LENGTH");
  });

  test("the scoring engine receives exactly the submitted full-assessment answers", () => {
    expect(api).toContain("const completeAnswers = answers");
    expect(api).toContain("computeResults(completeAnswers, timings, shuffleMap, QUESTIONS)");
    expect(api).toContain("import { QUESTIONS } from '../src/questions.js'");
  });
});
