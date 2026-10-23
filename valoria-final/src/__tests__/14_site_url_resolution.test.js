// valoria-final/src/__tests__/14_site_url_resolution.test.js
//
// Runtime coverage for lib/site-url.js and the handlers that build auth
// redirects and journey links.
//
// Incident: create-account.js, resend-confirmation.js and assessment-progress.js
// each hardcoded https://valoriainstitute.com. On staging that meant a
// participant registered against the staging database was handed a Supabase
// confirmation link whose redirect_to pointed at production, and assessment
// reminders sent them into the production journey. The account exists in staging
// but the confirmation lands on production, so the user is stranded.
//
// The old contract test made this worse: it asserted the production literal was
// present in the source, so the defect could not be fixed without failing it.

"use strict";

const path = require("path");
const { resolveSiteUrl, PRODUCTION_SITE_URL } = require("../../lib/site-url.js");

const root = path.join(__dirname, "../..");
const readApi = file => require("fs").readFileSync(path.join(root, "api", file), "utf8");

describe("resolveSiteUrl", () => {
  test("prefers the explicit VALORIA_SITE_URL", () => {
    expect(resolveSiteUrl({ VALORIA_SITE_URL: "https://staging.valoria.test" })).toBe("https://staging.valoria.test");
  });

  test("falls back through SITE_ORIGIN and NEXT_PUBLIC_SITE_URL", () => {
    expect(resolveSiteUrl({ SITE_ORIGIN: "https://site-origin.test" })).toBe("https://site-origin.test");
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://public-site.test" })).toBe("https://public-site.test");
  });

  test("uses the deployment's own VERCEL_URL when nothing else is set", () => {
    expect(resolveSiteUrl({ VERCEL_URL: "valoria-site-abc123.vercel.app" })).toBe("https://valoria-site-abc123.vercel.app");
  });

  test("falls back to production only when nothing is configured", () => {
    expect(resolveSiteUrl({})).toBe(PRODUCTION_SITE_URL);
  });

  test("precedence is explicit env over deployment host", () => {
    expect(resolveSiteUrl({ VALORIA_SITE_URL: "https://staging.valoria.test", VERCEL_URL: "x.vercel.app" })).toBe("https://staging.valoria.test");
  });

  test("normalises a scheme-less value and strips paths", () => {
    expect(resolveSiteUrl({ VALORIA_SITE_URL: "staging.valoria.test" })).toBe("https://staging.valoria.test");
    expect(resolveSiteUrl({ VALORIA_SITE_URL: "https://staging.valoria.test/some/path?x=1" })).toBe("https://staging.valoria.test");
  });

  test("ignores blank and malformed values instead of producing a broken URL", () => {
    expect(resolveSiteUrl({ VALORIA_SITE_URL: "   ", SITE_ORIGIN: "https://ok.test" })).toBe("https://ok.test");
    expect(resolveSiteUrl({ VALORIA_SITE_URL: "not a url at all" })).toBe(PRODUCTION_SITE_URL);
  });
});

describe("handlers build environment-specific URLs", () => {
  test("create-account resolves the site origin instead of hardcoding production", () => {
    const source = readApi("create-account.js");
    expect(source).toContain("resolveSiteUrl");
    expect(source).not.toMatch(/VALORIA_SITE_URL\s*=\s*["']https?:\/\//);
    expect(source).toContain("/auth/callback");
  });

  test("resend-confirmation resolves the site origin instead of hardcoding production", () => {
    const source = readApi("resend-confirmation.js");
    expect(source).toContain("resolveSiteUrl");
    expect(source).not.toMatch(/VALORIA_SITE_URL\s*=\s*["']https?:\/\//);
  });

  test("assessment-progress resolves the site origin instead of hardcoding production", () => {
    const source = readApi("assessment-progress.js");
    expect(source).toContain("resolveSiteUrl");
    expect(source).not.toContain("https://valoriainstitute.com/journey/continue");
  });

  test("no api module hardcodes the production site origin as a redirect base", () => {
    // Report/email body copy may legitimately name the public domain; redirect
    // bases must not. Guard the two shapes that actually route a participant.
    const offenders = [];
    for (const file of require("fs").readdirSync(path.join(root, "api"))) {
      if (!file.endsWith(".js")) continue;
      const source = readApi(file);
      if (/(redirect_to|redirectUrl|APP_URL|emailRedirectTo)\s*[:=][^\n]*["']https:\/\/valoriainstitute\.com/.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
