"use strict";
const fs = require("fs");
const path = require("path");

const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../../vercel.json"), "utf8"));
const rewrites = vercelConfig.rewrites || [];
const sources = rewrites.map(rewrite => rewrite.source);

function indexOfRewrite(source) {
  return sources.indexOf(source);
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
  const fallbackIndex = indexOfRewrite("/(.*)");
  expect(fallbackIndex).toBeGreaterThanOrEqual(0);
  expect(rewrites[fallbackIndex].destination).toBe("/index.html");
  expect(indexOfRewrite("/valu/assessment/api/:path*")).toBeLessThan(fallbackIndex);
  expect(indexOfRewrite("/valu/assessment/assets/:path*")).toBeLessThan(fallbackIndex);
 });
});
