"use strict";

import { createHash, createHmac } from "node:crypto";
import { EXPERIENCE_BANDS } from "../valuTaster.js";

const RESUME_TOKEN = "A".repeat(43);
const SIGNUP_KEY = "11111111-1111-4111-8111-111111111111";
const LEAD_CAPTURE_ID = "22222222-2222-4222-8222-222222222222";
const PROGRESS_ID = "33333333-3333-4333-8333-333333333333";
const TEST_SECRET = "test-staging-service-role-key";

function tasterStartToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1, typ: "taster_start_session", aud: "valu-taster-start",
    sub: "66666666-6666-4666-8666-666666666666",
    email: "participant@example.invalid", display_name: "Staging Test Participant",
    role: "Operations Director", experience: EXPERIENCE_BANDS[0].id, privacy_acknowledged: true,
    iat: now, exp: now + 900, jti: "staging-test-jti-1234567890"
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", TEST_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function loadHandler() {
  process.env.SUPABASE_URL = "https://staging-example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = TEST_SECRET;
  const rateLimitPath = require.resolve("../../api/_rateLimit.js");
  const modulePath = require.resolve("../../api/taster-progress.js");
  delete require.cache[rateLimitPath];
  delete require.cache[modulePath];
  return require("../../api/taster-progress.js").default;
}

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) };
}

function request(action = "register") {
  return {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.7", "cf-connecting-ip": "203.0.113.7" },
    socket: {},
    body: {
      action, resume_token: RESUME_TOKEN, signup_key: SIGNUP_KEY,
      name: "Staging Test Participant", email: "participant@example.invalid",
      role: "Operations Director", experience: EXPERIENCE_BANDS[0].id,
      organisation: "Example Organisation", interest: "Professional visibility",
      marketing_consent: false, privacy_acknowledged: true, taster_start_token: tasterStartToken()
    }
  };
}

function makeRes() {
  const res = { statusCode: 0, headers: {}, body: undefined };
  res.status = code => { res.statusCode = code; return res; };
  res.setHeader = (key, value) => { res.headers[key] = value; return res; };
  res.json = payload => { res.body = payload; return res; };
  return res;
}

function installFetch() {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes("rpc/consume_rate_limit")) return response(200, [{ allowed: true }]);
    if (url.includes("rest/v1/taster_progress?")) return response(200, []);
    if (url.includes("rpc/begin_valu_taster_signup")) {
      return response(200, [{ lead_capture_id: LEAD_CAPTURE_ID, progress_id: PROGRESS_ID, created: true }]);
    }
    throw new Error("unexpected fetch: " + url);
  };
  return calls;
}

