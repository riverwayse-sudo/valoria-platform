const fs = require("fs");
const path = require("path");

const API_ROOT = path.join(__dirname, "../../api");
const IDENTITY_REFERENCE_FILES = [
  "create-account.js",
  "resend-confirmation.js",
  "claim-listing.js",
  "send-profile-reminder.js",
  "generate-and-send-report.js",
];

describe("VALU identity reference contract", () => {
  const canonicalPattern = /^fp_[a-z0-9]{1,128}$/i;

  test.each([
    ["legacy snapshot-linked reference", "fp_7q2m9k", true],
    ["base-36 reference", "fp_z8a4q1", true],
    ["long alphanumeric reference", `fp_${"a1b2c3d4e5f6".repeat(4)}`, true],
    ["missing prefix", "7q2m9k", false],
    ["empty suffix", "fp_", false],
    ["punctuation in suffix", "fp_bad-value", false],
    ["whitespace", "fp_7q2m9k ", false],
  ])("%s", (_label, value, expected) => {
    expect(canonicalPattern.test(value)).toBe(expected);
  });

  test.each(IDENTITY_REFERENCE_FILES)(
    "%s accepts the shared identity-reference format",
    (filename) => {
      const source = fs.readFileSync(path.join(API_ROOT, filename), "utf8");
      expect(source).toContain("/^fp_[a-z0-9]{1,128}$/i");
    }
  );
});
