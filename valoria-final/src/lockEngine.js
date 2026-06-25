// lockEngine.js — Single source of truth for assessment lock logic.
// Extracted from assessmentLock.js v2.2.
// Covers: fingerprint generation, lock read/write, lock validation.

"use strict";

/**
 * computeFingerprint — deterministic identity hash from name + role.
 * MUST produce identical output to the frontend version in assessmentLock.js.
 */
function computeFingerprint(name, role) {
  const normalized = `${(name || "").trim().toLowerCase()}|${(role || "").trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * isLockActive — returns true only if all three conditions hold:
 *   1. lock has expiresAt
 *   2. lock.fingerprint matches the supplied fingerprint
 *   3. current time is before expiresAt
 *
 * Both arguments are required. Missing either → false.
 */
function isLockActive(lock, fingerprint) {
  if (!lock?.expiresAt || !lock?.fingerprint || !fingerprint) return false;
  if (lock.fingerprint !== fingerprint) return false;
  return new Date() < new Date(lock.expiresAt);
}

/**
 * buildLockRecord — constructs a valid lock object from assessment completion.
 * expiresAt = completedAt + 365 days.
 */
function buildLockRecord(fingerprint, completedAt) {
  const expiry = new Date(completedAt);
  expiry.setFullYear(expiry.getFullYear() + 1);
  return {
    fingerprint,
    completedAt: new Date(completedAt).toISOString(),
    expiresAt: expiry.toISOString(),
  };
}

module.exports = {
  computeFingerprint,
  isLockActive,
  buildLockRecord,
};
