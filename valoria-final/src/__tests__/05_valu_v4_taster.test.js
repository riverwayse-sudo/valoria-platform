"use strict";

const {
  TASTER_QUESTIONS,
  TASTER_SKILLS,
  EXPERIENCE_BANDS,
  VALU_VERSION,
  computeTasterResult,
} = require("../valuTaster");

describe("VALU v4.2 Intelligence taster", () => {
  test("contains nine independent Intelligence questions", () => {
    expect(VALU_VERSION).toBe("4.2");
    expect(TASTER_QUESTIONS).toHaveLength(9);
    expect(TASTER_QUESTIONS.every(question => question.cluster === "I")).toBe(true);
    expect(TASTER_QUESTIONS.every(question => question.id.startsWith("T-"))).toBe(true);
  });

  test("uses the approved 3/3/2/1 Intelligence skill distribution", () => {
    const counts = Object.fromEntries(TASTER_SKILLS.map(skill => [skill.key, 0]));
    TASTER_QUESTIONS.forEach(question => { counts[question.skill] += 1; });
    expect(counts).toEqual({
      "Critical Thinking": 3,
      "Strategic Thinking": 3,
      "Business Acumen": 2,
      "AI Fluency ★": 1,
    });
  });

  test("scores the four Intelligence skills without creating a five-cluster VALU score", () => {
    const answers = Object.fromEntries(TASTER_QUESTIONS.map((_, index) => [index, 3]));
    const result = computeTasterResult(answers);
    expect(result.intelligenceScore).toBe(100);
    expect(Object.values(result.normalisedSkills)).toEqual([100, 100, 100, 100]);
    expect(result.completedQuestions).toBe(9);
    expect(result).not.toHaveProperty("points");
    expect(result).not.toHaveProperty("clusterScores");
  });

  test("keeps experience bands and complete option text intact", () => {
    expect(EXPERIENCE_BANDS.map(band => band.id)).toEqual(["0-3", "4-8", "9-15", "15+"]);
    for (const question of TASTER_QUESTIONS) {
      expect(question.q.trim()).toMatch(/[.!?]$/);
      expect(question.options).toHaveLength(4);
      for (const option of question.options) expect(option.text.trim()).not.toBe("");
    }
  });
});
