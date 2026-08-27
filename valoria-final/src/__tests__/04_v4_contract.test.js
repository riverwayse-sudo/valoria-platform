"use strict";

const {
  CLUSTERS,
  MARKETPLACE_SCORE_THRESHOLD,
  getDesignation,
  getPathway,
  isMarketplaceScoreEligible,
} = require("../valuV4Contract");
const { computeResults, computeWeightedIndex } = require("../scoringEngine");

function makeQuestion(id, cluster, validAnchor = false) {
  return {
    id,
    cluster,
    skill: validAnchor ? "Validity" : `${cluster}-skill`,
    validAnchor,
    futureReady: false,
    options: [
      { text: "A", score: 1 },
      { text: "B", score: 2 },
      { text: "C", score: 3 },
      { text: "D", score: 4 },
    ],
  };
}

const QUESTIONS = [
  ...CLUSTERS.flatMap(cluster => Array.from({ length: cluster.maxRaw / 4 }, (_, i) => makeQuestion(`${cluster.id}${i}`, cluster.id))),
  makeQuestion("VA1", "VA", true),
  makeQuestion("VA2", "VA", true),
  makeQuestion("VA3", "VA", true),
];

function answersForScore(index) {
  return Object.fromEntries(QUESTIONS.map((q, i) => [i, q.cluster === "VA" ? 0 : index]));
}

describe("VALU v4 canonical contract", () => {
  test("cluster weights sum to exactly 1", () => {
    expect(CLUSTERS.reduce((sum, c) => sum + c.weight, 0)).toBeCloseTo(1, 10);
  });

  test("35 is the marketplace score threshold boundary", () => {
    expect(MARKETPLACE_SCORE_THRESHOLD).toBe(35);
    expect(isMarketplaceScoreEligible(34)).toBe(false);
    expect(isMarketplaceScoreEligible(35)).toBe(true);
    expect(isMarketplaceScoreEligible(36)).toBe(true);
  });

  test("designation and pathway boundaries remain canonical", () => {
    expect(getDesignation(34).name).toBe("At the Starting Point");
    expect(getDesignation(35).name).toBe("Building Foundations");
    expect(getDesignation(65).name).toBe("Emerging Force");
    expect(getDesignation(80).name).toBe("Force to Align With");
    expect(getPathway(49)).toBe("PRIME Sprint");
    expect(getPathway(50)).toBe("PRIME Cluster");
    expect(getPathway(65)).toBe("PRIME Programme");
    expect(getPathway(80)).toBe("PCP Certification");
  });

  test("weighted index is the only score aggregation step", () => {
    expect(computeWeightedIndex({ P: 80, R: 60, I: 70, M: 90, E: 50 })).toBe(72);
  });

  test("integrity flags do not mutate the canonical score", () => {
    const answers = answersForScore(3);
    // Force all three validity anchors to the lowest option to trigger gamingDetected.
    answers[QUESTIONS.length - 3] = 0;
    answers[QUESTIONS.length - 2] = 0;
    answers[QUESTIONS.length - 1] = 0;
    const timings = Array(QUESTIONS.length).fill(60000);
    const result = computeResults(answers, timings, {}, QUESTIONS);

    expect(result.gamingDetected).toBe(true);
    expect(result.valuIndex).toBe(100);
    expect(result.scoreEligibleForMarketplace).toBe(true);
  });
});
