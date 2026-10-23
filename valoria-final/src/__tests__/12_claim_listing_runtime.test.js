// valoria-final/src/__tests__/12_claim_listing_runtime.test.js
//
// Runtime coverage for api/claim-listing.js, which creates the marketplace
// profile and takes ownership of an assessment. It is the endpoint where a wrong
// answer changes who owns a record and what a participant is shown about their
// eligibility, so it matters more than most.
//
// It was covered only by substring assertions in 05_api_security_contract.test.js
// and 08_claim_taster_unresolved_candidates.test.js. Executing it confirms the
// handler is sound (unlike update-assessment, which had the same shape of
// coverage but two real defects), and pins the behaviour so it stays that way.
//
// Behaviours pinned:
//   * ownership is taken with a conditional PATCH (`user_id=is.null`) and the
//     result is checked, so a concurrent claimant cannot be overwritten;
//   * a losing race rolls back a profile it created, but never deletes a profile
//     that already existed;
//   * a 35+ score is reported as *score eligibility*, kept separate from
//     `listed`/`eligible_for_listing`, which come from the readiness engine.

"use strict";

const SECRET = "test-service-role-key-not-real";
const SUPABASE_URL = "https://test-project.supabase.co";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";
const ASSESSMENT_ID = "44444444-4444-4444-8444-444444444444";
const IDENTITY = "fp_abc123";
const EMAIL = "participant@example.com";

process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;

function request(body, headers = {}) {
  return {
    method: "POST",
    headers,
    json: async () => body,
  };
}

const bearer = token => ({ authorization: `Bearer ${token}` });

function assessment(overrides = {}) {
  return {
    id: ASSESSMENT_ID,
    name: "Test Participant",
    role: "Head of Operations",
    email: EMAIL,
    total_score: 40,
    cluster_scores: {},
    skill_scores: {},
    designation: "Development Pathway",
    completed_at: "2026-01-01T00:00:00Z",
    expires_at: "2027-01-01T00:00:00Z",
    user_id: null,
    ...overrides,
  };
}

function stubFetch({
  authOk = true,
  authUser = { id: USER_ID, email: EMAIL },
  assessments = [assessment()],
  profileExists = false,
  linkRows = [{ id: ASSESSMENT_ID }],
  linkStatus = 200,
  upsertStatus = 201,
  readiness = { listing_status: "unlisted", eligible_for_listing: false },
} = {}) {
  const calls = [];
  global.fetch = jest.fn(async (url, options = {}) => {
    const u = String(url);
    const method = options.method || "GET";
    calls.push({ url: u, method, headers: options.headers || {}, body: options.body });
    const ok = (json, status = 200) => ({
      ok: status >= 200 && status < 300, status,
      json: async () => json, text: async () => JSON.stringify(json),
    });
    if (u.includes("/auth/v1/user")) {
      if (!authOk) return ok({ error: "invalid" }, 401);
      return ok(authUser);
    }
    if (u.includes("/rest/v1/rpc/sync_professional_listing_status")) return ok(readiness);
    if (u.includes("/rest/v1/professional_profiles")) {
      if (method === "POST") return ok([], upsertStatus);
      if (method === "DELETE") return ok([], 204);
      return ok(profileExists ? [{ id: USER_ID }] : []);
    }
    if (u.includes("/rest/v1/valu_assessments")) {
      if (method === "PATCH") return ok(linkRows, linkStatus);
      return ok(assessments);
    }
    throw new Error(`unexpected fetch: ${method} ${u}`);
  });
  return calls;
}

async function invoke(body, headers) {
  const handler = require("../../api/claim-listing.js").default;
  const res = await handler(request(body, headers));
  return { status: res.status, body: await res.json() };
}

