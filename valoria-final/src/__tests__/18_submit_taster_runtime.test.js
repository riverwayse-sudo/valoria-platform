// valoria-final/src/__tests__/18_submit_taster_runtime.test.js
//
// Runtime coverage for api/submit-taster.js, the snapshot (taster) submission.
//
// The defect this suite pins: the handler sent
//   p_cluster_scores: results.normalisedScores
// but computeTasterResult() returns { points, maxPoints, strongest, weakest }.
// There is no `normalisedScores` key anywhere in src/, so the value was
// `undefined`, and submit_taster_with_identity_candidate raises
//   'cluster scores must be an object' (22023)
// when jsonb_typeof(p_cluster_scores) <> 'object'. Every snapshot submission
// therefore failed with a 502 and all 15 answers were lost.
//
// These tests execute the real handler and assert the actual RPC payload, so
// they fail if the field regresses or if it is replaced with an empty object.
// Only the network boundary (global.fetch) is stubbed.

"use strict";

const { randomUUID, createHash } = require("node:crypto");

const SUPABASE_URL = "https://testprojectref000000.supabase.co";
const SERVICE_ROLE_KEY = "test-service-role-key-not-real";

// The environment guard requires the target project to be positively
// identified. This suite runs off Vercel, so it opts in to local writes and
// declares the project the stubbed URL points at.
process.env.ALLOW_LOCAL_PRIVILEGED_WRITES = "true";
process.env.STAGING_SUPABASE_PROJECT_REF = "testprojectref000000";
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;

const { TASTER_QUESTIONS, computeTasterResult } = require("../valuTaster.js");

const RESUME_TOKEN = "a".repeat(48);
const TASTER_ID = "22222222-2222-4222-8222-222222222222";

function validAnswers() {
  const answers = {};
  for (let i = 0; i < TASTER_QUESTIONS.length; i += 1) answers[i] = 0;
  return answers;
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

// Stub only the network boundary. `overrides` forces one response shape.
function stubFetch({
  progress = null,
  rpcRows = [{ taster_id: TASTER_ID, created: true }],
  rpcStatus = 200,
  rpcBody = null,
  rateAllowed = true,
  networkError = false,
} = {}) {
  const calls = [];
  global.fetch = jest.fn(async (url, options = {}) => {
    const method = options.method || "GET";
    const u = String(url);
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: u, method, body });
    const ok = (json, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
      text: async () => JSON.stringify(json),
    });

    if (u.includes("/rpc/consume_rate_limit")) return ok({ allowed: rateAllowed });
    if (u.includes("/rest/v1/taster_progress")) {
      return ok([progress || {
        name: "Test Participant",
        role: "Head of Operations",
        experience: "4-8",
        email: "Test.Participant@Example.com",
        current_question: TASTER_QUESTIONS.length,
        answers: validAnswers(),
        submission_key: SUBMISSION_KEY,
      }]);
    }
    if (u.includes("/rpc/submit_taster_with_identity_candidate")) {
      if (networkError) throw new Error("ECONNRESET");
      return ok(rpcBody !== null ? rpcBody : rpcRows, rpcStatus);
    }
    throw new Error(`unexpected fetch: ${method} ${u}`);
  });
  return calls;
}

const SUBMISSION_KEY = randomUUID();

async function invoke(body) {
  jest.resetModules();
  const handler = require("../../api/submit-taster.js").default;
  const res = makeRes();
  await handler(
    { method: "POST", body, headers: {}, socket: { remoteAddress: "203.0.113.7" } },
    res
  );
  return res;
}

function submitBody(overrides = {}) {
  return { resume_token: RESUME_TOKEN, submission_key: SUBMISSION_KEY, ...overrides };
}

function rpcCall(calls) {
  return calls.find((c) => c.url.includes("submit_taster_with_identity_candidate"));
}

afterEach(() => {
  delete global.fetch;
});

