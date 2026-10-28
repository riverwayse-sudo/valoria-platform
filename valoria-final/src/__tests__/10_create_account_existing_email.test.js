"use strict";

/**
 * Executes the real create-account edge handler with a stubbed transport and
 * asserts that an address which already has an account produces a stable,
 * actionable response rather than the generic "Could not create account."
 *
 * A source-string assertion cannot catch this: the defect was that every
 * non-2xx provider response collapsed into one opaque message, so only running
 * the handler proves the mapping.
 */

const EXISTING_EMAIL = "temitayo@example.com";

// Declared project refs so the environment guard (lib/environment-guard.js)
// permits the write. The guard refuses a privileged write unless the runtime
// identity and the target database are both positively identified, so the
// harness must declare a staging target that differs from production.
const STAGING_REF = "stagingprojectrefabc";
const PRODUCTION_REF = "productionprojectxyz";

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

function makeReq(payload = {}) {
  return {
    method: "POST",
    headers: { get: (name) => (name === "x-forwarded-for" ? "203.0.113.7" : "") },
    json: async () => ({
      email: EXISTING_EMAIL,
      password: "correct-horse-battery",
      name: "Temitayo Adeyemi",
      role: "Programme Manager",
      ...payload,
    }),
  };
}

function loadHandler() {
  process.env.SUPABASE_URL = `https://${STAGING_REF}.supabase.co`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.STAGING_SUPABASE_PROJECT_REF = STAGING_REF;
  process.env.PRODUCTION_SUPABASE_PROJECT_REF = PRODUCTION_REF;
  // Case 3 of the guard: the test-runner path, which is opt-in by name and still
  // requires a declared staging target that differs from production.
  process.env.ALLOW_LOCAL_PRIVILEGED_WRITES = "true";
  delete process.env.RESEND_API_KEY;
  const path = require.resolve("../../api/create-account.js");
  delete require.cache[path];
  return require("../../api/create-account.js").default;
}

// Supabase's signup rejection for an already-registered address. The message
// wording is asserted against a provider fixture, never returned to the client.
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
  const body = await res.json();
  return { res, body, calls };
}

describe("create-account: existing email guidance", () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test("maps the provider email_exists code to a stable ACCOUNT_EXISTS response", async () => {
    const { res, body } = await run({
      generateLink: {
        status: 422,
        payload: { code: 422, error_code: "email_exists", msg: "A user with this email address has already been registered" },
      },
    });

    expect(res.status).toBe(409);
    expect(body.code).toBe("ACCOUNT_EXISTS");
    expect(body.actions).toEqual(expect.arrayContaining(["sign_in", "reset_password"]));
    expect(body.error).toBeTruthy();
  });

  test("does not leak the provider message or internal identifiers", async () => {
    const providerMessage = "A user with this email address has already been registered";
    const { body } = await run({
      generateLink: { status: 422, payload: { error_code: "email_exists", msg: providerMessage } },
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(providerMessage);
    expect(serialized).not.toContain("supabase");
    expect(serialized.toLowerCase()).not.toContain("service_role");
  });

  test("detects an existing account from the message when the provider omits the code", async () => {
    const { res, body } = await run({
      generateLink: { status: 422, payload: { msg: "A user with this email address has already been registered" } },
    });

    expect(res.status).toBe(409);
    expect(body.code).toBe("ACCOUNT_EXISTS");
  });

  test("does not misclassify an unrelated validation failure as an existing account", async () => {
    const { res, body } = await run({
      generateLink: { status: 422, payload: { error_code: "validation_failed", msg: "Password should be at least 6 characters" } },
    });

    expect(body.code).toBeUndefined();
    expect(res.status).toBe(422);
    expect(body.error).toBe("Could not create account.");
  });

  test("treats an upstream failure as retryable, never as an existing account", async () => {
    const { res, body } = await run({ generateLink: { status: 500, payload: { msg: "Internal Server Error" } } });

    expect(res.status).toBe(502);
    expect(body.code).toBeUndefined();
  });

  test("leaves a brand-new email able to register", async () => {
    const { res, body } = await run({
      generateLink: { status: 200, payload: { action_link: "https://example.supabase.co/verify?token=abc" } },
    });

    expect(res.status).toBe(200);
    expect(body.code).toBeUndefined();
  });

  test("surfaces rate limiting unchanged", async () => {
    const { res } = await run({ rateLimited: true });
    expect(res.status).toBe(429);
  });

  test("stops after the failed signup and writes nothing", async () => {
    const { calls } = await run({
      generateLink: { status: 422, payload: { error_code: "email_exists", msg: "already registered" } },
    });

    const writes = calls.filter((call) => {
      const method = String(call.options?.method || "GET").toUpperCase();
      return method !== "GET" && !call.url.includes("generate_link") && !call.url.includes("consume_rate_limit");
    });
    expect(writes).toEqual([]);
  });
});
