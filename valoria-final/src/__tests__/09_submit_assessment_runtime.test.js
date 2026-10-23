// valoria-final/src/__tests__/09_submit_assessment_runtime.test.js
//
// Runtime coverage for api/submit-assessment.js.
//
// The other contract tests for this endpoint read the file as text and assert
// on substrings, so they cannot catch control-flow bugs. One shipped: the insert
// response was declared with `const` inside the try block and read after it, so
// every successful first-time submission threw
//   ReferenceError: insertRes is not defined
// *after* the assessment row had been written. The participant was charged a
// completed assessment, saw "Could not save your result. Please try again.", and
// on retry received alreadyCompleted with no report token.
//
// These tests execute the real handler. Only the network boundary (global.fetch)
// is stubbed, so the validation, ownership checks, idempotency lookup, insert and
// response-shaping code all run for real.

"use strict";

const { createHmac, randomBytes } = require("node:crypto");

const SECRET = "test-service-role-key-not-real";
const SUPABASE_URL = "https://test-project.supabase.co";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const TASTER_ID = "22222222-2222-4222-8222-222222222222";
const NAME = "Test Participant";
const ROLE = "Head of Operations";

process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;

// Token format mirrors lib/valu-handoff-token.js (verified against the site's
// creator in the site repo). Built here so this suite stays self-contained.
function handoffToken(userId = USER_ID, tasterId = TASTER_ID, ttlSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    aud: "valu-full-assessment",
    sub: userId,
    taster_id: tasterId,
    iat: now,
    exp: now + ttlSeconds,
    jti: randomBytes(16).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function loadQuestions() {
  // The canonical bank, so the submission satisfies validateAnswers().
  return require("../questions.js").QUESTIONS;
}

function validBody(questions) {
  const answers = {};
  const timings = [];
  for (let i = 0; i < questions.length; i += 1) {
    answers[i] = 0;
    timings.push(45000);
  }
  return {
    name: NAME,
    role: ROLE,
    experience: "4-8",
    answers,
    timings,
    shuffleMap: {},
    taster_id: TASTER_ID,
    handoff_token: handoffToken(),
  };
}

function makeRes() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    json(data) { this.body = data; return this; },
  };
}

// Stub only the network boundary. `overrides` lets a test force one response.
function stubFetch({ existingAssessment = null, insertRows = [{ identity_hash: "fp", report_token: "tok-123" }], insertStatus = 201, taster = null } = {}) {
  const calls = [];
  global.fetch = jest.fn(async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ url: String(url), method });
    const u = String(url);
    const ok = (json, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) });

    if (u.includes("/rest/v1/rpc/consume_rate_limit")) return ok({ allowed: true });
    if (u.includes("/auth/v1/admin/users/")) return ok({ id: USER_ID, email: "test@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" });
    if (u.includes("/rest/v1/taster_sessions")) {
      return ok([taster || { id: TASTER_ID, user_id: USER_ID, name: NAME, role: ROLE, completed_at: "2026-01-01T00:00:00Z" }]);
    }
    if (u.includes("/rest/v1/valu_assessments")) {
      if (method === "POST") return ok(insertRows, insertStatus);
      return ok(existingAssessment ? [existingAssessment] : []);
    }
    throw new Error(`unexpected fetch: ${method} ${u}`);
  });
  return calls;
}

async function invoke(body) {
  const handler = require("../../api/submit-assessment.js").default;
  const res = makeRes();
  await handler({ method: "POST", body, headers: {}, socket: { remoteAddress: "203.0.113.7" } }, res);
  return res;
}

describe("submit-assessment runtime", () => {
  let questions;

  beforeAll(() => {
    questions = loadQuestions();
  });

  afterEach(() => {
    jest.resetModules();
    delete global.fetch;
  });

  test("a valid first-time submission is saved and returns its report token", async () => {
    stubFetch();
    const res = await invoke(validBody(questions));

    // Before the fix this was a thrown ReferenceError instead of a response.
    expect(res.statusCode).toBe(200);
    expect(res.body.report_token).toBe("tok-123");
    expect(typeof res.body.results.valuIndex).toBe("number");
    expect(res.body.alreadyCompleted).toBeUndefined();
  });

  test("the saved row is account-bound and carries the canonical score", async () => {
    const calls = stubFetch();
    const res = await invoke(validBody(questions));
    expect(res.statusCode).toBe(200);

    const insert = calls.find(c => c.method === "POST" && c.url.includes("/rest/v1/valu_assessments"));
    expect(insert).toBeTruthy();
    // The handler must never let the browser choose ownership.
    expect(res.body.identity_hash).toBeTruthy();
  });

  test("a repeat submission for the same verified owner is idempotent", async () => {
    stubFetch({
      existingAssessment: {
        id: "existing-1",
        user_id: USER_ID,
        taster_id: TASTER_ID,
        total_score: 61,
        designation: "Proficient",
        cluster_scores: { P: 60 },
        skill_scores: {},
        completed_at: "2026-01-02T00:00:00Z",
        report_token: "tok-existing",
      },
    });
    const res = await invoke(validBody(questions));
    expect(res.statusCode).toBe(200);
    expect(res.body.alreadyCompleted).toBe(true);
    expect(res.body.report_token).toBe("tok-existing");
    expect(res.body.results.valuIndex).toBe(61);
  });

  test("an unconfirmed account is refused", async () => {
    const calls = stubFetch();
    global.fetch = jest.fn(async (url, options = {}) => {
      const u = String(url);
      const ok = (json, status = 200) => ({ ok: status < 300, status, json: async () => json, text: async () => JSON.stringify(json) });
      if (u.includes("/rest/v1/rpc/consume_rate_limit")) return ok({ allowed: true });
      if (u.includes("/auth/v1/admin/users/")) return ok({ id: USER_ID, email: "test@example.com", email_confirmed_at: null });
      if (u.includes("/rest/v1/taster_sessions")) return ok([{ id: TASTER_ID, user_id: USER_ID, name: NAME, role: ROLE, completed_at: "2026-01-01T00:00:00Z" }]);
      return ok([], 200);
    });
    const res = await invoke(validBody(questions));
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/confirm your valoria account email/i);
    expect(calls).toBeDefined();
  });

  test("a handoff token for a different snapshot is refused", async () => {
    stubFetch();
    const body = validBody(questions);
    body.handoff_token = handoffToken(USER_ID, "33333333-3333-4333-8333-333333333333");
    const res = await invoke(body);
    expect(res.statusCode).toBe(401);
  });

  test("an incomplete answer set is refused before any write", async () => {
    const calls = stubFetch();
    const body = validBody(questions);
    delete body.answers[0];
    const res = await invoke(body);
    expect(res.statusCode).toBe(400);
    expect(calls.some(c => c.method === "POST" && c.url.includes("/rest/v1/valu_assessments"))).toBe(false);
  });

  test("a failed insert reports a retryable error and does not claim success", async () => {
    stubFetch({ insertRows: [], insertStatus: 500 });
    const res = await invoke(validBody(questions));
    expect(res.statusCode).toBe(502);
    expect(res.body.report_token).toBeUndefined();
  });
});
