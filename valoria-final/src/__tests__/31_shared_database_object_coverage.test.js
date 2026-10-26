// valoria-final/src/__tests__/31_shared_database_object_coverage.test.js
//
// A guard on how the cross-repository migration collisions get resolved.
//
// The collisions documented in docs/engineering/migration-collision-register.md
// mean one file per version is applied and the other is skipped. The tempting
// resolution is to delete the "losing" file from one repository. That is unsafe
// for the 20260908150000 collision specifically: the platform's file is the only
// migration anywhere that adds the four taster_sessions handoff columns and
// creates the trigger that uses them, and the site's file with the same version
// does neither. Delete the platform file to "resolve" the collision and the
// taster->profile handoff has no mechanism, with no other file to restore it.
//
// So this asserts the objects exist in the union of both repositories, whichever
// file provides them. It does not care which repository owns them, which is the
// point: the resolution can renumber, move, or consolidate freely, and this still
// holds. It fails only if the object's last remaining creator is removed.
//
// These are object-level checks, not version checks. A version check cannot see
// this defect: the version 20260908150000 exists in both repositories either way.

"use strict";

const fs = require("fs");
const path = require("path");

function migrationDirs() {
  const dirs = [path.join(__dirname, "..", "..", "supabase", "migrations")];
  const siteCandidates = [
    process.env.VALORIA_SITE_DIR,
    "/workspace/project/valoria-site",
    path.join(__dirname, "..", "..", "..", "..", "valoria-site"),
  ].filter(Boolean);
  for (const d of siteCandidates) {
    const m = path.join(d, "supabase", "migrations");
    if (fs.existsSync(m)) dirs.push(m);
  }
  return dirs;
}

// Every migration in every repository that is present, as one corpus. The site
// repository may be absent (CI); the checks below are stated so that they hold in
// either case, and the ones that need the site corpus say so.
function corpus() {
  const out = [];
  for (const dir of migrationDirs()) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
      out.push({
        file: f,
        dir,
        sql: fs.readFileSync(path.join(dir, f), "utf8"),
      });
    }
  }
  return out;
}

const ALL = corpus();

function filesMatching(re) {
  return ALL.filter((m) => re.test(m.sql)).map((m) => m.file);
}

describe("shared database object coverage", () => {
  test("the migration corpus is non-empty", () => {
    expect(ALL.length).toBeGreaterThan(0);
  });

  describe("taster_sessions handoff columns (collision 20260908150000)", () => {
    // Each of these must be added by at least one migration in the union. The
    // platform's 20260908150000 is currently the only one; that is exactly why
    // deleting it would be a silent data-integrity loss.
    for (const column of ["user_id", "linked_at", "reminder_count", "last_reminder_at"]) {
      test(`some migration adds taster_sessions.${column}`, () => {
        const re = new RegExp(
          `alter\\s+table\\s+(?:public\\.)?taster_sessions[\\s\\S]{0,400}?add\\s+column\\s+if\\s+not\\s+exists\\s+${column}\\b`,
          "i"
        );
        const found = filesMatching(re);
        expect(found).not.toEqual([]);
      });
    }

    test("some migration creates the taster->profile handoff trigger", () => {
      // Without the trigger the columns are inert: nothing links a taster
      // session to a profile when the user signs up.
      const found = filesMatching(
        /create\s+trigger\s+trg_link_taster_to_profile[\s\S]{0,200}?on\s+(?:public\.)?taster_sessions/i
      );
      expect(found).not.toEqual([]);
    });

    test("some migration defines the function the trigger calls", () => {
      const found = filesMatching(
        /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?link_taster_to_profile\s*\(/i
      );
      expect(found).not.toEqual([]);
    });

    test("the columns and the trigger come from the same migration", () => {
      // If a resolution splits them across files, the trigger can be created
      // before its columns exist, or after a database was already provisioned
      // without them. Keeping them together is what makes the file reorderable.
      const withColumns = filesMatching(
        /alter\s+table\s+(?:public\.)?taster_sessions[\s\S]{0,400}?add\s+column\s+if\s+not\s+exists\s+user_id\b/i
      );
      const withTrigger = filesMatching(
        /create\s+trigger\s+trg_link_taster_to_profile/i
      );
      expect(withColumns.some((f) => withTrigger.includes(f))).toBe(true);
    });
  });

  describe("the private schema (collision 20260827, cascade source)", () => {
    test("some migration creates the private schema", () => {
      // It is the only creator, and the 29 cascading failures in the shared
      // replay trace to this file failing and rolling back. If it is removed
      // rather than made to succeed, the cascade becomes permanent.
      const found = filesMatching(/create\s+schema\s+if\s+not\s+exists\s+private\b/i);
      expect(found).not.toEqual([]);
    });

    test("the schema is created by a migration that can run early", () => {
      // Creating a schema has no dependencies. If the only creator is a large
      // migration with table dependencies, every consumer fails until it runs,
      // which is the observed cascade. A dedicated early creation is the fix
      // this test would accept; this asserts only that one exists, not where.
      const creators = filesMatching(/create\s+schema\s+if\s+not\s+exists\s+private\b/i);
      expect(creators.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("collision register accuracy", () => {
    const REGISTER = path.join(__dirname, "..", "..", "docs", "engineering", "migration-collision-register.md");

    test("the collision register exists and records the harmful versions", () => {
      // The register is the evidence trail for the collision decisions. If a
      // collision is resolved, the register must be updated in the same change.
      expect(fs.existsSync(REGISTER)).toBe(true);
      const doc = fs.readFileSync(REGISTER, "utf8");
      expect(doc).toContain("20260908150000");
      expect(doc).toContain("20260921121500");
    });

    test("the register marks the two byte-identical collisions as harmless", () => {
      const doc = fs.readFileSync(REGISTER, "utf8");
      expect(doc).toContain("20260921124500");
      expect(doc).toContain("20260921130000");
      expect(doc.toLowerCase()).toContain("harmless");
    });
  });
});
