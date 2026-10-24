const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// The live entry graph: main.jsx mounts VALUIndexV4App, which renders the gate
// and the full assessment. Components outside this graph are not bundled.
const LIVE = [
  "VALUIndexV4App.jsx",
  "AssessmentNavigation.jsx",
  "VALUIndexV4GateNext.jsx",
  "VALUIndexV4Gate.jsx",
  "FullVALUAssessment.jsx",
];

describe("assessment app links follow the deployment environment", () => {
  test("no live component hardcodes the production site origin", () => {
    // These links route a participant out of the assessment and into the site
    // (sign in, sign up, journey continuation, report, profile setup). Hardcoded
    // to production, a staging participant is handed back to the production site
    // and their staging journey is never completed.
    const offenders = [];
    for (const file of LIVE) {
      const source = read(`src/${file}`);
      for (const m of source.matchAll(/["'`]https:\/\/valoriainstitute\.com[^"'`]*["'`]/g)) {
        offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("each live component routes its site links through the shared helper", () => {
    const users = LIVE.filter((f) => /siteUrl\(|SITE_ORIGIN/.test(read(`src/${f}`)));
    expect(users).toEqual(
      expect.arrayContaining([
        "AssessmentNavigation.jsx",
        "VALUIndexV4GateNext.jsx",
        "FullVALUAssessment.jsx",
      ])
    );
  });

  test("the helper reads the build-time origin and tolerates its absence in Jest", () => {
    const source = read("src/siteOrigin.js");
    // Comments are stripped first: the file documents why it avoids
    // import.meta.env, and that prose must not be mistaken for a usage.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // Vite substitutes __SITE_ORIGIN__ at build time. It must not come from
    // import.meta.env: Babel, which Jest uses to transform this app, rejects
    // `import.meta` outright, so such a module could not be imported by a test.
    expect(code).toContain("__SITE_ORIGIN__");
    expect(code).not.toContain("import.meta");
    expect(code).toMatch(/typeof __SITE_ORIGIN__ !== ["']undefined["']/);
  });

  test("the build injects the origin from the environment, defaulting to production", () => {
    const config = read("vite.config.js");
    const code = config
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // The define must actually be wired into the config object. Asserting the
    // bare token appears anywhere is not enough: it survives in a comment, so
    // deleting the define would still pass.
    expect(code).toMatch(/define:\s*\{[^}]*__SITE_ORIGIN__/);
    expect(code).toMatch(/VALORIA_SITE_URL/);
    // The default must be the production origin, so a deployment with nothing
    // configured behaves exactly as before this change.
    expect(code).toMatch(/VALORIA_SITE_URL\s*\|\|\s*'https:\/\/valoriainstitute\.com'/);
  });

  test("the helper's default is the production origin, so an unset var is not broken", () => {
    const source = read("src/siteOrigin.js");
    const fallback = source.match(/\?\s*String\(__SITE_ORIGIN__\)[\s\S]*?:\s*'([^']+)'/);
    expect(fallback).not.toBeNull();
    expect(fallback[1]).toBe("https://valoriainstitute.com");
  });

  test("siteUrl builds an absolute URL from the resolved origin", () => {
    // Executes the real helper with the build-time global defined, which is what
    // Vite produces.
    const file = path.join(root, "src/siteOrigin.js");
    const body = fs
      .readFileSync(file, "utf8")
      .replace(/^export const SITE_ORIGIN/m, "const SITE_ORIGIN")
      .replace(/^export function siteUrl/m, "function siteUrl")
      .concat("\nreturn { SITE_ORIGIN, siteUrl };\n");
    const load = (origin) =>
      new Function("__SITE_ORIGIN__", body)(origin);

    const staging = load("https://staging.valoriainstitute.com");
    expect(staging.SITE_ORIGIN).toBe("https://staging.valoriainstitute.com");
    expect(staging.siteUrl("/login")).toBe("https://staging.valoriainstitute.com/login");
    // A trailing slash must not produce a double slash.
    const trailing = load("https://staging.example.com/");
    expect(trailing.siteUrl("/login")).toBe("https://staging.example.com/login");
    // Absent (as in Jest) falls back to production rather than throwing.
    expect(load(undefined).SITE_ORIGIN).toBe("https://valoriainstitute.com");
  });
});
