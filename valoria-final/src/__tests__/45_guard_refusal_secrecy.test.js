// valoria-final/src/__tests__/45_guard_refusal_secrecy.test.js
//
// The environment write guard refuses a privileged write with HTTP 503 and a
// reason. The reason is built from deployment configuration — project refs and
// variable names — and some handlers return it to the client as `detail`. It
// must stay diagnosable without ever carrying a credential: not the service-role
// key, not the Resend key, not a JWT-shaped token. The same holds for anything
// logged on the refusal path.
//
// The guard's reason strings interpolate project refs only. Nothing pinned that
// invariant across the twenty-odd handlers that return `detail`, so an edit that
// added a key to a reason would ship silently. These tests drive the real
// handlers and the real rate-limit helper and assert on what actually leaves the
// process.

"use strict";

const SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FAKEserviceRole.FAKESIG";
const RESEND_KEY = "re_fake_resend_key_do_not_use";
const CRON_SECRET = "cron_fake_secret";
const SUPABASE_URL = "https://testprojectref000000.supabase.co";

const SECRETS = [SERVICE_ROLE, RESEND_KEY, CRON_SECRET];
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/;

const MANAGED_KEYS = [
  "VERCEL_ENV",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "CRON_SECRET",
  "VALORIA_SITE_URL",
  "PRODUCTION_SUPABASE_PROJECT_REF",
  "STAGING_SUPABASE_PROJECT_REF",
  "ALLOW_LOCAL_PRIVILEGED_WRITES",
];

function setEnv(overrides = {}) {
  for (const k of MANAGED_KEYS) delete process.env[k];
  Object.assign(process.env, {
    VERCEL_ENV: "production",
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE,
    RESEND_API_KEY: RESEND_KEY,
    CRON_SECRET,
    VALORIA_SITE_URL: "https://staging.valoriainstitute.example",
    // Deliberately no PRODUCTION_SUPABASE_PROJECT_REF: this is the refusing
    // configuration, and the one that must not leak anything.
    ...overrides,
  });
}

function load(file) {
  jest.resetModules();
  return require(file);
}

function jsonRes(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data, headers: { get: () => null } };
}

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function expectNoSecret(text, where) {
  for (const s of SECRETS) expect(text).not.toContain(s);
  expect(text).not.toMatch(JWT_SHAPE);
}

let logged;

beforeEach(() => {
  logged = [];
  for (const m of ["log", "error", "warn", "info"]) {
    jest.spyOn(console, m).mockImplementation((...args) => {
      logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    });
  }
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  delete global.fetch;
});

describe("refusal responses and logs carry no credential", () => {
  test("submit-taster refuses with a diagnosable reason and no secret", async () => {
    setEnv();
    global.fetch = jest.fn(async () => { throw new Error("no outbound call should occur"); });

    const handler = load("../../api/submit-taster.js").default;
    const res = fakeRes();
    await handler({ method: "POST", headers: { "x-forwarded-for": "203.0.113.9" }, body: {} }, res);

    expect(res.statusCode).toBe(503);
    // Diagnosable: the reason names what is missing.
    expect(String(res.body.detail)).toMatch(/PRODUCTION_SUPABASE_PROJECT_REF|production database is not declared/);
    expectNoSecret(JSON.stringify(res.body), "submit-taster refusal body");
    expectNoSecret(JSON.stringify(res.headers), "submit-taster refusal headers");
    expectNoSecret(logged.join("\n"), "submit-taster logs");
    // The refused write never reached the database.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("create-account refuses at the rate-limit guard without leaking, and logs the reason", async () => {
    setEnv();
    global.fetch = jest.fn(async () => { throw new Error("no outbound call should occur"); });

    const handler = load("../../api/create-account.js").default;
    const req = new Request("https://example.vercel.app/api/create-account", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({ email: "participant@example.com", password: "password123" }),
    });
    const res = await handler(req);

    expect(res.status).toBe(503);
    const body = await res.json();
    // The refusal the client sees is the generic one, not the internal reason.
    expect(JSON.stringify(body)).not.toMatch(/refusing a privileged write/);
    expectNoSecret(JSON.stringify(body), "create-account refusal body");
    expectNoSecret(JSON.stringify([...res.headers.entries()]), "create-account refusal headers");
    // The reason is retained server-side, where it is useful, and still clean.
    expect(logged.join("\n")).toMatch(/refusing a privileged write/);
    expectNoSecret(logged.join("\n"), "create-account logs");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("the rate-limit helper keeps the reason out of the response and clean in the log", async () => {
    setEnv();
    const rateLimit = load("../../api/_rateLimit.js");

    const result = await rateLimit.checkRateLimit(
      { headers: { get: () => "203.0.113.9" } },
      { namespace: "test", limit: 5, windowSeconds: 60 }
    );

    expect(result.allowed).toBe(false);
    expect(result.response.status).toBe(503);
    const body = await result.response.json();
    expect(body.error).toBe("Request protection is temporarily unavailable.");
    expectNoSecret(JSON.stringify(body), "rate-limit refusal body");
    expectNoSecret(logged.join("\n"), "rate-limit logs");
    expect(logged.join("\n")).toMatch(/refusing a privileged write/);
  });
});

describe("every guard reason is free of credential material", () => {
  const { privilegedWriteAllowed } = require("../../lib/environment-guard.js");

  const REFUSING_CONFIGS = [
    { label: "production, no declared production ref", env: { VERCEL_ENV: "production" } },
    { label: "production, SUPABASE_URL unidentifiable", env: { VERCEL_ENV: "production", SUPABASE_URL: "not-a-url", PRODUCTION_SUPABASE_PROJECT_REF: "aaaaaaaaaaaaaaaaaaaa" } },
    { label: "production, target is a different project", env: { VERCEL_ENV: "production", PRODUCTION_SUPABASE_PROJECT_REF: "bbbbbbbbbbbbbbbbbbbb" } },
    { label: "preview, no staging ref declared", env: { VERCEL_ENV: "preview" } },
    { label: "preview, production ref not declared", env: { VERCEL_ENV: "preview", STAGING_SUPABASE_PROJECT_REF: "cccccccccccccccccccc" } },
    { label: "staging ref names the production project", env: { VERCEL_ENV: "preview", STAGING_SUPABASE_PROJECT_REF: "bbbbbbbbbbbbbbbbbbbb", PRODUCTION_SUPABASE_PROJECT_REF: "bbbbbbbbbbbbbbbbbbbb" } },
    { label: "unset VERCEL_ENV without local opt-in", env: {} },
  ];

  test.each(REFUSING_CONFIGS)("$label — reason names the fix and no secret", ({ env }) => {
    for (const k of MANAGED_KEYS) delete process.env[k];
    Object.assign(process.env, { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE, ...env });

    const decision = privilegedWriteAllowed();

    expect(decision.allowed).toBe(false);
    expect(typeof decision.reason).toBe("string");
    // Useful: it points at the variable or condition to correct.
    expect(decision.reason).toMatch(/PRODUCTION_SUPABASE_PROJECT_REF|STAGING_SUPABASE_PROJECT_REF|ALLOW_LOCAL_PRIVILEGED_WRITES|does not identify|not the declared/);
    expectNoSecret(decision.reason, `guard reason for ${JSON.stringify(env)}`);
  });
});
