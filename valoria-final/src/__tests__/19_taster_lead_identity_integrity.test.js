"use strict";

import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.join(__dirname, "../../supabase/migrations/20261107150000_enforce_taster_lead_identity_foreign_keys.sql"),
  "utf8"
);

describe("taster registration identity integrity", () => {
  test("new progress, submitted tasters and identity candidates must reference a registered lead", () => {
    expect(migration).toContain("FOREIGN KEY (lead_capture_id)");
    expect(migration).toContain("REFERENCES public.lead_captures(id)");
    expect(migration).toContain("NOT VALID");
    expect(migration).toContain("NEW.lead_capture_id IS NULL");
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF lead_capture_id");
  });

  test("taster identity candidates and account links cannot point to missing records", () => {
    expect(migration).toContain("taster_identity_candidates_taster_id_fkey");
    expect(migration).toContain("REFERENCES public.taster_sessions(id)");
    expect(migration).toContain("taster_sessions_user_id_fkey");
    expect(migration).toContain("REFERENCES auth.users(id)");
    expect(migration).toContain("taster_identity_candidates_linked_user_id_fkey");
  });

  test("taster progress submission references are unique", () => {
    expect(migration).toContain("taster_progress_submission_key_key");
    expect(migration).toContain("WHERE submission_key IS NOT NULL");
  });
});
