"use strict";

const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "../../api/create-account.js"),
  "utf8"
);

describe("account confirmation origin isolation", () => {
  test("account confirmation redirects use the configured server-side site origin", () => {
    expect(source).toContain("process.env.VALU_SITE_ORIGIN?.trim()");
    expect(source).toContain("const VALORIA_SITE_URL = resolveValoriaSiteUrl()");
    expect(source).toContain("${VALORIA_SITE_URL}/auth/callback");
  });

  test("Preview fails closed instead of sending confirmation links to production", () => {
    expect(source).toContain('process.env.VERCEL_ENV === "preview" ? "" : "https://www.valoriainstitute.com"');
    expect(source).toContain("if (!VALORIA_SITE_URL) return json({ error: \"Account confirmation origin is not configured.\" }, 500)");
  });

  test("configured callback origin must be a clean HTTPS origin", () => {
    expect(source).toContain('parsed.protocol !== "https:"');
    expect(source).toContain("parsed.username");
    expect(source).toContain("parsed.password");
    expect(source).toContain("parsed.pathname !== \"/\"");
    expect(source).toContain("parsed.search");
    expect(source).toContain("parsed.hash");
  });
});
