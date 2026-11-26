import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = (process.env.STAGING_ASSESSMENT_URL || "https://assessment-staging.valoriainstitute.com").replace(/\/$/, "");
const origin = process.env.STAGING_SITE_URL || "https://staging.valoriainstitute.com";
const email = `qa+taster-first-${process.env.GITHUB_RUN_ID || randomUUID()}@example.com`;
const headers = { "Content-Type": "application/json", Origin: origin };

async function postRaw(action, payload = {}) {
  const response = await fetch(`${base}/api/taster-first-progress`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

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

// Reject incomplete consent before creating a pre-account session.
const noConsent = await postRaw("start", {
  name: "Staging Taster First QA",
  role: "QA Analyst",
  email,
  experience: "4-8",
  privacy_acknowledged: false,
});
assert.equal(noConsent.response.status, 400, "start must reject missing privacy acknowledgement");

// A resume token is a bearer credential and must be validated before session lookup.
const invalidResume = await postRaw("load", { resume_token: "invalid-token" });
assert.equal(invalidResume.response.status, 401, "load must reject malformed resume tokens");

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

// Verify the paired site staging deployment exposes account-first onboarding while retaining the legacy Taster API for saved sessions.
const sitePaths = ["/", "/valu", "/valu/start", "/valu/assessment", "/professional-signup", "/marketplace"];
for (const path of sitePaths) {
  const response = await fetch(new URL(path, origin));
  assert.equal(response.status, 200, `site route ${path} returned HTTP ${response.status}`);
}
const homeResponse = await fetch(origin);
assert.equal(homeResponse.status, 200, "staging site homepage must return HTTP 200");
const homeHtml = await homeResponse.text();
assert.ok(homeHtml.includes("START THE VALU INDEX TASTER"), "homepage must expose the Taster-first CTA");
assert.ok(homeHtml.includes('href="/valu/register/?journey=valu_taster"'), "public CTA must require account-first Taster registration");

const robotsResponse = await fetch(new URL("/robots.txt", origin));
assert.equal(robotsResponse.status, 200, "staging robots.txt must return HTTP 200");
assert.match(await robotsResponse.text(), /^Disallow: \/$/m, "staging must block search indexing");
const sitemapResponse = await fetch(new URL("/sitemap.xml", origin));
assert.equal(sitemapResponse.status, 200, "staging sitemap must return HTTP 200");
const sitemap = await sitemapResponse.text();
assert.ok(sitemap.includes("https://staging.valoriainstitute.com/"), "staging sitemap must use the staging canonical origin");
assert.doesNotMatch(sitemap, /<loc>https:\/\/(?:www\.)?valoriainstitute\.com\//, "staging sitemap must not publish production URLs");

console.log(JSON.stringify({
  result: "PASS",
  email,
  taster_id: completed.taster_id,
  retry_same_taster: true,
  completed_session_immutable: true,
}));
