"use strict";
const fs = require("fs");
const path = require("path");

describe("Snapshot claim eligibility and ownership safeguards", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../api/claim-taster.js"), "utf8");

  test("allows exact-email recovery for unresolved and contact-candidate records", () => {
    expect(source).toContain("identity_status: 'in.(contact_candidate,unresolved)'");
    expect(source).toContain("candidate_email: `eq.${email}`");
    expect(source).toContain("linked_user_id: 'is.null'");
  });

  test("requires an authenticated account with a confirmed email", () => {
    expect(source).toContain("fetch(`${SUPABASE_URL}/auth/v1/user`");
    expect(source).toContain("if (!user.email_confirmed_at)");
  });

  test("retains snapshot name, role, and existing-account conflict checks", () => {
    expect(source).toContain("if (taster.user_id && taster.user_id !== userId)");
    expect(source).toContain("candidate.candidate_name");
    expect(source).toContain("candidate.candidate_role");
    expect(source).toContain("user_id: 'is.null'");
  });

  test("preserves reconciliation audit and governed readiness refresh", () => {
    expect(source).toContain("identity_status: 'account_linked'");
    expect(source).toContain("decision: 'verified_match'");
    expect(source).toContain("rpc/refresh_professional_journey");
    expect(source).toContain("rpc/sync_professional_listing_status");
  });
});
