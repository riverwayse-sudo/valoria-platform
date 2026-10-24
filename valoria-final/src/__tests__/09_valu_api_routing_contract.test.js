"use strict";
const fs = require("fs");
const path = require("path");

const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf8"));
const rewrites = vercelConfig.rewrites || [];
const sources = rewrites.map(rewrite => rewrite.source);

function indexOfRewrite(source) {
  return sources.indexOf(source);
}

// The SPA fallback is the rewrite that lands on index.html. It is located by its
// destination, not by a literal source string: the source expression is expected
// to be tightened over time, and a test that pins the old literal fails the
// moment the routing is actually fixed.
function fallbackIndex() {
  return rewrites.findIndex(rewrite => rewrite.destination === "/index.html");
}

// Compile a rewrite source into a matcher. `:path*` is a greedy parameter;
// everything else is a path-to-regexp expression that behaves like an anchored
// regex for these patterns.
function matcherFor(source) {
  if (source.includes(":path*")) {
    const prefix = source.replace(/:[A-Za-z]+\*/g, "").replace(/\/$/, "");
    return new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(.*)$`);
  }
  return new RegExp(`^${source}$`);
}

function substitute(destination, captures) {
  return destination.replace(/:[A-Za-z]+\*/g, captures[0] || "");
}

// Vercel applies rewrites in order and the first match wins, so resolving a path
// this way reproduces what the deployment actually does — which is the property
// under test.
function resolve(pathname) {
  for (const rewrite of rewrites) {
    const match = matcherFor(rewrite.source).exec(pathname);
    if (match) return substitute(rewrite.destination, match.slice(1));
  }
  return null;
}

// The Vite app inlines API_BASE from vite.config.js `base` ("/valu/assessment/"),
// so every client call goes to /valu/assessment/api/<handler>. On the standalone
// assessment origin nothing mapped that prefix to the Vercel functions, so the
// catch-all SPA fallback answered instead: GET returned the HTML shell with 200
// and POST returned 405.
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

 // Behavioural: resolve the paths the SPA actually requests and assert they reach
 // the handler rather than the shell. This is the incident itself.
 test("an assessment API call resolves to the handler, not the SPA shell", () => {
  expect(resolve("/valu/assessment/api/submit-taster")).toBe("/api/submit-taster");
  expect(resolve("/valu/assessment/api/taster-progress")).toBe("/api/taster-progress");
  expect(resolve("/valu/assessment/api/create-account")).toBe("/api/create-account");
 });

 test("an assessment asset resolves to the asset bundle", () => {
  expect(resolve("/valu/assessment/assets/index-abc123.js")).toBe("/assets/index-abc123.js");
  expect(resolve("/valu/assessment/assets/index-abc123.css")).toBe("/assets/index-abc123.css");
 });

 test("application routes still reach the SPA shell", () => {
  expect(resolve("/")).toBe("/index.html");
  expect(resolve("/dashboard")).toBe("/index.html");
  expect(resolve("/valu/assessment")).toBe("/index.html");
 });
});
