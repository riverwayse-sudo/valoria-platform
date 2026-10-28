// valoria-final/src/__tests__/16_report_generation_runtime.test.js
//
// Runtime coverage for api/generate-and-send-report.js — the only endpoint with
// a public, unauthenticated trigger path. Everything here executes the real
// handler; only global.fetch is stubbed.

"use strict";

const CRON = "test-cron-secret-not-real";
const SECRET = "test-service-role-key-not-real";
const SUPABASE_URL = "https://testprojectref000000.supabase.co";
const IDENTITY = "fp_abc123";
const REPORT_TOKEN = "33333333-3333-4333-8333-333333333333";
const EMAIL = "participant@example.com";
const OWN_ORIGIN = "https://valoria-final.example.vercel.app";

// The environment guard requires the target project to be positively
// identified. This suite runs off Vercel, so it opts in to local writes and
// declares the project the stubbed URL points at.
process.env.ALLOW_LOCAL_PRIVILEGED_WRITES = "true";
process.env.STAGING_SUPABASE_PROJECT_REF = "testprojectref000000";
process.env.PRODUCTION_SUPABASE_PROJECT_REF = "prodprojectref000000";
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
process.env.CRON_SECRET = CRON;
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";

// A report body whose header and aggregate claims match the canonical row.
const CANONICAL_REPORT = [
  "## YOUR SCORE: 58/100 — DEVELOPING",
  "",
  "## WHAT YOU ARE GOOD AT",
  "You read a room quickly. Your VALU Index sits at 58/100.",
  "",
  "## WHERE YOU ARE LOSING GROUND",
  "You defer the hard conversation.",
].join("\n");

const ASSESSMENT = {
  identity_hash: IDENTITY,
  report_token: REPORT_TOKEN,
  name: "Test Participant",
  role: "Head of Operations",
  email: EMAIL,
  total_score: 58,
  designation: "Developing",
  cluster_scores: { PRIME: 61, IMPACT: 54 },
  skill_scores: { Validity: 90, Execution: 70, Influence: 55 },
  ai_report: CANONICAL_REPORT,
  report_email_sent_at: null,
  report_status: "PENDING",
  report_attempts: 0,
};

function jsonRes(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) };
}

function makeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (d) => { res.body = d; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; return res; };
  return res;
}

// Stubs the whole Supabase + Anthropic + send-email surface and records calls.
function stub(overrides = {}) {
  const calls = [];
  global.fetch = jest.fn(async (url, options = {}) => {
    const u = String(url);
    calls.push({ url: u, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null, headers: options.headers || {} });

    if (u.includes("/rpc/consume_rate_limit")) return jsonRes([{ allowed: true, remaining: 2 }]);
    if (u.includes("/rpc/claim_report_generation")) return jsonRes([{ claimed: true, status: "IN_PROGRESS" }]);
    if (u.includes("/rest/v1/valu_assessments") && (options.method || "GET") === "GET") {
      const rows = overrides.assessment === null ? [] : [overrides.assessment || ASSESSMENT];
      return jsonRes(rows);
    }
    if (u.includes("/rest/v1/valu_assessments")) {
      // PATCH: return the row unless the test says the filter matched nothing.
      return overrides.patchEmpty ? jsonRes([]) : jsonRes([{ identity_hash: IDENTITY }]);
    }
    if (u.includes("/api/send-email")) return jsonRes({ ok: true }, overrides.sendEmailStatus || 200);
    if (u.includes("api.anthropic.com")) {
      return jsonRes({ content: [{ text: overrides.generatedReport ?? CANONICAL_REPORT }] });
    }
    return jsonRes({}, 200);
  });
  return calls;
}

async function invoke({ body = { report_token: REPORT_TOKEN }, headers = {}, method = "POST" } = {}) {
  jest.resetModules();
  const handler = require("../../api/generate-and-send-report.js").default;
  const res = makeRes();
  const req = {
    method,
    body,
    url: `${OWN_ORIGIN}/api/generate-and-send-report`,
    headers: { ...headers },
  };
  await handler(req, res);
  return res;
}

afterEach(() => {
  jest.resetModules();
  delete global.fetch;
});

