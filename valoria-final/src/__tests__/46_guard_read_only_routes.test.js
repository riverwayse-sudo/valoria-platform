// valoria-final/src/__tests__/46_guard_read_only_routes.test.js
//
// The write guard exists to stop privileged *writes*. A guard that also blocks
// legitimate read-only routes would take the platform down for a reason nobody
// asked for, and the natural reaction to that would be to weaken the guard.
//
// Two handlers read with the service-role key and deliberately do not call the
// guard: api/system-status.js (operational backlog counts) and
// api/get-assessment-data.js (report data). Both are gated by CRON_SECRET and
// neither writes. These tests run them in the *refusing* configuration — the
// same one that makes a privileged write return 503 — and show they still work,
// while a write handler in that same configuration is refused. That difference
// is what proves the guard is discriminating rather than simply off.

"use strict";

const SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FAKEserviceRole.FAKESIG";
const CRON_SECRET = "cron_fake_secret";
const SUPABASE_URL = "https://testprojectref000000.supabase.co";
const IDENTITY = "fp_abc123";

const MANAGED_KEYS = [
  "VERCEL_ENV",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "PRODUCTION_SUPABASE_PROJECT_REF",
  "STAGING_SUPABASE_PROJECT_REF",
  "ALLOW_LOCAL_PRIVILEGED_WRITES",
];

// A configuration in which the guard refuses every privileged write: production
// runtime, no declared production project. Anything that still works here is
// working because it is not a guarded write.
function setRefusingEnv() {
  for (const k of MANAGED_KEYS) delete process.env[k];
  Object.assign(process.env, {
    VERCEL_ENV: "production",
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE,
    CRON_SECRET,
  });
}

function load(file) {
  jest.resetModules();
  return require(file);
}

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

let calls;

function stubReads({ rows = [{ name: "Test Participant", total_score: 58 }], count = "0-0/3", ok = true } = {}) {
  calls = [];
  global.fetch = jest.fn(async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET" });
    return {
      ok,
      status: ok ? 200 : 502,
      json: async () => rows,
      headers: { get: (h) => (h.toLowerCase() === "content-range" ? count : null) },
    };
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  delete global.fetch;
});

describe("read-only routes stay functional while writes are refused", () => {
  test("system-status returns its counts, and issues only GETs", async () => {
    setRefusingEnv();
    stubReads({ count: "0-0/3" });

    const handler = load("../../api/system-status.js").default;
    const res = fakeRes();
    await handler({ method: "GET", headers: { authorization: `Bearer ${CRON_SECRET}` } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.backlog.total).toBe(9); // three counts of 3
    expect(calls.length).toBeGreaterThan(0);
    // Read-only, and with the guard refusing writes this proves no write is attempted.
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  test("get-assessment-data returns a row, and issues only GETs", async () => {
    setRefusingEnv();
    stubReads({ rows: [{ name: "Test Participant", total_score: 58 }] });

    const handler = load("../../api/get-assessment-data.js").default;
    const req = new Request("https://example.vercel.app/api/get-assessment-data", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${CRON_SECRET}` },
      body: JSON.stringify({ identity_hash: IDENTITY }),
    });
    const res = await handler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.row.total_score).toBe(58);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  test("a privileged write in the same configuration is refused", async () => {
    setRefusingEnv();
    global.fetch = jest.fn(async () => { throw new Error("no outbound call should occur"); });

    const handler = load("../../api/submit-taster.js").default;
    const res = fakeRes();
    await handler({ method: "POST", headers: { "x-forwarded-for": "203.0.113.9" }, body: {} }, res);

    // Same environment as the two tests above: reads work, the write does not.
    expect(res.statusCode).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("read-only routes are not public", () => {
  test("system-status rejects a missing or wrong CRON secret", async () => {
    setRefusingEnv();
    stubReads();
    const handler = load("../../api/system-status.js").default;

    for (const auth of [undefined, "Bearer wrong-secret"]) {
      const res = fakeRes();
      await handler({ method: "GET", headers: auth ? { authorization: auth } : {} }, res);
      expect(res.statusCode).toBe(401);
    }
  });

  test("get-assessment-data rejects a missing or wrong CRON secret before reading", async () => {
    setRefusingEnv();
    stubReads();
    const handler = load("../../api/get-assessment-data.js").default;

    for (const auth of [undefined, "Bearer wrong-secret"]) {
      const req = new Request("https://example.vercel.app/api/get-assessment-data", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(auth ? { authorization: auth } : {}) },
        body: JSON.stringify({ identity_hash: IDENTITY }),
      });
      const res = await handler(req);
      expect(res.status).toBe(401);
    }
    expect(calls.length).toBe(0);
  });
});
