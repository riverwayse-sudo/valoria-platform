// VALU Index v4.1 — canonical 9-question directional taster.
// The snapshot is directional only. Its answers NEVER enter the formal VALU score.
// Question text/options are sourced directly from the canonical question bank.

import { QUESTIONS } from "./questions.js";

export const VALU_VERSION = "4.1";

// Nine-question taster: retain the approved first two Presence/Relationships
// items and the first available canonical item in each remaining PRIME cluster.
// Taster answers remain separate from the formal full-assessment scoring state.
const TASTER_IDS = [
  "P1a","P1b",
  "R1a","R1b",
  "I1a",
  "M1a",
  "E1a",
  "I2a",
  "M1b",
];

const byId = new Map(QUESTIONS.map(q => [q.id, q]));

export const TASTER_QUESTIONS = TASTER_IDS.map(id => {
  const question = byId.get(id);
  if (!question) throw new Error(`Missing canonical taster question: ${id}`);
  return question;
});

export const EXPERIENCE_BANDS = [
  { id:"0-3", label:"0 – 3 years", desc:"Early career" },
  { id:"4-8", label:"4 – 8 years", desc:"Mid career" },
  { id:"9-15", label:"9 – 15 years", desc:"Senior" },
  { id:"15+", label:"15+ years", desc:"Executive / Director" },
];

export function computeTasterResult(answers = {}) {
  const clusterScores = { P:0, R:0, I:0, M:0, E:0 };
  const clusterCounts = { P:0, R:0, I:0, M:0, E:0 };
  const clusterMaxPoints = { P:0, R:0, I:0, M:0, E:0 };

  TASTER_QUESTIONS.forEach((q, idx) => {
    const chosen = answers[idx];
    if (chosen === undefined || !q.options[chosen]) return;
    clusterScores[q.cluster] += q.options[chosen].score;
    clusterCounts[q.cluster]++;
    clusterMaxPoints[q.cluster] += Math.max(...q.options.map(option => Number(option.score) || 0));
  });

  const points = { ...clusterScores };
  const maxPoints = { ...clusterMaxPoints };
  // Points are the display/scoring unit. Do not convert snapshot results to percentages.
  // Derive each dimension's maximum from the canonical question options.
  Object.keys(clusterScores).forEach(id => {
    if (!clusterCounts[id]) {
      points[id] = 0;
      maxPoints[id] = TASTER_QUESTIONS.filter(q => q.cluster === id)
        .reduce((sum, q) => sum + Math.max(...q.options.map(option => Number(option.score) || 0)), 0);
    }
  });

  const clusters = [
    {id:"P",name:"Presence"},{id:"R",name:"Relationships"},{id:"I",name:"Intelligence"},{id:"M",name:"Mastery"},{id:"E",name:"Enterprise"}
  ];
  const order = Object.fromEntries(clusters.map((cluster, index) => [cluster.id, index]));
  const strongest = [...clusters].sort((a,b) => (points[b.id] - points[a.id]) || (order[a.id] - order[b.id]))[0];
  const weakest = [...clusters].sort((a,b) => (points[a.id] - points[b.id]) || (order[a.id] - order[b.id]))[0];

  return {
    points,
    maxPoints,
    strongest,
    weakest,
    completedQuestions: Object.keys(answers).length,
  };
}