describe("generate-and-send-report — trigger authorisation", () => {
  test("rejects a request with no report token and no worker credentials", async () => {
    const calls = stub();
    const res = await invoke({ body: {} });
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  test("rejects a malformed report token", async () => {
    const calls = stub();
    const res = await invoke({ body: { report_token: "not-a-uuid" } });
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  test("a caller cannot claim worker privileges by supplying identity_hash alone", async () => {
    // workerIdentityOnly requires isAuthorizedWorker. Without the CRON secret
    // this must be treated as an unauthenticated public trigger.
    const calls = stub();
    const res = await invoke({ body: { identity_hash: IDENTITY } });
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  test("rejects when the per-IP rate limit is exhausted", async () => {
    // The IP limit runs first. This handler is runtime:"nodejs" and uses the
    // node-style res, so it must call enforceRateLimit (writes to res) rather
    // than checkRateLimit (returns a Web Response). With checkRateLimit the
    // branch fell through and the limit was never enforced.
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes("/rpc/consume_rate_limit")) return jsonRes([{ allowed: false, retry_after_seconds: 900 }]);
      return jsonRes([], 200);
    });
    const res = await invoke();
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("900");
    expect(res.body.error).toMatch(/too many requests/i);
  });

  test("fails closed when the rate limiter itself errors", async () => {
    // A limiter that cannot be reached must not silently allow the request.
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes("/rpc/consume_rate_limit")) return jsonRes({ message: "boom" }, 500);
      return jsonRes([], 200);
    });
    const res = await invoke();
    expect(res.statusCode).toBe(503);
  });

  test("does not reach the assessment lookup when rate limited", async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, options = {}) => {
      calls.push({ url: String(url), body: options.body });
      if (String(url).includes("/rpc/consume_rate_limit")) return jsonRes([{ allowed: false, retry_after_seconds: 60 }]);
      return jsonRes([], 200);
    });
    await invoke();
    expect(calls.some((c) => c.url.includes("valu_assessments"))).toBe(false);
  });

  test("returns 404 for an unknown report token", async () => {
    stub({ assessment: null });
    const res = await invoke();
    expect(res.statusCode).toBe(404);
  });
});

describe("generate-and-send-report — report delivery routing", () => {
  test("delivers via this deployment's own origin, not a site origin", async () => {
    // /api/send-email is a route in this deployment. The site does not serve it
    // (the site's /valu/assessment rewrite points back here), so posting to a
    // site origin 404s and delivery fails.
    const calls = stub();
    const res = await invoke();
    expect(res.statusCode).toBe(200);
    const send = calls.find((c) => c.url.includes("/api/send-email"));
    expect(send).toBeDefined();
    expect(send.url.startsWith(OWN_ORIGIN)).toBe(true);
    expect(send.url).not.toContain("valoriainstitute.com");
  });

  test("authenticates the internal send-email call with the CRON secret", async () => {
    const calls = stub();
    await invoke();
    const send = calls.find((c) => c.url.includes("/api/send-email"));
    expect(send.headers.Authorization).toBe(`Bearer ${CRON}`);
  });

  test("marks the report sent only after delivery succeeds", async () => {
    const calls = stub();
    const res = await invoke();
    expect(res.statusCode).toBe(200);
    expect(res.body.sent).toBe(true);
    const patches = calls.filter((c) => c.url.includes("valu_assessments") && c.method === "PATCH");
    const sent = patches.find((p) => p.body.report_status === "SENT");
    expect(sent).toBeDefined();
    // The SENT transition must come after the send-email call.
    expect(calls.indexOf(sent)).toBeGreaterThan(calls.findIndex((c) => c.url.includes("/api/send-email")));
  });

  test("a failing send-email marks the report FAILED, not SENT", async () => {
    const calls = stub({ sendEmailStatus: 502 });
    const res = await invoke();
    expect(res.statusCode).toBe(500);
    const patches = calls.filter((c) => c.url.includes("valu_assessments") && c.method === "PATCH");
    expect(patches.some((p) => p.body.report_status === "SENT")).toBe(false);
    expect(patches.some((p) => p.body.report_status === "FAILED")).toBe(true);
  });

  test("an already-sent report is not re-sent", async () => {
    const calls = stub({ assessment: { ...ASSESSMENT, report_email_sent_at: "2026-01-01T00:00:00Z" } });
    const res = await invoke();
    expect(res.body.alreadySent).toBe(true);
    expect(calls.some((c) => c.url.includes("/api/send-email"))).toBe(false);
  });

  test("a missing email keeps the report ready instead of failing generation", async () => {
    stub({ assessment: { ...ASSESSMENT, email: null } });
    const res = await invoke();
    expect(res.statusCode).toBe(200);
    expect(res.body.emailPending).toBe(true);
  });

  // Recipient binding. A public trigger is unauthenticated, so the delivery
  // address must come from the stored assessment the token resolved to. If the
  // request body could name the recipient, anyone holding a report token could
  // mail that report to an arbitrary address.
  test("the recipient is the stored assessment's email, never a caller-supplied one", async () => {
    const calls = stub();
    const res = await invoke({ body: { report_token: REPORT_TOKEN, email: "attacker@evil.example" } });
    expect(res.statusCode).toBe(200);
    const send = calls.find((c) => c.url.includes("/api/send-email"));
    expect(send.body.email).toBe(EMAIL);
    expect(send.body.email).not.toBe("attacker@evil.example");
  });

  test("a worker cannot redirect delivery to a caller-supplied address either", async () => {
    // The CRON worker may name the identity hash, but not the destination.
    const calls = stub();
    const res = await invoke({
      body: { identity_hash: IDENTITY, email: "attacker@evil.example" },
      headers: { authorization: `Bearer ${CRON}` },
    });
    expect(res.statusCode).toBe(200);
    const send = calls.find((c) => c.url.includes("/api/send-email"));
    expect(send.body.email).toBe(EMAIL);
  });

  test("a stored email is trimmed before it is used as the recipient", async () => {
    const calls = stub({ assessment: { ...ASSESSMENT, email: `  ${EMAIL}  ` } });
    await invoke();
    const send = calls.find((c) => c.url.includes("/api/send-email"));
    expect(send.body.email).toBe(EMAIL);
  });

  test("a whitespace-only stored email defers delivery instead of sending", async () => {
    const calls = stub({ assessment: { ...ASSESSMENT, email: "   " } });
    const res = await invoke();
    expect(res.body.emailPending).toBe(true);
    expect(calls.some((c) => c.url.includes("/api/send-email"))).toBe(false);
  });
});

