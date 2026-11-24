"use strict";

const fs = require("node:fs");
const path = require("node:path");

const read = relative => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
const readApi = name => fs.readFileSync(path.join(__dirname, "../../api", name), "utf8");

describe("parallel Taster-first journey isolation", () => {
  const api = readApi("taster-first-progress.js");
  const worker = read("../../worker.js");
  const app = read("VALUIndexV4App.jsx");
  const component = read("VALUIndexTasterFirst.jsx");
  const migration = read("../../supabase/migrations/20261124193000_preaccount_taster_first_sessions.sql");

  test("Taster-first is opt-in and the current account-first experience remains the default", () => {
    expect(app).toContain('params.get("journey") === "taster-first"');
    expect(app).toContain("<VALUIndexV4GateNext />");
    expect(app).toContain("<VALUIndexTasterFirst");
    expect(component).toContain("api/taster-first-progress");
  });

  test("new API is registered on the assessment Worker without replacing existing handlers", () => {
    expect(worker).toContain('"/api/taster-first-progress"');
    expect(worker).toContain('"/api/taster-progress"');
    expect(worker).toContain('"/api/submit-taster"');
  });

  test("pre-account session storage is private and token hashes are stored instead of bearer tokens", () => {
    expect(migration).toContain("resume_token_hash text not null unique");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.valu_preaccount_taster_progress from public, anon, authenticated");
    expect(migration).toContain("grant all on table public.valu_preaccount_taster_progress to service_role");
    expect(api).toContain("createHash('sha256')");
    expect(api).toContain("randomBytes(32).toString('base64url')");
    expect(component).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(api).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
  });

  test("start requires privacy acknowledgement and applies IP and email rate limits", () => {
    expect(api).toContain("body.privacy_acknowledged !== true");
    expect(api).toContain("namespace: 'taster-first-email'");
    expect(api).toContain("namespace: 'taster-first'");
  });

  test("only the approved nine-question bank can be saved or completed", () => {
    expect(api).toContain("TASTER_QUESTIONS.length");
    expect(api).toContain("validAnswers(session.answers)");
    expect(api).toContain("Object.keys(session.answers).length !== TASTER_QUESTIONS.length");
    expect(api).toContain("p_taster_version: VALU_VERSION");
    expect(component).toContain("VALU_VERSION");
    expect(component).not.toContain("VALUIndexV4GateNext");
  });

  test("completion reuses canonical idempotent registration and snapshot RPCs", () => {
    expect(api).toContain("rpc('begin_valu_taster_signup'");
    expect(api).toContain("rpc('submit_taster_with_identity_candidate'");
    expect(api).toContain("p_signup_key: session.signup_key");
    expect(api).toContain("p_submission_key: session.submission_key");
    expect(api).toContain("status: 'completed', taster_id: submitted.taster_id");
    expect(api).toContain("already_completed: true");
  });

  test("the formal 58-question assessment remains separate and unchanged", () => {
    expect(app).toContain("if (full) return <FullVALUAssessment />");
    expect(component).toContain("separate from your full 58-question VALU Index");
    expect(component).not.toContain("Question 10");
    expect(component).not.toContain("1 of 9");
    expect(component).not.toContain("1 of 58");
  });

  test("the result CTA carries the completed Taster to the existing account-creation handoff", () => {
    expect(component).toContain('localStorage.setItem("pending_taster_id",payload.taster_id)');
    expect(app).toContain('"/professional-signup/?"');
    expect(app).toContain("taster_id: tasterId");
    expect(app).toContain("experience, email");
  });
});
