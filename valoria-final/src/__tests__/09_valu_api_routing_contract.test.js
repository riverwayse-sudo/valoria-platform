"use strict";
const fs = require("fs");
const path = require("path");

const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf8"));
const rewrites = vercelConfig.rewrites || [];
const sources = rewrites.map(rewrite => rewrite.source);

function indexOfRewrite(source) {
  return sources.indexOf(source);
}

// The SPA fallback is the only rewrite that lands on index.html. It is
// identified by its destination, not by a literal source pattern: the fallback
// has been tightened once already (from /(.*) to a pattern that excludes API
// paths and file extensions), and a test pinned to the old literal would have
// failed for the wrong reason — or, worse, passed while the fallback swallowed
// asset and API requests again.
function fallbackIndex() {
  return rewrites.findIndex(rewrite => rewrite.destination === "/index.html");
}

// Compile the fallback the way Vercel matches a path. A leading-slash group
// with no parameters behaves like a plain regex anchored at both ends, so this
// exercises the real pattern instead of comparing strings.
function fallbackMatches(pathname) {
  const index = fallbackIndex();
  const source = rewrites[index].source;
  return new RegExp(`^${source}$`).test(pathname);
}

// The Vite app inlines API_BASE from vite.config.js `base` ("/valu/assessment/"),
// so every client call goes to /valu/assessment/api/<handler>. On the standalone
// assessment origin nothing mapped that prefix to the Vercel functions, so the
// catch-all SPA fallback answered instead: GET returned the HTML shell with 200
// and POST returned 405. These assertions keep the API rewrite ahead of the
// fallback so the failure cannot return silently.
describe("VALU assessment API routing contract", () => {
  test("routes standalone assessment API calls to the Vercel handlers", () => {
    const apiIndex = indexOfRewrite("/valu/assessment/api/:path*");
    expect(apiIndex).toBeGreaterThanOrEqual(0);
    expect(rewrites[apiIndex].destination).toBe("/api/:path*");
  });

  test("keeps the assessment asset rewrite", () => {
    const assetIndex = indexOfRewrite("/valu/assessment/assets/:path*");
    expect(assetIndex).toBeGreaterThanOrEqual(0);
    expect(rewrites[assetIndex].destination).toBe("/assets/:path*");
  });

  test("applies the API and asset rewrites before the SPA fallback", () => {
    const fallback = fallbackIndex();
    expect(fallback).toBeGreaterThanOrEqual(0);
    expect(rewrites[fallback].destination).toBe("/index.html");
    expect(indexOfRewrite("/valu/assessment/api/:path*")).toBeLessThan(fallback);
    expect(indexOfRewrite("/valu/assessment/assets/:path*")).toBeLessThan(fallback);
  });

  // Behavioural coverage: what the fallback actually matches, not how it is
  // spelled. This is what catches a fallback that looks correct but swallows
  // the wrong paths.
  test("the SPA fallback does not swallow root API requests", () => {
    expect(fallbackMatches("/api/submit-assessment")).toBe(false);
  });

  test("the proxied assessment API is protected by rewrite order, not the pattern", () => {
    // The negative lookahead in the fallback only guards the leading "/api/",
    // so /valu/assessment/api/* still matches the fallback pattern itself:
    expect(fallbackMatches("/valu/assessment/api/submit-assessment")).toBe(true);
    // What actually protects it is the API rewrite appearing first, which the
    // ordering test above asserts. Recording the regex behaviour here so a
    // future reorder is understood as the break it would be, not a surprise.
  });

  test("the SPA fallback does not swallow asset requests", () => {
    // A missing asset must reach a 404, not index.html with a JavaScript MIME
    // type — the reported asset/MIME defect.
    expect(fallbackMatches("/assets/index-abc123.js")).toBe(false);
    expect(fallbackMatches("/valu/assessment/assets/index-abc123.css")).toBe(false);
    expect(fallbackMatches("/favicon.ico")).toBe(false);
  });

  test("the SPA fallback still serves real client routes", () => {
    // Tightening the fallback must not break the app's own routes.
    expect(fallbackMatches("/dashboard")).toBe(true);
    expect(fallbackMatches("/valu/assessment/")).toBe(true);
  });
});
