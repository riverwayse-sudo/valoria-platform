// valoria-final/src/__tests__/13_link_assessment_runtime.test.js
//
// Runtime coverage for api/link-assessment-to-taster.js, which attaches a
// completed full assessment to a verified account. It changes ownership
// (user_id/taster_id) and writes the identity audit record, so a wrong answer
// here transfers a participant's record.
//
// It was covered only by substring assertions. Executing the real handler
// confirms the guards hold, and pins them. The interesting properties are that
// ownership can only be taken when the row is unowned or already the caller's,
// that the audit link is never overwritten, and that an unconfirmed email blocks
// the link entirely.

"use strict";

const { createHmac, randomBytes } = require("node:crypto");

const SECRET = "test-service-role-key-not-real";
const SUPABASE_URL = "https://testprojectref000000.supabase.co";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";
const TASTER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_TASTER_ID = "55555555-5555-4555-8555-555555555555";
const ASSESSMENT_ID = "44444444-4444-4444-8444-444444444444";
const IDENTITY = "fp_abc123";
const NAME = "Test Participant";
const ROLE = "Head of Operations";

// The environment guard requires the target project to be positively
// identified. This suite runs off Vercel, so it opts in to local writes and
// declares the project the stubbed URL points at.
process.env.ALLOW_LOCAL_PRIVILEGED_WRITES = "true";
process.env.STAGING_SUPABASE_PROJECT_REF = "testprojectref000000";
process.env.PRODUCTION_SUPABASE_PROJECT_REF = "prodprojectref000000";
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;

function handoffToken({ sub = USER_ID, tasterId = TASTER_ID, ttlSeconds = 3600, secret = SECRET } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { v: 1, aud: "valu-full-assessment", sub, taster_id: tasterId, iat: now, exp: now + ttlSeconds, jti: randomBytes(16).toString("base64url") };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function makeRes() {
  return {
    statusCode: null, headers: {}, body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    json(data) { this.body = data; return this; },
  };
}

function assessment(overrides = {}) {
  return {
    id: ASSESSMENT_ID, user_id: null, taster_id: TASTER_ID, email: "participant@example.com",
    name: NAME, role: ROLE, total_score: 40, completed_at: "2026-01-01T00:00:00Z",
    identity_hash: IDENTITY, ...overrides,
  };
}

function stubFetch({
  taster = { id: TASTER_ID, user_id: USER_ID, name: NAME, role: ROLE },
  assessments = [assessment()],
  authUser = { id: USER_ID, email: "participant@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" },
  patchRows = [{ id: ASSESSMENT_ID, user_id: USER_ID, taster_id: TASTER_ID }],
  patchStatus = 200,
  identityLink = null,
  profileStatus = 200,
  journeyStatus = 200,
} = {}) {
  const calls = [];
  global.fetch = jest.fn(async (url, options = {}) => {
    const u = String(url);
    const method = options.method || "GET";
    calls.push({ url: u, method, headers: options.headers || {}, body: options.body });
    const ok = (json, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) });
    if (u.includes("/rest/v1/taster_sessions")) return ok(taster ? [taster] : []);
    if (u.includes("/auth/v1/admin/users/")) return ok(authUser);
    if (u.includes("/rest/v1/assessment_identity_links")) {
      if (method === "POST") return ok([], 201);
      return ok(identityLink ? [identityLink] : []);
    }
    if (u.includes("/rest/v1/professional_profiles")) return ok([], profileStatus);
    if (u.includes("/rest/v1/rpc/refresh_professional_journey")) return ok({}, journeyStatus);
    if (u.includes("/rest/v1/valu_assessments")) {
      if (method === "PATCH") return ok(patchRows, patchStatus);
      return ok(assessments);
    }
    throw new Error(`unexpected fetch: ${method} ${u}`);
  });
  return calls;
}

async function invoke(body) {
  const handler = require("../../api/link-assessment-to-taster.js").default;
  const res = makeRes();
  await handler({ method: "POST", body, headers: {} }, res);
  return res;
}

const validBody = (over = {}) => ({ taster_id: TASTER_ID, identity_hash: IDENTITY, handoff_token: handoffToken(), ...over });

