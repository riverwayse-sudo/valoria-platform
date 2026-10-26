// valoria-final/src/__tests__/24_deployment_config_integrity.test.js
//
// Vercel reads `vercel.json` from the project's ROOT directory only. The
// repository also carried `public/vercel.json`, which Vite copies verbatim into
// `dist/`. Vercel never reads it — but it is not inert either: it is a
// plausible-looking, complete-looking routing config that contradicts the real
// one, and the next person debugging a 404 opens the file that sits next to the
// build output and "fixes" the wrong copy.
//
// That is not hypothetical. The root config's fallback was deliberately
// tightened to exclude `api/` paths and file-like paths, because a catch-all
// `/(.*)` served `index.html` for missing assets — the reported asset/MIME
// failure. `public/vercel.json` still contained exactly that unexcluded
// catch-all. Anyone who trusted it would reintroduce the defect.
//
// These tests assert the authoritative config's properties and that the
// contradicting copy stays gone.

"use strict";

const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const rootConfig = JSON.parse(fs.readFileSync(path.join(REPO, "vercel.json"), "utf8"));

describe("deployment config integrity", () => {
  test("no second vercel.json shadows the authoritative one", () => {
    const strays = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "vercel.json" && full !== path.join(REPO, "vercel.json")) strays.push(full);
      }
    };
    walk(REPO);
    expect(strays).toEqual([]);
  });

  test("the authoritative config carries the deployment properties only it can", () => {
    // If these live only in the root file, the root file is provably the one in
    // effect: crons and per-function durations are not read from a build output.
    expect(Array.isArray(rootConfig.crons)).toBe(true);
    expect(rootConfig.crons.length).toBeGreaterThan(0);
    expect(Object.keys(rootConfig.functions || {}).length).toBeGreaterThan(0);
  });
});

describe("SPA fallback does not swallow assets or API calls", () => {
  const rewrites = rootConfig.rewrites || [];
  const fallback = rewrites.find((r) => r.destination === "/index.html");

  function matches(pathname) {
    return new RegExp(`^${fallback.source}$`).test(pathname);
  }

  test("a single fallback exists", () => {
    expect(rewrites.filter((r) => r.destination === "/index.html")).toHaveLength(1);
  });

  // The asset/MIME failure: a missing asset must 404, not return the HTML shell.
  test.each([
    "/valu/assessment/assets/index-xqmGZMx3.js",
    "/valu/assessment/assets/index-C2fFoBQa.css",
    "/assets/app.js",
    "/logo.png",
    "/favicon.ico",
    "/some/deep/thing.woff2",
  ])("does not match the asset path %s", (p) => {
    expect(matches(p)).toBe(false);
  });

  test.each(["/api/submit-taster", "/api/create-account"])(
    "does not match the bare api path %s",
    (p) => {
      expect(matches(p)).toBe(false);
    }
  );

  test.each(["/valu/assessment", "/valu/assessment/", "/valu/assessment/start", "/dashboard"])(
    "still serves the application route %s",
    (p) => {
      expect(matches(p)).toBe(true);
    }
  );

  // The assessment API prefix must be handled by its own rewrite, ahead of the
  // fallback. The fallback matching it would answer POSTs with the HTML shell.
  test("the assessment API rewrite precedes the fallback", () => {
    const api = rewrites.findIndex((r) => r.source === "/valu/assessment/api/:path*");
    const fb = rewrites.findIndex((r) => r.destination === "/index.html");
    expect(api).toBeGreaterThanOrEqual(0);
    expect(api).toBeLessThan(fb);
  });

  test("the assessment asset rewrite precedes the fallback", () => {
    const asset = rewrites.findIndex((r) => r.source === "/valu/assessment/assets/:path*");
    const fb = rewrites.findIndex((r) => r.destination === "/index.html");
    expect(asset).toBeGreaterThanOrEqual(0);
    expect(asset).toBeLessThan(fb);
  });
});
