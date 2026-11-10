import { canonicalDesignationName } from "../../api/_canonicalDesignation.js";
import fs from "node:fs";
import path from "node:path";

const read = (relative) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("canonical VALU designation consumers", () => {
  test.each([
    [34, null],
    [35, "Standard"],
    [54, "Standard"],
    [55, "Proficient"],
    [74, "Proficient"],
    [75, "Distinguished"],
    [89, "Distinguished"],
    [90, "Elite"],
    [100, "Elite"],
  ])("score %i resolves to %s", (score, expected) => {
    expect(canonicalDesignationName(score)).toBe(expected);
  });

  test.each([null, undefined, "not-a-score", -1, 101, Infinity])(
    "invalid score %s has no designation",
    (score) => {
      expect(canonicalDesignationName(score)).toBeNull();
    }
  );

  test("participant-facing API consumers derive labels from canonical points", () => {
    for (const file of [
      "api/submit-assessment.js",
      "api/create-account.js",
      "api/claim-listing.js",
      "api/send-profile-reminder.js",
    ]) {
      const source = read(file);
      expect(source).toContain("canonicalDesignationName");
      expect(source).not.toContain("assessment.designation");
    }
  });
});