describe("submit-taster runtime — cluster scores contract", () => {
  test("sends a non-empty points object, not an undefined field", async () => {
    const calls = stubFetch();
    const res = await invoke(submitBody());

    expect(res.statusCode).toBe(200);

    const payload = rpcCall(calls).body;
    // The regression: this used to be `undefined`, which JSON.stringify drops
    // entirely, so the RPC saw no cluster scores at all.
    expect(payload.p_cluster_scores).toBeDefined();
    expect(typeof payload.p_cluster_scores).toBe("object");
    expect(payload.p_cluster_scores).not.toBeNull();
    expect(Array.isArray(payload.p_cluster_scores)).toBe(false);
    expect(Object.keys(payload.p_cluster_scores).length).toBeGreaterThan(0);
  })

  test("the points object matches the canonical scoring output exactly", async () => {
    const calls = stubFetch();
    const answers = validAnswers();
    await invoke(submitBody());

    const expected = computeTasterResult(answers);
    const payload = rpcCall(calls).body;

    expect(payload.p_cluster_scores).toEqual(expected.points);
    // The five PRIME dimensions, and numeric values rather than nulls.
    expect(Object.keys(payload.p_cluster_scores).sort()).toEqual(["E", "I", "M", "P", "R"]);
    for (const value of Object.values(payload.p_cluster_scores)) {
      expect(typeof value).toBe("number");
      expect(Number.isFinite(value)).toBe(true);
    }
  })

  test("an all-first-option snapshot yields non-zero points, proving real scores are sent", async () => {
    const calls = stubFetch();
    await invoke(submitBody());
    const total = Object.values(rpcCall(calls).body.p_cluster_scores)
      .reduce((sum, n) => sum + n, 0);
    expect(total).toBeGreaterThan(0);
  })
})

describe("submit-taster runtime — answers are persisted", () => {
  test("all 15 answers reach the RPC unchanged", async () => {
    // Distinguish each answer so a truncation or reorder is visible. The handler
    // reads answers from the server-side progress row, so that is what varies.
    const answers = validAnswers();
    for (let i = 0; i < TASTER_QUESTIONS.length; i += 1) {
      answers[i] = i % TASTER_QUESTIONS[i].options.length;
    }
    const calls = stubFetch({
      progress: {
        name: "Test Participant",
        role: "Head of Operations",
        experience: "4-8",
        email: "Test.Participant@Example.com",
        current_question: TASTER_QUESTIONS.length,
        answers,
        submission_key: SUBMISSION_KEY,
      },
    });
    await invoke(submitBody());

    const payload = rpcCall(calls).body;
    expect(payload.p_answers).toEqual(answers);
    expect(Object.keys(payload.p_answers)).toHaveLength(TASTER_QUESTIONS.length);
    expect(Object.keys(payload.p_answers)).toHaveLength(15);
  })

  test("strongest and weakest clusters are forwarded", async () => {
    const calls = stubFetch();
    await invoke(submitBody());
    const payload = rpcCall(calls).body;
    expect(["P", "R", "I", "M", "E"]).toContain(payload.p_strongest_cluster);
    expect(["P", "R", "I", "M", "E"]).toContain(payload.p_weakest_cluster);
  })

  test("the contact email is normalised before storage", async () => {
    const calls = stubFetch();
    await invoke(submitBody());
    expect(rpcCall(calls).body.p_email).toBe("test.participant@example.com");
  })

  test("a successful submission returns the taster id and the computed results", async () => {
    stubFetch();
    const res = await invoke(submitBody());
    expect(res.statusCode).toBe(200);
    expect(res.body.taster_id).toBe(TASTER_ID);
    expect(res.body.results.points).toBeDefined();
  })
})

describe("submit-taster runtime — failure is reported, never a false success", () => {
  test("an RPC rejection returns 502 and does not report success", async () => {
    stubFetch({
      rpcStatus: 400,
      rpcBody: { code: "22023", message: "cluster scores must be an object" },
    });
    const res = await invoke(submitBody());
    expect(res.statusCode).toBe(502);
    expect(res.body.ok).toBeUndefined();
    expect(res.body.taster_id).toBeUndefined();
    expect(res.body.error).toBeTruthy();
  })

  test("an RPC response with no taster_id returns 502 rather than a bare 200", async () => {
    stubFetch({ rpcRows: [] });
    const res = await invoke(submitBody());
    expect(res.statusCode).toBe(502);
    expect(res.body.taster_id).toBeUndefined();
  })

  test("an RPC row without a taster_id is a 502, not a false success", async () => {
    // A truthy row that lacks the id. Without the explicit confirmation check
    // the handler would return 200 with taster_id undefined, telling the
    // participant their snapshot was saved when it was not.
    stubFetch({ rpcRows: [{ created: true }] });
    const res = await invoke(submitBody());
    expect(res.statusCode).toBe(502);
    expect(res.body.taster_id).toBeUndefined();
  })

  test("a network failure returns 502", async () => {
    stubFetch({ networkError: true });
    const res = await invoke(submitBody());
    expect(res.statusCode).toBe(502);
  })

  test("incomplete answers are refused before the RPC is called", async () => {
    const partial = validAnswers();
    delete partial[TASTER_QUESTIONS.length - 1];
    const calls = stubFetch({
      progress: {
        name: "Test Participant",
        role: "Head of Operations",
        experience: "4-8",
        email: "t@example.com",
        current_question: TASTER_QUESTIONS.length,
        answers: partial,
        submission_key: SUBMISSION_KEY,
      },
    });
    const res = await invoke(submitBody());
    expect(res.statusCode).toBe(400);
    expect(rpcCall(calls)).toBeUndefined();
  })
})

