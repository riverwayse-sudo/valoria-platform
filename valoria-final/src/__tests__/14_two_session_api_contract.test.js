"use strict";

// API contract for two independent VALU assessment records.

const fs = require("fs");
const path = require("path");

const readApi = name => fs.readFileSync(path.join(__dirname, "../../api", name), "utf8");

describe("taster-progress requires registration before a new taster", () => {
  const api = readApi("taster-progress.js");

  test("registration creates the lead and resumable progress through one RPC", () => {
    expect(api).toContain("action === 'register'");
    expect(api).toContain("rpc/begin_valu_taster_signup");
    expect(api).toContain("p_resume_token_hash: hashToken(body.resume_token)");
    expect(api).toContain("p_privacy_acknowledged: body.privacy_acknowledged === true");
    expect(api).not.toContain("action === 'init'");
    expect(api).not.toContain("action === 'identify'");
  });

  test("new sessions cannot be initialized anonymously and registration is rate limited", () => {
    expect(api).toContain("['register', 'load', 'save', 'complete']");
    expect(api).toContain("consumeRegistrationRateLimit(req)");
    expect(api).toContain("p_limit: 12");
  });

  test("resume reads preserve the direct lead identity link", () => {
    expect(api).toContain("lead_capture_id");
    expect(api).toContain("progress.lead_capture_id");
    expect(api).toContain("lead_capture_id: `eq.${progress.lead_capture_id}`");
  });

  test("legacy identity fields remain nullable while new taster inserts require a lead", () => {
    const migrations = path.join(__dirname, "../../supabase/migrations");
    const relax = fs.readFileSync(path.join(migrations, "20261030120000_relax_taster_progress_identity_nullable.sql"), "utf8");
    const identity = fs.readFileSync(path.join(migrations, "20261107131125_require_lead_registration_for_new_valu_tasters.sql"), "utf8");
    for (const col of ["name", "role", "experience", "email"]) {
      expect(relax).toMatch(new RegExp(`ALTER COLUMN ${col} DROP NOT NULL`, "i"));
    }
    expect(identity).toContain("taster_progress_lead_capture_id_fkey");
    expect(identity).toContain("taster_sessions_lead_capture_id_fkey");
    expect(identity).toContain("trg_require_lead_capture_for_taster_progress");
    expect(identity).toContain("trg_require_lead_capture_for_taster_session");
  });
});

describe("full-assessment progress is independent of taster progress", () => {
  const progressApi = readApi("assessment-progress.js");
  const submitApi = readApi("submit-assessment.js");

  test("full progress restore reads its own table and never reads taster answers", () => {
    expect(progressApi).toContain("valu_assessment_progress");
    expect(progressApi).not.toContain("taster_answers");
    expect(progressApi).not.toContain("seedAnswersFromOpening");
    expect(progressApi).not.toContain("seeded_answers");
    expect(progressApi).toContain("totalQuestions !== QUESTIONS.length");
    expect(progressApi).toContain("Number(progress.total_questions) !== QUESTIONS.length");
    expect(progressApi).not.toContain("assessment_version");
  });

  test("assessment reminder emails never expose internal question counts", () => {
    expect(progressApi).not.toContain("${row.current_question} / ${row.total_questions} questions");
    expect(progressApi).not.toContain("${remaining} remaining");
    expect(progressApi).toContain("Your responses are saved. Continue where you left off");
  });

  test("a participant without saved full progress starts at the beginning of the full assessment", () => {
    const component = fs.readFileSync(path.join(__dirname, "../FullVALUAssessment.jsx"), "utf8");
    expect(component).toContain("setCurrent(0)");
    expect(component).toContain("nextPlaceToAnswer(restoredAnswers, 1)");
  });

  test("final submission scores the full 58-answer map without merging the taster", () => {
    expect(submitApi).toContain("if (!validateAnswers(answers))");
    expect(submitApi).toContain("const completeAnswers = answers");
    expect(submitApi).toContain("computeResults(completeAnswers, timings, shuffleMap, QUESTIONS)");
    expect(submitApi).toContain("answers: completeAnswers");
    expect(submitApi).not.toContain("seedAnswersFromOpening");
    expect(submitApi).not.toContain("taster_answers");
    expect(submitApi).not.toContain("validateRemainingAnswers");
  });

  test("taster identity is used only to verify account ownership and journey provenance", () => {
    expect(submitApi).toContain("taster.user_id !== handoff.sub");
    expect(submitApi).toContain("taster_id: tasterId, user_id: resolvedUserId");
    expect(submitApi).not.toContain("select: 'id,user_id,name,role,completed_at,taster_answers'");
  });
});

describe("full assessment submission validates a complete answer map", () => {
  const api = readApi("submit-assessment.js");

  test("timings are bounded integrity diagnostics and never part of scoring", () => {
    expect(api).toContain("const MAX_TIMINGS_LENGTH = QUESTIONS.length");
    expect(api).toContain("timings.length < 1 || timings.length > MAX_TIMINGS_LENGTH");
    expect(api).toContain("value > 86_400_000");
    expect(api).not.toContain("timings.length !== MAX_TIMINGS_LENGTH");
  });

  test("the scoring engine receives exactly the submitted full-assessment answers", () => {
    expect(api).toContain("const completeAnswers = answers");
    expect(api).toContain("computeResults(completeAnswers, timings, shuffleMap, QUESTIONS)");
    expect(api).toContain("import { QUESTIONS } from '../src/questions.js'");
  });
});
