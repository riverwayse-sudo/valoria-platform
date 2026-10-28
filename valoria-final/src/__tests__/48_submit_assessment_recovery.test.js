"use strict";

/**
 * Recovery contract for the full-assessment block-scope defect.
 *
 * The defect committed the valu_assessments row and then threw, so a participant
 * could hold a saved assessment with no successful response and no accessible
 * result. This suite proves that such a submission is recoverable by retrying,
 * and that the retry does not create a second row.
 *
 * It is deliberately transport-level and stateful: the fake commits a row on the
 * first POST and serves it on later GETs, which is exactly what the database did.
 */

import { createHmac } from "node:crypto";
import { QUESTIONS } from "../questions.js";

const SERVICE_ROLE = "service-role-key";
const TASTER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const REPORT_TOKEN = "33333333-3333-4333-8333-333333333333";

function handoffToken(sub, tasterId) {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({
    v: 1, aud: "valu-full-assessment", sub, taster_id: tasterId,
    iat: now, exp: now + 3600, jti: "j".repeat(24),
  })).toString("base64url");
  const sig = createHmac("sha256", SERVICE_ROLE).update(body).digest().toString("base64url");
  return `${body}.${sig}`;
}

function loadHandler() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE;
  const path = require.resolve("../../api/submit-assessment.js");
  delete require.cache[path];
  return require("../../api/submit-assessment.js").default;
}

const jsonResponse = (status, data) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

function makeReq() {
  return {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.9" },
    socket: {},
    body: {
      name: "Temitayo Adeyemi", role: "Programme Manager", experience: "9-15",
      answers: Object.fromEntries(QUESTIONS.map((_, i) => [i, 0])),
      timings: QUESTIONS.map(() => 1200),
      shuffleMap: {},
      taster_id: TASTER_ID,
      handoff_token: handoffToken(USER_ID, TASTER_ID),
    },
  };
}

function makeRes() {
  const res = { statusCode: 0, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; return res; };
  res.json = (p) => { res.body = p; return res; };
  return res;
}

// A stateful fake: the first POST commits a row; later GETs return it.
function installStatefulFetch() {
  const db = { rows: [], inserts: 0 };
  global.fetch = async (url, options = {}) => {
    if (url.includes("rpc/consume_rate_limit")) return jsonResponse(200, { allowed: true });
    if (url.includes("/rest/v1/taster_sessions")) {
      return jsonResponse(200, [{ id: TASTER_ID, user_id: USER_ID, name: "Temitayo Adeyemi", role: "Programme Manager", completed_at: "2026-10-25T09:00:00.000Z" }]);
    }
    if (url.includes("/auth/v1/admin/users/")) {
      return jsonResponse(200, { id: USER_ID, email: "temitayo@example.com", email_confirmed_at: "2026-10-25T09:00:00.000Z" });
    }
    if (url.includes("/rest/v1/valu_assessments")) {
      if (options.method === "POST") {
        db.inserts += 1;
        db.rows.push({
          id: "row-1", user_id: USER_ID, taster_id: TASTER_ID, total_score: 71,
          designation: "Strategist", cluster_scores: {}, skill_scores: {},
          completed_at: "2026-10-25T09:00:00.000Z", report_token: REPORT_TOKEN,
        });
        return jsonResponse(201, [{ identity_hash: "abc", report_token: REPORT_TOKEN }]);
      }
      return jsonResponse(200, db.rows.slice(0, 1));
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return db;
}

describe("Full assessment data recovery", () => {
  afterEach(() => { delete global.fetch; jest.restoreAllMocks(); });

  test("a row committed by a failed first attempt is recovered on retry, with no duplicate", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const db = installStatefulFetch();
    const handler = loadHandler();

    // Attempt 1: no existing row, so the insert commits the row and returns the
    // report token. On the pre-fix code the handler then threw; the row was
    // already written either way.
    const res1 = makeRes();
    await handler(makeReq(), res1);
    expect(res1.statusCode).toBe(200);
    expect(db.inserts).toBe(1);
    expect(db.rows).toHaveLength(1);

    // Attempt 2 (the participant's retry): the row now exists, so it is found
    // before any insert and returned with the original report token.
    const res2 = makeRes();
    await handler(makeReq(), res2);

    expect(res2.statusCode).toBe(200);
    expect(res2.body.report_token).toBe(REPORT_TOKEN);
    expect(res2.body.alreadyCompleted).toBe(true);
    expect(db.inserts).toBe(1); // still one insert: the retry did not duplicate
    expect(db.rows).toHaveLength(1);
  });
});
