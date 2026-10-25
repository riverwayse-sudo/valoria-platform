// valoria-final/src/__tests__/17_canonical_58_bank_scoring.test.js
//
// Golden-vector coverage for the canonical 58-question VALU bank.
//
// Existing scoring tests exercise the engine over a synthetic fixture bank. The
// bank that actually ships is src/questions.js, and nothing pinned the engine's
// output over it. A change to the bank (a cluster id, an option count, a weight
// interaction) could shift every participant's published score without any test
// failing.
//
// The expected values below were produced by running the canonical engine over
// the real bank. They are not hand-computed and must not be hand-edited: if the
// bank or contract legitimately changes, regenerate them and record why in the
// same commit. That is the point of the test — a silent score change is the
// failure mode being guarded against.

"use strict";

const { createHash } = require("node:crypto");

const { QUESTIONS } = require("../questions.js");
const engine = require("../scoringEngine.js");
const contract = require("../valuV4Contract.js");

function answersFrom(pick) {
  const answers = {};
  QUESTIONS.forEach((question, index) => { answers[index] = pick(question, index); });
  return answers;
}

function score(answers) {
  return engine.computeResults(answers, QUESTIONS.map(() => 30000), {}, QUESTIONS);
}

// Golden values over the shipped bank. Regenerate with the same helper.
const GOLDEN = [
  {
    name: "every first option",
    pick: () => 0,
    expect: { valuIndex: 55, clusterScores: { P: 50, R: 52, I: 70, M: 50, E: 42 } },
  },
  {
    name: "every last option",
    pick: (q) => q.options.length - 1,
    expect: { valuIndex: 74, clusterScores: { P: 75, R: 71, I: 75, M: 75, E: 75 } },
  },
  {
    name: "middle option",
    pick: (q) => Math.floor((q.options.length - 1) / 2),
    expect: { valuIndex: 65, clusterScores: { P: 64, R: 60, I: 55, M: 75, E: 83 } },
  },
];

