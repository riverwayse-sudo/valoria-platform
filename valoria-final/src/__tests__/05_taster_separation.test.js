"use strict";

const { TASTER_QUESTIONS, VALU_VERSION, computeTasterResult } = require("../valuTaster");
const { QUESTIONS } = require("../questions");
const { validPartialAnswers } = require("../../api/taster-progress");
const fs = require("fs");
const path = require("path");
const { LEGACY_TASTER_QUESTIONS, LEGACY_TASTER_VERSION, computeLegacyTasterResult } = require("../valuTasterLegacy");
const { TASTER_QUESTIONS: V42_QUESTIONS, TASTER_VERSION_V42, computeV42TasterResult } = require("../valuTasterV42");
const { TOTAL_QUESTIONS, ASSESSMENT_ORDER, openingPositions, remainingPositions, seedAnswersFromOpening } = require("../assessmentJourney");

describe("separate VALU taster and formal assessment contracts", () => {
  test("new taster is the independent 15-question v4.0 PRIME snapshot", () => {
    expect(VALU_VERSION).toBe("4.0");
    expect(TASTER_QUESTIONS).toHaveLength(15);
    expect(new Set(TASTER_QUESTIONS.map(question => question.cluster))).toEqual(new Set(["P", "R", "I", "M", "E"]));
    expect(validPartialAnswers({ 0: 1, 14: 2 }, TASTER_QUESTIONS)).toBe(true);
    expect(validPartialAnswers({ 15: 1 }, TASTER_QUESTIONS)).toBe(false);
    const result = computeTasterResult(Object.fromEntries(TASTER_QUESTIONS.map((_, index) => [index, 3])));
    expect(result.completedQuestions).toBe(15);
    expect(Object.keys(result.normalisedScores).sort()).toEqual(["E", "I", "M", "P", "R"]);
  });

  test("existing v4.1 sessions retain their exact nine-question bank and scoring", () => {
    expect(LEGACY_TASTER_VERSION).toBe("4.1");
    expect(LEGACY_TASTER_QUESTIONS).toHaveLength(9);
    const result = computeLegacyTasterResult(Object.fromEntries(LEGACY_TASTER_QUESTIONS.map((_, index) => [index, 3])));
    expect(result.completedQuestions).toBe(9);
    expect(Object.keys(result.points).sort()).toEqual(["E", "I", "M", "P", "R"]);
  });

  test("existing v4.2 sessions retain their Intelligence-only bank and scoring", () => {
    expect(TASTER_VERSION_V42).toBe("4.2");
    expect(V42_QUESTIONS).toHaveLength(9);
    expect(V42_QUESTIONS.every(question => question.cluster === "I")).toBe(true);
    const result = computeV42TasterResult(Object.fromEntries(V42_QUESTIONS.map((_, index) => [index, 3])));
    expect(result.completedQuestions).toBe(9);
    expect(Number.isFinite(result.intelligenceScore)).toBe(true);
  });

  test("the formal VALU assessment remains a separate 58-question instrument", () => {
    expect(QUESTIONS).toHaveLength(58);
    expect(TOTAL_QUESTIONS).toBe(58);
    expect(ASSESSMENT_ORDER).toHaveLength(58);
    expect(openingPositions()).toEqual([]);
    expect(remainingPositions()).toHaveLength(58);
    expect(seedAnswersFromOpening()).toEqual({});
  });

  test("the 15-question taster identifiers do not collide with the formal bank", () => {
    const formalIds = new Set(QUESTIONS.map(question => question.id));
    expect(TASTER_QUESTIONS.every(question => !formalIds.has(question.id))).toBe(true);
  });

  test("new registrations resolve to v4.0 while old versions remain explicitly resumable", () => {
    const progressApi = fs.readFileSync(path.join(__dirname, "../../api/taster-progress.js"), "utf8");
    const submitApi = fs.readFileSync(path.join(__dirname, "../../api/submit-taster.js"), "utf8");
    const migrationFiles = fs.readdirSync(path.join(__dirname, "../../supabase/migrations"));
    const migration = migrationFiles.find(name => name.includes("restore_writer_taster_v40"));
    expect(migration).toBeTruthy();
    const migrationSql = fs.readFileSync(path.join(__dirname, "../../supabase/migrations", migration), "utf8");
    expect(progressApi).toContain("questionBankForVersion(progress.taster_version)");
    expect(progressApi).toContain("TASTER_VERSION_V42");
    expect(submitApi).toContain("computeLegacyTasterResult(answers)");
    expect(submitApi).toContain("computeV42TasterResult(answers)");
    expect(submitApi).toContain("p_taster_version: tasterVersion");
    expect(migrationSql).toContain("alter column taster_version set default '4.0'");
    expect(migrationSql).toContain("alter column total_questions set default 15");
  });

  test("the 58-question assessment is never seeded from taster answers", () => {
    const formalIds = new Set(QUESTIONS.map(question => question.id));
    expect(TASTER_QUESTIONS.every(question => !formalIds.has(question.id))).toBe(true);
    expect(remainingPositions()).toHaveLength(58);
    expect(seedAnswersFromOpening()).toEqual({});
  });
});
