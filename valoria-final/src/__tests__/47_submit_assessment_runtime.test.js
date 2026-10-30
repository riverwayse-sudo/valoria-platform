"use strict";

/**
 * Executes the real submit-assessment handler with a stubbed transport.
 *
 * A source-string assertion cannot catch a block-scoped variable that is read
 * after its `try` block closes: the code parses, the build passes, and only a
 * runtime execution of the handler reveals the ReferenceError. That is exactly
 * how the first-time full-assessment submission regression shipped, so this
 * suite runs the handler rather than grepping it.
 */

import { createHash, createHmac } from "node:crypto";
import { QUESTIONS } from "../questions.js";

const SERVICE_ROLE = "service-role-key";
const TASTER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const REPORT_TOKEN = "33333333-3333-4333-8333-333333333333";

function handoffToken(sub, tasterId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    typ: "assessment_session",
    aud: "valu-full-assessment",
    sub,
    taster_id: tasterId,
    iat: now,
    exp: now + 3600,
    jti: "j".repeat(24),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SERVICE_ROLE).update(body).digest().toString("base64url");
  return `${body}.${sig}`;
}

function validAnswers() {
  return Object.fromEntries(QUESTIONS.map((question, index) => [index, 0]));
}
function validTimings() {
  return QUESTIONS.map(() => 1200);
}

function loadHandler() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE;
  const path = require.resolve("../../api/submit-assessment.js");
  delete require.cache[path];
  return require("../../api/submit-assessment.js").default;
}

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function makeReq() {
  return {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.9" },
    socket: {},
    body: {
      name: "Temitayo Adeyemi",
      role: "Programme Manager",
      experience: "9-15",
      answers: validAnswers(),
      timings: validTimings(),
      shuffleMap: {},
      taster_id: TASTER_ID,
      handoff_token: handoffToken(USER_ID, TASTER_ID),
    },
  };
}

