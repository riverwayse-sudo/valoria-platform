"use strict";

const fs = require("fs");
const path = require("path");

const migration = fs.readFileSync(
  path.join(__dirname, "../../supabase/migrations/20261112123000_harden_public_roster_rpc_visibility_and_identity.sql"),
  "utf8"
);

describe("Public marketplace roster RPC security contract", () => {
  test("public RPC never returns personal names or initials", () => {
    expect(migration).toContain("NULL::text AS full_name");
    expect(migration).toContain("NULL::text AS display_initials");
  });

  test("public reads revalidate consent, visibility, listing state and assessment validity", () => {
    expect(migration).toContain("private.has_public_profile_consent(p.id)");
    expect(migration).toContain("p.visibility IN ('public', 'marketplace')");
    expect(migration).toContain("p.listing_status = 'listed'");
    expect(migration).toContain("p.revoked_at IS NULL");
    expect(migration).toContain("private.valu_assessment_is_current(p.id)");
    expect(migration).toContain("private.is_basic_public_profile_ready(p.id)");
    expect(migration).toContain("controls.admin_revoked");
  });

  test("private roster helper is not directly executable by client roles", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION private.get_marketplace_public_roster_v1_impl(uuid, text) FROM PUBLIC, anon, authenticated"
    );
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("has_function_privilege('anon'");
  });

  test("roster writer removes administrator-revoked profiles from the internal projection", () => {
    const writerMigration = fs.readFileSync(
      path.join(__dirname, "../../supabase/migrations/20261112133000_exclude_admin_revoked_profiles_from_roster_writer.sql"),
      "utf8"
    );
    expect(writerMigration).toContain("controls.admin_revoked");
    expect(writerMigration).toContain("is_revoked");
    expect(writerMigration).toContain("Marketplace writer does not enforce administrator revocation");
  });

  test("roster writer never projects registered-only profiles and requires explicit consent", () => {
    expect(migration).toContain("public_consent_ok");
    expect(migration).toContain("private.has_public_profile_consent(p_professional_id)");
    expect(migration).toContain("p.visibility in ('public','marketplace','registered_only')");
    expect(migration).toContain("p.visibility in ('public','marketplace')");
    expect(migration).toContain("Expected exactly two public-roster visibility gates");
  });
});
