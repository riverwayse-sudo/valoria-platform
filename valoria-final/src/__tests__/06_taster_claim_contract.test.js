"use strict";

const fs = require("fs");
const path = require("path");

const API_PATH = path.join(__dirname, "../../api/claim-taster.js");

describe("Legacy taster claim security contract", () => {
  const source = fs.readFileSync(API_PATH, "utf8");

  test("requires a signed-in user and confirmed email", () => {
    expect(source).toContain("/auth/v1/user");
    expect(source).toContain("email_confirmed_at");
    expect(source).toContain("Bearer");
  });

  test("derives account identity from the verified session, never request payload", () => {
    expect(source).toContain("const userId = user?.id");
    expect(source).toContain("const email = String(user?.email");
    expect(source).not.toMatch(/req\.body.*user_id|payload.*user_id/);
  });

  test("only claims corroborated candidates for the exact confirmed email", () => {
    expect(source).toContain("candidate_email: `eq.${email}`");
    expect(source).toContain("identity_status: 'eq.contact_candidate'");
    expect(source).toContain("linked_user_id: 'is.null'");
    expect(source).toContain("candidate_name");
    expect(source).toContain("candidate_role");
  });

  test("uses conditional ownership writes and preserves original taster data", () => {
    expect(source).toContain("user_id: 'is.null'");
    expect(source).toContain("method: 'PATCH'");
    expect(source).toContain("original taster record and answers preserved");
    expect(source).toContain("identity_reconciliation_reviews");
  });

  test("runs journey and listing readiness gates after claim", () => {
    expect(source).toContain("refresh_professional_journey");
    expect(source).toContain("sync_professional_listing_status");
    expect(source).toContain("visibility remains governed by the normal readiness");
  });
});