describe("link-assessment-to-taster runtime", () => {
  afterEach(() => {
    jest.resetModules();
    delete global.fetch;
  });

  test("rejects a non-POST method", async () => {
    const handler = require("../../api/link-assessment-to-taster.js").default;
    const res = makeRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  test("rejects a malformed identity_hash before any network call", async () => {
    const calls = stubFetch();
    const res = await invoke(validBody({ identity_hash: "nope" }));
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  test("rejects a missing or forged handoff token", async () => {
    stubFetch();
    const res = await invoke(validBody({ handoff_token: "forged.token" }));
    expect(res.statusCode).toBe(401);
  });

  test("rejects a handoff token signed with the wrong secret", async () => {
    stubFetch();
    const res = await invoke(validBody({ handoff_token: handoffToken({ secret: "wrong-secret" }) }));
    expect(res.statusCode).toBe(401);
  });

  test("rejects a handoff token issued for a different account", async () => {
    stubFetch();
    const res = await invoke(validBody({ handoff_token: handoffToken({ sub: OTHER_USER_ID }) }));
    expect(res.statusCode).toBe(403);
  });

  test("rejects a handoff token minted for a different taster", async () => {
    // The token is bound to taster_id at verification time, so a token for
    // another teaser fails verification outright rather than reaching the
    // ownership checks.
    stubFetch();
    const res = await invoke(validBody({ handoff_token: handoffToken({ tasterId: OTHER_TASTER_ID }) }));
    expect(res.statusCode).toBe(401);
  });

  test("refuses an unconfirmed account email", async () => {
    stubFetch({ authUser: { id: USER_ID, email: "participant@example.com", email_confirmed_at: null } });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/confirm/i);
  });

  test("refuses an assessment already owned by another account", async () => {
    stubFetch({ assessments: [assessment({ user_id: OTHER_USER_ID })] });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(409);
  });

  test("refuses when the assessment identity does not match the teaser", async () => {
    stubFetch({ assessments: [assessment({ name: "Someone Else" })] });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(403);
  });

  test("refuses an incomplete assessment", async () => {
    stubFetch({ assessments: [assessment({ completed_at: null })] });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(409);
  });

  test("takes ownership with a conditional PATCH and verifies the result", async () => {
    const calls = stubFetch();
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    const patch = calls.find(c => c.method === "PATCH" && c.url.includes("valu_assessments"));
    expect(decodeURIComponent(patch.url)).toContain(`or=(user_id.is.null,user_id.eq.${USER_ID})`);
    expect(patch.headers.Prefer).toBe("return=representation");
  });

  test("a lost ownership race is a 409 and does not claim success", async () => {
    stubFetch({ patchRows: [] });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(409);
    expect(res.body.ok).toBeUndefined();
    expect(res.body.error).toMatch(/ownership changed/i);
  });

  test("a PATCH that returns the wrong owner is a 409", async () => {
    stubFetch({ patchRows: [{ id: ASSESSMENT_ID, user_id: OTHER_USER_ID, taster_id: TASTER_ID }] });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(409);
  });

  test("an existing audit link for another account is refused, not overwritten", async () => {
    const calls = stubFetch({ identityLink: { assessment_id: ASSESSMENT_ID, user_id: OTHER_USER_ID } });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(409);
    expect(calls.some(c => c.method === "POST" && c.url.includes("assessment_identity_links"))).toBe(false);
  });

  test("an existing audit link for the same account is not duplicated", async () => {
    const calls = stubFetch({ identityLink: { assessment_id: ASSESSMENT_ID, user_id: USER_ID } });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(200);
    expect(calls.some(c => c.method === "POST" && c.url.includes("assessment_identity_links"))).toBe(false);
  });

  test("a missing audit link is created once with ignore-duplicates", async () => {
    const calls = stubFetch({ identityLink: null });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(200);
    const insert = calls.find(c => c.method === "POST" && c.url.includes("assessment_identity_links"));
    expect(insert.headers.Prefer).toContain("resolution=ignore-duplicates");
  });

  test("a failing profile refresh is a 502, and the score is not reported as fully linked", async () => {
    stubFetch({ profileStatus: 500 });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(502);
    expect(res.body.ok).toBeUndefined();
  });

  test("a failing journey refresh is a 502", async () => {
    stubFetch({ journeyStatus: 500 });
    const res = await invoke(validBody());
    expect(res.statusCode).toBe(502);
  });

  test("no secret is echoed back in any error response", async () => {
    stubFetch({ patchStatus: 500, patchRows: [] });
    const res = await invoke(validBody());
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });
});
