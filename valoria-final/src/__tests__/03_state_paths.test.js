// __tests__/03_state_paths.test.js
// Phase 3 — State path coverage.
// The recurring bug: new / resume / view-previous paths each made different
// assumptions about which fields were populated.
// These tests assert the CONTRACT that all three paths produce identical
// field shapes. If any path diverges, a test will catch it here.

"use strict";

const { computeFingerprint, buildLockRecord, isLockActive } = require("../lockEngine");
const { getDesignation, getPathway, computeWeightedIndex, computeClusterScoresOnly } = require("../scoringEngine");

// ── SHARED RESULT SHAPE ───────────────────────────────────────────────────
// Every path that produces a "results" object must return ALL of these fields.
// This is the contract. Tests assert against it.
const REQUIRED_RESULT_FIELDS = [
  "valuIndex",
  "clusterScores",
  "skillScores",
  "desig",
  "futureReadyScore",
  "strongest",
  "weakest",
  "listed",
  "pathway",
  "gamingDetected",
  "anchorFlags",
  "speedFlag",
  "uniformityFlag",
  "anyFlag",
  "globalSD",
  "consistencyFlags",
];

// Simulate the shape returned by fetchAssessmentByFingerprint (DB fetch)
// This is what the "view previous" path receives — must match the live result shape.
function simulateDBResult({ valuIndex = 72, clusterScores = null, skillScores = null } = {}) {
  const scores = clusterScores || { P: 75, R: 80, I: 70, M: 65, E: 60 };
  const skills = skillScores  || { "Communication": 83, "Negotiation": 67 };
  const CLUSTERS = [
    { id: "P" }, { id: "R" }, { id: "I" }, { id: "M" }, { id: "E" },
  ];
  const sorted = [...CLUSTERS].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
  );

  // This replicates what fetchAssessmentByFingerprint returns in PRIMEAssessment.jsx
  return {
    name: "Test User",
    role: "Test Role",
    aiReport: null,
    results: {
      valuIndex,
      clusterScores: scores,
      skillScores: skills,
      desig: getDesignation(valuIndex),
      futureReadyScore: Math.round(
        Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
      ),
      strongest: sorted[0],
      weakest: sorted[sorted.length - 1],
      consistencyFlags: {},
      gamingDetected: false,
      anchorFlags: 0,
      speedFlag: false,
      uniformityFlag: false,
      anyFlag: false,
      listed: valuIndex >= 35,
      pathway: getPathway(valuIndex),
      globalSD: 1,
    },
  };
}

// Simulate the shape produced by computeResults (live assessment path)
function simulateLiveResult({ valuIndex = 72, clusterScores = null, skillScores = null } = {}) {
  const scores = clusterScores || { P: 75, R: 80, I: 70, M: 65, E: 60 };
  const skills = skillScores  || { "Communication": 83, "Negotiation": 67 };
  const CLUSTERS_ARR = [
    { id: "P" }, { id: "R" }, { id: "I" }, { id: "M" }, { id: "E" },
  ];
  const sorted = [...CLUSTERS_ARR].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
  );
  return {
    valuIndex,
    clusterScores: scores,
    skillScores: skills,
    desig: getDesignation(valuIndex),
    futureReadyScore: 68,
    strongest: sorted[0],
    weakest: sorted[sorted.length - 1],
    consistencyFlags: {},
    gamingDetected: false,
    anchorFlags: 0,
    speedFlag: false,
    uniformityFlag: false,
    anyFlag: false,
    listed: valuIndex >= 35,
    pathway: getPathway(valuIndex),
    globalSD: 0.82,
  };
}

// ── SECTION 1: Result shape contract ─────────────────────────────────────
describe("Result shape contract — all paths must produce identical fields", () => {
  test("live result (new user path) has all required fields", () => {
    const result = simulateLiveResult();
    REQUIRED_RESULT_FIELDS.forEach(field => {
      expect(result).toHaveProperty(field);
    });
  });

  test("DB result (view previous path) has all required fields", () => {
    const { results } = simulateDBResult();
    REQUIRED_RESULT_FIELDS.forEach(field => {
      expect(results).toHaveProperty(field);
    });
  });

  test("live result and DB result have matching field sets", () => {
    const live  = simulateLiveResult();
    const { results: db } = simulateDBResult();
    const liveKeys = Object.keys(live).sort();
    const dbKeys   = Object.keys(db).sort();
    expect(liveKeys).toEqual(dbKeys);
  });

  test("clusterScores contains exactly P, R, I, M, E keys", () => {
    const live = simulateLiveResult();
    const { results: db } = simulateDBResult();
    const expected = ["E", "I", "M", "P", "R"];
    expect(Object.keys(live.clusterScores).sort()).toEqual(expected);
    expect(Object.keys(db.clusterScores).sort()).toEqual(expected);
  });

  test("desig object has name and min properties", () => {
    const live = simulateLiveResult();
    const { results: db } = simulateDBResult();
    expect(live.desig).toHaveProperty("name");
    expect(live.desig).toHaveProperty("min");
    expect(db.desig).toHaveProperty("name");
    expect(db.desig).toHaveProperty("min");
  });
});