describe("generate-and-send-report — report state writes are confirmed", () => {
  test("a state write that matches no row is surfaced as a failure", async () => {
    // With Prefer: return=minimal an empty match looked like success, leaving the
    // row stuck while the caller believed the transition was persisted.
    const calls = stub({ patchEmpty: true });
    const res = await invoke();
    expect(res.statusCode).toBe(500);
    const patches = calls.filter((c) => c.url.includes("valu_assessments") && c.method === "PATCH");
    expect(patches.every((p) => p.headers.Prefer === "return=representation")).toBe(true);
  });
});

describe("generate-and-send-report — canonical score guard", () => {
  test("rejects a generated report whose score conflicts with the stored score", async () => {
    stub({
      assessment: { ...ASSESSMENT, ai_report: null },
      generatedReport: "## YOUR SCORE: 91/100 — ADVANCED\n\n## WHAT YOU ARE GOOD AT\nAll good.",
    });
    const res = await invoke();
    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe("REPORT_VALIDATION_FAILED");
  });

  test("accepts a generated report that matches the stored score", async () => {
    const calls = stub({ assessment: { ...ASSESSMENT, ai_report: null } });
    const res = await invoke();
    expect(res.statusCode).toBe(200);
    const saved = calls.find((c) => c.body && c.body.report_status === "READY");
    expect(saved.body.ai_report).toContain("58/100");
  });

  test("reuses a stored report that already matches the canonical score", async () => {
    const calls = stub();
    await invoke();
    // No Anthropic call should be needed when the stored report is already valid.
    expect(calls.some((c) => c.url.includes("api.anthropic.com"))).toBe(false);
  });
});

describe("generate-and-send-report — error hygiene", () => {
  test("does not leak the service-role key or CRON secret in an error body", async () => {
    stub({ sendEmailStatus: 502 });
    const res = await invoke();
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain(CRON);
  });

  test("rejects a GET", async () => {
    const calls = stub();
    const res = await invoke({ method: "GET" });
    expect(res.statusCode).toBe(405);
    expect(calls).toHaveLength(0);
  });
});
