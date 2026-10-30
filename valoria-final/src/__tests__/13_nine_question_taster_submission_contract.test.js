"use strict";
const fs = require("fs");
const path = require("path");

const MIGRATIONS = path.join(__dirname, "../../supabase/migrations");
const readMigration = name => fs.readFileSync(path.join(MIGRATIONS, name), "utf8");

describe("nine-question taster submission contract", () => {
  const fix = readMigration("20261029220000_accept_nine_question_taster_submission.sql");

  test("the atomic submission RPC accepts the nine approved answers", () => {
    expect(fix).toContain("(SELECT count(*) FROM jsonb_object_keys(p_answers)) <> 9");
    expect(fix).toContain("'all 9 snapshot answers are required'");
    expect(fix).not.toContain("<> 15");
  });

  test("every later definition of the RPC agrees on the answer count", () => {
    const definitions = fs.readdirSync(MIGRATIONS)
      .filter(name => name.endsWith(".sql"))
      .filter(name => readMigration(name).includes("FUNCTION public.submit_taster_with_identity_candidate"))
      .sort();
    // Migrations apply in filename order, so the last definition is the effective one.
    const effective = definitions[definitions.length - 1];
    expect(effective).toBe("20261030090000_explicit_taster_completion.sql");
    expect(readMigration(effective)).toContain("(SELECT count(*) FROM jsonb_object_keys(p_answers)) <> 9");
    for (const name of definitions) {
      // Every definition rejects an incomplete snapshot; only the newest accept nine.
      expect(readMigration(name)).toMatch(/jsonb_object_keys\(p_answers\)\) <> (9|15)/);
    }
  });

  test("the correction preserves the identity, ownership and retry rules verbatim", () => {
    for (const rule of [
      "submission key is required",
      "valid name is required",
      "valid role is required",
      "valid email is required",
      "cluster scores must be an object",
      "submission retry could not be reconciled",
      "submission key was reused with different snapshot data",
      "ON CONFLICT ON CONSTRAINT taster_identity_candidates_pkey DO NOTHING",
      "SET search_path = pg_catalog, public",
    ]) {
      expect(fix).toContain(rule);
    }
    expect(fix).toContain("REVOKE ALL ON FUNCTION public.submit_taster_with_identity_candidate");
    expect(fix).toContain("GRANT EXECUTE ON FUNCTION public.submit_taster_with_identity_candidate");
  });

  test("the migration only replaces the function and does not touch stored snapshots", () => {
    expect(fix).not.toMatch(/DELETE\s+FROM/i);
    expect(fix).not.toMatch(/TRUNCATE/i);
    expect(fix).not.toMatch(/UPDATE\s+public\.taster_sessions/i);
  });

  test("a submitted snapshot is stamped complete so the full assessment can continue", () => {
    // The handoff gate refuses to start unless the linked snapshot has
    // completed_at set. Nothing wrote that column before this migration, so
    // completion depended on an environment default that no migration declared
    // and CI never exercised.
    const completion = readMigration("20261030090000_explicit_taster_completion.sql");
    expect(completion).toContain("alter column completed_at set default now()");
    const insert = completion.slice(completion.indexOf("INSERT INTO public.taster_sessions"));
    expect(insert).toContain("submission_key, completed_at");
    expect(insert).toContain("p_submission_key, now()");
  });

  test("already-submitted snapshots missing their completion stamp are recovered idempotently", () => {
    const completion = readMigration("20261030090000_explicit_taster_completion.sql");
    const repair = completion.slice(completion.indexOf("UPDATE public.taster_sessions t"));
    // Repairs only the missing stamp, guarded so a rerun cannot rewrite history.
    expect(repair).toContain("SET completed_at = t.created_at");
    expect(repair).toContain("WHERE t.completed_at IS NULL");
    expect(repair).toContain("jsonb_typeof(t.taster_answers) = 'object'");
    // Never rewrites answers, scores or ownership.
    expect(repair).not.toMatch(/taster_answers\s*=/);
    expect(repair).not.toMatch(/cluster_scores\s*=/);
    expect(repair).not.toMatch(/user_id\s*=/);
    expect(completion).not.toMatch(/DELETE\s+FROM/i);
  });
});
