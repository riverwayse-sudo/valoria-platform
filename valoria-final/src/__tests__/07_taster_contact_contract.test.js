"use strict";
const fs = require("fs");
const path = require("path");

// submit-taster.js reads these at module load time, so they must be set first.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://unit-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "unit-test-service-role";

const { TASTER_QUESTIONS, computeTasterResult } = require("../../src/valuTaster.js");
const submitTaster = require("../../api/submit-taster.js").default;

const API_SOURCE = fs.readFileSync(path.join(__dirname, "../../api/submit-taster.js"), "utf8");
const RPC_MIGRATION = fs.readFileSync(
  path.join(__dirname, "../../supabase/migrations/20261016121500_fix_taster_submission_ambiguous_reference.sql"),
  "utf8"
);

describe("Snapshot submission contact contract", () => {
 test("requires a valid normalized email at the API boundary", () => {
  expect(API_SOURCE).toContain("const { resume_token, submission_key } = req.body || {}");
  expect(API_SOURCE).toContain("taster_progress?");
  expect(API_SOURCE).toContain("progress.current_question !== TASTER_QUESTIONS.length");
 });
 test("uses the validated normalized email in the identity projection", () => {
  expect(API_SOURCE).toContain("p_email: normalizedEmail");
  expect(API_SOURCE).toContain("submit_taster_with_identity_candidate");
 });
 test("keeps server-side answer validation and rate limiting", () => {
  expect(API_SOURCE).toContain("consumeRateLimit(ip)");
  expect(API_SOURCE).toContain("validAnswers(answers)");
  expect(API_SOURCE).toContain("computeTasterResult(answers)");
 });
});

describe("Snapshot submission RPC payload", () => {
 const RESUME_TOKEN = "A".repeat(43);
 const SUBMISSION_KEY = "8f14e45f-ceea-467a-9f4a-1b2c3d4e5f60";

 function declaredRpcParams() {
  return [...RPC_MIGRATION.matchAll(/^\s+(p_[a-z_]+)\s+(?:uuid|text|jsonb)/gm)].map(match => match[1]);
 }

 function answersAtOption(index) {
  const answers = {};
  TASTER_QUESTIONS.forEach((_, questionIndex) => { answers[questionIndex] = index; });
  return answers;
 }

 function answersAtLastOption() {
  const answers = {};
  TASTER_QUESTIONS.forEach((question, questionIndex) => { answers[questionIndex] = question.options.length - 1; });
  return answers;
 }

 function stub(json) {
  return { ok: true, json: async () => json };
 }

 function makeRes() {
  const res = { statusCode: null, headers: {}, body: null };
  res.status = code => { res.statusCode = code; return res; };
  res.setHeader = (name, value) => { res.headers[name] = value; return res; };
  res.json = body => { res.body = body; return res; };
  return res;
 }

 async function submitSnapshot(answers) {
  const calls = [];
  global.fetch = jest.fn(async (url, init = {}) => {
   const target = String(url);
   calls.push({ target, init });
   if (target.includes("consume_rate_limit")) return stub({ allowed: true });
   if (target.includes("taster_progress")) {
    return stub([{
     name: "Ada Lovelace",
     role: "Engineer",
     experience: "5-9 years",
     email: "ada@example.com",
     current_question: TASTER_QUESTIONS.length,
     answers,
     submission_key: SUBMISSION_KEY,
    }]);
   }
   if (target.includes("submit_taster_with_identity_candidate")) {
    return stub([{ taster_id: "11111111-1111-4111-8111-111111111111", created: true }]);
   }
   throw new Error(`unexpected fetch: ${target}`);
  });

  const res = makeRes();
  await submitTaster(
   { method: "POST", headers: {}, body: { resume_token: RESUME_TOKEN, submission_key: SUBMISSION_KEY }, socket: {} },
   res
  );
  const rpcCall = calls.find(call => call.target.includes("submit_taster_with_identity_candidate"));
  return { res, payload: rpcCall ? JSON.parse(rpcCall.init.body) : null };
 }

 afterEach(() => { delete global.fetch; });

 test("sends every parameter the atomic RPC declares", async () => {
  const { res, payload } = await submitSnapshot(answersAtOption(0));
  expect(res.statusCode).toBe(200);
  expect(payload).not.toBeNull();
  expect(Object.keys(payload).sort()).toEqual(declaredRpcParams().sort());
 });

 test("sends the points-based cluster scores rather than a dropped undefined field", async () => {
  const answers = answersAtOption(0);
  const { payload } = await submitSnapshot(answers);
  const expected = computeTasterResult(answers);

  // Before PR #59 the handler sent results.normalisedScores, which computeTasterResult
  // no longer returns. JSON.stringify drops undefined values, so p_cluster_scores
  // disappeared from the body entirely and PostgREST could not resolve the overload.
  expect("p_cluster_scores" in payload).toBe(true);
  expect(payload.p_cluster_scores).not.toBeUndefined();
  expect(payload.p_cluster_scores).toEqual(expected.points);
  expect(payload.p_cluster_scores).toEqual({ P: 4, R: 10, I: 6, M: 6, E: 3 });
 });

 test("derives strongest and weakest clusters from the same points payload", async () => {
  const answers = answersAtLastOption();
  const { payload } = await submitSnapshot(answers);
  const expected = computeTasterResult(answers);

  expect(payload.p_cluster_scores).toEqual(expected.points);
  expect(payload.p_strongest_cluster).toBe(expected.strongest.id);
  expect(payload.p_weakest_cluster).toBe(expected.weakest.id);
 });
});
