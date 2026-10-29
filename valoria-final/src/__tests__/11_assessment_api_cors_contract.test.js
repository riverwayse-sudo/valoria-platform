"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const API_ROOT = path.join(__dirname, "../../api");
const read = (name) => fs.readFileSync(path.join(API_ROOT, name), "utf8");

// Every browser-facing assessment endpoint is called cross-origin from the
// assessment UI (assessment.valoriainstitute.com and the /valu/assessment/
// proxy on valoriainstitute.com). Without an allow-listed preflight response
// the browser blocks the POST before it ever reaches the handler.
describe("assessment API CORS and origin contract", () => {
  const corsWrapped = [
    "taster-progress.js",
    "submit-taster.js",
    "generate-and-send-report.js",
  ];

  test.each(corsWrapped)("%s applies the shared CORS policy and answers preflight", (file) => {
    const source = read(file);
    expect(source).toContain("./_cors.js");
    expect(source).toContain("applyCors(req, res)");
    expect(source).toContain("handlePreflight(req, res)");
  });

  test("assessment-progress wraps the edge handler so restore/save carry CORS headers", () => {
    const source = read("assessment-progress.js");
    expect(source).toContain('import { withEdgeCors } from "./_cors.js"');
    expect(source).toContain("export default withEdgeCors(baseHandler)");
  });

  test("the CORS allow-list is explicit and never wildcarded", () => {
    const source = read("_cors.js");
    expect(source).toContain("'https://valoriainstitute.com'");
    expect(source).toContain("'https://www.valoriainstitute.com'");
    expect(source).toContain("'https://assessment.valoriainstitute.com'");
    expect(source).not.toContain("'*'");
    expect(source).toContain("Access-Control-Allow-Methods', 'POST, OPTIONS'");
  });

  test("preflight rejects an unlisted origin and answers allowed origins with 204", () => {
    const source = read("_cors.js");
    expect(source).toContain("if (headers === null) return edgeJson({ error: 'Origin not allowed.' }, 403)");
    expect(source).toContain("return new Response(null, { status: 204");
  });

  test("the taster and progress APIs still reject non-POST methods with 405", () => {
    for (const file of ["taster-progress.js", "submit-taster.js"]) {
      const source = read(file);
      expect(source).toContain("if (req.method !== 'POST') return json(res, 405");
    }
  });

  test("no browser-facing assessment API derives its path from the Vite asset base", () => {
    const component = fs.readFileSync(path.join(__dirname, "../VALUIndexV4GateNext.jsx"), "utf8");
    const full = fs.readFileSync(path.join(__dirname, "../FullVALUAssessment.jsx"), "utf8");
    expect(component).not.toContain("import.meta.env.BASE_URL");
    expect(full).not.toContain("import.meta.env.BASE_URL");
    expect(component).toContain("https://assessment.valoriainstitute.com");
    expect(full).toContain("https://assessment.valoriainstitute.com");
  });

  test("the CORS helper actually allows the assessment origins and blocks others", () => {
    const script = `
      import { applyCors, handlePreflight, corsHeaders, withEdgeCors } from ${JSON.stringify(path.join(API_ROOT, "_cors.js"))};
      const set = new Map();
      const res = { setHeader: (k, v) => set.set(k, v), getHeader: (k) => set.get(k), status(code) { this.code = code; return this; }, json() { return this; }, end() {} };
      const allowed = applyCors({ headers: { origin: 'https://valoriainstitute.com' } }, res);
      const blocked = applyCors({ headers: { origin: 'https://evil.example.com' } }, res);
      const preflight = handlePreflight({ method: 'OPTIONS', headers: { origin: 'https://assessment.valoriainstitute.com' } }, res);
      const edgeAllowed = corsHeaders('https://valoriainstitute.com');
      const edgeBlocked = corsHeaders('https://evil.example.com');
      const wrapped = withEdgeCors(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const preflightResponse = await wrapped({ method: 'OPTIONS', headers: { get: (k) => (k === 'origin' ? 'https://valoriainstitute.com' : null) } });
      const bodyResponse = await wrapped({ method: 'POST', headers: { get: (k) => (k === 'origin' ? 'https://assessment.valoriainstitute.com' : null) } });
      console.log(JSON.stringify({
        allowed, blocked,
        allowHeader: res.getHeader('Access-Control-Allow-Origin'),
        preflightStatus: res.code,
        edgeAllowedOrigin: edgeAllowed && edgeAllowed['Access-Control-Allow-Origin'],
        edgeBlocked,
        preflightResponseStatus: preflightResponse.status,
        preflightCors: preflightResponse.headers.get('access-control-allow-origin'),
        bodyStatus: bodyResponse.status,
        bodyCors: bodyResponse.headers.get('access-control-allow-origin'),
        bodyPayload: await bodyResponse.json(),
      }));
    `;
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
    const result = JSON.parse(output.trim().split("\n").pop());
    expect(result.allowed).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.allowHeader).toBe("https://valoriainstitute.com");
    expect(result.preflightStatus).toBe(204);
    expect(result.edgeAllowedOrigin).toBe("https://valoriainstitute.com");
    expect(result.edgeBlocked).toBe(null);
    expect(result.preflightResponseStatus).toBe(204);
    expect(result.preflightCors).toBe("https://valoriainstitute.com");
    expect(result.bodyStatus).toBe(200);
    expect(result.bodyCors).toBe("https://assessment.valoriainstitute.com");
    expect(result.bodyPayload).toEqual({ ok: true });
  });
});