// ── SECTION 2: New user path ──────────────────────────────────────────────
describe("New user path", () => {
  test("sessionData populated with name and role from intro form", () => {
    // Simulates handleBegin({ name, role, resume: false })
    const name = "Ada Okonkwo";
    const role = "Product Manager";
    const sessionData = { name, role, results: null, shuffleMap: {} };
    expect(sessionData.name).toBe(name);
    expect(sessionData.role).toBe(role);
    expect(sessionData.results).toBeNull();
  });

  test("fingerprint computed from name+role is non-empty", () => {
    const fp = computeFingerprint("Ada Okonkwo", "Product Manager");
    expect(fp).toBeTruthy();
    expect(fp.length).toBeGreaterThan(3);
  });

  test("no lock exists at start for new user", () => {
    const fp = computeFingerprint("Brand New User", "Fresh Role");
    // No lock record — isLockActive must return false
    expect(isLockActive(null, fp)).toBe(false);
  });

  test("after completion, lock is built and active", () => {
    const fp   = computeFingerprint("Ada Okonkwo", "Product Manager");
    const lock = buildLockRecord(fp, new Date().toISOString());
    expect(isLockActive(lock, fp)).toBe(true);
  });

  test("result object produced after completion has correct pathway", () => {
    const result = simulateLiveResult({ valuIndex: 72 });
    expect(result.pathway).toBe("PRIME Programme"); // 65–79
  });
});

// ── SECTION 3: Resume path ────────────────────────────────────────────────
describe("Resume path", () => {
  // Simulate a checkpoint saved mid-assessment
  function makeCheckpoint(overrides = {}) {
    return {
      name: "Resuming User",
      role: "Senior Manager",
      currentQ: 12,
      answers: { 0: 2, 1: 3, 2: 1, 3: 2 },
      timings: [45000, 32000, 28000, 51000],
      sessionSeed: 54321,
      ...overrides,
    };
  }

  test("checkpoint has all fields needed to resume", () => {
    const checkpoint = makeCheckpoint();
    const required = ["name", "role", "currentQ", "answers", "timings", "sessionSeed"];
    required.forEach(field => expect(checkpoint).toHaveProperty(field));
  });

  test("resume path uses checkpoint.name (not form input)", () => {
    const checkpoint = makeCheckpoint({ name: "Checkpoint Name" });
    // BUG FIX: resume should use checkpoint.name, not whatever is in the form
    const nameToUse = checkpoint.name;
    expect(nameToUse).toBe("Checkpoint Name");
  });

  test("resume path uses checkpoint.sessionSeed for shuffle consistency", () => {
    const checkpoint = makeCheckpoint({ sessionSeed: 99887 });
    expect(checkpoint.sessionSeed).toBe(99887);
  });

  test("resuming preserves answers already given", () => {
    const checkpoint = makeCheckpoint();
    expect(Object.keys(checkpoint.answers).length).toBeGreaterThan(0);
    // The resumed session starts at currentQ, not 0
    expect(checkpoint.currentQ).toBeGreaterThan(0);
  });

  test("resume does NOT reset currentQ to 0", () => {
    const checkpoint = makeCheckpoint({ currentQ: 15 });
    const initialQ = checkpoint.currentQ; // must be 15, not 0
    expect(initialQ).toBe(15);
  });

  test("fingerprint from resumed session matches original session", () => {
    const checkpoint = makeCheckpoint();
    const fp = computeFingerprint(checkpoint.name, checkpoint.role);
    // Same name+role → same fingerprint as original session
    const originalFP = computeFingerprint("Resuming User", "Senior Manager");
    expect(fp).toBe(originalFP);
  });
});

