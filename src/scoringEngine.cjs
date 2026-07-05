// scoringEngine.js — Single source of truth for all VALU Index scoring.
// This file must stay byte-identical (content, not necessarily extension)
// between valoria-platform (src/scoringEngine.cjs) and valoria-site
// (src/scoringEngine.js). It drifted once already (designation color/bg
// fields existed in one repo but not the other) — if you change scoring
// logic, copy the whole file to the other repo in the same commit/PR.
// Long-term fix: extract to a shared npm package so this can't happen again.

"use strict";

const CLUSTERS = [
  { id: "P", name: "Presence",      weight: 0.20, maxRaw: 36 },
  { id: "R", name: "Relationships", weight: 0.25, maxRaw: 48 },
  { id: "I", name: "Intelligence",  weight: 0.25, maxRaw: 60 },
  { id: "M", name: "Mastery",       weight: 0.20, maxRaw: 36 },
  { id: "E", name: "Enterprise",    weight: 0.10, maxRaw: 36 },
];

const DESIGNATIONS = [
  { min: 80, name: "Force to Align With",      color: "#C9A84C", bg: "rgba(201,168,76,0.08)" },
  { min: 65, name: "Emerging Force",           color: "#378ADD", bg: "rgba(55,138,221,0.08)" },
  { min: 50, name: "Developing Professional",  color: "#7F77DD", bg: "rgba(127,119,221,0.08)" },
  { min: 35, name: "Building Foundations",     color: "#1D9E75", bg: "rgba(29,158,117,0.08)" },
  { min: 0,  name: "At the Starting Point",    color: "#888888", bg: "rgba(136,136,136,0.08)" },
];

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

function computeResults(answers, timings, shuffleMap, questions) {
  const clusterRaw       = { P: 0, R: 0, I: 0, M: 0, E: 0 };
  const clusterAllScores = { P: [], R: [], I: [], M: [], E: [] };
  const skillRaw         = {};

  questions.forEach((q, idx) => {
    if (q.cluster === "VA") return;
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return;
    const originalOption = shuffleMap[idx]
      ? shuffleMap[idx][displayedIdx]
      : q.options[displayedIdx];
    const score = originalOption?.score || 0;
    clusterRaw[q.cluster] += score;
    clusterAllScores[q.cluster].push(score);
    if (q.skill && q.skill !== "Validity") {
      skillRaw[q.skill] = (skillRaw[q.skill] || 0) + score;
    }
  });

  const skillScores = {};
  Object.entries(skillRaw).forEach(([skill, raw]) => {
    skillScores[skill] = Math.round((raw / SKILL_MAX_RAW) * 100);
  });

  const clusterScores = {};
  CLUSTERS.forEach(c => {
    clusterScores[c.id] = Math.round((clusterRaw[c.id] / c.maxRaw) * 100);
  });

  let valuRaw = 0;
  CLUSTERS.forEach(c => { valuRaw += clusterScores[c.id] * c.weight; });
  let valuIndex = Math.round(valuRaw);

  const consistencyFlags = {};
  CLUSTERS.forEach(c => {
    const scores = clusterAllScores[c.id];
    if (scores.length < 2) return;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length);
    if (sd > 1.2) {
      consistencyFlags[c.id] = true;
      clusterScores[c.id] = Math.round(clusterScores[c.id] * 0.85);
    }
  });

  let valuRaw2 = 0;
  CLUSTERS.forEach(c => { valuRaw2 += clusterScores[c.id] * c.weight; });
  valuIndex = Math.round(valuRaw2);

  let anchorFlags = 0;
  questions.forEach((q, idx) => {
    if (!q.validAnchor) return;
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return;
    const originalOption = shuffleMap[idx]
      ? shuffleMap[idx][displayedIdx]
      : q.options[displayedIdx];
    if (originalOption?.score === 1) anchorFlags++;
  });
  const gamingDetected = anchorFlags >= 3;
  if (gamingDetected) valuIndex = Math.round(valuIndex * 0.80);

  const answeredTimings = timings.filter(t => t > 0);
  const totalTime = answeredTimings.reduce((a, b) => a + b, 0);
  const fastAnswers = timings.filter(t => t > 0 && t < 8000).length;
  const speedFlag = totalTime < 720000 || fastAnswers >= 3;

  const allScores = [];
  questions.forEach((q, idx) => {
    if (q.cluster === "VA") return;
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return;
    const originalOption = shuffleMap[idx]
      ? shuffleMap[idx][displayedIdx]
      : q.options[displayedIdx];
    if (originalOption?.score) allScores.push(originalOption.score);
  });
  const globalMean = allScores.reduce((a, b) => a + b, 0) / (allScores.length || 1);
  const globalSD = Math.sqrt(
    allScores.reduce((a, b) => a + (b - globalMean) ** 2, 0) / (allScores.length || 1)
  );
  const uniformityFlag = valuIndex >= 65 && globalSD < 0.5;

  const desig = DESIGNATIONS.find(d => valuIndex >= d.min) || DESIGNATIONS[DESIGNATIONS.length - 1];

  const frQuestions = questions.filter(q => q.futureReady);
  const frRaw = frQuestions.reduce((sum, q) => {
    const idx = questions.indexOf(q);
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return sum;
    const originalOption = shuffleMap[idx]
      ? shuffleMap[idx][displayedIdx]
      : q.options[displayedIdx];
    return sum + (originalOption?.score || 0);
  }, 0);
  const futureReadyScore = frQuestions.length
    ? Math.round((frRaw / (frQuestions.length * 4)) * 100)
    : 0;

  const sorted = [...CLUSTERS].sort((a, b) => clusterScores[b.id] - clusterScores[a.id]);

  return {
    valuIndex,
    clusterScores,
    skillScores,
    desig,
    futureReadyScore,
    strongest: sorted[0],
    weakest: sorted[sorted.length - 1],
    consistencyFlags,
    gamingDetected,
    anchorFlags,
    speedFlag,
    uniformityFlag,
    listed: valuIndex >= 35 && !uniformityFlag,
    pathway:
      valuIndex >= 80 ? "PCP Certification" :
      valuIndex >= 65 ? "PRIME Programme" :
      valuIndex >= 50 ? "PRIME Cluster" :
      "PRIME Sprint",
    anyFlag:
      Object.keys(consistencyFlags).length > 0 ||
      gamingDetected || speedFlag || uniformityFlag,
    globalSD: Math.round(globalSD * 100) / 100,
  };
}

function computeClusterScoresOnly(clusterRaw) {
  const clusterScores = {};
  CLUSTERS.forEach(c => {
    clusterScores[c.id] = Math.round(((clusterRaw[c.id] || 0) / c.maxRaw) * 100);
  });
  return clusterScores;
}

function computeWeightedIndex(clusterScores) {
  let valuRaw = 0;
  CLUSTERS.forEach(c => { valuRaw += (clusterScores[c.id] || 0) * c.weight; });
  return Math.round(valuRaw);
}

function getDesignation(valuIndex) {
  return DESIGNATIONS.find(d => valuIndex >= d.min) || DESIGNATIONS[DESIGNATIONS.length - 1];
}

function getPathway(valuIndex) {
  if (valuIndex >= 80) return "PCP Certification";
  if (valuIndex >= 65) return "PRIME Programme";
  if (valuIndex >= 50) return "PRIME Cluster";
  return "PRIME Sprint";
}

module.exports = {
  CLUSTERS,
  DESIGNATIONS,
  SKILL_MAX_RAW,
  seededShuffle,
  computeResults,
  computeClusterScoresOnly,
  computeWeightedIndex,
  getDesignation,
  getPathway,
};
