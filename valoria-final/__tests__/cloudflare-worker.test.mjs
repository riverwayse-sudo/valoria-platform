import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

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

test("assessment API preflight carries the approved site origin", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://assessment.example/api/taster-progress", {
    method: "OPTIONS",
    headers: { Origin: "https://www.valoriainstitute.com" },
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://www.valoriainstitute.com");
});
