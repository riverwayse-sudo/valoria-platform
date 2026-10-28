// valoria-final/src/__tests__/25_submit_control_contract.test.js
//
// The final submit control. The brief asks that it be "accessible and correctly
// validate the assessment", and the audit recorded an incident where it was not.
//
// The defect: the button was rendered whenever the last question was on screen,
// disabled only when that question was unanswered. `submitAssessment()` had a
// second precondition — a live handoff token — that the button did not reflect.
// A participant whose handoff had lapsed saw a fully styled, enabled
// SUBMIT button, clicked it, and nothing happened: no request, no error, no
// state change. The component returns before setting any state, so there was
// nothing on screen to explain it.
//
// These tests pin both halves: the control's disabled state must account for
// every precondition the handler enforces, and every early return in the handler
// must produce feedback.

"use strict";

const fs = require("fs");
const path = require("path");

const SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "FullVALUAssessment.jsx"),
  "utf8"
);

describe("final submit control", () => {
  test("readiness accounts for the handoff token, not just the last answer", () => {
    const readiness = SOURCE.match(/const canSubmit = ([^\n]+)/);
    expect(readiness).not.toBeNull();
    expect(readiness[1]).toMatch(/handoffToken/);
    expect(readiness[1]).toMatch(/handoffStatus/);
    expect(readiness[1]).toMatch(/finalAnswered/);
  });

  test("the button is disabled from the computed readiness, not an inline partial check", () => {
    const button = SOURCE.match(/onClick=\{submitAssessment\}([\s\S]{0,400}?)>/);
    expect(button).not.toBeNull();
    expect(button[1]).toMatch(/disabled=\{!canSubmit\}/);
    // The old shape disabled on `saving || !hasOwnProperty(answers, len-1)`.
    expect(button[1]).not.toMatch(/disabled=\{saving \|\|/);
  });

  test("the disabled state is announced, not only styled", () => {
    const button = SOURCE.match(/onClick=\{submitAssessment\}([\s\S]{0,400}?)>/);
    expect(button[1]).toMatch(/aria-disabled=\{!canSubmit\}/);
  });

  // A disabled control must explain itself. Without this the participant is left
  // to guess, which is the accessibility half of the incident.
  test("each blocking condition has an explanatory message", () => {
    expect(SOURCE).toMatch(/submitHint/);
    expect(SOURCE).toMatch(/Answer this final question to submit/);
    expect(SOURCE).toMatch(/unanswered/);
    expect(SOURCE).toMatch(/secure session has expired/);
  });

  // The handler must not return without telling the participant why.
  test("the handler reports a lapsed handoff instead of returning silently", () => {
    const handler = SOURCE.match(/async function submitAssessment\(\) \{([\s\S]*?)\n  \}/);
    expect(handler).not.toBeNull();
    const body = handler[1];
    expect(body).toMatch(/handoffStatus !== 'ready' \|\| !handoffToken/);

    // Every guard that can block a click must set an error before returning.
    // The single exception is the re-entrancy guard, which is hit only while a
    // request is already in flight or after success — a state the UI already
    // shows, and for which a duplicate message would be noise.
    const silentGuards = body
      .split("\n")
      .filter((line) => /^\s+if \(.+\) return;$/.test(line.trimEnd()))
      .filter((line) => !/saving \|\| result/.test(line));
    expect(silentGuards).toEqual([]);
  });

  // Each non-re-entrancy guard must be followed by setError within its block.
  test("each blocking guard produces a message", () => {
    const body = SOURCE.match(/async function submitAssessment\(\) \{([\s\S]*?)\n  \}/)[1];
    const setErrorCount = (body.match(/setError\(/g) || []).length;
    // Three guarded exits (lapsed handoff, unanswered final question, and the
    // generic catch), plus the initial clear.
    expect(setErrorCount).toBeGreaterThanOrEqual(3);
  });

  test("a failed submit clears the saving flag so the control is usable again", () => {
    const handler = SOURCE.match(/async function submitAssessment\(\) \{([\s\S]*?)\n  \}/)[1];
    expect(handler).toMatch(/finally \{[\s\S]*?setSaving\(false\)/);
  });

  // Retry safety: submission must not be re-entrant while in flight, and the
  // token is only cleared after a terminal outcome.
  test("submission is not re-entrant", () => {
    const handler = SOURCE.match(/async function submitAssessment\(\) \{([\s\S]*?)\n  \}/)[1];
    expect(handler).toMatch(/if \(saving \|\| result\) return;/);
  });
});

describe("assessment completeness validation", () => {
  // The client can only reason about the last answer; the server must enforce the
  // whole set. If this contract is dropped, a partial assessment could be scored.
  const server = fs.readFileSync(path.join(__dirname, "..", "..", "api", "submit-assessment.js"), "utf8");

  test("the server requires exactly the canonical question count", () => {
    expect(server).toMatch(/Object\.keys\(answers\)\.length !== QUESTIONS\.length/);
  });

  test("the server requires every answer to be a valid option index", () => {
    expect(server).toMatch(/value >= 0 && value < question\.options\.length/);
  });

  test("an incomplete submission is rejected before any write", () => {
    const validateIdx = server.indexOf("validateAnswers(answers)");
    const writeIdx = server.indexOf("valu_assessments");
    expect(validateIdx).toBeGreaterThanOrEqual(0);
    expect(writeIdx).toBeGreaterThan(validateIdx);
  });

  test("the question count is the canonical 58", () => {
    const questions = require("../questions.js");
    const list = questions.QUESTIONS || questions.default || questions;
    expect(list.length).toBe(58);
  });
});