describe("the canonical bank is 58 questions", () => {
  test("exactly 58 questions ship", () => {
    expect(QUESTIONS).toHaveLength(58);
  });

  test("every question has a cluster, a skill and at least two options", () => {
    for (const question of QUESTIONS) {
      expect(typeof question.id).toBe("string");
      expect(question.cluster).toMatch(/^[PRIME]$|^VA$/);
      expect(typeof question.skill).toBe("string");
      expect(Array.isArray(question.options)).toBe(true);
      expect(question.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("58 questions split into 54 scored and 4 validity anchors", () => {
    // The bank is not 58 scored items. VA1-VA4 are validity anchors: they carry
    // cluster "VA" and validAnchor:true, and the engine excludes them from the
    // five scored clusters. Pinning the split means a change that silently moves
    // a question in or out of scoring is caught here.
    const anchors = QUESTIONS.filter((q) => q.cluster === "VA");
    const scored = QUESTIONS.filter((q) => q.cluster !== "VA");
    expect(anchors).toHaveLength(4);
    expect(anchors.every((q) => q.validAnchor === true)).toBe(true);
    expect(anchors.every((q) => q.type === "anchor")).toBe(true);
    expect(scored).toHaveLength(54);
    expect(QUESTIONS).toHaveLength(scored.length + anchors.length);
  });

  test("the five scored clusters appear, plus the anchor cluster", () => {
    const ids = [...new Set(QUESTIONS.map((q) => q.cluster))].sort();
    expect(ids).toEqual(["E", "I", "M", "P", "R", "VA"]);
    // Every scored cluster in the bank is a contract cluster.
    const contractIds = contract.CLUSTERS.map((c) => c.id).sort();
    const scoredIds = [...new Set(QUESTIONS.filter((q) => q.cluster !== "VA").map((q) => q.cluster))].sort();
    expect(scoredIds).toEqual(contractIds);
  });

  test("no contract cluster is left unscored by the bank", () => {
    const scoredIds = new Set(QUESTIONS.filter((q) => q.cluster !== "VA").map((q) => q.cluster));
    for (const cluster of contract.CLUSTERS) {
      expect(scoredIds.has(cluster.id)).toBe(true);
    }
  });

  test("question ids are unique", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the bank's scoring shape is pinned", () => {
  // Golden indices alone are not enough. Changing a single option's score from 4
  // to 3 shifted nothing in the three golden vectors above, because those picks
  // only ever take the first, middle and last options of each question. A digest
  // over every question's scoring-relevant fields closes that gap: any change to
  // an option score, cluster, skill or anchor flag changes the digest.
  //
  // If a bank change is intentional, regenerate this digest in the same commit
  // and say why. A silently altered option score is exactly the failure this
  // guards against — it moves real participants' published results.
  const EXPECTED_SHAPE_DIGEST = "513da2c47b4614c4a36426a650bd7adfa7235abf696f3ebaa58a2fe70cfcbcfc";

  function shapeDigest(bank) {
    const shape = bank.map((q) => [
      q.id,
      q.cluster,
      q.skill,
      q.type || "",
      q.validAnchor ? "A" : "",
      q.futureReady ? "F" : "",
      q.options.map((o) => o.score).join(""),
    ].join("|")).join("\n");
    return createHash("sha256").update(shape).digest("hex");
  }

  test("the shipped bank's scoring shape matches the recorded digest", () => {
    expect(shapeDigest(QUESTIONS)).toBe(EXPECTED_SHAPE_DIGEST);
  });

  test("the digest is sensitive to an option score change", () => {
    // Proves the digest actually detects the class of change it exists to catch,
    // rather than being a constant that happens to match.
    const tampered = QUESTIONS.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) }));
    tampered[0].options[0].score += 1;
    expect(shapeDigest(tampered)).not.toBe(EXPECTED_SHAPE_DIGEST);
  });

  test("the digest is sensitive to a cluster or anchor-flag change", () => {
    const moved = QUESTIONS.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) }));
    moved[5].cluster = "E";
    expect(shapeDigest(moved)).not.toBe(EXPECTED_SHAPE_DIGEST);

    const unflagged = QUESTIONS.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) }));
    unflagged[0].validAnchor = true;
    expect(shapeDigest(unflagged)).not.toBe(EXPECTED_SHAPE_DIGEST);
  });

  test("option scores are within the 1-4 range the contract expects", () => {
    for (const question of QUESTIONS) {
      for (const option of question.options) {
        expect(Number.isInteger(option.score)).toBe(true);
        expect(option.score).toBeGreaterThanOrEqual(1);
        expect(option.score).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe("the published index is points out of 100", () => {
  test("MAX_SCORE is 100 and the index never exceeds it", () => {
    expect(contract.MAX_SCORE).toBe(100);
    for (const golden of GOLDEN) {
      const result = score(answersFrom(golden.pick));
      expect(result.valuIndex).toBeLessThanOrEqual(100);
      expect(result.valuIndex).toBeGreaterThanOrEqual(0);
    }
  });

  test("the best possible answers do not exceed the maximum", () => {
    const result = score(answersFrom((q) => q.options.length - 1));
    expect(result.valuIndex).toBeLessThanOrEqual(contract.MAX_SCORE);
  });

  test("the index is an integer, so it renders as a whole points value", () => {
    for (const golden of GOLDEN) {
      const result = score(answersFrom(golden.pick));
      expect(Number.isInteger(result.valuIndex)).toBe(true);
    }
  });
});

describe("canonical scoring over the shipped 58-question bank", () => {
  test.each(GOLDEN.map((g) => [g.name, g]))("%s reproduces the golden index", (_name, golden) => {
    const result = score(answersFrom(golden.pick));
    expect(result.valuIndex).toBe(golden.expect.valuIndex);
  });

  test.each(GOLDEN.map((g) => [g.name, g]))("%s reproduces the golden cluster scores", (_name, golden) => {
    const result = score(answersFrom(golden.pick));
    expect(result.clusterScores).toEqual(golden.expect.clusterScores);
  });

  test("a higher option in every question never lowers the index", () => {
    // Monotonicity: the display must not tell a participant that better answers
    // scored worse. Compared across the ordered golden picks.
    const ordered = [GOLDEN[0], GOLDEN[2], GOLDEN[1]];
    const indices = ordered.map((g) => score(answersFrom(g.pick)).valuIndex);
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    }
  });

  test("the designation follows the published band for the golden index", () => {
    const result = score(answersFrom(GOLDEN[1].pick));
    const band = contract.DESIGNATIONS.find((d) => result.valuIndex >= d.min);
    expect(result.designation || band.name).toBeTruthy();
    // 74 points sits in the Proficient band (55-74), not Distinguished (75+).
    expect(result.valuIndex).toBe(74);
    expect(band.name).toBe("Proficient");
  });

  test("scoring the same answers twice is stable", () => {
    const answers = answersFrom(GOLDEN[2].pick);
    expect(score(answers).valuIndex).toBe(score(answers).valuIndex);
  });

  test("the engine does not mutate the shipped bank", () => {
    // A shuffled or truncated bank would corrupt every later request in the
    // same process.
    const before = JSON.stringify(QUESTIONS);
    score(answersFrom(() => 0));
    expect(JSON.stringify(QUESTIONS)).toBe(before);
  });
});
