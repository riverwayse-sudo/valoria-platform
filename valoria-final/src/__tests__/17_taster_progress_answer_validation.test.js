"use strict";

const { EXPERIENCE_BANDS, TASTER_QUESTIONS } = require("../valuTaster");

const RESUME_TOKEN = "A".repeat(43);
const PROGRESS_ID = "33333333-3333-4333-8333-333333333333";

function loadHandler() {
  process.env.SUPABASE_URL = "https://staging-example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-staging-service-role-key";
  const rateLimitPath = require.resolve("../../api/_rateLimit.js");
  const modulePath = require.resolve("../../api/taster-progress.js");
  delete require.cache[rateLimitPath];
  delete require.cache[modulePath];
  return require("../../api/taster-progress.js").default;
}

function makeRes() {
  const res = { statusCode: 0, headers: {}, body: undefined };
  res.status = code => { res.statusCode = code; return res; };
  res.setHeader = (key, value) => { res.headers[key] = value; return res; };
  res.json = payload => { res.body = payload; return res; };
  return res;
}

function makeRequest(answers) {
  return {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.9", "cf-connecting-ip": "203.0.113.9" },
    socket: {},
    body: {
      action: "save",
      resume_token: RESUME_TOKEN,
      answers,
      current_question: 1,
    },
  };
}

function installFetch() {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes("rpc/consume_rate_limit")) return { ok: true, json: async () => [{ allowed: true, remaining: 99 }] };
    if (url.includes("/rest/v1/taster_progress?") && options.method === undefined) {
      return { ok: true, json: async () => [{
        id: PROGRESS_ID,
        taster_version: "4.2",
        status: "in_progress",
        expires_at: "2099-01-01T00:00:00.000Z",
        submission_key: null,
      }] };
    }
    if (url.includes("/rest/v1/taster_progress?") && options.method === "PATCH") {
      return { ok: true, json: async () => [{ id: PROGRESS_ID }] };
    }
    throw new Error("unexpected fetch: " + url);
  };
  return calls;
}

describe("taster progress answer-key validation", () => {
  afterEach(() => {
    delete global.fetch;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    jest.restoreAllMocks();
  });

  test("accepts numeric answer indexes for the v4.2 question bank and persists the response", async () => {
    const calls = installFetch();
    const res = makeRes();
    await loadHandler()(makeRequest({ "0": 2 }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ saved: true, submission_key: null });
    const patch = calls.find(call => call.options.method === "PATCH");
    expect(patch).toBeDefined();
    expect(JSON.parse(patch.options.body).answers).toEqual({ "0": 2 });
    expect(TASTER_QUESTIONS[0].options[2]).toBeDefined();
  });

  test("rejects non-numeric answer indexes without writing progress", async () => {
    const calls = installFetch();
    const res = makeRes();
    await loadHandler()(makeRequest({ "question-zero": 2 }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Taster progress is incomplete or invalid");
    expect(calls.some(call => call.options.method === "PATCH")).toBe(false);
  });

  test("rejects an answer outside the selected question's option range", async () => {
    const calls = installFetch();
    const res = makeRes();
    await loadHandler()(makeRequest({ "0": TASTER_QUESTIONS[0].options.length }), res);

    expect(res.statusCode).toBe(400);
    expect(calls.some(call => call.options.method === "PATCH")).toBe(false);
  });
});
