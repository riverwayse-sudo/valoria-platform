// __tests__/02_lock_engine.test.js
// Phase 2 — Lock engine unit tests.
// Covers: fingerprint determinism, isLockActive all paths, buildLockRecord.

"use strict";

const {
  computeFingerprint,
  isLockActive,
  buildLockRecord,
} = require("../lockEngine");

// ── SECTION 1: computeFingerprint ─────────────────────────────────────────
describe("computeFingerprint", () => {
  test("same name + role always produces same fingerprint", () => {
    const fp1 = computeFingerprint("Femi Akintola", "Head of Growth");
    const fp2 = computeFingerprint("Femi Akintola", "Head of Growth");
    expect(fp1).toBe(fp2);
  });

  test("fingerprint starts with 'fp_'", () => {
    expect(computeFingerprint("Ada Obi", "Engineer")).toMatch(/^fp_/);
  });

  test("different names produce different fingerprints", () => {
    const fp1 = computeFingerprint("Ada Obi", "Engineer");
    const fp2 = computeFingerprint("Kemi Bello", "Engineer");
    expect(fp1).not.toBe(fp2);
  });

  test("different roles produce different fingerprints", () => {
    const fp1 = computeFingerprint("Ada Obi", "Engineer");
    const fp2 = computeFingerprint("Ada Obi", "Director");
    expect(fp1).not.toBe(fp2);
  });

  test("case-insensitive: 'FEMI' and 'femi' produce same fingerprint", () => {
    const fp1 = computeFingerprint("FEMI", "Director");
    const fp2 = computeFingerprint("femi", "Director");
    expect(fp1).toBe(fp2);
  });

  test("leading/trailing whitespace is ignored", () => {
    const fp1 = computeFingerprint("  Femi  ", "  Director  ");
    const fp2 = computeFingerprint("Femi", "Director");
    expect(fp1).toBe(fp2);
  });

  test("empty name + role produces a fingerprint without crashing", () => {
    const fp = computeFingerprint("", "");
    expect(typeof fp).toBe("string");
    expect(fp).toMatch(/^fp_/);
  });

  test("null inputs produce a fingerprint without crashing", () => {
    const fp = computeFingerprint(null, null);
    expect(typeof fp).toBe("string");
  });

  test("fingerprint is stable across calls (not time-dependent)", () => {
    const fp1 = computeFingerprint("Temitayo", "Founder");
    const fp2 = computeFingerprint("Temitayo", "Founder");
    const fp3 = computeFingerprint("Temitayo", "Founder");
    expect(fp1).toBe(fp2);
    expect(fp2).toBe(fp3);
  });
});

