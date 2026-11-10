"use strict";

const {
  TASTER_QUESTIONS,
  TASTER_SKILLS,
  VALU_VERSION,
  computeTasterResult,
} = require("../valuTaster");
const { QUESTIONS } = require("../questions");
const fs = require("fs");
const path = require("path");
const {
  LEGACY_TASTER_QUESTIONS,
  LEGACY_TASTER_VERSION,
  computeLegacyTasterResult,
} = require("../valuTasterLegacy");
const {
  TOTAL_QUESTIONS,
  ASSESSMENT_ORDER,
  openingPositions,
  remainingPositions,
  seedAnswersFromOpening,
} = require("../assessmentJourney");

describe("separate VALU taster and formal assessment contracts", () => {
  test("the taster is an independent nine-question Intelligence instrument", () => {
    expect(TASTER_QUESTIONS).toHaveLength(9);
    expect(TASTER_QUESTIONS.every(question => question.cluster === "I")).toBe(true);
    expect(TASTER_QUESTIONS.every(question => question.id.startsWith("T-"))).toBe(true);
    expect(VALU_VERSION).toBe("4.2");
  });

  test("existing v4.1 sessions retain their original question set for safe resume", () => {
    expect(LEGACY_TASTER_VERSION).toBe("4.1");
    expect(LEGACY_TASTER_QUESTIONS).toHaveLength(9);
    const legacyAnswers = Object.fromEntries(LEGACY_TASTER_QUESTIONS.map((_, index) => [index, 3]));
    const result = computeLegacyTasterResult(legacyAnswers);
    expect(result.completedQuestions).toBe(9);
    expect(Object.keys(result.points).sort()).toEqual(["E", "I", "M", "P", "R"]);
  });

  test("the Intelligence taster has the approved skill distribution", () => {
    const counts = Object.fromEntries(TASTER_SKILLS.map(skill => [skill.key, 0]));
    TASTER_QUESTIONS.forEach(question => { counts[question.skill] += 1; });
    expect(counts).toEqual({
      "Critical Thinking": 3,
      "Strategic Thinking": 3,
      "Business Acumen": 2,
      "AI Fluency ★": 1,
    });
  });

  test("the formal VALU assessment remains a separate 58-question instrument", () => {
    expect(QUESTIONS).toHaveLength(58);
    expect(TOTAL_QUESTIONS).toBe(58);
    expect(ASSESSMENT_ORDER).toHaveLength(58);
    expect(openingPositions()).toEqual([]);
    expect(remainingPositions()).toHaveLength(58);
    expect(seedAnswersFromOpening()).toEqual({});
  });

  test("taster identifiers cannot collide with the formal question bank", () => {
    const formalIds = new Set(QUESTIONS.map(question => question.id));
    expect(TASTER_QUESTIONS.every(question => !formalIds.has(question.id))).toBe(true);
  });

  test("taster answers score only Intelligence skills and never produce an official VALU Index", () => {
    const answers = Object.fromEntries(TASTER_QUESTIONS.map((_, index) => [index, 3]));
    const result = computeTasterResult(answers);

    expect(result.intelligenceScore).toBe(100);
    expect(result.normalisedSkills).toEqual({
      "Critical Thinking": 100,
      "Strategic Thinking": 100,
      "Business Acumen": 100,
      "AI Fluency ★": 100,
    });
    expect(result.completedQuestions).toBe(9);
    expect(result).not.toHaveProperty("valuIndex");
    expect(result).not.toHaveProperty("clusterScores");
  });

  test("new sessions use v4.2 while existing v4.1 sessions retain their original bank", () => {
    const progressApi = fs.readFileSync(path.join(__dirname, "../../api/taster-progress.js"), "utf8");
    const submitApi = fs.readFileSync(path.join(__dirname, "../../api/submit-taster.js"), "utf8");
    const migration = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261110083803_set_taster_version_42_default.sql"), "utf8");
    expect(progressApi).toContain("questionBankForVersion(progress.taster_version)");
    expect(progressApi).toContain("taster_version: progress.taster_version");
    expect(submitApi).toContain("computeLegacyTasterResult(answers)");
    expect(submitApi).toContain("p_taster_version: tasterVersion");
    expect(migration).toContain("alter column taster_version set default '4.2'");
  });

  test("retired taster versions are not silently remapped to the new question bank", () => {
    const progressApi = fs.readFileSync(path.join(__dirname, "../../api/taster-progress.js"), "utf8");
    expect(progressApi).toContain("This saved taster session uses a retired format");
  });

  test("an empty taster answer map does not create NaN skill scores", () => {
    const result = computeTasterResult({});
    expect(result.intelligenceScore).toBe(0);
    expect(Object.values(result.normalisedSkills).every(Number.isFinite)).toBe(true);
    expect(result.completedQuestions).toBe(0);
  });
});
