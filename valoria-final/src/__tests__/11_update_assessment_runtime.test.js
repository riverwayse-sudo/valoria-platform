// valoria-final/src/__tests__/11_update_assessment_runtime.test.js
//
// Runtime coverage for api/update-assessment.js, which writes ownership
// (user_id/email) and internal report fields. It was covered only by
// substring assertions in 05_api_security_contract.test.js, which cannot execute
// the handler.
//
// Two real defects were found by executing it and are pinned here:
//
//   1. The ownership PATCH was `id=eq.<id>` with no ownership predicate, unlike
//      claim-listing and link-assessment-to-taster. Two accounts verifying the
//      same email concurrently could both pass the pre-checks and the second
//      PATCH would silently overwrite the first owner.
//   2. It used `Prefer: return=minimal`, which cannot distinguish "row updated"
//      from "row matched no filter". Combined with (1), a lost race would be
//      reported to the client as success.
//
// Only the network boundary (global.fetch) is stubbed, so validation, auth and
// the patch-URL construction all run for real.

"use strict";

const SECRET = "test-service-role-key-not-real";
const SUPABASE_URL = "https://testprojectref000000.supabase.co";
const CRON_SECRET = "test-cron-secret-not-real";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";
const ASSESSMENT_ID = "44444444-4444-4444-8444-444444444444";
const IDENTITY = "fp_abc123";
const EMAIL = "participant@example.com";

// The environment guard requires the target project to be positively
// identified. This suite runs off Vercel, so it opts in to local writes and
// declares the project the stubbed URL points at.
process.env.ALLOW_LOCAL_PRIVILEGED_WRITES = "true";
process.env.STAGING_SUPABASE_PROJECT_REF = "testprojectref000000";
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
process.env.CRON_SECRET = CRON_SECRET;

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

// Stub only the network boundary.
function stubFetch({
  assessment = { id: ASSESSMENT_ID, email: EMAIL, user_id: null },
  authUser = { id: USER_ID, email: EMAIL },
  authOk = true,
  patchRows = [{ id: ASSESSMENT_ID }],
  patchStatus = 200,
} = {}) {
  const calls = [];
  global.fetch = jest.fn(async (url, options = {}) => {
    const u = String(url);
    const method = options.method || "GET";
    calls.push({ url: u, method, headers: options.headers || {}, body: options.body });
    const ok = (json, status = 200) => ({
      ok: status >= 200 && status < 300, status,
      json: async () => json, text: async () => JSON.stringify(json),
    });
    if (u.includes("/auth/v1/user")) {
      if (!authOk) return ok({ error: "invalid token" }, 401);
      return ok(authUser);
    }
    if (u.includes("/rest/v1/valu_assessments")) {
      if (method === "PATCH") return ok(patchRows, patchStatus);
      return ok(assessment ? [assessment] : []);
    }
    throw new Error(`unexpected fetch: ${method} ${u}`);
  });
  return calls;
}

async function invoke(body, headers = {}) {
  const handler = require("../../api/update-assessment.js").default;
  const res = makeRes();
  await handler({ method: "POST", body, headers }, res);
  return res;
}

const bearer = token => ({ authorization: `Bearer ${token}` });

