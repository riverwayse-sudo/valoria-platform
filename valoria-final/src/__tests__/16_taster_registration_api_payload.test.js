"use strict";

import { createHash } from "node:crypto";
import { EXPERIENCE_BANDS } from "../valuTaster.js";

const RESUME_TOKEN = "A".repeat(43);
const SIGNUP_KEY = "11111111-1111-4111-8111-111111111111";
const LEAD_CAPTURE_ID = "22222222-2222-4222-8222-222222222222";
const PROGRESS_ID = "33333333-3333-4333-8333-333333333333";

function loadHandler() {
  process.env.SUPABASE_URL = "https://staging-example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
  const modulePath = require.resolve("../../api/taster-progress.js");
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
      marketing_consent: false, privacy_acknowledged: true
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

  test("rejects the old anonymous init action", async () => {
    const calls = installFetch();
    const res = makeRes();
    await loadHandler()(request("init"), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Unsupported progress action");
    expect(calls.some(call => call.url.includes("begin_valu_taster_signup"))).toBe(false);
  });
});
