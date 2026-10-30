"use strict";
const { createHmac } = require("node:crypto");
const path = require("path");
const { pathToFileURL } = require("node:url");

// The site signs the full-assessment handoff token with node:crypto HMAC-SHA256;
// the assessment platform verifies it in both its Edge and canonical Node runtimes. If the
// two ever disagree on payload shape, audience, signature or TTL, the participant sees
// "secure link expired" and cannot continue. This exercises the real platform
// verifier against a token built exactly the way the site builds it.
const SECRET = "test-only-service-role-secret-for-handoff-interop";

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signToken(payload, secret = SECRET) {
  const encoded = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

describe("VALU full-assessment handoff token interoperability", () => {
  let verifyValuHandoffTokenEdge;
  let verifyValuHandoffToken;
  const now = Math.floor(Date.now() / 1000);
  const tasterId = "3f0a1c2e-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
  const payload = {
    v: 1,
    typ: "assessment_session",
    aud: "valu-full-assessment",
    sub: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    taster_id: tasterId,
    iat: now,
    exp: now + 4 * 60 * 60,
    jti: "jti-0123456789abcdef",
  };

  beforeAll(async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
    const moduleUrl = pathToFileURL(path.join(__dirname, "../../lib/valu-handoff-token-edge.js")).href;
    ({ verifyValuHandoffTokenEdge } = await import(moduleUrl));
    const nodeModuleUrl = pathToFileURL(path.join(__dirname, "../../lib/valu-handoff-token.js")).href;
    ({ verifyValuHandoffToken } = await import(nodeModuleUrl));
  });

  test("the platform verifier accepts a platform-issued session token signed with Node HMAC", async () => {
    const verified = await verifyValuHandoffTokenEdge(signToken(payload), tasterId);
    expect(verified).not.toBeNull();
    expect(verified.sub).toBe(payload.sub);
    expect(verified.taster_id).toBe(tasterId);
    expect(verified.aud).toBe("valu-full-assessment");
  });

  test("the canonical Node verifier accepts the same signed session token", () => {
    const verified = verifyValuHandoffToken(signToken(payload), tasterId);
    expect(verified).not.toBeNull();
    expect(verified.sub).toBe(payload.sub);
    expect(verified.taster_id).toBe(tasterId);
    expect(verified.aud).toBe("valu-full-assessment");
  });

  test("the canonical Node verifier rejects expired, mismatched, and tampered tokens", () => {
    const expired = { ...payload, iat: now - 8 * 60 * 60, exp: now - 60 };
    const other = "00000000-0000-4000-8000-000000000000";
    const token = signToken(payload);
    const [encoded, signature] = token.split(".");
    expect(verifyValuHandoffToken(signToken(expired), tasterId)).toBeNull();
    expect(verifyValuHandoffToken(token, other)).toBeNull();
    expect(verifyValuHandoffToken(`${encoded}.${signature.slice(0, -2)}xx`, tasterId)).toBeNull();
    expect(verifyValuHandoffToken(signToken(payload, "wrong-secret"), tasterId)).toBeNull();
    expect(verifyValuHandoffToken("not-a-token", tasterId)).toBeNull();
  });

  test("an expired token is rejected", async () => {
    const expired = { ...payload, iat: now - 8 * 60 * 60, exp: now - 60 };
    expect(await verifyValuHandoffTokenEdge(signToken(expired), tasterId)).toBeNull();
  });

  test("a token for a different taster is rejected", async () => {
    const other = "00000000-0000-4000-8000-000000000000";
    expect(await verifyValuHandoffTokenEdge(signToken(payload), other)).toBeNull();
  });

  test("a tampered signature is rejected", async () => {
    const token = signToken(payload);
    const [encoded, signature] = token.split(".");
    const tampered = `${encoded}.${signature.slice(0, -2)}xx`;
    expect(await verifyValuHandoffTokenEdge(tampered, tasterId)).toBeNull();
  });

  test("a token signed with the wrong secret is rejected", async () => {
    expect(await verifyValuHandoffTokenEdge(signToken(payload, "wrong-secret"), tasterId)).toBeNull();
  });

  test("safe diagnostic callbacks identify missing, expired, and invalid signatures without exposing token data", async () => {
    let reason = null;
    expect(await verifyValuHandoffTokenEdge("", tasterId, value => { reason = value; })).toBeNull();
    expect(reason).toBe("token_missing");

    const expired = { ...payload, iat: now - 8 * 60 * 60, exp: now - 60 };
    reason = null;
    expect(await verifyValuHandoffTokenEdge(signToken(expired), tasterId, value => { reason = value; })).toBeNull();
    expect(reason).toBe("token_expired");

    reason = null;
    expect(await verifyValuHandoffTokenEdge(signToken(payload, "wrong-secret"), tasterId, value => { reason = value; })).toBeNull();
    expect(reason).toBe("signature_invalid");
  });

  test("a malformed token is rejected without throwing", async () => {
    expect(await verifyValuHandoffTokenEdge("not-a-token", tasterId)).toBeNull();
    expect(await verifyValuHandoffTokenEdge("", tasterId)).toBeNull();
    expect(await verifyValuHandoffTokenEdge(null, tasterId)).toBeNull();
  });
});
