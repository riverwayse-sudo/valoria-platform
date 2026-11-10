// Compatibility only for already-started v4.1 sessions.
// New registrations must use the independent v4.2 Intelligence taster.
import { QUESTIONS } from "./questions.js";

export const LEGACY_TASTER_VERSION = "4.1";

const TASTER_IDS = [
  "P1b", "R1a", "R4a",
  "I2a", "I3b",
  "M1b", "M2b",
  "E2a", "E1a",
];

const byId = new Map(QUESTIONS.map(question => [question.id, question]));

export const LEGACY_TASTER_QUESTIONS = TASTER_IDS.map(id => {
  const question = byId.get(id);
  if (!question) throw new Error(`Missing v4.1 legacy taster question: ${id}`);
  return question;
});

export function computeLegacyTasterResult(answers = {}) {
  const clusterScores = { P: 0, R: 0, I: 0, M: 0, E: 0 };
  const clusterCounts = { P: 0, R: 0, I: 0, M: 0, E: 0 };
  const clusterMaxPoints = { P: 0, R: 0, I: 0, M: 0, E: 0 };

  LEGACY_TASTER_QUESTIONS.forEach((question, index) => {
    const selected = answers[index];
    if (!Number.isInteger(selected) || !question.options[selected]) return;
    clusterScores[question.cluster] += question.options[selected].score;
    clusterCounts[question.cluster] += 1;
    clusterMaxPoints[question.cluster] += Math.max(
      ...question.options.map(option => Number(option.score) || 0),
    );
  });

  const points = { ...clusterScores };
  const maxPoints = { ...clusterMaxPoints };
  Object.keys(clusterScores).forEach(id => {
    if (!clusterCounts[id]) {
      points[id] = 0;
      maxPoints[id] = LEGACY_TASTER_QUESTIONS
        .filter(question => question.cluster === id)
        .reduce((sum, question) => sum + Math.max(
          ...question.options.map(option => Number(option.score) || 0),
        ), 0);
    }
  });

  const clusters = [
    { id: "P", name: "Presence" },
    { id: "R", name: "Relationships" },
    { id: "I", name: "Intelligence" },
    { id: "M", name: "Mastery" },
    { id: "E", name: "Enterprise" },
  ];
  const order = Object.fromEntries(clusters.map((cluster, index) => [cluster.id, index]));
  const strongest = [...clusters].sort(
    (a, b) => (points[b.id] - points[a.id]) || (order[a.id] - order[b.id]),
  )[0];
  const weakest = [...clusters].sort(
    (a, b) => (points[a.id] - points[b.id]) || (order[a.id] - order[b.id]),
  )[0];

  return {
    points,
    maxPoints,
    strongest,
    weakest,
    completedQuestions: Object.keys(answers).length,
  };
}
