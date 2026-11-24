import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = (process.env.STAGING_ASSESSMENT_URL || "https://assessment-staging.valoriainstitute.com").replace(/\/$/, "");
const origin = process.env.STAGING_SITE_URL || "https://staging.valoriainstitute.com";
const email = `qa+taster-first-${process.env.GITHUB_RUN_ID || randomUUID()}@example.com`;
const headers = { "Content-Type": "application/json", Origin: origin };

async function post(action, payload = {}) {
  const response = await fetch(`${base}/api/taster-first-progress`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  assert.ok(response.ok, `${action} returned HTTP ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

const started = await post("start", {
  name: "Staging Taster First QA",
  role: "QA Analyst",
  email,
  experience: "4-8",
  privacy_acknowledged: true,
  marketing_consent: false,
});
assert.ok(started.resume_token, "start must return an opaque resume token");
assert.match(started.resume_token, /^[A-Za-z0-9_-]{40,64}$/);

const answers = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [String(index), 0]));
const saved = await post("save", {
  resume_token: started.resume_token,
  answers,
  current_question: 9,
  submission_key: started.submission_key,
});
assert.equal(saved.saved, true);

const resumed = await post("load", { resume_token: started.resume_token });
assert.equal(resumed.progress.current_question, 9);
assert.deepEqual(resumed.progress.answers, answers);
assert.equal(resumed.progress.status, "in_progress");

const completed = await post("complete", { resume_token: started.resume_token });
assert.ok(completed.taster_id, "complete must return a canonical Taster ID");
assert.equal(completed.completed, true);
assert.equal(typeof completed.results.intelligenceScore, "number");

const retried = await post("complete", { resume_token: started.resume_token });
assert.equal(retried.taster_id, completed.taster_id, "lost-response retry must return the same Taster");
assert.equal(retried.already_completed, true);

const postCompleteSave = await fetch(`${base}/api/taster-first-progress`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "save",
    resume_token: started.resume_token,
    answers,
    current_question: 9,
  }),
});
assert.equal(postCompleteSave.status, 409, "completed Taster must be immutable");

console.log(JSON.stringify({
  result: "PASS",
  email,
  taster_id: completed.taster_id,
  retry_same_taster: true,
  completed_session_immutable: true,
}));
