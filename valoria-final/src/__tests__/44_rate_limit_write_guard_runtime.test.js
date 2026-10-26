// valoria-final/src/__tests__/44_rate_limit_write_guard_runtime.test.js
//
// api/_rateLimit.js calls the `consume_rate_limit` RPC with the service-role key,
// so it is a privileged write. It was the one service-role writer that did not
// carry the environment guard: a completeness scan that treated `rpc(` as a write
// surfaced it, and every caller (create-account, resend-confirmation,
// generate-and-send-report, taster-progress) enforces a limit only on a POST, so
// guarding it cannot break a read or resume path.
//
// These tests execute the real module. Only global.fetch is stubbed.

"use strict";

const PROJECT_REF = "testprojectref000000";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

process.env.ALLOW_LOCAL_PRIVILEGED_WRITES = "true";
process.env.STAGING_SUPABASE_PROJECT_REF = PROJECT_REF;
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-not-real";

const rateLimit = require("../../api/_rateLimit.js");

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function fakeReq(ip = "203.0.113.9") {
  return { headers: { get: (n) => (n.toLowerCase() === "x-forwarded-for" ? ip : "") } };
}

let fetchCalls;

beforeEach(() => {
  fetchCalls = [];
  global.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => [{ allowed: true, remaining: 5, retry_after_seconds: 60 }],
    };
  };
  delete process.env.VERCEL_ENV;
  delete process.env.PRODUCTION_SUPABASE_PROJECT_REF;
  process.env.ALLOW_LOCAL_PRIVILEGED_WRITES = "true";
  process.env.STAGING_SUPABASE_PROJECT_REF = PROJECT_REF;
});

afterEach(() => {
  delete global.fetch;
});

describe("the rate-limit RPC is a guarded privileged write", () => {
  test("an authorised runtime reaches the RPC and allows the request", async () => {
    const res = fakeRes();
    const allowed = await rateLimit.enforceRateLimit(fakeReq(), res, {
      namespace: "test", limit: 5, windowSeconds: 60,
    });
    expect(allowed).toBe(true);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("/rest/v1/rpc/consume_rate_limit");
    expect(fetchCalls[0].init.method).toBe("POST");
  });

  test("a production runtime with no declared production ref never reaches the RPC", async () => {
    process.env.VERCEL_ENV = "production";
    const res = fakeRes();
    const allowed = await rateLimit.enforceRateLimit(fakeReq(), res, {
      namespace: "test", limit: 5, windowSeconds: 60,
    });
    expect(allowed).toBe(false);
    expect(fetchCalls).toHaveLength(0);
    expect(res.statusCode).toBe(503);
  });

  test("checkRateLimit reports not-allowed with a 503 when the guard refuses", async () => {
    process.env.VERCEL_ENV = "production";
    const result = await rateLimit.checkRateLimit(fakeReq(), {
      namespace: "test", limit: 5, windowSeconds: 60,
    });
    expect(result.allowed).toBe(false);
    expect(result.response.status).toBe(503);
    expect(fetchCalls).toHaveLength(0);
  });

  test("a preview pointed at an undeclared staging project never reaches the RPC", async () => {
    process.env.VERCEL_ENV = "preview";
    delete process.env.STAGING_SUPABASE_PROJECT_REF;
    const res = fakeRes();
    const allowed = await rateLimit.enforceRateLimit(fakeReq(), res, {
      namespace: "test", limit: 5, windowSeconds: 60,
    });
    expect(allowed).toBe(false);
    expect(fetchCalls).toHaveLength(0);
  });
});
