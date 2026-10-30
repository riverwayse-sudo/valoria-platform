const fs = require("node:fs");
const path = require("node:path");

const api = name => fs.readFileSync(path.join(process.cwd(), "api", name), "utf8");

describe("Vercel Hobby function budget and VALU handoff runtime", () => {
  test("assessment progress stays Edge-compatible and verifies HMAC with Web Crypto", () => {
    const source = api("assessment-progress.js");
    expect(source).toContain('runtime: "edge"');
    expect(source).toContain('../lib/valu-handoff-token-edge.js');
    expect(source).toContain("verifyValuHandoffTokenEdge(handoffToken, tasterId)");
    expect(source).not.toContain("node:crypto");
  });

  test("lightweight system status remains Edge to offset the participant API Node function", () => {
    const source = api("system-status.js");
    expect(source).toContain('runtime: "edge"');
    expect(source).toContain('req.headers.get("authorization")');
    expect(source).toContain("return new Response(");
    expect(source).not.toContain("node:crypto");
    expect(source).not.toContain("res.status(");
  });

  test("the system status endpoint remains fail-closed when cron configuration is absent", () => {
    const source = api("system-status.js");
    expect(source).toContain("!SUPABASE_URL || !SERVICE_ROLE_KEY || !CRON_SECRET");
    expect(source).toContain('error: "Service unavailable" }, 503');
    expect(source).toContain('error: "Unauthorized" }, 401');
  });
});
