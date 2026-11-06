"use strict";

// API contracts for a separate nine-question taster and a separate 58-question
// formal VALU assessment.

const fs = require("fs");
const path = require("path");

const readApi = name => fs.readFileSync(path.join(__dirname, "../../api", name), "utf8");

describe("taster-progress supports anonymous entry and a late identity step", () => {
  const api = readApi("taster-progress.js");

  test("init creates a resumable taster session with no personal details", () => {
    expect(api).toContain("action === 'init'");
    expect(api).toContain("name: null, role: null, experience: null, email: null");
  });

  test("an identify action attaches identity without resetting taster answers or progress", () => {
    expect(api).toContain("action === 'identify'");
    const identifyBlock = api.slice(api.indexOf("if (action === 'identify')"), api.indexOf("if (action === 'load')"));
    expect(identifyBlock).toContain("name, role, experience, email");
    expect(identifyBlock).not.toContain("answers");
    expect(identifyBlock).not.toContain("current_question");
  });

  test("the taster action allow-list includes identify", () => {
    expect(api).toContain("['init', 'load', 'save', 'identify', 'complete']");
  });

  test("taster progress has its own nine-question contract", () => {
    expect(api).toContain("total_questions");
    expect(api).toContain("TASTER_QUESTIONS.length");
    expect(api).not.toContain("valu_assessment_progress");
  });

  test("identity columns are nullable so anonymous init can create the row", () => {
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

describe("formal assessment progress is independent and versioned", () => {
  const progressApi = readApi("assessment-progress.js");
  const submitApi = readApi("submit-assessment.js");

  test("formal progress only restores the separate 58-question assessment version", () => {
    expect(progressApi).toContain('const FULL_ASSESSMENT_VERSION = "FULL_VALU_V2_SEPARATE_TASTER"');
    expect(progressApi).toContain("assessment_version: `eq.${FULL_ASSESSMENT_VERSION}`");
    expect(progressApi).toContain("assessment_version=eq.${FULL_ASSESSMENT_VERSION}");
    expect(progressApi).toContain("totalQuestions !== QUESTIONS.length");
    expect(progressApi).not.toContain("taster_answers");
    expect(progressApi).not.toContain("seedAnswersFromOpening");
  });

  test("formal progress validates canonical question positions and option values", () => {
    expect(progressApi).toContain("Formal answers must use valid canonical question positions and options");
    expect(progressApi).toContain("value >= QUESTIONS[position].options.length");
    expect(progressApi).toContain("assessment_version: FULL_ASSESSMENT_VERSION");
  });

  test("no saved formal progress returns an empty restore rather than taster answers", () => {
    const block = progressApi.slice(
      progressApi.indexOf("const progress = await getProgressByTasterId(tasterId);"),
      progressApi.indexOf("if (progress.user_id")
    );
    expect(block).toContain("progress: null");
    expect(block).not.toContain("seeded_answers");
    expect(block).not.toContain("taster_answers");
  });

  test("formal submission scores the submitted 58-answer map directly", () => {
    expect(submitApi).toContain("All 58 formal assessment answers are required");
    expect(submitApi).toContain("const completeAnswers = answers");
    expect(submitApi).toContain("computeResults(completeAnswers, timings, shuffleMap, QUESTIONS)");
    expect(submitApi).toContain("answers: completeAnswers");
    expect(submitApi).toContain("FULL_VALU_V2_SEPARATE_TASTER");
    expect(submitApi).not.toContain("taster_answers");
    expect(submitApi).not.toContain("seedAnswersFromOpening");
  });

  test("formal submission requires one timing entry per formal question", () => {
    expect(submitApi).toContain("timings.length !== MAX_TIMINGS_LENGTH");
    expect(submitApi).not.toContain("timings.length < 1 || timings.length > MAX_TIMINGS_LENGTH");
  });
});
