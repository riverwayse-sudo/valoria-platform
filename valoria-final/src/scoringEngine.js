import {
  CLUSTERS,
  DESIGNATIONS,
  getDesignation,
  getPathway,
  isMarketplaceScoreEligible,
  MARKETPLACE_SCORE_THRESHOLD,
  VALU_VERSION,
} from "./valuV4Contract.js";

export { CLUSTERS, DESIGNATIONS, MARKETPLACE_SCORE_THRESHOLD, VALU_VERSION };

const SKILL_MAX_RAW = 12;

function seededShuffle(arr, seed) {
  const result = [...arr];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function optionForAnswer(question, idx, shuffleMap) {
  if (idx === undefined || idx === null) return null;
  const displayedOptions = shuffleMap?.[question.index];
  return displayedOptions ? displayedOptions[idx] : question.options[idx];
}

function computeClusterScoresOnly(clusterRaw) {
  const clusterScores = {};
  CLUSTERS.forEach(c => {
    const raw = Math.max(0, Math.min(c.maxRaw, clusterRaw[c.id] || 0));
    clusterScores[c.id] = Math.round((raw / c.maxRaw) * 100);
  });
  return clusterScores;
}

function computeWeightedIndex(clusterScores) {
  const weighted = CLUSTERS.reduce(
    (sum, cluster) => sum + (clusterScores[cluster.id] || 0) * cluster.weight,
    0
  );
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

/**
 * Canonical VALU v4 score contract:
 * 1. Each PRIME cluster is normalised independently against its canonical maxRaw.
 * 2. The five normalised cluster scores are combined using canonical weights.
 * 3. The weighted result is rounded once to the final 0–100 VALU Index.
 * 4. Integrity signals (consistency, speed, anchors, uniformity) are diagnostics;
 *    they never silently mutate the published score. Governance may use them for
 *    review or a separate validity decision.
 * 5. Marketplace score eligibility is only the 35-point threshold. It is NOT the
 *    same thing as listing status, profile completeness, verification, or availability.
 */
function computeResults(answers, timings = [], shuffleMap = {}, questions) {
  if (!Array.isArray(questions)) throw new TypeError("VALU scoring requires the canonical question bank.");

  const indexedQuestions = questions.map((q, index) => ({ ...q, index }));
  const clusterRaw = { P: 0, R: 0, I: 0, M: 0, E: 0 };
  const clusterAllScores = { P: [], R: [], I: [], M: [], E: [] };
  const skillRaw = {};

  indexedQuestions.forEach(q => {
    if (q.cluster === "VA") return;
    const displayedIdx = answers?.[q.index];
    if (displayedIdx === undefined) return;
    const originalOption = optionForAnswer(q, displayedIdx, shuffleMap);
    const score = Number(originalOption?.score) || 0;
    clusterRaw[q.cluster] += score;
    clusterAllScores[q.cluster].push(score);
    if (q.skill && q.skill !== "Validity") {
      skillRaw[q.skill] = (skillRaw[q.skill] || 0) + score;
    }
  });

  const skillScores = {};
  Object.entries(skillRaw).forEach(([skill, raw]) => {
    skillScores[skill] = Math.round((Math.min(SKILL_MAX_RAW, raw) / SKILL_MAX_RAW) * 100);
  });

  const clusterScores = computeClusterScoresOnly(clusterRaw);
  const valuIndex = computeWeightedIndex(clusterScores);

  // Integrity diagnostics are deliberately separated from score calculation.
  const consistencyFlags = {};
  CLUSTERS.forEach(c => {
    const scores = clusterAllScores[c.id];
    if (scores.length < 2) return;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
    const sd = Math.sqrt(variance);
    if (sd > 1.2) consistencyFlags[c.id] = true;
  });

  let anchorFlags = 0;
  indexedQuestions.forEach(q => {
    if (!q.validAnchor) return;
    const displayedIdx = answers?.[q.index];
    if (displayedIdx === undefined) return;
    const originalOption = optionForAnswer(q, displayedIdx, shuffleMap);
    if (originalOption?.score === 1) anchorFlags++;
  });
  const gamingDetected = anchorFlags >= 3;

  const answeredTimings = Array.isArray(timings) ? timings.filter(t => Number.isFinite(t) && t > 0) : [];
  const totalTime = answeredTimings.reduce((a, b) => a + b, 0);
  const fastAnswers = answeredTimings.filter(t => t < 8000).length;
  const speedFlag = totalTime < 720000 || fastAnswers >= 3;

  const allScores = [];
  indexedQuestions.forEach(q => {
    if (q.cluster === "VA") return;
    const displayedIdx = answers?.[q.index];
    if (displayedIdx === undefined) return;
    const originalOption = optionForAnswer(q, displayedIdx, shuffleMap);
    if (originalOption?.score) allScores.push(originalOption.score);
  });
  const globalMean = allScores.reduce((a, b) => a + b, 0) / (allScores.length || 1);
  const globalSD = Math.sqrt(
    allScores.reduce((a, b) => a + (b - globalMean) ** 2, 0) / (allScores.length || 1)
  );
  const uniformityFlag = valuIndex >= 65 && globalSD < 0.5;

  const futureReadyQuestions = indexedQuestions.filter(q => q.futureReady);
  const frRaw = futureReadyQuestions.reduce((sum, q) => {
    const displayedIdx = answers?.[q.index];
    if (displayedIdx === undefined) return sum;
    const originalOption = optionForAnswer(q, displayedIdx, shuffleMap);
    return sum + (Number(originalOption?.score) || 0);
  }, 0);
  const futureReadyScore = futureReadyQuestions.length
    ? Math.round((frRaw / (futureReadyQuestions.length * 4)) * 100)
    : 0;

  const sorted = [...CLUSTERS].sort((a, b) => clusterScores[b.id] - clusterScores[a.id]);
  const scoreEligibleForMarketplace = isMarketplaceScoreEligible(valuIndex);

  return {
    valuVersion: VALU_VERSION,
    valuIndex,
    clusterScores,
    skillScores,
    desig: getDesignation(valuIndex),
    futureReadyScore,
    strongest: sorted[0],
    weakest: sorted[sorted.length - 1],
    consistencyFlags,
    gamingDetected,
    anchorFlags,
    speedFlag,
    uniformityFlag,
    scoreEligibleForMarketplace,
    marketplaceScoreThreshold: MARKETPLACE_SCORE_THRESHOLD,
    // Deprecated compatibility field: this means score eligibility only.
    // It must not be treated as actual marketplace listing state.
    listed: scoreEligibleForMarketplace,
    pathway: getPathway(valuIndex),
    anyFlag:
      Object.keys(consistencyFlags).length > 0 ||
      gamingDetected ||
      speedFlag ||
      uniformityFlag,
    globalSD: Math.round(globalSD * 100) / 100,
  };
}

export {
  SKILL_MAX_RAW,
  seededShuffle,
  computeResults,
  computeClusterScoresOnly,
  computeWeightedIndex,
  getDesignation,
  getPathway,
  isMarketplaceScoreEligible,
};
