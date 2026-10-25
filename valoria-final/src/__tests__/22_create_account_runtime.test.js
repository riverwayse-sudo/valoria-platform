// valoria-final/src/__tests__/22_create_account_runtime.test.js
//
// Runtime coverage for api/create-account.js — the public registration endpoint
// that also sends the welcome/confirmation email. It previously had no runtime
// test: only a static assertion that it resolved the site origin. The handler is
// a web-standard edge function (Request in, Response out), so Node's built-in
// Request/Response globals exercise the real code; only global.fetch is stubbed.

"use strict";

const SECRET = "test-service-role-key-not-real";
const SUPABASE_URL = "https://test-project.supabase.co";
const IDENTITY = "fp_abc123";
const REPORT_TOKEN = "44444444-4444-4444-8444-444444444444";
const EMAIL = "participant@example.com";
const SITE = "https://staging.valoriainstitute.example";
const RESEND_KEY = "test-resend-key-not-real";

process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
process.env.RESEND_API_KEY = RESEND_KEY;
process.env.VALORIA_SITE_URL = SITE;

const ASSESSMENT = {
  id: "assess-1",
  name: "Test Participant",
  role: "Head of Operations",
  email: EMAIL,
  user_id: null,
  total_score: 58,
  cluster_scores: { PRIME: 61 },
  skill_scores: { Validity: 90 },
  designation: "Developing",
  completed_at: "2026-01-01T00:00:00Z",
  expires_at: null,
  report_token: REPORT_TOKEN,
};

function jsonRes(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

// Stubs Supabase, the Auth admin link, and Resend; records every call.
let RECORDED = [];
function stub(overrides = {}) {
  const calls = [];
  RECORDED = calls;
  global.fetch = jest.fn(async (url, options = {}) => {
    const u = String(url);
    calls.push({ url: u, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null, headers: options.headers || {} });

    if (u.includes("/rpc/consume_rate_limit")) {
      const behaviour = overrides.limit || {};
      if (behaviour.error) return jsonRes({ message: "boom" }, 500);
      if (behaviour.deny) return jsonRes([{ allowed: false, retry_after_seconds: 900, remaining: 0 }]);
      return jsonRes([{ allowed: true, remaining: 4 }]);
    }
    if (u.includes("/rest/v1/valu_assessments") && (options.method || "GET") === "GET") {
      const rows = overrides.assessment === null ? [] : [overrides.assessment || ASSESSMENT];
      return jsonRes(rows);
    }
    if (u.includes("/auth/v1/admin/generate_link")) {
      return jsonRes(overrides.generateLink ?? {
        action_link: `${SUPABASE_URL}/auth/v1/verify?token=abc&type=signup&redirect_to=${encodeURIComponent(SITE)}`,
        user: { id: "user-1" },
      });
    }
    if (u.includes("api.resend.com")) return jsonRes({ id: "msg-1" }, overrides.resendStatus || 200);
    if (u.includes("/rest/v1/")) return jsonRes(overrides.restRows ?? [{ id: "user-1" }]);
    return jsonRes({}, 200);
  });
  return calls;
}

async function invoke({ body, headers = {} } = {}) {
  jest.resetModules();
  const handler = require("../../api/create-account.js").default;
  const payload = body || {
    email: EMAIL,
    password: "a-long-enough-password",
    name: "Test Participant",
    role: "professional",
    identity_hash: IDENTITY,
  };
  const req = new Request("https://valoria-final.example.vercel.app/api/create-account", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers },
    body: JSON.stringify(payload),
  });
  const res = await handler(req);
  return { res, body: await res.clone().json(), calls: RECORDED };
}

afterEach(() => {
  jest.resetModules();
  delete global.fetch;
});

