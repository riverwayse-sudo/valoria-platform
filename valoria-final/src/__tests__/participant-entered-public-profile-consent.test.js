"use strict";

const fs = require("fs");
const path = require("path");

const migration = fs.readFileSync(
  path.join(__dirname, "../../supabase/migrations/20261126000638_require_participant_entered_public_profile_consent.sql"),
  "utf8"
);

describe("Participant-entered public profile consent", () => {
  test("administrator attestations cannot satisfy public visibility consent", () => {
    expect(migration).toContain("acknowledgement.source IN ('profile_setup', 'profile_edit')");
    expect(migration).not.toContain("'admin_attestation')");
  });

  test("only the current, versioned profile submission acknowledgement is considered", () => {
    expect(migration).toContain("acknowledgement.acknowledgement_version = 'public-profile-visibility-v3-2026-11-07'");
    expect(migration).toContain("acknowledgement.acknowledgement_type = 'profile_submission'");
    expect(migration).toContain("ORDER BY acknowledgement.acknowledged_at DESC NULLS LAST");
  });

  test("existing public profiles without participant consent are made registered-only and reprojected", () => {
    expect(migration).toContain("SET visibility = 'registered_only'");
    expect(migration).toContain("PERFORM public.refresh_marketplace_public_roster(affected.id)");
    expect(migration).toContain("Profiles without participant-entered public consent remain publicly visible");
    expect(migration).toContain("Marketplace public roster contains a profile without participant-entered consent");
  });

  test("the helper is not directly executable by client roles", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION private.has_public_profile_consent(uuid) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION private.has_public_profile_consent(uuid) TO service_role");
  });
});