describe("submit-taster runtime — retry and duplicate safety", () => {
  test("a retry reuses the same submission key, so the RPC can deduplicate", async () => {
    const calls = stubFetch();
    await invoke(submitBody());
    await invoke(submitBody());

    const keys = calls
      .filter((c) => c.url.includes("submit_taster_with_identity_candidate"))
      .map((c) => c.body.p_submission_key);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(SUBMISSION_KEY);
    expect(keys[1]).toBe(SUBMISSION_KEY);
  })

  test("the RPC reporting created:false (a duplicate) is surfaced, not hidden", async () => {
    stubFetch({ rpcRows: [{ taster_id: TASTER_ID, created: false }] });
    const res = await invoke(submitBody());
    expect(res.statusCode).toBe(200);
    expect(res.body.created).toBe(false);
    expect(res.body.taster_id).toBe(TASTER_ID);
  })

  test("a submission key that does not match saved progress is refused", async () => {
    const calls = stubFetch({
      progress: {
        name: "Test Participant",
        role: "Head of Operations",
        experience: "4-8",
        email: "t@example.com",
        current_question: TASTER_QUESTIONS.length,
        answers: validAnswers(),
        submission_key: randomUUID(),
      },
    });
    const res = await invoke(submitBody());
    expect(res.statusCode).toBe(409);
    expect(rpcCall(calls)).toBeUndefined();
  })

  test("a malformed submission key is refused", async () => {
    const calls = stubFetch();
    const res = await invoke(submitBody({ submission_key: "not-a-uuid" }));
    expect(res.statusCode).toBe(400);
    expect(rpcCall(calls)).toBeUndefined();
  })

  test("a malformed resume token is refused", async () => {
    stubFetch();
    const res = await invoke(submitBody({ resume_token: "short" }));
    expect(res.statusCode).toBe(401);
  })

  test("an expired or unknown resume token is refused", async () => {
    stubFetch({ progress: null, rpcRows: null, rpcBody: null });
    // Force the progress lookup to return no rows.
    global.fetch = jest.fn(async (url) => {
      const u = String(url);
      const ok = (json) => ({ ok: true, status: 200, json: async () => json });
      if (u.includes("/rpc/consume_rate_limit")) return ok({ allowed: true });
      if (u.includes("/rest/v1/taster_progress")) return ok([]);
      throw new Error(`unexpected fetch: ${u}`);
    });
    const res = await invoke(submitBody());
    expect(res.statusCode).toBe(404);
  })

  test("the rate limiter is enforced", async () => {
    const calls = stubFetch({ rateAllowed: false });
    const res = await invoke(submitBody());
    expect(res.statusCode).toBe(429);
    expect(rpcCall(calls)).toBeUndefined();
  })

})

// The payload must match the SQL function's parameter list exactly. The original
// defect was a payload/schema mismatch that no code-level test would have caught
// because both sides were individually valid — the handler sent a key the
// function did not accept, and the function rejected the call. Pinning the two
// against each other closes that whole class.
describe("submit-taster payload matches the RPC signature", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  function rpcParameters() {
    const dir = path.join(__dirname, "../../supabase/migrations");
    const sql = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
      .join("\n");
    // The latest CREATE OR REPLACE wins in Postgres; take the last declaration.
    const decls = [
      ...sql.matchAll(
        /CREATE OR REPLACE FUNCTION\s+public\.submit_taster_with_identity_candidate\s*\(([\s\S]*?)\)\s*(?:RETURNS|LANGUAGE)/gi
      ),
    ];
    expect(decls.length).toBeGreaterThan(0);
    const body = decls[decls.length - 1][1];
    return [...body.matchAll(/\b(p_[a-z_]+)\s+/g)].map((m) => m[1]).sort();
  }

  test("every parameter the function declares is sent, and nothing extra", async () => {
    const calls = stubFetch();
    await invoke(submitBody());

    const sent = Object.keys(rpcCall(calls).body).sort();
    expect(sent).toEqual(rpcParameters());
  });

  test("the payload carries no field the function does not declare", async () => {
    const calls = stubFetch();
    await invoke(submitBody());

    const declared = new Set(rpcParameters());
    const extra = Object.keys(rpcCall(calls).body).filter((k) => !declared.has(k));
    expect(extra).toEqual([]);
  });
});

