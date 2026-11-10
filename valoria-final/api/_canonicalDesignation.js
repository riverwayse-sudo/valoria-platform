import { getDesignation } from '../src/valuV4Contract.js';

/**
 * Resolve the public merit designation from the canonical VALU points contract.
 * Historical database labels are intentionally ignored because they may have
 * been written by legacy scoring versions.
 */
export function canonicalDesignationName(score) {
  const points = Number(score);
  if (!Number.isFinite(points) || points < 0 || points > 100) return null;
  return getDesignation(points)?.name || null;
}
