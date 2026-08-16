"use strict";

const fs = require("fs");
const path = require("path");

const API_ROOT = path.join(__dirname, "../../api");

function readApi(name) {
  return fs.readFileSync(path.join(API_ROOT, name), "utf8");
}

describe("Privileged API security contracts", () => {
  const internalApis = [
    "get-assessment-data.js",
    "report.js",
    "save-report.js",
    "finalize-report.js",
    "send-email.js",
    "generate-and-send-report.js",
    "sweep-unsent-reports.js",
    "system-status.js",
  ];

  test.each(internalApis)("%s requires CRON_SECRET", (file) => {
    const source = readApi(file);
    expect(source).toContain("CRON_SECRET");
    expect(source).toMatch(/!CRON_SECRET|CRON_SECRET.*missing|CRON_SECRET.*required/);
  });

  test.each(internalApis)("%s does not expose raw provider/database errors", (file) => {
    const source = readApi(file);
    expect(source).not.toMatch(/return\s+json\(\{\s*error:\s*[^}]*\.message/);
    expect(source).not.toMatch(/error:\s*[^,}]*\.body/);
  });

  test("privileged endpoints disable caching where sensitive data is returned", () => {
    const sensitive = [
      "get-assessment-data.js",
      "report.js",
      "save-report.js",
      "finalize-report.js",
      "system-status.js",
    ];
    sensitive.forEach((file) => {
      const source = readApi(file);
      expect(source).toContain("no-store");
    });
  });
});

describe("Identity ownership contracts", () => {
  test("claim-listing derives ownership from the verified auth user", () => {
    const source = readApi("claim-listing.js");
    expect(source).toContain("auth.getUser");
    expect(source).toContain("authUser.id");
    expect(source).toContain("authUser.email");
    expect(source).toContain("user_id: authUser.id");
    expect(source).not.toMatch(/user_id\s*=\s*fields\.user_id/);
  });

  test("update-assessment verifies the authenticated user", () => {
    const source = readApi("update-assessment.js");
    expect(source).toContain("auth.getUser");
    expect(source).toContain("user_id");
  });

  test("account creation verifies assessment/email matching before linking", () => {
    const source = readApi("create-account.js");
    expect(source).toContain("assessment.email");
    expect(source).toContain("assessment.user_id");
    expect(source).toContain("identity_hash");
  });
});

describe("Assessment integrity contracts", () => {
  test("submission cannot overwrite an existing identity assessment", () => {
    const source = readApi("submit-assessment.js");
    expect(source).toContain("computeFingerprint");
    expect(source).not.toContain("resolution=merge-duplicates");
    expect(source).toContain("status === 409");
  });

  test("submission bounds attacker-controlled collections", () => {
    const source = readApi("submit-assessment.js");
    expect(source).toContain("MAX_NAME_LENGTH");
    expect(source).toContain("MAX_ROLE_LENGTH");
    expect(source).toContain("MAX_TIMINGS_LENGTH");
    expect(source).toContain("MAX_SHUFFLE_KEYS");
    expect(source).toContain("Number.isFinite");
  });
});
