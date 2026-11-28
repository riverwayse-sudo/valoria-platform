// VALU v4 canonical contract.
// Governed by Valoria Institute Brand Guidelines VI-BG-2026-001.

export const VALU_VERSION = 4;
export const MAX_SCORE = 100;
export const MARKETPLACE_SCORE_THRESHOLD = 35;

export const CLUSTERS = Object.freeze([
  Object.freeze({ id: "P", name: "Presence", weight: 0.20, maxRaw: 36 }),
  Object.freeze({ id: "R", name: "Relationships", weight: 0.25, maxRaw: 48 }),
  Object.freeze({ id: "I", name: "Intelligence", weight: 0.25, maxRaw: 60 }),
  Object.freeze({ id: "M", name: "Mastery", weight: 0.20, maxRaw: 36 }),
  Object.freeze({ id: "E", name: "Enterprise", weight: 0.10, maxRaw: 36 }),
]);

// Merit designations are score-based, not certifications or paid subscription tiers.
// The lowest band is a designation, but does not meet the separate 35-point listing threshold.
export const DESIGNATIONS = Object.freeze([
  Object.freeze({ min: 80, name: "Force to Align With", stars: "✦✦✦", color: "#1A1A2E", bg: "#C9A84C" }),
  Object.freeze({ min: 65, name: "Emerging Force", stars: "✦✦", color: "#C9A84C", bg: "#1A1A2E" }),
  Object.freeze({ min: 50, name: "Developing Professional", stars: "✦", color: "#2E2E4A", bg: "#EDE8DC" }),
  Object.freeze({ min: 35, name: "Building Foundations", stars: "", color: "#2E2E4A", bg: "#F7F4EE" }),
  Object.freeze({ min: 0, name: "At the Starting Point", stars: "", color: "#2E2E4A", bg: "#EDE8DC" }),
]);

// Development pathways are separate from merit designations.
export const PATHWAYS = Object.freeze([
  Object.freeze({ min: 75, name: "Advanced Development Pathway" }),
  Object.freeze({ min: 55, name: "Cluster Development Pathway" }),
  Object.freeze({ min: 35, name: "Foundation Development Pathway" }),
  Object.freeze({ min: 0, name: "Assessment Follow-up Pathway" }),
]);

export function getDesignation(score) {
  if (score == null || typeof score === "boolean" || (typeof score === "string" && score.trim() === "")) return null;
  const points = Number(score);
  if (!Number.isFinite(points) || points < 0 || points > MAX_SCORE) return null;
  return DESIGNATIONS.find(d => points >= d.min) || null;
}

export function getPathway(score) {
  return PATHWAYS.find(p => score >= p.min)?.name || PATHWAYS[PATHWAYS.length - 1].name;
}

export function isMarketplaceScoreEligible(score) {
  return Number.isFinite(score) && score >= MARKETPLACE_SCORE_THRESHOLD;
}

export function assertCanonicalWeights() {
  const total = CLUSTERS.reduce((sum, cluster) => sum + cluster.weight, 0);
  if (Math.abs(total - 1) > Number.EPSILON) {
    throw new Error(`Invalid VALU v${VALU_VERSION} cluster weights: expected 1, got ${total}`);
  }
}

assertCanonicalWeights();
