import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const ASSESSMENT_ORIGIN = process.env.STAGING_ASSESSMENT_URL || 'https://assessment-staging.valoriainstitute.com';
const SITE_ORIGIN = process.env.STAGING_SITE_URL || 'https://staging.valoriainstitute.com';
const TASTER_ID = '55555555-5555-4555-8555-555555555555';
const LEAD_CAPTURE_ID = '66666666-6666-4666-8666-666666666666';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const actions = [];
const storageEvents = [];
const pageErrors = [];
const forbiddenRequests = [];
const routeErrors = [];
let committed = false;
let submissionKey = null;
let completedAnswers = null;
let submitCalls = 0;
let completeCalls = 0;
let redirectUrl = null;
let redirectStorage = null;
let resolveRedirectHandled;
const redirectHandled = new Promise(resolve => { resolveRedirectHandled = resolve; });

await context.exposeBinding('auditStorage', (_source, event) => storageEvents.push(event));
await page.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
  const watched = new Set(['pending_taster_id', 'valu_taster_resume_token', 'valu_taster_signup_key']);
  const originalSet = Storage.prototype.setItem;
  const originalRemove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key, value) {
    if (this === window.localStorage && watched.has(key)) {
      void window.auditStorage?.({ action: 'set', key, value: String(value) });
    }
    return originalSet.call(this, key, value);
  };
  Storage.prototype.removeItem = function (key) {
    if (this === window.localStorage && watched.has(key)) {
      void window.auditStorage?.({ action: 'remove', key });
    }
    return originalRemove.call(this, key);
  };
});

page.on('pageerror', error => pageErrors.push(error.message));
page.on('request', request => {
  try {
    const url = new URL(request.url());
    if (['valoriainstitute.com', 'www.valoriainstitute.com', 'assessment.valoriainstitute.com'].includes(url.hostname)) {
      forbiddenRequests.push(request.url());
    }
  } catch {}
});

async function json(route, status, body) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

await page.route('**/api/taster-progress*', async route => {
  try {
    const body = route.request().postDataJSON() || {};
    actions.push(body.action);
    if (body.action === 'register') {
      await json(route, 200, { lead_capture_id: LEAD_CAPTURE_ID });
      return;
    }
    if (body.action === 'save') {
      if (body.submission_key) submissionKey = body.submission_key;
      if (body.current_question === 9 && !committed) completedAnswers = JSON.stringify(body.answers || {});
      if (committed) {
        assert.equal(body.submission_key, submissionKey, 'retry must preserve the original submission key');
        assert.equal(body.current_question, 9, 'completed retry must preserve the completed answer count');
        assert.equal(JSON.stringify(body.answers || {}), completedAnswers, 'retry must preserve the exact original answers');
        await json(route, 200, {
          saved: true,
          completed: true,
          taster_id: TASTER_ID,
          submission_key: submissionKey,
        });
        return;
      }
      await json(route, 200, { saved: true, submission_key: body.submission_key || null });
      return;
    }
    if (body.action === 'complete') {
      completeCalls += 1;
      assert.equal(body.taster_id, TASTER_ID);
      assert.ok(body.submission_key, 'completion must carry the stable submission key');
      assert.equal(body.submission_key, submissionKey);
      if (completeCalls === 1) {
        // The server has committed the completion, but the browser loses the response.
        committed = true;
        await json(route, 502, { error: 'Simulated response loss after completion commit.' });
        return;
      }
      await json(route, 200, { completed: true, already_completed: true });
      return;
    }
    await json(route, 400, { error: 'Unexpected progress action in retry audit.' });
  } catch (error) {
    routeErrors.push(error.message);
    await json(route, 500, { error: 'Retry audit mock failed.' });
  }
});

await page.route('**/api/submit-taster*', async route => {
  try {
    submitCalls += 1;
    const body = route.request().postDataJSON() || {};
    assert.ok(body.resume_token, 'submission must use the registered resume token');
    assert.equal(body.submission_key, submissionKey, 'submission must use the stable submission key');
    await json(route, 200, { taster_id: TASTER_ID });
  } catch (error) {
    routeErrors.push(error.message);
    await json(route, 500, { error: 'Retry audit submission mock failed.' });
  }
});

