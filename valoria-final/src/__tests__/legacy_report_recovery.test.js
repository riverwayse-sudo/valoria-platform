"use strict";

const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "../../api/generate-and-send-report.js"),
  "utf8"
);

describe("Legacy assessment report recovery security contract", () => {
  test("only a CRON-authenticated worker can resolve an assessment by identity hash", () => {
    expect(source).toContain("const workerIdentityOnly = isAuthorizedWorker");
    expect(source).toContain("isValidIdentityHash(requestedIdentityHash)");
    expect(source).toContain("fetchAssessment(report_token, workerIdentityOnly ? requestedIdentityHash : null)");
    expect(source).toContain("Public requests must resolve by the opaque report token");
  });

  test("public report generation still requires an opaque report token", () => {
    expect(source).toContain('error: "Valid report token is required"');
    expect(source).toContain("if (!isValidReportToken(report_token) && !workerIdentityOnly)");
    expect(source).toContain("if (!isAuthorizedWorker) {");
  });

  test("legacy recovery does not weaken rate limiting for public triggers", () => {
    expect(source).toContain('namespace: "report-trigger-ip"');
    expect(source).toContain("consumePublicTriggerRateLimit(report_token)");
    expect(source).toContain("if (!isAuthorizedWorker) {");
  });
});