describe("registration-first taster API payload", () => {
  afterEach(() => {
    delete global.fetch;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    jest.restoreAllMocks();
  });

  test("creates the lead and resumable progress through the atomic RPC", async () => {
    const calls = installFetch();
    const res = makeRes();
    await loadHandler()(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ registered: true, lead_capture_id: LEAD_CAPTURE_ID, progress_id: PROGRESS_ID });
    const rpc = calls.find(call => call.url.includes("rpc/begin_valu_taster_signup"));
    expect(rpc).toBeDefined();
    const body = JSON.parse(rpc.options.body);
    expect(body.p_signup_key).toBe(SIGNUP_KEY);
    expect(body.p_resume_token_hash).toBe(createHash("sha256").update(RESUME_TOKEN).digest("hex"));
    expect(body.p_email).toBe("participant@example.invalid");
    expect(body.p_experience).toBe(EXPERIENCE_BANDS[0].id);
    expect(body.p_marketing_consent).toBe(false);
    expect(body.p_privacy_acknowledged).toBe(true);
    expect(calls.some(call => call.url.endsWith("/rest/v1/taster_progress"))).toBe(false);
  });

  test("completed progress can be retried idempotently without mutating the saved taster", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url, options });
      if (url.includes("rpc/consume_rate_limit")) return response(200, [{ allowed: true, remaining: 179 }]);
      if (url.includes("rest/v1/taster_progress?")) {
        if (!options.method || options.method === "GET") return response(200, [{
          id: PROGRESS_ID, name: "Staging Test Participant", role: "Operations Director",
          experience: EXPERIENCE_BANDS[0].id, email: "participant@example.invalid",
          current_question: 9, answers: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
          submission_key: "44444444-4444-4444-8444-444444444444",
          status: "completed", taster_version: "4.2", total_questions: 9, expires_at: "2099-01-01T00:00:00.000Z",
          lead_capture_id: LEAD_CAPTURE_ID, taster_id: "55555555-5555-4555-8555-555555555555"
        }]);
        throw new Error("completed progress must not be patched");
      }
      if (url.includes("rest/v1/taster_sessions?")) return response(200, [{ id: "55555555-5555-4555-8555-555555555555" }]);
      throw new Error("unexpected fetch: " + url);
    };
    const handler = loadHandler();
    const req = request("save");
    req.body = {
      action: "save", resume_token: RESUME_TOKEN,
      answers: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
      current_question: 9, submission_key: "44444444-4444-4444-8444-444444444444"
    };
    const saveRes = makeRes();
    await handler(req, saveRes);
    expect(saveRes.statusCode).toBe(200);
    expect(saveRes.body).toMatchObject({ saved: true, completed: true, taster_id: "55555555-5555-4555-8555-555555555555" });
    expect(calls.some(call => call.options.method === "PATCH")).toBe(false);

    const completeReq = { ...req, body: { ...req.body, action: "complete", taster_id: "55555555-5555-4555-8555-555555555555" } };
    const completeRes = makeRes();
    await handler(completeReq, completeRes);
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.body).toMatchObject({ completed: true, already_completed: true });
    expect(calls.some(call => call.options.method === "PATCH")).toBe(false);
  });

  test("rejects role or experience that differs from the confirmed account token", async () => {
    for (const override of [{ role: "Finance Director" }, { experience: EXPERIENCE_BANDS[1].id }]) {
      const calls = installFetch();
      const req = request();
      Object.assign(req.body, override);
      const res = makeRes();
      await loadHandler()(req, res);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain("professional role and experience");
      expect(calls.some(call => call.url.includes("rpc/begin_valu_taster_signup"))).toBe(false);
    }
  });

  test("rejects a new taster registration without a confirmed-account token", async () => {
    const calls = installFetch();
    const req = request();
    delete req.body.taster_start_token;
    const res = makeRes();
    await loadHandler()(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain("Create and confirm your Valoria account");
    expect(calls.some(call => call.url.includes("rpc/begin_valu_taster_signup"))).toBe(false);
  });

  test("allows a pre-existing legacy progress row to complete its recovery registration", async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url, options });
      if (url.includes("rpc/consume_rate_limit")) return response(200, [{ allowed: true }]);
      if (url.includes("rest/v1/taster_progress?")) return response(200, [{
        id: PROGRESS_ID, name: "Staging Test Participant", role: "Operations Director",
        experience: EXPERIENCE_BANDS[0].id, email: "participant@example.invalid",
        current_question: 2, answers: { 0: 1, 1: 0 }, status: "in_progress",
        lead_capture_id: null, taster_version: "4.2", total_questions: 9
      }]);
      if (url.includes("rpc/begin_valu_taster_signup")) return response(200, [{
        lead_capture_id: LEAD_CAPTURE_ID, progress_id: PROGRESS_ID, created: true
      }]);
      throw new Error("unexpected fetch: " + url);
    };
    const req = request();
    delete req.body.taster_start_token;
    const res = makeRes();
    await loadHandler()(req, res);
    expect(res.statusCode).toBe(200);
    expect(calls.some(call => call.url.includes("rpc/begin_valu_taster_signup"))).toBe(true);
  });

  test("rejects the old anonymous init action", async () => {
    const calls = installFetch();
    const res = makeRes();
    await loadHandler()(request("init"), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Unsupported progress action");
    expect(calls.some(call => call.url.includes("begin_valu_taster_signup"))).toBe(false);
  });
});