// ── SECTION 2: isLockActive ────────────────────────────────────────────────
describe("isLockActive", () => {
  const FUTURE  = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const PAST    = new Date(Date.now() - 1000).toISOString();
  const FP      = computeFingerprint("Test User", "Test Role");

  const validLock = {
    fingerprint: FP,
    expiresAt: FUTURE,
    completedAt: new Date().toISOString(),
  };

  test("valid lock + matching fingerprint → true", () => {
    expect(isLockActive(validLock, FP)).toBe(true);
  });

  test("expired lock → false even if fingerprint matches", () => {
    const expired = { ...validLock, expiresAt: PAST };
    expect(isLockActive(expired, FP)).toBe(false);
  });

  test("wrong fingerprint → false even if not expired", () => {
    const wrongFP = computeFingerprint("Different User", "Different Role");
    expect(isLockActive(validLock, wrongFP)).toBe(false);
  });

  test("null lock → false", () => {
    expect(isLockActive(null, FP)).toBe(false);
  });

  test("undefined lock → false", () => {
    expect(isLockActive(undefined, FP)).toBe(false);
  });

  test("null fingerprint argument → false", () => {
    expect(isLockActive(validLock, null)).toBe(false);
  });

  test("undefined fingerprint argument → false", () => {
    expect(isLockActive(validLock, undefined)).toBe(false);
  });

  test("lock missing expiresAt → false", () => {
    const noExpiry = { fingerprint: FP, completedAt: new Date().toISOString() };
    expect(isLockActive(noExpiry, FP)).toBe(false);
  });

  test("lock missing fingerprint → false", () => {
    const noFP = { expiresAt: FUTURE, completedAt: new Date().toISOString() };
    expect(isLockActive(noFP, FP)).toBe(false);
  });

  test("empty object lock → false", () => {
    expect(isLockActive({}, FP)).toBe(false);
  });

  test("lock expiring exactly now is treated as expired", () => {
    // expiresAt set to 1ms ago
    const justExpired = {
      ...validLock,
      expiresAt: new Date(Date.now() - 1).toISOString(),
    };
    expect(isLockActive(justExpired, FP)).toBe(false);
  });

  // ── THE BUG THIS FIXES ────────────────────────────────────────────────
  // In v2.1, isLockActive was called as isLockActive(assessmentLockRecord)
  // with only one argument — fingerprint was always undefined → always false.
  // This test pins the correct two-argument contract forever.
  test("REGRESSION: called with one argument (old bug) → always false", () => {
    expect(isLockActive(validLock)).toBe(false);
  });

  test("REGRESSION: lock fingerprint must match supplied fingerprint (not just exist)", () => {
    const differentUserFP = computeFingerprint("Someone Else", "Other Role");
    const lockForDifferentUser = {
      fingerprint: differentUserFP,
      expiresAt: FUTURE,
      completedAt: new Date().toISOString(),
    };
    // Lock exists and is valid — but for a different identity
    expect(isLockActive(lockForDifferentUser, FP)).toBe(false);
  });
});

// ── SECTION 3: buildLockRecord ────────────────────────────────────────────
describe("buildLockRecord", () => {
  const FP = computeFingerprint("Femi", "Founder");
  const NOW = new Date().toISOString();

  test("returns object with fingerprint, completedAt, expiresAt", () => {
    const lock = buildLockRecord(FP, NOW);
    expect(lock).toHaveProperty("fingerprint", FP);
    expect(lock).toHaveProperty("completedAt");
    expect(lock).toHaveProperty("expiresAt");
  });

  test("expiresAt is exactly 1 year after completedAt", () => {
    const completed = new Date("2025-01-15T10:00:00.000Z");
    const lock = buildLockRecord(FP, completed.toISOString());
    const expiry = new Date(lock.expiresAt);
    expect(expiry.getFullYear()).toBe(2026);
    expect(expiry.getMonth()).toBe(0);  // January
    expect(expiry.getDate()).toBe(15);
  });

  test("isLockActive returns true for freshly built lock", () => {
    const lock = buildLockRecord(FP, NOW);
    expect(isLockActive(lock, FP)).toBe(true);
  });

  test("isLockActive returns false for lock built 1 year ago", () => {
    const yearAgo = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString();
    const lock = buildLockRecord(FP, yearAgo);
    expect(isLockActive(lock, FP)).toBe(false);
  });
});

// ── SECTION 4: fingerprint ↔ lock round-trip ──────────────────────────────
describe("fingerprint + lock round-trip", () => {
  test("complete flow: name+role → fingerprint → lock → isLockActive", () => {
    const name = "Busola Emmanuel";
    const role = "Executive Director";
    const fp   = computeFingerprint(name, role);
    const lock = buildLockRecord(fp, new Date().toISOString());
    expect(isLockActive(lock, fp)).toBe(true);
  });

  test("different user cannot unlock another user's lock", () => {
    const fp1 = computeFingerprint("User A", "Role A");
    const fp2 = computeFingerprint("User B", "Role B");
    const lockForUser1 = buildLockRecord(fp1, new Date().toISOString());
    expect(isLockActive(lockForUser1, fp2)).toBe(false);
  });

  test("name change (same role) results in different fingerprint = different lock", () => {
    const fp1 = computeFingerprint("Femi Akintola", "Founder");
    const fp2 = computeFingerprint("Oluwafemi Akintola", "Founder");
    expect(fp1).not.toBe(fp2);
    const lock = buildLockRecord(fp1, new Date().toISOString());
    // Lock built for fp1 does NOT cover fp2
    expect(isLockActive(lock, fp2)).toBe(false);
  });
});
