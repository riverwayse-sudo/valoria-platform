"use strict";
const fs = require("fs");
const path = require("path");

const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf8"));
const rewrites = vercelConfig.rewrites || [];

// The catch-all rewrite previously matched every path, so a request for a
// missing hashed asset (/assets/index-STALEHASH.js) was answered with the
// index.html shell and HTTP 200 instead of 404. Browsers then tried to execute
// HTML as JavaScript, which is why a stale page appeared blank rather than
// failing loudly.
//
// These patterns use no path-to-regexp syntax beyond a plain group, so a naive
// anchored RegExp compiles them identically to Vercel's matcher. Verified
// against path-to-regexp 6.x for the paths exercised below.
function fallbackPattern() {
  const fallback = rewrites[rewrites.length - 1];
  expect(fallback.destination).toBe("/index.html");
  return new RegExp(`^${fallback.source}$`);
}

function matchesFallback(pathname) {
  return fallbackPattern().test(pathname);
}

describe("missing asset 404 contract", () => {
 test("serves the SPA shell for extension-less routes", () => {
  for (const route of ["/", "/valu/assessment/", "/valu/assessment", "/dashboard", "/valu/assessment/journey"]) {
   expect(matchesFallback(route)).toBe(true);
  }
 });

 test("does not answer missing hashed assets with the SPA shell", () => {
  for (const asset of [
   "/assets/index-STALEHASH.js",
   "/assets/index-STALEHASH.css",
   "/valu/assessment/assets/index-STALEHASH.js",
   "/valu/assessment/assets/index-STALEHASH.css",
   "/logo.png",
   "/favicon.ico",
  ]) {
   expect(matchesFallback(asset)).toBe(false);
  }
 });

 test("does not swallow unmatched API paths", () => {
  expect(matchesFallback("/api/does-not-exist")).toBe(false);
 });

 test("keeps the catch-all fallback last so specific rewrites win", () => {
  // Vercel matches rewrites in array order, so anything after the catch-all
  // would be unreachable. Asserting the fallback is last guarantees the API and
  // asset rewrites are evaluated first whenever they are present.
  expect(rewrites[rewrites.length - 1].destination).toBe("/index.html");
  const sources = rewrites.slice(0, -1).map(rewrite => rewrite.source);
  expect(sources).not.toContain("/index.html");
 });

 test("retains a real asset file being served", () => {
  // A built asset has an extension, so it never reaches the fallback and Vercel
  // serves it from the output directory with the correct content type.
  expect(matchesFallback("/assets/index-DBNncGId.js")).toBe(false);
 });
});
