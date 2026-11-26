import assert from "node:assert/strict";
import { chromium } from "playwright";

const ASSESSMENT_ORIGIN = (process.env.STAGING_ASSESSMENT_URL || "https://assessment-staging.valoriainstitute.com").replace(/\/$/, "");
const SITE_ORIGIN = process.env.STAGING_SITE_URL || "https://staging.valoriainstitute.com";
const TASTER_ID = "66666666-6666-4666-8666-666666666666";
const RESUME_TOKEN = "staging-taster-first-resume-token-12345678901234567890";
const SUBMISSION_KEY = "77777777-7777-4777-8777-777777777777";

const calls = { start: 0, save: 0, complete: 0 };
const routeErrors = [];
const pageErrors = [];
const forbiddenRequests = [];
let committed = false;
let firstCompletedAnswers = null;
let redirectUrl = null;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
const page = await context.newPage();

page.on("pageerror", error => pageErrors.push(error.message));
page.on("request", request => {
  try {
    const url = new URL(request.url());
    if (["valoriainstitute.com", "www.valoriainstitute.com", "assessment.valoriainstitute.com"].includes(url.hostname)) {
      forbiddenRequests.push(request.url());
    }
  } catch {}
});

async function json(route, status, body) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

await page.route(url => url.origin === ASSESSMENT_ORIGIN && url.pathname === "/api/taster-first-progress", async route => {
  try {
    const body = route.request().postDataJSON() || {};
    if (body.action === "start") {
      calls.start += 1;
      assert.equal(body.name, "Valoria Automated Retry Test");
      assert.equal(body.role, "Staging QA");
      assert.equal(body.email, "retry-audit@example.invalid");
      assert.equal(body.experience, "0-3");
      assert.equal(body.privacy_acknowledged, true);
      await json(route, 200, { resume_token: RESUME_TOKEN, submission_key: SUBMISSION_KEY });
      return;
    }
    if (body.action === "save") {
      calls.save += 1;
      assert.equal(body.resume_token, RESUME_TOKEN, "every save must use the same resume token");
      assert.equal(body.submission_key, SUBMISSION_KEY, "every save must preserve the stable submission key");
      assert.ok(body.current_question >= 1 && body.current_question <= 9, "saved position must stay within the nine-question Taster");
      assert.equal(Object.keys(body.answers || {}).length, body.current_question, "saved answers must match the current question position");
      if (body.current_question === 9) {
        if (committed) {
          assert.equal(JSON.stringify(body.answers), firstCompletedAnswers, "retry must preserve the exact original answers");
        } else {
          firstCompletedAnswers = JSON.stringify(body.answers);
        }
      }
      await json(route, 200, { saved: true, current_question: body.current_question, submission_key: SUBMISSION_KEY });
      return;
    }
    if (body.action === "complete") {
      calls.complete += 1;
      assert.equal(body.resume_token, RESUME_TOKEN);
      if (calls.complete === 1) {
        // The server commits the result but the browser loses the response.
        committed = true;
        await json(route, 502, { error: "Simulated response loss after completion commit." });
        return;
      }
      await json(route, 200, {
        completed: true,
        already_completed: true,
        taster_id: TASTER_ID,
        results: { intelligenceScore: 72, points: { I: 72 }, normalisedSkills: {} },
      });
      return;
    }
    if (body.action === "load") {
      await json(route, 200, { progress: { status: "completed", taster_id: TASTER_ID, current_question: 9, answers: {} } });
      return;
    }
    await json(route, 400, { error: "Unexpected Taster-first progress action." });
  } catch (error) {
    routeErrors.push(error.message);
    await json(route, 500, { error: "Taster-first retry audit mock failed." });
  }
});

await page.route(url => url.origin === SITE_ORIGIN && url.pathname.startsWith("/professional-signup/"), async route => {
  redirectUrl = route.request().url();
  await route.continue();
});