describe("create-account — welcome email recipient binding", () => {
  test("the confirmation email is addressed to the lowercased address", async () => {
    // The site posts form.email.trim().toLowerCase(), so the handler receives a
    // normalised address; the server must still lowercase before use so the Auth
    // link, the stored row and the Resend recipient agree.
    stub();
    const { res, calls: recorded } = await invoke({ body: {
      email: EMAIL.toUpperCase(), password: "a-long-enough-password",
      name: "Test Participant", role: "professional",
    }});
    expect(res.status).toBe(200);
    const send = recorded.find((c) => c.url.includes("api.resend.com"));
    expect(send).toBeDefined();
    expect(send.body.to).toBe(EMAIL);
    const link = recorded.find((c) => c.url.includes("generate_link"));
    expect(link.body.email).toBe(EMAIL);
  });

  test("a padded address is rejected rather than silently trimmed", async () => {
    // Validation runs before trimming, so surrounding whitespace is refused with
    // a clear 400. The site never sends it; this pins the stricter behaviour so
    // it cannot drift into accepting an address it would then normalise.
    stub();
    const { res, calls: recorded } = await invoke({ body: {
      email: `  ${EMAIL}  `, password: "a-long-enough-password",
      name: "Test Participant", role: "professional",
    }});
    expect(res.status).toBe(400);
    expect(recorded.some((c) => c.url.includes("api.resend.com"))).toBe(false);
  });

  test("the email cannot be redirected to a second address supplied in the body", async () => {
    // Only `email` names the recipient; an extra field must not be honoured.
    stub();
    const { calls: recorded } = await invoke({ body: {
      email: EMAIL, password: "a-long-enough-password", name: "Test Participant",
      role: "professional", to: "attacker@evil.example", recipient: "attacker@evil.example",
    }});
    const sends = recorded.filter((c) => c.url.includes("api.resend.com"));
    expect(sends.length).toBeGreaterThan(0);
    for (const s of sends) expect(s.body.to).toBe(EMAIL);
  });

  test("an assessment link requires the assessment email to match the request email", async () => {
    stub({ assessment: { ...ASSESSMENT, email: "someone-else@example.com" } });
    const { res } = await invoke();
    expect(res.status).toBe(403);
  });
});

describe("create-account — rate limiting fails closed", () => {
  test("a limiter that errors blocks registration with 503, not a silent allow", async () => {
    const calls = stub({ limit: { error: true } });
    const { res } = await invoke();
    expect(res.status).toBe(503);
    // Fail-closed means no email is attempted and no account is generated.
    expect(calls.some((c) => c.url.includes("api.resend.com"))).toBe(false);
    expect(calls.some((c) => c.url.includes("generate_link"))).toBe(false);
  });

  test("an exhausted per-IP limit returns 429 and stops before any side effect", async () => {
    const calls = stub({ limit: { deny: true } });
    const { res } = await invoke();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("900");
    expect(calls.some((c) => c.url.includes("api.resend.com"))).toBe(false);
    expect(calls.some((c) => c.url.includes("generate_link"))).toBe(false);
  });

  test("a missing rate-limit configuration fails closed rather than allowing", async () => {
    // The limiter throws when Supabase is unconfigured; the handler must not
    // treat that as permission to proceed.
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      jest.resetModules();
      const handler = require("../../api/create-account.js").default;
      const req = new Request("https://valoria-final.example.vercel.app/api/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7" },
        body: JSON.stringify({ email: EMAIL, password: "a-long-enough-password", name: "X", role: "professional" }),
      });
      const res = await handler(req);
      expect(res.status).toBe(503);
    } finally {
      process.env.SUPABASE_URL = savedUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
    }
  });

  test("both an IP limit and a per-email limit are applied to registration", async () => {
    const calls = stub();
    await invoke();
    const limits = calls.filter((c) => c.url.includes("/rpc/consume_rate_limit"));
    // The per-email limit is keyed by the normalised address, so the same
    // address cannot be re-registered from many IPs.
    expect(limits.length).toBe(2);
    const keys = limits.map((l) => l.body.p_rate_key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe("create-account — journey email navigation", () => {
  // The journey email's primary call-to-action is a functional link to the
  // participant's profile, not branding. It was hardcoded to
  // https://valoriainstitute.com/profile/edit, so a staging participant was
  // sent to the production profile page while their account lives in the
  // staging database. That is the same stranding lib/site-url.js fixed for the
  // auth redirect, and the redirect test did not cover it because it only
  // inspected the Supabase generate_link call, never the email body.

  test("the profile call-to-action points at the configured site, not production", async () => {
    const calls = stub();
    await invoke();
    const journey = calls.find((c) => c.url.includes("api.resend.com") && /What Happens Next/i.test(c.body?.subject || ""));
    expect(journey).toBeDefined();
    const html = String(journey.body.html || "");
    expect(html).toContain(`${SITE}/profile/edit`);
    expect(html).not.toContain("https://valoriainstitute.com/profile/edit");
  });

  test("the brand footer stays canonical", async () => {
    // The fix is scoped to the functional link. The brand identity in the
    // footer is intentionally the canonical production brand.
    const calls = stub();
    await invoke();
    const journey = calls.find((c) => c.url.includes("api.resend.com") && /What Happens Next/i.test(c.body?.subject || ""));
    expect(String(journey.body.html || "")).toContain("Valoria Institute");
  });

  test("the action link is not affected by the site origin", async () => {
    // The Supabase action_link is generated by Supabase using redirect_to, so
    // it must keep flowing through untouched.
    const calls = stub();
    await invoke();
    const generated = calls.find((c) => c.url.includes("/auth/v1/admin/generate_link"));
    expect(generated.body.redirect_to).toContain(SITE);
  });
});
