"use strict";

/** Exercise the real create-account handler with a stubbed Supabase transport. */

const EXISTING_EMAIL = "sample@example.test";

function jsonResponse(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

function makeReq(payload = {}) {
  return {
    method: "POST",
    headers: { get: name => name === "x-forwarded-for" ? "203.0.113.7" : "" },
    json: async () => ({
      email: EXISTING_EMAIL,
      password: "correct-horse-battery",
      name: "Sample User",
      role: "Programme Manager",
      ...payload,
    }),
  };
}

function loadHandler() {
  process.env.SUPABASE_URL = "https://stagingprojectrefabc.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  delete process.env.RESEND_API_KEY;
  const path = require.resolve("../../api/create-account.js");
  delete require.cache[path];
  return require("../../api/create-account.js").default;
}

function installFetch({ generateLink = { status: 200, payload: {} }, rateLimited = false } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes("rpc/consume_rate_limit")) {
      return rateLimited
        ? jsonResponse(200, { allowed: false, retry_after_seconds: 3600 })
        : jsonResponse(200, { allowed: true, remaining: 4 });
    }
    if (url.includes("auth/v1/admin/generate_link")) {
      return jsonResponse(generateLink.status, generateLink.payload);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return calls;
}

async function run(options) {
  const calls = installFetch(options);
  const res = await loadHandler()(makeReq());
  return { res, body: await res.json(), calls };
}

describe("create-account: existing email guidance", () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test("maps provider email_exists to a stable sign-in response", async () => {
    const { res, body } = await run({
      generateLink: { status: 422, payload: { error_code: "email_exists", msg: "A user with this email address has already been registered" } },
    });
    expect(res.status).toBe(409);
    expect(body.code).toBe("ACCOUNT_EXISTS");
    expect(body.actions).toEqual(expect.arrayContaining(["sign_in", "reset_password"]));
  });

  test("detects an existing account if the provider omits its error code", async () => {
    const { res, body } = await run({
      generateLink: { status: 422, payload: { msg: "A user with this email address has already been registered" } },
    });
    expect(res.status).toBe(409);
    expect(body.code).toBe("ACCOUNT_EXISTS");
  });

  test("does not leak provider wording or privileged identifiers", async () => {
    const providerMessage = "A user with this email address has already been registered";
    const { body } = await run({ generateLink: { status: 422, payload: { error_code: "email_exists", msg: providerMessage } } });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(providerMessage);
    expect(serialized.toLowerCase()).not.toContain("service_role");
    expect(serialized.toLowerCase()).not.toContain("supabase");
  });

  test("does not misclassify unrelated validation failures", async () => {
    const { res, body } = await run({
      generateLink: { status: 422, payload: { error_code: "validation_failed", msg: "Password should be at least 6 characters" } },
    });
    expect(res.status).toBe(422);
    expect(body.code).toBeUndefined();
    expect(body.error).toBe("Could not create account.");
  });

  test("maps upstream failures to retryable server errors", async () => {
    const { res, body } = await run({ generateLink: { status: 500, payload: { msg: "Internal Server Error" } } });
    expect(res.status).toBe(502);
    expect(body.code).toBeUndefined();
  });

  test("does not block a new email from registering", async () => {
    const { res, body } = await run({
      generateLink: { status: 200, payload: { action_link: "https://example.supabase.co/verify?token=abc" } },
    });
    expect(res.status).toBe(200);
    expect(body.code).toBeUndefined();
  });

  test("preserves rate-limit responses", async () => {
    const { res } = await run({ rateLimited: true });
    expect(res.status).toBe(429);
  });

  test("stops after the provider rejects an existing account", async () => {
    const { calls } = await run({ generateLink: { status: 422, payload: { error_code: "email_exists" } } });
    const writes = calls.filter(call => {
      const method = String(call.options?.method || "GET").toUpperCase();
      return method !== "GET" && !call.url.includes("generate_link") && !call.url.includes("consume_rate_limit");
    });
    expect(writes).toEqual([]);
  });
});