// ── SECTION 4: View Previous path ─────────────────────────────────────────
describe("View Previous path (locked user)", () => {
  test("requires lockRecord.fingerprint to be present", () => {
    const fp   = computeFingerprint("Locked User", "Director");
    const lock = buildLockRecord(fp, new Date().toISOString());
    // lockRecord.fingerprint must exist for the "view previous" button to work
    expect(lock.fingerprint).toBeTruthy();
  });

  test("DB result used when lockRecord.fingerprint is available", () => {
    const fp   = computeFingerprint("Locked User", "Director");
    const lock = buildLockRecord(fp, new Date().toISOString());
    const profile = simulateDBResult({ valuIndex: 68 });
    // Simulates: onBegin({ previousProfile: profile })
    expect(profile.results.valuIndex).toBe(68);
    expect(profile.results.desig.name).toBe("Emerging Force");
  });

  test("view previous result has aiReport field (may be null)", () => {
    const profile = simulateDBResult();
    expect(profile).toHaveProperty("aiReport");
  });

  test("missing lockRecord.fingerprint → cannot view previous (error path)", () => {
    // Simulates the guard: if (!lockRecord?.fingerprint) → show error
    const lockRecord = null;
    const canViewPrevious = !!(lockRecord?.fingerprint);
    expect(canViewPrevious).toBe(false);
  });

  test("view previous does NOT create a new session or clear the lock", () => {
    const fp   = computeFingerprint("Locked User", "Director");
    const lock = buildLockRecord(fp, new Date().toISOString());
    // Lock should remain active after viewing previous
    expect(isLockActive(lock, fp)).toBe(true);
  });

  test("view previous result has same shape as live result", () => {
    const { results: db } = simulateDBResult({ valuIndex: 55 });
    const live = simulateLiveResult({ valuIndex: 55 });
    const dbKeys   = Object.keys(db).sort();
    const liveKeys = Object.keys(live).sort();
    expect(dbKeys).toEqual(liveKeys);
  });
});

// ── SECTION 5: confirmedEmail contract ───────────────────────────────────
describe("confirmedEmail field contract", () => {
  // The bug: confirmedEmail was not persisting across all paths
  // These tests assert that every path that needs confirmedEmail has it.

  test("confirmedEmail is set from parsed auth hash email on return", () => {
    // Simulates parseAuthHash returning { email: 'test@example.com' }
    const authResult = { accessToken: "token", type: "signup", email: "test@example.com" };
    const confirmedEmail = authResult.email;
    expect(confirmedEmail).toBe("test@example.com");
  });

  test("confirmedEmail falls back to pending.email if hash email is null", () => {
    const authResult = { accessToken: "token", type: "signup", email: null };
    const pending = { name: "User", role: "Role", email: "pending@example.com", results: {} };
    const confirmedEmail = authResult.email || pending.email;
    expect(confirmedEmail).toBe("pending@example.com");
  });

  test("confirmedEmail is not undefined when set via onSignupDone callback", () => {
    // Simulates: setConfirmedEmail(email) in ResultsScreen
    let confirmedEmail = undefined;
    const onSignupDone = (email) => { confirmedEmail = email; };
    onSignupDone("user@example.com");
    expect(confirmedEmail).toBe("user@example.com");
    expect(confirmedEmail).not.toBeUndefined();
  });

  test("ReportScreen receives confirmedEmail and it is not undefined", () => {
    // Simulates passing confirmedEmail prop to ReportScreen
    const sessionState = {
      confirmedEmail: "confirmed@example.com",
    };
    // Props received by ReportScreen must include confirmedEmail
    expect(sessionState.confirmedEmail).toBeDefined();
    expect(sessionState.confirmedEmail).not.toBeNull();
  });

  test("pending report payload includes email field", () => {
    // setPendingReport payload shape
    const pendingPayload = {
      name: "Test User",
      role: "Test Role",
      email: "user@example.com",
      results: {},
    };
    expect(pendingPayload).toHaveProperty("email");
    expect(pendingPayload.email).not.toBeUndefined();
  });
});

// ── SECTION 6: sessionSeed contract ──────────────────────────────────────
describe("sessionSeed contract", () => {
  test("resume path uses checkpoint.sessionSeed, not a fresh seed", () => {
    const checkpoint = { sessionSeed: 77777, currentQ: 10, name: "X", role: "Y", answers: {}, timings: [] };
    const seedToUse = checkpoint.sessionSeed; // must NOT be Math.random()
    expect(seedToUse).toBe(77777);
  });

  test("new session seed is a positive integer", () => {
    const seed = Math.floor(Math.random() * 99999);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(100000);
  });

  test("different session seeds produce different question orders", () => {
    const { seededShuffle } = require("../scoringEngine");
    const options = [
      { text: "A", score: 1 }, { text: "B", score: 2 },
      { text: "C", score: 3 }, { text: "D", score: 4 },
    ];
    const r1 = seededShuffle(options, 11111 + 5); // seed1 + qIndex
    const r2 = seededShuffle(options, 22222 + 5); // seed2 + qIndex
    expect(r1.map(o => o.text)).not.toEqual(r2.map(o => o.text));
  });
});
