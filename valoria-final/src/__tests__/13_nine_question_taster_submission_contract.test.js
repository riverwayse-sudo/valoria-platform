"use strict";
const fs = require("fs");
const path = require("path");

const MIGRATIONS = path.join(__dirname, "../../supabase/migrations");
const readMigration = name => fs.readFileSync(path.join(MIGRATIONS, name), "utf8");

describe("versioned taster submission contract", () => {
  const canonicalFixName = fs.readdirSync(MIGRATIONS).find(name => name.includes("restore_writer_taster_v40"));
  const canonicalFix = canonicalFixName ? readMigration(canonicalFixName) : "";

  test("the historical nine-question correction remains immutable and documented", () => {
    const historical = readMigration("20261029220000_accept_nine_question_taster_submission.sql");
    expect(historical).toContain("jsonb_object_keys(p_answers)) <> 9");
    expect(historical).toContain("'all 9 snapshot answers are required'");
  });

  test("the newest RPC definition restores the canonical 15-answer contract", () => {
    expect(canonicalFixName).toBeTruthy();
    expect(canonicalFix).toContain("jsonb_object_keys(p_answers)) <> 15");
    expect(canonicalFix).toContain("'all 15 snapshot answers are required'");
    expect(canonicalFix).toContain("lead_capture_id");
    expect(canonicalFix.toLowerCase()).toContain("security invoker");
  });

  test("the new-session defaults are 4.0 and 15 without rewriting saved progress", () => {
    expect(canonicalFix).toContain("alter column taster_version set default '4.0'");
    expect(canonicalFix).toContain("alter column total_questions set default 15");
    expect(canonicalFix).not.toMatch(/UPDATE\s+public\.taster_progress/i);
    expect(canonicalFix).not.toMatch(/DELETE\s+FROM/i);
    expect(canonicalFix).not.toMatch(/TRUNCATE/i);
  });

  test("identity ownership and retry protections remain present", () => {
    for (const rule of [
      "submission key is required",
      "lead registration is required before a snapshot can be submitted",
      "registered lead does not match the snapshot identity",
      "submission retry could not be reconciled",
      "submission key was reused with different snapshot or registration data",
      "snapshot identity candidate is linked to a different registration",
      "security invoker",
      "REVOKE ALL ON FUNCTION public.submit_taster_with_identity_candidate",
      "GRANT EXECUTE ON FUNCTION public.submit_taster_with_identity_candidate",
    ]) expect(canonicalFix).toContain(rule);
  });

  test("historical snapshot completion remains independently protected", () => {
    const completion = readMigration("20261030090000_explicit_taster_completion.sql");
    expect(completion).toContain("alter column completed_at set default now()");
    expect(completion).toContain("WHERE t.completed_at IS NULL");
    expect(completion).not.toMatch(/DELETE\s+FROM/i);
  });
});