function makeRes() {
  const res = { statusCode: 0, headers: {}, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.setHeader = (key, value) => { res.headers[key] = value; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

function installFetch({ existing = [], insert = {}, insertStatus = 201 } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes("rpc/consume_rate_limit")) return jsonResponse(200, { allowed: true });
    if (url.includes("/rest/v1/taster_sessions")) {
      return jsonResponse(200, [{
        id: TASTER_ID,
        user_id: USER_ID,
        name: "Temitayo Adeyemi",
        role: "Programme Manager",
        completed_at: "2026-10-25T09:00:00.000Z",
      }]);
    }
    if (url.includes("/auth/v1/admin/users/")) {
      return jsonResponse(200, { id: USER_ID, email: "temitayo@example.com", email_confirmed_at: "2026-10-25T09:00:00.000Z" });
    }
    if (url.includes("/rest/v1/valu_assessments")) {
      if (options.method === "POST") {
        return jsonResponse(insertStatus, insert.payload ?? [{ identity_hash: "abc", report_token: REPORT_TOKEN }]);
      }
      return jsonResponse(200, existing);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return calls;
}

describe("Full assessment submission runtime contract", () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test("dashboard handoff exchange atomically consumes a code and rejects reuse", async () => {
    const code = "c".repeat(43);
    const codeHash = createHash("sha256").update(code).digest("hex");
    const linkId = "44444444-4444-4444-8444-444444444444";
    let consumed = false;
    let consumeWrites = 0;
    global.fetch = async (url, options = {}) => {
      if (url.includes("rpc/consume_rate_limit")) return jsonResponse(200, { allowed: true });
      if (url.includes("/rest/v1/valoria_reentry_links")) {
        if (options.method === "PATCH") {
          consumeWrites += 1;
          if (consumed) return jsonResponse(200, []);
          consumed = true;
          return jsonResponse(200, [{ id: linkId, used_at: new Date().toISOString() }]);
        }
        if (consumed) return jsonResponse(200, []);
        expect(url).toContain(`token=eq.${codeHash}`);
        expect(url).toContain("entry_point=eq.dashboard_assessment");
        return jsonResponse(200, [{
          id: linkId,
          user_id: USER_ID,
          source_id: TASTER_ID,
          expires_at: new Date(Date.now() + 30000).toISOString(),
        }]);
      }
      if (url.includes("/rest/v1/taster_sessions")) {
        return jsonResponse(200, [{
          id: TASTER_ID,
          user_id: USER_ID,
          name: "Temitayo Adeyemi",
          role: "Programme Manager",
          experience: "9-15",
          completed_at: "2026-10-25T09:00:00.000Z",
        }]);
      }
      if (url.includes("/auth/v1/admin/users/")) {
        return jsonResponse(200, { id: USER_ID, email: "temitayo@example.com", email_confirmed_at: "2026-10-25T09:00:00.000Z" });
      }
      if (url.includes("/rest/v1/valu_assessments")) return jsonResponse(200, []);
      throw new Error(`unexpected fetch: ${url}`);
    };

    const handler = loadHandler();
    const request = {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.10" },
      socket: {},
      body: { action: "exchange-dashboard-handoff", handoff_code: code },
    };
    const first = makeRes();
    await handler(request, first);
    expect(first.statusCode).toBe(200);
    expect(first.body.ok).toBe(true);
    expect(first.body.identity.taster_id).toBe(TASTER_ID);
    const [encoded] = first.body.session_token.split(".");
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    expect(claims.typ).toBe("assessment_session");
    expect(claims.sub).toBe(USER_ID);
    expect(claims.taster_id).toBe(TASTER_ID);

    const second = makeRes();
    await handler(request, second);
    expect(second.statusCode).toBe(401);
    expect(consumeWrites).toBe(1);
  });

  test("a first-time full-assessment submission persists and returns a report token", async () => {
    installFetch();
    const res = makeRes();
    await loadHandler()(makeReq(), res);

    // Before the fix this was 500: insertRes was read outside its block, so the
    // row was written and then the handler threw before returning the token.
    expect(res.statusCode).toBe(200);
    expect(res.body.report_token).toBe(REPORT_TOKEN);
    expect(res.body.alreadyCompleted).toBeUndefined();
  });

  test("the insert is issued exactly once, so a retry cannot duplicate a row", async () => {
    const calls = installFetch();
    await loadHandler()(makeReq(), makeRes());
    const inserts = calls.filter((call) => call.url.includes("/rest/v1/valu_assessments") && call.options.method === "POST");
    expect(inserts).toHaveLength(1);
  });

  test("a repeat submission returns the original record and does not insert again", async () => {
    const calls = installFetch({
      existing: [{ id: "a", user_id: USER_ID, taster_id: TASTER_ID, total_score: 71, designation: "Strategist", cluster_scores: {}, skill_scores: {}, completed_at: "2026-10-25T09:00:00.000Z", report_token: REPORT_TOKEN }],
    });
    const res = makeRes();
    await loadHandler()(makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.alreadyCompleted).toBe(true);
    expect(res.body.report_token).toBe(REPORT_TOKEN);
    const inserts = calls.filter((call) => call.url.includes("/rest/v1/valu_assessments") && call.options.method === "POST");
    expect(inserts).toHaveLength(0);
  });

  test("a failed insert reports a controlled failure and never claims success", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    installFetch({ insertStatus: 500, insert: { payload: { message: "boom" } } });
    const res = makeRes();
    await loadHandler()(makeReq(), res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe("Could not save your result. Please try again.");
    expect(res.body.report_token).toBeUndefined();
  });

  test("an insert that returns no report token fails loudly rather than reporting success", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    installFetch({ insert: { payload: [{ identity_hash: "abc" }] } });
    const res = makeRes();
    await loadHandler()(makeReq(), res);

    expect(res.statusCode).toBe(502);
    expect(res.body.report_token).toBeUndefined();
  });

  test("error responses never echo server credentials", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    installFetch({ insertStatus: 500, insert: { payload: { message: `leak ${SERVICE_ROLE}` } } });
    const res = makeRes();
    await loadHandler()(makeReq(), res);

    expect(JSON.stringify(res.body)).not.toContain(SERVICE_ROLE);
  });
});
