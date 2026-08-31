// VALU v4 canonical contract.
// This module is the single source of truth for score math, designations,
// pathways, and the assessment score threshold used by marketplace eligibility.
// It intentionally does NOT decide listing status: listing is governed separately.

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

export const DESIGNATIONS = Object.freeze([
  Object.freeze({ min: 80, name: "Force to Align With", color: "#C9A84C", bg: "rgba(201,168,76,0.08)" }),
  Object.freeze({ min: 65, name: "Emerging Force", color: "#378ADD", bg: "rgba(55,138,221,0.08)" }),
  Object.freeze({ min: 50, name: "Developing Professional", color: "#7F77DD", bg: "rgba(127,119,221,0.08)" }),
  Object.freeze({ min: 35, name: "Building Foundations", color: "#1D9E75", bg: "rgba(29,158,117,0.08)" }),
  Object.freeze({ min: 0, name: "At the Starting Point", color: "#888888", bg: "rgba(136,136,136,0.08)" }),
]);

export const PATHWAYS = Object.freeze([
  Object.freeze({ min: 80, name: "PCP Certification" }),
  Object.freeze({ min: 65, name: "PRIME Programme" }),
  Object.freeze({ min: 50, name: "PRIME Cluster" }),
  Object.freeze({ min: 0, name: "PRIME Sprint" }),
]);

export function getDesignation(score) {
  return DESIGNATIONS.find(d => score >= d.min) || DESIGNATIONS[DESIGNATIONS.length - 1];
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