describe("update-assessment runtime", () => {
  afterEach(() => {
    jest.resetModules();
    delete global.fetch;
  });

  // ── input validation ─────────────────────────────────────────────────────
  test("rejects a non-POST method", async () => {
    const handler = require("../../api/update-assessment.js").default;
    const res = makeRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  test("rejects a malformed identity_hash before any network call", async () => {
    const calls = stubFetch();
    const res = await invoke({ identity_hash: "nope", fields: { user_id: USER_ID } });
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  test("rejects unsupported fields instead of passing them through", async () => {
    stubFetch();
    const res = await invoke({ identity_hash: IDENTITY, fields: { total_score: 99 } }, bearer("x"));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/unsupported update field/i);
  });

  // ── authorization ────────────────────────────────────────────────────────
  test("ownership fields require a verified session", async () => {
    stubFetch();
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } });
    expect(res.statusCode).toBe(401);
  });

  test("internal report fields require the cron secret", async () => {
    stubFetch();
    const res = await invoke({ identity_hash: IDENTITY, fields: { ai_report: { x: 1 } } }, bearer("user-token"));
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/internal authorization/i);
  });

  test("internal fields succeed with the cron secret and never touch ownership", async () => {
    const calls = stubFetch();
    const res = await invoke({ identity_hash: IDENTITY, fields: { ai_report: { ok: true } } }, bearer(CRON_SECRET));
    expect(res.statusCode).toBe(200);
    const patch = calls.find(c => c.method === "PATCH");
    expect(JSON.parse(patch.body)).toEqual({ ai_report: { ok: true } });
    expect(patch.url).not.toMatch(/user_id/);
  });

  test("a user_id for a different account is refused", async () => {
    stubFetch();
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: OTHER_USER_ID } }, bearer("user-token"));
    expect(res.statusCode).toBe(403);
  });

  test("an assessment already owned by another account is refused", async () => {
    stubFetch({ assessment: { id: ASSESSMENT_ID, email: EMAIL, user_id: OTHER_USER_ID } });
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } }, bearer("user-token"));
    expect(res.statusCode).toBe(403);
  });

  test("a verified email that differs from the assessment email is refused", async () => {
    stubFetch({ authUser: { id: USER_ID, email: "someone-else@example.com" } });
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } }, bearer("user-token"));
    expect(res.statusCode).toBe(403);
  });

  // ── the two defects fixed ────────────────────────────────────────────────
  test("the ownership PATCH is conditional on the row being unowned or ours", async () => {
    const calls = stubFetch();
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } }, bearer("user-token"));
    expect(res.statusCode).toBe(200);
    const patch = calls.find(c => c.method === "PATCH");
    // Without this predicate two concurrent claimants can both succeed and the
    // second silently takes the row.
    expect(decodeURIComponent(patch.url)).toContain(`or=(user_id.is.null,user_id.eq.${USER_ID})`);
  });

  test("a conditional PATCH that matches no row is reported as a conflict, not success", async () => {
    // The row was claimed by someone else between the lookup and the PATCH, so
    // PostgREST returns 200 with an empty array.
    stubFetch({ patchRows: [] });
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } }, bearer("user-token"));
    expect(res.statusCode).toBe(409);
    expect(res.body.ok).toBeUndefined();
    expect(res.body.error).toMatch(/ownership changed/i);
  });

  test("the PATCH asks for the representation so the outcome can be checked", async () => {
    const calls = stubFetch();
    await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } }, bearer("user-token"));
    const patch = calls.find(c => c.method === "PATCH");
    expect(patch.headers.Prefer).toBe("return=representation");
  });

  test("an unowned row can be claimed (the happy path)", async () => {
    const calls = stubFetch({ assessment: { id: ASSESSMENT_ID, email: EMAIL, user_id: null } });
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } }, bearer("user-token"));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(JSON.parse(calls.find(c => c.method === "PATCH").body)).toEqual({ user_id: USER_ID });
  });

  test("an already-owned row stays with its owner and is re-claimed idempotently", async () => {
    const calls = stubFetch({ assessment: { id: ASSESSMENT_ID, email: EMAIL, user_id: USER_ID } });
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } }, bearer("user-token"));
    expect(res.statusCode).toBe(200);
    expect(decodeURIComponent(calls.find(c => c.method === "PATCH").url)).toContain(`user_id.eq.${USER_ID}`);
  });

  test("email-only updates do not carry an ownership predicate", async () => {
    const calls = stubFetch({ assessment: { id: ASSESSMENT_ID, email: EMAIL, user_id: USER_ID } });
    const res = await invoke({ identity_hash: IDENTITY, fields: { email: EMAIL } }, bearer("user-token"));
    expect(res.statusCode).toBe(200);
    const patch = calls.find(c => c.method === "PATCH");
    expect(patch.url).not.toContain("or=");
    expect(JSON.parse(patch.body)).toEqual({ email: EMAIL });
  });

  test("a missing assessment is a 404, not a silent success", async () => {
    stubFetch({ assessment: null });
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } }, bearer("user-token"));
    expect(res.statusCode).toBe(404);
  });

  test("a failing PATCH is a 502 and never reports success", async () => {
    stubFetch({ patchStatus: 500, patchRows: [] });
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } }, bearer("user-token"));
    expect(res.statusCode).toBe(502);
    expect(res.body.ok).toBeUndefined();
  });

  test("no sensitive value is echoed back in any error response", async () => {
    stubFetch({ authOk: false });
    const res = await invoke({ identity_hash: IDENTITY, fields: { user_id: USER_ID } }, bearer("user-token"));
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    expect(JSON.stringify(res.body)).not.toContain(CRON_SECRET);
  });
});