try {
  // A new visitor must reach account creation before any Taster questions.
  const publicEntry = new URL("/", ASSESSMENT_ORIGIN);
  publicEntry.searchParams.set("site_origin", SITE_ORIGIN);
  await page.goto(publicEntry.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("heading", { name: /Your account comes first/i }).waitFor({ state: "visible", timeout: 20000 });
  const accountButton = page.getByRole("button", { name: /CREATE OR SIGN IN TO YOUR ACCOUNT/i });
  await accountButton.click();
  await page.waitForURL(url => url.origin === SITE_ORIGIN && url.pathname.replace(/\/$/, "") === "/valu/register" && url.searchParams.get("journey") === "valu_taster", { timeout: 20000 });

  // Existing pre-account sessions remain resumable only through their explicit legacy route.
  const legacyEntry = new URL("/", ASSESSMENT_ORIGIN);
  legacyEntry.searchParams.set("site_origin", SITE_ORIGIN);
  legacyEntry.searchParams.set("journey", "taster-first");
  await page.goto(legacyEntry.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByPlaceholder("Full name").fill("Valoria Automated Retry Test");
  await page.getByPlaceholder("e.g. Senior Marketing Manager").fill("Staging QA");
  await page.getByPlaceholder("you@example.com").fill("retry-audit@example.invalid");
  await page.waitForTimeout(500);
  const experienceTrigger = page.locator("button").filter({ hasText: /Select your experience/i }).first();
  await experienceTrigger.waitFor({ state: "visible", timeout: 20000 });
  await experienceTrigger.click();
  await page.getByRole("listbox").getByText(/0 – 3 years/i).click();
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: /START THE VALU INDEX TASTER/i }).click();
  await page.locator(".valu-option").first().waitFor({ state: "visible", timeout: 20000 });

  assert.equal(calls.start, 1, "Taster-first must start exactly one saved session");
  assert.equal(await page.evaluate(() => localStorage.getItem("pending_taster_id")), null,
    "the account-linking Taster ID must not exist before completion");

  // Answer the first eight questions normally.
  for (let index = 0; index < 8; index += 1) {
    await page.locator(".valu-option").first().waitFor({ state: "visible", timeout: 20000 });
    await page.locator(".valu-option").first().click();
    await page.waitForTimeout(350);
  }

  // First completion commits server-side but the response is lost.
  await page.locator(".valu-option").first().waitFor({ state: "visible", timeout: 20000 });
  await page.locator(".valu-option").first().click();
  await page.getByRole("alert").filter({ hasText: "Simulated response loss after completion commit." }).waitFor({ state: "visible", timeout: 20000 });

  const failedAttemptStorage = await page.evaluate(() => ({
    pendingTasterId: localStorage.getItem("pending_taster_id"),
    resumeToken: localStorage.getItem("valu_taster_first_resume_token"),
  }));
  assert.equal(failedAttemptStorage.pendingTasterId, null,
    "the Taster must not be linked to an account before confirmed completion");
  assert.equal(failedAttemptStorage.resumeToken, RESUME_TOKEN,
    "the resume token must remain available after a lost response");
  assert.equal(calls.complete, 1);

  // Retry the final answer. The server returns the same committed Taster.
  await page.locator(".valu-option").first().waitFor({ state: "visible", timeout: 20000 });
  await page.locator(".valu-option").first().click();
  await page.getByRole("heading", { name: /Your first signal is ready/i }).waitFor({ state: "visible", timeout: 20000 });

  assert.equal(calls.start, 1, "retry must not create a second Taster session");
  assert.equal(calls.complete, 2, "completion must be safely retried");
  assert.equal(committed, true);
  const completedStorage = await page.evaluate(() => ({
    pendingTasterId: localStorage.getItem("pending_taster_id"),
    name: localStorage.getItem("pending_taster_name"),
    role: localStorage.getItem("pending_taster_role"),
    experience: localStorage.getItem("pending_taster_experience"),
    email: localStorage.getItem("pending_taster_email"),
  }));
  assert.equal(completedStorage.pendingTasterId, TASTER_ID,
    "the canonical Taster ID must be stored only after confirmed completion");
  assert.equal(completedStorage.name, "Valoria Automated Retry Test");
  assert.equal(completedStorage.role, "Staging QA");
  assert.equal(completedStorage.experience, "0-3");
  assert.equal(completedStorage.email, "retry-audit@example.invalid");

  const redirectRequest = page.waitForRequest(request => {
    try {
      const url = new URL(request.url());
      return url.origin === SITE_ORIGIN && url.pathname.startsWith("/professional-signup/");
    } catch { return false; }
  }, { timeout: 20000 });
  await page.getByRole("button", { name: /CREATE MY VALORIA ACCOUNT/i }).click();
  await redirectRequest;
  await page.waitForURL(url => url.origin === SITE_ORIGIN && url.pathname.replace(/\/$/, "") === "/professional-signup", { timeout: 30000 });
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 20000 });
  await page.waitForFunction(expected => {
    const emailInput = document.querySelector('input[type="email"]');
    return Boolean(emailInput && emailInput.value === expected && emailInput.readOnly);
  }, "retry-audit@example.invalid", { timeout: 20000 });

  const signupPageState = await page.evaluate(() => ({
    email: document.querySelector('input[type="email"]')?.value || "",
    emailReadOnly: Boolean(document.querySelector('input[type="email"]')?.readOnly),
    password: Boolean(document.querySelector('input[type="password"]')),
    savedTasterCopy: /Your taster is saved/i.test(document.body.innerText),
    tasterId: new URL(window.location.href).searchParams.get("taster_id"),
  }));
  assert.equal(signupPageState.tasterId, TASTER_ID, "the actual signup page must receive the completed Taster ID");
  assert.equal(signupPageState.email, "retry-audit@example.invalid", "the actual signup page must retain the Taster email");
  assert.equal(signupPageState.emailReadOnly, true, "the Taster email must be locked to the completed result");
  assert.equal(signupPageState.password, true, "post-Taster signup must offer account creation");
  assert.equal(signupPageState.savedTasterCopy, true, "the signup page must confirm the Taster is saved");

  const destination = new URL(redirectUrl);
  assert.equal(destination.origin, SITE_ORIGIN, "account creation must return to the matching site environment");
  assert.equal(destination.pathname, "/professional-signup/");
  assert.equal(destination.searchParams.get("taster_id"), TASTER_ID);
  assert.equal(destination.searchParams.get("name"), "Valoria Automated Retry Test");
  assert.equal(destination.searchParams.get("role"), "Staging QA");
  assert.equal(destination.searchParams.get("experience"), "0-3");
  assert.equal(destination.searchParams.get("email"), "retry-audit@example.invalid");
  assert.equal(destination.searchParams.has("account_first"), false,
    "post-Taster account creation must not be routed into the account-first legacy path");
  assert.equal(routeErrors.length, 0, routeErrors.join("; "));
  assert.equal(pageErrors.length, 0, pageErrors.join("; "));
  assert.equal(forbiddenRequests.length, 0, forbiddenRequests.join("; "));

  console.log(JSON.stringify({
    passed: true,
    environment: "Cloudflare staging only",
    scenario: "Taster-first completion commits but response is lost; retry reuses the same Taster",
    calls,
    failedAttemptStorage,
    completedStorage,
    redirectUrl,
    routeErrors,
    pageErrors,
    forbiddenRequests,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
