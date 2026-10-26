// valoria-final/src/__tests__/15_cron_gated_endpoints_runtime.test.js
//
// Runtime coverage for the CRON_SECRET-gated endpoints. These read and write
// assessment rows with the service-role key, so they are the most privileged
// modules in the repo, and they were covered only by substring assertions.
//
// The existing contract test asserts that each file's *source text* contains
// "CRON_SECRET". That is not the same as the endpoint rejecting an unauthorised
// caller, and it cannot see how headers are actually read at runtime.
//
// These tests execute the real handlers with real Web Request objects, which is
// how Vercel invokes them, and stub only global.fetch.

"use strict";

const CRON = "test-cron-secret-not-real";
const SECRET = "test-service-role-key-not-real";
const SUPABASE_URL = "https://testprojectref000000.supabase.co";
const IDENTITY = "fp_abc123";

// The environment guard requires the target project to be positively
// identified. This suite runs off Vercel, so it opts in to local writes and
// declares the project the stubbed URL points at.
process.env.ALLOW_LOCAL_PRIVILEGED_WRITES = "true";
process.env.STAGING_SUPABASE_PROJECT_REF = "testprojectref000000";
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
process.env.CRON_SECRET = CRON;

const MODULES = {
  "get-assessment-data": "../../api/get-assessment-data.js",
  "save-report": "../../api/save-report.js",
  "report": "../../api/report.js",
  "finalize-report": "../../api/finalize-report.js",
  "sweep-unsent-reports": "../../api/sweep-unsent-reports.js",
};

function stubFetch(handler) {
  const calls = [];
  global.fetch = jest.fn(async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body, headers: options.headers || {} });
    return handler(String(url), options);
  });
  return calls;
}

const okJson = (data, status = 200) => ({
  ok: status >= 200 && status < 300, status,
  json: async () => data, text: async () => JSON.stringify(data),
});

