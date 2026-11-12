import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
process.env.VALU_PREVIEW_SITE_ORIGIN = "https://site-preview.example,https://site-preview-two.example";
process.env.VALU_PREVIEW_ASSESSMENT_ORIGIN = "https://assessment-preview.example";
process.env.SUPABASE_URL = "https://staging-db.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-role-key";
process.env.CRON_SECRET = "test-only-cron-secret";
const { default: worker } = await import("../worker.js");

function makeEnv() {
  const seen = [];
  return {
    seen,
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        seen.push({ pathname: url.pathname, method: request.method });
        return new Response(url.pathname, { status: 200 });
      },
    },
  };
}

test("assessment shell URL resolves to the Vite index document", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://assessment.example/valu/assessment/"), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "/index.html");
  assert.deepEqual(env.seen, [{ pathname: "/index.html", method: "GET" }]);
});

test("Vite asset URLs retain their filename after the assessment prefix is removed", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    new Request("https://assessment.example/valu/assessment/assets/app-123.js"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "/assets/app-123.js");
});

test("known API paths execute their handler instead of falling through to static assets", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    new Request("https://assessment.example/api/taster-progress", { method: "GET" }),
    env,
  );
  assert.equal(response.status, 405);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  assert.deepEqual(env.seen, []);
});

test("unknown API paths return JSON 404 and never fall through to the SPA", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://assessment.example/api/not-real"), env);
  assert.equal(response.status, 404);
  assert.deepEqual(env.seen, []);
});

test("assessment API preflight allows the production site and exact preview origins", async () => {
  const env = makeEnv();
  for (const origin of [
    "https://www.valoriainstitute.com",
    "https://site-preview.example",
    "https://site-preview-two.example",
    "https://assessment-preview.example",
  ]) {
    const response = await worker.fetch(new Request("https://assessment.example/api/taster-progress", {
      method: "OPTIONS",
      headers: { Origin: origin },
    }), env);
    assert.equal(response.status, 204, origin);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
  }
});

test("assessment API preflight rejects unconfigured preview origins", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://assessment.example/api/taster-progress", {
    method: "OPTIONS",
    headers: { Origin: "https://untrusted-preview.example" },
  }), env);
  assert.equal(response.status, 403);
});

test("full assessment preflight allows only the deployed assessment Worker origin", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://assessment.example/api/submit-assessment", {
    method: "OPTIONS",
    headers: {
      Origin: "https://valoria-assessment.riverwayse.workers.dev",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://valoria-assessment.riverwayse.workers.dev");
  assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assert.match(response.headers.get("access-control-allow-headers") || "", /Content-Type/i);
});

test("full assessment preflight rejects an untrusted Worker origin", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://assessment.example/api/submit-assessment", {
    method: "OPTIONS",
    headers: {
      Origin: "https://untrusted-worker.example",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  }), env);
  assert.equal(response.status, 403);
});


test("the direct remaining-assessment URL resolves to the same authenticated assessment shell", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    new Request("https://assessment.example/remaining?full=1&site_origin=https%3A%2F%2Fvaloriainstitute.com#handoff_code=one-time"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "/index.html");
  assert.deepEqual(env.seen, [{ pathname: "/index.html", method: "GET" }]);
});

test("the remaining-assessment route supports a trailing slash", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://assessment.example/remaining/"), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "/index.html");
});


test("Cloudflare sends the dedicated remaining route through the Worker before static asset handling", () => {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.ok(config.assets.run_worker_first.includes("/remaining*"));
});


test("marketplace readiness queue endpoint is registered and requires cron authentication", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    new Request("https://assessment.example/api/process-readiness-queue"),
    env,
  );
  assert.equal(response.status, 401);
  assert.match(await response.text(), /Unauthorized/);
  assert.deepEqual(env.seen, []);
});

test("unsent report sweep endpoint is registered and requires cron authentication", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    new Request("https://assessment.example/api/sweep-unsent-reports", { method: "POST" }),
    env,
  );
  assert.equal(response.status, 401);
  assert.match(await response.text(), /Unauthorized/);
  assert.deepEqual(env.seen, []);
});

test("staging Wrangler environment targets the existing staging Worker and staging database only", () => {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.env.staging.name, "valoria-staging-assessment");
  assert.equal(config.env.staging.vars.SUPABASE_URL, "https://yccxgjdqworgcbircnvn.supabase.co");
  assert.equal(config.env.staging.vars.VALU_PRODUCTION_SUPABASE_URL, undefined);
  assert.equal(config.previews.vars.VALU_PRODUCTION_SUPABASE_URL, undefined);
  assert.deepEqual(
    config.env.staging.vars.VALU_PREVIEW_SITE_ORIGIN.split(","),
    [
      "https://valoria-staging-site.riverwayse.workers.dev",
      "https://valoria-redesign-staging-site.riverwayse.workers.dev",
    ],
  );
});

test("account confirmation redirects honor only exact allowed site request origins", async () => {
  const { getSiteOrigin } = await import("../api/_siteOrigin.js");
  process.env.VALORIA_SITE_URL = "https://valoria-staging-site.riverwayse.workers.dev";
  assert.equal(getSiteOrigin({ headers: { origin: "https://valoria-staging-site.riverwayse.workers.dev" } }), "https://valoria-staging-site.riverwayse.workers.dev");
  assert.equal(getSiteOrigin({ headers: { origin: "https://valoria-redesign-staging-site.riverwayse.workers.dev" } }), "https://valoria-redesign-staging-site.riverwayse.workers.dev");
  assert.equal(getSiteOrigin({ headers: { origin: "https://staging.valoriainstitute.com" } }), "https://staging.valoriainstitute.com");
  assert.equal(getSiteOrigin({ headers: { origin: "https://attacker.example" } }), "https://valoria-staging-site.riverwayse.workers.dev");
});

test("assessment app is never indexed and production analytics is disabled in staging builds", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(html, /<script async src="https:\/\/www\.googletagmanager\.com/);
  const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(main, /import\.meta\.env\.PROD/);
  assert.match(main, /if \(!import\.meta\.env\.PROD \|\| isPreview\) return/);
});
