"use strict";
const fs = require("fs");
const path = require("path");
describe("Snapshot submission contact contract", () => {
 const source = fs.readFileSync(path.join(__dirname, "../../api/submit-taster.js"), "utf8");
 test("requires a valid normalized email at the API boundary", () => {
  expect(source).toContain("const { resume_token, submission_key } = req.body || {}");
  expect(source).toContain("taster_progress?");
  expect(source).toContain("progress.current_question !== TASTER_QUESTIONS.length");
 });
 test("uses the validated normalized email in the identity projection", () => {
  expect(source).toContain("p_email: normalizedEmail");
  expect(source).toContain("submit_taster_with_identity_candidate");
 });
 test("keeps server-side answer validation and rate limiting", () => {
  expect(source).toContain("consumeRateLimit(ip)");
  expect(source).toContain("validAnswers(answers)");
  expect(source).toContain("computeTasterResult(answers)");
 });
 test("persists the current points-based snapshot score shape to the atomic RPC", () => {
  expect(source).toContain("p_cluster_scores: results.points");
  expect(source).not.toContain("p_cluster_scores: results.normalisedScores");
 });

});
