// VALU Index v4 — canonical 15-question directional snapshot.
// The snapshot is directional only. Its answers NEVER enter the formal VALU score.
// Question text/options are sourced directly from the canonical question bank.

import { QUESTIONS } from "./questions.js";

export const VALU_VERSION = "4.0";

const TASTER_IDS = [
  "P1a","P1b","P2a",
  "R1a","R1b","R4a",
  "I1a","I2a","I3b",
  "M1a","M1b","M2b",
  "E1a","E1b","E2a",
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

  TASTER_QUESTIONS.forEach((q, idx) => {
    const chosen = answers[idx];
    if (chosen === undefined || !q.options[chosen]) return;
    clusterScores[q.cluster] += q.options[chosen].score;
    clusterCounts[q.cluster]++;
  });

  const normalisedScores = {};
  Object.keys(clusterScores).forEach(id => {
    const count = clusterCounts[id] || 1;
    normalisedScores[id] = Math.round((clusterScores[id] / (count * 4)) * 100);
  });

  const clusters = [
    {id:"P",name:"Presence"},{id:"R",name:"Relationships"},{id:"I",name:"Intelligence"},{id:"M",name:"Mastery"},{id:"E",name:"Enterprise"}
  ];
  const order = Object.fromEntries(clusters.map((cluster, index) => [cluster.id, index]));
  const strongest = [...clusters].sort((a,b) => (normalisedScores[b.id] - normalisedScores[a.id]) || (order[a.id] - order[b.id]))[0];
  const weakest = [...clusters].sort((a,b) => (normalisedScores[a.id] - normalisedScores[b.id]) || (order[a.id] - order[b.id]))[0];

  return {
    normalisedScores,
    strongest,
    weakest,
    completedQuestions: Object.keys(answers).length,
  };
}
