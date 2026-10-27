// valoria-final/src/__tests__/19_vercel_routing_contract.test.js
//
// Contract coverage for valoria-final/vercel.json.
//
// Two routing defects shipped on main:
//
//   1. The assessment app is served under the site's /valu/assessment proxy,
//      and the Vite client inlines API_BASE from vite.config.js `base`, so every
//      call goes to /valu/assessment/api/<handler> (see VALUIndexV4GateNext.jsx).
//      Nothing mapped that prefix to the Vercel functions, so the catch-all SPA
//      fallback answered instead: GET returned the HTML shell with 200 and POST
//      returned 405. The assessment page loaded but could not save anything.
//   2. The fallback was `/(.*)`, which also swallowed missing asset requests, so
//      a 404 asset returned index.html with the wrong content type instead of a
//      404 — the reported asset/MIME failure.
//
// This asserts the routing shape rather than the handler code, so it fails if
// either rewrite is dropped or the fallback is widened again. The regex is
// exercised for real rather than compared as a string, so a rewrite that looks
// right but matches the wrong paths is still caught.

"use strict";

const fs = require("fs");
const path = require("path");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf8"));
const rewrites = config.rewrites || [];
const sources = rewrites.map((r) => r.source);

const API_SOURCE = "/valu/assessment/api/:path*";
const ASSET_SOURCE = "/valu/assessment/assets/:path*";

function indexOf(source) {
  return sources.indexOf(source);
}

// The SPA fallback is the only rewrite that lands on index.html.
function fallback() {
  const index = rewrites.findIndex((r) => r.destination === "/index.html");
  return { index, rewrite: rewrites[index] };
}

// Compile the fallback source the way Vercel matches a path. The pattern is a
// path-to-regexp expression; a leading-slash group with no parameters behaves
// like a plain regex anchored at both ends.
function matchesFallback(pathname) {
  const { rewrite } = fallback();
  return new RegExp(`^${rewrite.source}$`).test(pathname);
}

describe("assessment API routing", () => {
  test("maps the proxied assessment API prefix to the Vercel handlers", () => {
    const index = indexOf(API_SOURCE);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(rewrites[index].destination).toBe("/api/:path*");
  })

  test("keeps the assessment asset rewrite", () => {
    const index = indexOf(ASSET_SOURCE);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(rewrites[index].destination).toBe("/assets/:path*");
  })

  test("applies both rewrites before the SPA fallback", () => {
    const { index: fallbackIndex } = fallback();
    expect(fallbackIndex).toBeGreaterThanOrEqual(0);
    expect(indexOf(API_SOURCE)).toBeLessThan(fallbackIndex);
    expect(indexOf(ASSET_SOURCE)).toBeLessThan(fallbackIndex);
  })
})

describe("missing assets return a 404, not the SPA shell", () => {
  test("the fallback does not match paths under the top-level api/", () => {
    expect(matchesFallback("/api/submit-taster")).toBe(false);
    expect(matchesFallback("/api/generate-and-send-report")).toBe(false);
  })

  test("the assessment API prefix is handled by the earlier rewrite, not the fallback", () => {
    // The fallback alone would match this path — the `api/` lookahead is
    // anchored at the start, and this path begins with /valu. Ordering is what
    // saves it, so assert the ordering explicitly rather than assuming it.
    expect(matchesFallback("/valu/assessment/api/submit-taster")).toBe(true);
    expect(indexOf(API_SOURCE)).toBeLessThan(fallback().index);
  })

  test("the fallback does not match paths that look like files", () => {
    for (const asset of [
      "/logo.png",
      "/favicon.ico",
      "/assets/index-abc123.js",
      "/assets/index-abc123.css",
      "/valu/assessment/assets/hero.webp",
      "/fonts/valoria.woff2",
    ]) {
      expect(matchesFallback(asset)).toBe(false);
    }
  })

  test("the fallback still serves real application routes", () => {
    for (const route of ["/", "/dashboard", "/valu/assessment", "/login"]) {
      expect(matchesFallback(route)).toBe(true);
    }
  })

  test("the fallback destination is the SPA shell", () => {
    expect(fallback().rewrite.destination).toBe("/index.html");
  })
})
