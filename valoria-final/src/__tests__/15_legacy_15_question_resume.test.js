"use strict";

const fs = require("fs");
const path = require("path");
const {
  LEGACY_15_TASTER_VERSION,
  LEGACY_15_TASTER_QUESTIONS,
  computeLegacy15TasterResult,
} = require("../valuTasterLegacy15");

describe("legacy 15-question Taster recovery", () => {
  test("keeps the historical five-PRIME instrument isolated from the formal 58-question bank", () => {
    expect(LEGACY_15_TASTER_VERSION).toBe("legacy-15");
    expect(LEGACY_15_TASTER_QUESTIONS).toHaveLength(15);
    const counts = Object.fromEntries(["P", "R", "I", "M", "E"].map(cluster => [cluster, 0]));
    LEGACY_15_TASTER_QUESTIONS.forEach(question => {
      counts[question.cluster] += 1;
      expect(question.options).toHaveLength(4);
      expect(question.q.trim()).not.toBe("");
    });
    expect(counts).toEqual({ P: 3, R: 3, I: 3, M: 3, E: 3 });

    const bankSource = fs.readFileSync(path.join(__dirname, "../valuTasterLegacy15.js"), "utf8");
    expect(bankSource).not.toMatch(/from\s+['"].*questions\.js['"]/);
  });

  test("reconstructs the five directional PRIME scores for a complete historical response set", () => {
    const answers = Object.fromEntries(LEGACY_15_TASTER_QUESTIONS.map((question, index) => [
      index,
      question.options.findIndex(option => option.score === 4),
    ]));
    const result = computeLegacy15TasterResult(answers);
    expect(result.completedQuestions).toBe(15);
    expect(result.normalisedScores).toEqual({ P: 100, R: 100, I: 100, M: 100, E: 100 });
    expect(result.strongest).toEqual({ id: "P", name: "Presence" });
    expect(result.weakest).toEqual({ id: "P", name: "Presence" });
  });

  test("all resume and submit layers recognise the historical version without changing the current Taster", () => {
    const root = path.join(__dirname, "../..");
    const progress = fs.readFileSync(path.join(root, "api/taster-progress.js"), "utf8");
    const submit = fs.readFileSync(path.join(root, "api/submit-taster.js"), "utf8");
    const gate = fs.readFileSync(path.join(__dirname, "../VALUIndexV4GateNext.jsx"), "utf8");
    expect(progress).toContain("version === LEGACY_15_TASTER_VERSION");
    expect(submit).toContain("tasterVersion === LEGACY_15_TASTER_VERSION");
    expect(submit).toContain("computeLegacy15TasterResult");
    expect(gate).toContain("version==='legacy-15'||version==='4.0'");
    expect(gate).toContain("legacy.LEGACY_15_TASTER_QUESTIONS");
  });
});