await page.route(url => url.origin === SITE_ORIGIN && url.pathname.startsWith('/professional-signup'), async route => {
  redirectUrl = route.request().url();
  // Do not evaluate the page during a cross-origin navigation interception.
  // The init-script storageEvents capture the exact writes/removals without racing navigation.
  redirectStorage = 'verified via storageEvents';
  try {
    await route.abort();
  } finally {
    resolveRedirectHandled();
  }
});

try {
  const entry = new URL('/', ASSESSMENT_ORIGIN);
  entry.searchParams.set('site_origin', SITE_ORIGIN);
  await page.goto(entry.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.getByPlaceholder('Your full professional name').fill('Valoria Automated Retry Test');
  await page.getByPlaceholder('you@example.com').fill('retry-audit@example.invalid');
  await page.getByPlaceholder('e.g. Product Manager').fill('Staging QA');
  await page.locator('select').first().selectOption({ index: 1 });
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: /CONTINUE TO MY VALU INDEX TASTER/i }).click();

  await page.getByRole('button', { name: /BEGIN MY VALU INDEX TASTER/i }).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('button', { name: /BEGIN MY VALU INDEX TASTER/i }).click();

  for (let i = 0; i < 9; i += 1) {
    await page.locator('.valu-option').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.valu-option').first().click();
    if (i < 8) {
      await page.waitForTimeout(250);
    }
  }

  const continueButton = page.getByRole('button', { name: /CONTINUE TO ACCOUNT CREATION/i });
  await continueButton.waitFor({ state: 'visible', timeout: 20000 });

  // First attempt: taster submission commits, but the completion response is lost.
  await continueButton.click();
  await page.getByRole('alert').filter({ hasText: 'Simulated response loss after completion commit.' }).waitFor({ state: 'visible', timeout: 20000 });
  const firstFailureStorage = await page.evaluate(() => ({
    pending: localStorage.getItem('pending_taster_id'),
    resume: localStorage.getItem('valu_taster_resume_token'),
    signup: localStorage.getItem('valu_taster_signup_key'),
  }));
  assert.equal(firstFailureStorage.pending, null, 'pending taster ID must not be written before completion is confirmed');
  assert.ok(firstFailureStorage.resume, 'resume token must remain available after the lost response');
  assert.ok(firstFailureStorage.signup, 'signup key must remain available after the lost response');
  assert.equal(submitCalls, 1, 'the initial taster must be submitted exactly once');
  assert.equal(completeCalls, 1, 'the first completion attempt must have occurred once');

  // Retry: the API reports the already-committed taster and the browser must not resubmit it.
  const redirectRequest = page.waitForRequest(request => {
    try {
      const url = new URL(request.url());
      return url.origin === SITE_ORIGIN && url.pathname.startsWith('/professional-signup');
    } catch { return false; }
  }, { timeout: 20000 });
  await continueButton.click();
  await redirectRequest;
  await redirectHandled;

  assert.equal(submitCalls, 1, 'retry must reuse the completed taster instead of submitting a duplicate');
  assert.equal(completeCalls, 2, 'the completion transition must be safely retried');
  assert.equal(committed, true);
  assert.ok(redirectUrl?.startsWith(SITE_ORIGIN + '/professional-signup/'), `handoff must return to the originating redesign site; received ${redirectUrl || 'no intercepted URL'}`);
  assert.ok(redirectUrl.includes('taster_id=' + TASTER_ID), 'handoff must carry the verified taster reference');
  assert.ok(storageEvents.some(event => event.action === 'set' && event.key === 'pending_taster_id' && event.value === TASTER_ID), 'pending taster ID must be written only after confirmed completion');
  assert.ok(storageEvents.some(event => event.action === 'remove' && event.key === 'valu_taster_resume_token'), 'resume token must be cleared after confirmed completion');
  assert.ok(storageEvents.some(event => event.action === 'remove' && event.key === 'valu_taster_signup_key'), 'signup key must be cleared after confirmed completion');
  assert.equal(routeErrors.length, 0, routeErrors.join('; '));
  assert.equal(pageErrors.length, 0, pageErrors.join('; '));
  assert.equal(forbiddenRequests.length, 0, forbiddenRequests.join('; '));

  console.log(JSON.stringify({
    passed: true,
    environment: 'Cloudflare staging only',
    scenario: 'completion committed but response lost; same taster reused on retry',
    submitCalls,
    completeCalls,
    redirectUrl,
    firstFailureStorage,
    redirectStorage,
    storageEvents,
    pageErrors,
    forbiddenRequests,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