describe("claim-listing runtime", () => {
  afterEach(() => {
    jest.resetModules();
    delete global.fetch;
  });

  // ── authorization ────────────────────────────────────────────────────────
  test("a request without a bearer token is refused before any lookup", async () => {
    const calls = stubFetch();
    const res = await invoke({ identity_hash: IDENTITY }, {});
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  test("an invalid or expired session is refused", async () => {
    stubFetch({ authOk: false });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("stale"));
    expect(res.status).toBe(401);
  });

  test("a malformed identity_hash is refused", async () => {
    stubFetch();
    const res = await invoke({ identity_hash: "not-a-fingerprint" }, bearer("t"));
    expect(res.status).toBe(400);
  });

  // ── ownership rules ──────────────────────────────────────────────────────
  test("an assessment for a different email cannot be claimed", async () => {
    stubFetch({ authUser: { id: USER_ID, email: "attacker@example.com" } });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.status).toBe(403);
  });

  test("an assessment already owned by another account is a 409", async () => {
    stubFetch({ assessments: [assessment({ user_id: OTHER_USER_ID })] });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.status).toBe(409);
  });

  test("an unknown identity is a 404", async () => {
    stubFetch({ assessments: [] });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.status).toBe(404);
  });

  // ── the ownership write ──────────────────────────────────────────────────
  test("ownership is taken with a conditional PATCH and its result is checked", async () => {
    const calls = stubFetch();
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.status).toBe(200);
    const patch = calls.find(c => c.method === "PATCH");
    expect(patch.url).toContain("user_id=is.null");
    expect(patch.headers.Prefer).toBe("return=representation");
  });

  test("losing the claim race is a 409 and the created profile is rolled back", async () => {
    const calls = stubFetch({ profileExists: false, linkRows: [] });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.status).toBe(409);
    expect(res.body.ok).toBeUndefined();
    expect(calls.some(c => c.method === "DELETE" && c.url.includes("professional_profiles"))).toBe(true);
  });

  test("a losing race never deletes a profile that already existed", async () => {
    // Deleting here would destroy a genuine participant's profile.
    const calls = stubFetch({ profileExists: true, linkRows: [] });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.status).toBe(409);
    expect(calls.some(c => c.method === "DELETE")).toBe(false);
  });

  test("a failed ownership link is a 502 and never reports success", async () => {
    const calls = stubFetch({ linkStatus: 500, linkRows: [] });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.status).toBe(502);
    expect(res.body.ok).toBeUndefined();
    expect(calls.some(c => c.method === "DELETE" && c.url.includes("professional_profiles"))).toBe(true);
  });

  // ── eligibility vs listing, and the 35-point threshold ───────────────────
  test("a 35+ score is reported as score eligibility, distinct from listing", async () => {
    stubFetch({ assessments: [assessment({ total_score: 35 })], readiness: { listing_status: "unlisted", eligible_for_listing: false } });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.status).toBe(200);
    expect(res.body.score_eligible_for_marketplace).toBe(true);
    // A qualifying score is not a listing. This distinction must survive.
    expect(res.body.listed).toBe(false);
    expect(res.body.listing_status).toBe("unlisted");
    expect(res.body.eligible_for_listing).toBe(false);
  });

  test("a score below 35 is not marketplace eligible", async () => {
    stubFetch({ assessments: [assessment({ total_score: 34 })] });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.body.score_eligible_for_marketplace).toBe(false);
  });

  test("listing state comes from the readiness engine, not the score", async () => {
    stubFetch({ assessments: [assessment({ total_score: 90 })], readiness: { listing_status: "listed", eligible_for_listing: true } });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.body.listed).toBe(true);
    expect(res.body.listing_status).toBe("listed");
    expect(res.body.eligible_for_listing).toBe(true);
  });

  test("a failing readiness RPC degrades to unlisted rather than claiming listed", async () => {
    const calls = stubFetch();
    // Make only the RPC fail.
    const base = global.fetch;
    global.fetch = jest.fn(async (url, options = {}) => {
      if (String(url).includes("sync_professional_listing_status")) return { ok: false, status: 500, json: async () => ({}), text: async () => "err" };
      return base(url, options);
    });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(res.status).toBe(200);
    expect(res.body.listed).toBe(false);
    expect(res.body.eligible_for_listing).toBe(false);
    expect(calls.length).toBeGreaterThan(0);
  });

  test("no secret is echoed back in any error response", async () => {
    stubFetch({ authOk: false });
    const res = await invoke({ identity_hash: IDENTITY }, bearer("t"));
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });
});
