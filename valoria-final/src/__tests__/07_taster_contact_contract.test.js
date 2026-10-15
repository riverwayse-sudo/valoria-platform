"use strict";
const fs = require("fs");
const path = require("path");
describe("Snapshot submission contact contract", () => {
 const source = fs.readFileSync(path.join(__dirname, "../../api/submit-taster.js"), "utf8");
 test("requires a valid normalized email at the API boundary", () => {
  expect(source).toContain("const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''");
  expect(source).toContain("if (!normalizedEmail || normalizedEmail.length > 254");
  expect(source).toContain("A valid email address is required before starting a VALU snapshot.");
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
});