async function call(name, { method = "POST", headers = {}, body } = {}) {
  const handler = require(MODULES[name]).default;
  const req = new Request("https://valoria-final.example.vercel.app/api/" + name, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handler(req);
}

const authed = { authorization: `Bearer ${CRON}`, "content-type": "application/json" };

afterEach(() => {
  jest.resetModules();
  delete global.fetch;
});

// ─────────────────────────────────────────────────────────────────────────────
// Authorisation must actually reject, not merely be mentioned in the source.
// ─────────────────────────────────────────────────────────────────────────────
describe.each(Object.keys(MODULES))("%s authorisation", (name) => {
  test("rejects a request with no Authorization header, without touching the database", async () => {
    const calls = stubFetch(() => okJson([], 200));
    const res = await call(name, { body: { identity_hash: IDENTITY } });
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  test("rejects a wrong secret, without touching the database", async () => {
    const calls = stubFetch(() => okJson([], 200));
    const res = await call(name, { headers: { authorization: "Bearer wrong-secret" }, body: { identity_hash: IDENTITY } });
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  test("rejects a request that omits the Bearer prefix", async () => {
    stubFetch(() => okJson([], 200));
    const res = await call(name, { headers: { authorization: CRON }, body: { identity_hash: IDENTITY } });
    expect(res.status).toBe(401);
  });

  test("accepts the configured secret", async () => {
    stubFetch((url) => {
      if (url.includes("valu_assessments")) return okJson([{ identity_hash: IDENTITY, email: "p@example.com", ai_report: "report", report_email_sent_at: null }]);
      return okJson([], 200);
    });
    const res = await call(name, { headers: authed, body: { identity_hash: IDENTITY } });
    expect(res.status).not.toBe(401);
  });
});

describe("privileged endpoints fail closed when CRON_SECRET is unset", () => {
  test.each(Object.keys(MODULES))("%s rejects when CRON_SECRET is missing", async (name) => {
    delete process.env.CRON_SECRET;
    try {
      const calls = stubFetch(() => okJson([], 200));
      const res = await call(name, { headers: { authorization: `Bearer ${CRON}` }, body: { identity_hash: IDENTITY } });
      // An unconfigured secret must never mean "allow".
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(calls).toHaveLength(0);
    } finally {
      process.env.CRON_SECRET = CRON;
    }
  });
});

describe("method handling", () => {
  // /api/sweep-unsent-reports is a Vercel cron target and vercel.json schedules
  // it, so Vercel invokes it with GET. It must accept GET. The rest are POST-only.
  const postOnly = Object.keys(MODULES).filter((n) => n !== "sweep-unsent-reports");

  test.each(postOnly)("%s rejects a GET even when authorised", async (name) => {
    stubFetch(() => okJson([], 200));
    const res = await call(name, { method: "GET", headers: authed });
    expect(res.status).toBe(405);
  });

  test("sweep-unsent-reports accepts GET because Vercel cron invokes it that way", async () => {
    stubFetch(() => okJson([]));
    const res = await call("sweep-unsent-reports", { method: "GET", headers: authed });
    expect(res.status).toBe(200);
  });

  test("sweep-unsent-reports still rejects an unauthenticated GET", async () => {
    const calls = stubFetch(() => okJson([]));
    const res = await call("sweep-unsent-reports", { method: "GET" });
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// get-assessment-data: the header lookup shape
// ─────────────────────────────────────────────────────────────────────────────
describe("get-assessment-data header handling", () => {
  test("reads the Authorization header from a Web Headers object", async () => {
    // This module is declared `runtime: "edge"`, where req.headers is a Headers
    // instance. A plain `req.headers.authorization` lookup returns undefined on
    // that object, so the endpoint would reject every request. This asserts the
    // runtime shape Vercel actually provides.
    stubFetch((url) => {
      if (url.includes("valu_assessments")) return okJson([{ name: "P", role: "R", email: "p@example.com", total_score: 58 }]);
      return okJson([], 200);
    });
    const res = await call("get-assessment-data", { headers: authed, body: { identity_hash: IDENTITY } });
    expect(res.status).toBe(200);
  });

  test("returns the assessment row on success", async () => {
    stubFetch((url) => {
      if (url.includes("valu_assessments")) return okJson([{ name: "P", role: "R", email: "p@example.com", total_score: 58 }]);
      return okJson([], 200);
    });
    const res = await call("get-assessment-data", { headers: authed, body: { identity_hash: IDENTITY } });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.row.total_score).toBe(58);
  });

  test("404s for an unknown identity rather than returning an empty success", async () => {
    stubFetch(() => okJson([]));
    const res = await call("get-assessment-data", { headers: authed, body: { identity_hash: IDENTITY } });
    expect(res.status).toBe(404);
  });

  test("does not leak the service-role key in an error body", async () => {
    stubFetch(() => okJson({ error: "boom" }, 500));
    const res = await call("get-assessment-data", { headers: authed, body: { identity_hash: IDENTITY } });
    expect(JSON.stringify(await res.json())).not.toContain(SECRET);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// save-report: must not report success when nothing was written
// ─────────────────────────────────────────────────────────────────────────────
describe("save-report write-result handling", () => {
  test("a PATCH that matches no row must not report success", async () => {
    // `Prefer: return=minimal` cannot distinguish "row updated" from "filter
    // matched nothing", so an empty match was reported as ok:true. The caller
    // then believes the report is stored when it is not.
    stubFetch(() => okJson([], 200));
    const res = await call("save-report", { headers: authed, body: { identity_hash: IDENTITY, report_text: "text" } });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const json = await res.json();
    expect(json.ok).not.toBe(true);
  });

  test("reports success when a row was actually updated", async () => {
    stubFetch(() => okJson([{ identity_hash: IDENTITY }]));
    const res = await call("save-report", { headers: authed, body: { identity_hash: IDENTITY, report_text: "text" } });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test("an empty payload is rejected before any write", async () => {
    const calls = stubFetch(() => okJson([{ identity_hash: IDENTITY }]));
    const res = await call("save-report", { headers: authed, body: { identity_hash: IDENTITY } });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// finalize-report: the mark-sent write must be confirmed
// ─────────────────────────────────────────────────────────────────────────────
describe("finalize-report", () => {
  test("does not re-send when the report was already sent", async () => {
    const calls = stubFetch((url) => {
      if (url.includes("valu_assessments")) return okJson([{ email: "p@example.com", ai_report: "r", report_email_sent_at: "2026-01-01T00:00:00Z" }]);
      return okJson([], 200);
    });
    const res = await call("finalize-report", { headers: authed, body: { identity_hash: IDENTITY } });
    expect((await res.json()).already_sent).toBe(true);
    expect(calls.some((c) => c.url.includes("send-email"))).toBe(false);
  });

  test("skips when there is no report yet", async () => {
    stubFetch((url) => {
      if (url.includes("valu_assessments")) return okJson([{ email: "p@example.com", ai_report: null, report_email_sent_at: null }]);
      return okJson([], 200);
    });
    const res = await call("finalize-report", { headers: authed, body: { identity_hash: IDENTITY } });
    expect((await res.json()).skipped).toBe("no_report_yet");
  });

  test("a failing send is reported as a failure, not a success", async () => {
    stubFetch((url) => {
      if (url.includes("send-email")) return okJson({ error: "nope" }, 502);
      if (url.includes("valu_assessments")) return okJson([{ email: "p@example.com", ai_report: "r", report_email_sent_at: null }]);
      return okJson([], 200);
    });
    const res = await call("finalize-report", { headers: authed, body: { identity_hash: IDENTITY } });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sweep-unsent-reports: bounded work, honest reporting
// ─────────────────────────────────────────────────────────────────────────────
describe("sweep-unsent-reports", () => {
  test("reports lookup failures instead of silently returning empty success", async () => {
    stubFetch(() => okJson({ message: "boom" }, 500));
    const res = await call("sweep-unsent-reports", { headers: authed });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.lookupFailures.length).toBeGreaterThan(0);
  });

  test("does not forward the service-role key to the internal endpoints it calls", async () => {
    const calls = stubFetch((url) => {
      if (url.includes("valu_assessments")) return okJson([{ identity_hash: IDENTITY, report_token: "rt" }]);
      return okJson({ ok: true }, 200);
    });
    await call("sweep-unsent-reports", { headers: authed });
    const outbound = calls.filter((c) => c.url.includes("/api/"));
    for (const c of outbound) {
      expect(String(c.headers.Authorization || "")).not.toContain(SECRET);
    }
  });

  test("passes the CRON secret to the internal endpoints it calls", async () => {
    const calls = stubFetch((url) => {
      if (url.includes("valu_assessments")) return okJson([{ identity_hash: IDENTITY, report_token: "rt" }]);
      return okJson({ ok: true }, 200);
    });
    await call("sweep-unsent-reports", { headers: authed });
    const outbound = calls.filter((c) => c.url.includes("/api/"));
    expect(outbound.length).toBeGreaterThan(0);
    for (const c of outbound) {
      expect(String(c.headers.Authorization)).toBe(`Bearer ${CRON}`);
    }
  });
});
