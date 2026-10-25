"use strict";

/**
 * Executes the real submit-taster handler with a stubbed transport and asserts the
 * atomic RPC payload. A source-string assertion cannot catch a payload field that
 * silently serializes away, which is exactly how the snapshot save regression shipped.
 */

import { TASTER_QUESTIONS } from "../valuTaster.js";

const RESUME_TOKEN = "A".repeat(43);
const SUBMISSION_KEY = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const TASTER_ID = "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

function validAnswers() {
  return Object.fromEntries(TASTER_QUESTIONS.map((question, index) => [index, 0]));
}

function loadHandler() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  const path = require.resolve("../../api/submit-taster.js");
  delete require.cache[path];
  return require("../../api/submit-taster.js").default;
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
    headers: { "x-forwarded-for": "203.0.113.7" },
    socket: {},
    body: { resume_token: RESUME_TOKEN, submission_key: SUBMISSION_KEY },
  };
}

function makeRes() {
  const res = { statusCode: 0, headers: {}, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.setHeader = (key, value) => { res.headers[key] = value; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

function installFetch({ progress = {}, submit = {} } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes("rpc/consume_rate_limit")) return jsonResponse(200, { allowed: true });
    if (url.includes("rest/v1/taster_progress")) {
      return jsonResponse(200, [{
        name: "Temitayo Adeyemi",
        role: "Programme Manager",
        experience: "9-15",
        email: "Temitayo@Example.com",
        current_question: TASTER_QUESTIONS.length,
        answers: validAnswers(),
        submission_key: SUBMISSION_KEY,
        ...progress,
      }]);
    }
    if (url.includes("rpc/submit_taster_with_identity_candidate")) {
      return jsonResponse(submit.status || 200, submit.payload || [{ taster_id: TASTER_ID, created: true }]);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return calls;
}

describe("Snapshot submission RPC payload contract", () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test("posts numeric cluster scores for all five PRIME dimensions", async () => {
    const calls = installFetch();
    const res = makeRes();
    await loadHandler()(makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.taster_id).toBe(TASTER_ID);

    const rpc = calls.find(call => call.url.includes("submit_taster_with_identity_candidate"));
    expect(rpc).toBeDefined();
    const body = JSON.parse(rpc.options.body);

    // A missing p_cluster_scores key is what makes PostgREST reject the call.
    expect(Object.prototype.hasOwnProperty.call(body, "p_cluster_scores")).toBe(true);
    expect(body.p_cluster_scores).toEqual(expect.objectContaining({
      P: expect.any(Number),
      R: expect.any(Number),
      I: expect.any(Number),
      M: expect.any(Number),
      E: expect.any(Number),
    }));
    expect(Object.keys(body.p_cluster_scores).sort()).toEqual(["E", "I", "M", "P", "R"]);
    for (const id of ["P", "R", "I", "M", "E"]) {
      expect(Number.isFinite(body.p_cluster_scores[id])).toBe(true);
    }
    expect(body.p_answers).toEqual(validAnswers());
    expect(body.p_email).toBe("temitayo@example.com");
    expect(body.p_submission_key).toBe(SUBMISSION_KEY);
    expect(body.p_taster_version).toBeTruthy();
  });

  test("does not send the removed normalisedScores field", async () => {
    const calls = installFetch();
    await loadHandler()(makeReq(), makeRes());
    const rpc = calls.find(call => call.url.includes("submit_taster_with_identity_candidate"));
    expect(rpc.options.body).not.toContain("normalisedScores");
  });

  test("calls the atomic RPC exactly once so a retry cannot duplicate records", async () => {
    const calls = installFetch();
    await loadHandler()(makeReq(), makeRes());
    const rpcCalls = calls.filter(call => call.url.includes("submit_taster_with_identity_candidate"));
    expect(rpcCalls).toHaveLength(1);
  });

  test("reports the atomic save failure and does not claim success when the RPC rejects", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    installFetch({ submit: { status: 400, payload: { message: "function not found" } } });
    const res = makeRes();
    await loadHandler()(makeReq(), res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe("We could not securely save your snapshot and recovery record together. Please retry.");
    expect(res.body.taster_id).toBeUndefined();
  });

  test("fails fast when the saved progress has no valid submission reference", async () => {
    installFetch({ progress: { submission_key: "9c8b7a65-4321-4fed-8abc-0123456789ab" } });
    const res = makeRes();
    await loadHandler()(makeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain("does not match");
  });

  test("rejects an incomplete snapshot before any persistence attempt", async () => {
    const calls = installFetch({ progress: { current_question: 14 } });
    const res = makeRes();
    await loadHandler()(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Finish and save all snapshot answers");
    expect(calls.some(call => call.url.includes("submit_taster_with_identity_candidate"))).toBe(false);
  });
});
