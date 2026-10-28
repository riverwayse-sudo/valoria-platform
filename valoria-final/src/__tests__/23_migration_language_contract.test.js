// valoria-final/src/__tests__/23_migration_language_contract.test.js
//
// Guards a class of defect that is invisible until a migration is replayed on a
// real database. `20260827_marketplace_governance_v4.sql` declared
// `language plpgsql` on a wrapper function whose body is a bare `select ...`.
// PostgreSQL rejects that with `syntax error at or near "select"`, so the
// migration could never apply to a clean database — yet it had been applied to
// the live one, where the failure was never exercised.
//
// A static assertion cannot prove a migration executes. What it can do is catch
// this specific, mechanical mismatch: a body that is a single SQL statement
// cannot be PL/pgSQL. That is what these tests check, alongside the other
// properties a clean provision depends on.

"use strict";

const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "supabase", "migrations");

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function read(file) {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
}

// Strips comments and string literals so prose cannot be mistaken for SQL.
function clean(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/'(?:[^']|'')*'/g, "''");
}

// Every `create [or replace] function` header paired with its body.
function functionDefinitions(sql) {
  const out = [];
  const re = /create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_.]+)\s*\(([^)]*)\)\s*([\s\S]*?)\$\$([\s\S]*?)\$\$/gi;
  for (const m of sql.matchAll(re)) {
    out.push({ name: m[1], signature: m[2], header: m[3], body: m[4] });
  }
  return out;
}

describe("tracked migration language contract", () => {
  const files = migrationFiles();

  test("the migrations directory is present and non-empty", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // The exact defect class that broke the chain. A `language plpgsql` body must
  // contain PL/pgSQL structure — at minimum a `begin ... end`, or a statement
  // that is not valid as a single SQL expression. A bare `select x;` is not.
  test("no function declares plpgsql with a single-statement SQL body", () => {
    const offenders = [];
    for (const file of files) {
      for (const fn of functionDefinitions(clean(read(file)))) {
        const declaresPlpgsql = /\blanguage\s+plpgsql\b/i.test(fn.header);
        if (!declaresPlpgsql) continue;
        const body = fn.body.trim().replace(/;+\s*$/, "").trim();
        if (!body) continue;
        const hasPlpgsqlStructure = /\bbegin\b/i.test(body) || /\bdeclare\b/i.test(body);
        // A body that is only a single `select ...` (optionally parenthesised)
        // is a SQL function body, not PL/pgSQL.
        const isBareSelect = /^\(*\s*select\b[\s\S]*\)*$/i.test(body) && !body.includes(";");
        if (!hasPlpgsqlStructure && isBareSelect) {
          offenders.push(`${file}: ${fn.name}(${fn.signature.slice(0, 60)})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // The regression itself, pinned by name so the specific fix cannot silently
  // revert. If this fails, `20260827_marketplace_governance_v4.sql` has been
  // changed back to a form PostgreSQL rejects.
  test("the readiness wrapper in marketplace_governance_v4 is language sql", () => {
    const file = "20260827_marketplace_governance_v4.sql";
    const sql = clean(read(file));
    const m = sql.match(
      /create\s+or\s+replace\s+function\s+public\.evaluate_professional_readiness\s*\(([^)]*)\)\s*([\s\S]*?)\$\$/
    );
    expect(m).not.toBeNull();
    expect(m[2]).toMatch(/\blanguage\s+sql\b/i);
    expect(m[2]).not.toMatch(/\blanguage\s+plpgsql\b/i);
  });

  // The wrapper must delegate, not reimplement: the security-relevant logic
  // lives in `private`. A change that inlined it here would move the logic out
  // of the private schema and change its exposure.
  test("the readiness wrapper delegates to the private implementation", () => {
    const sql = clean(read("20260827_marketplace_governance_v4.sql"));
    expect(sql).toMatch(/public\.evaluate_professional_readiness[\s\S]*?private\.evaluate_professional_readiness/);
  });

  // Every public wrapper over a private function must be executable only by
  // service_role. A wrapper that kept the default PUBLIC execute grant would
  // expose the readiness logic to anon, which the migration intends to prevent.
  test("public wrappers revoke execute from public, anon and authenticated", () => {
    const sql = clean(read("20260827_marketplace_governance_v4.sql"));
    for (const fn of ["evaluate_professional_readiness", "compute_professional_listing_eligibility", "sync_professional_listing_status"]) {
      const revoke = new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`,
        "i"
      );
      expect(sql).toMatch(revoke);
      const grant = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s+to\\s+service_role`, "i");
      expect(sql).toMatch(grant);
    }
  });
});

describe("clean-provision prerequisites", () => {
  const files = migrationFiles();

  // These objects are referenced by the migrations but created by no migration.
  // The list is asserted so that a newly added migration depending on another
  // untracked object is caught here rather than only at provisioning time.
  const KNOWN_UNTRACKED = [
    "professional_profiles",
    "valu_assessments",
    "taster_sessions",
    "valoria_journey_events",
    "professional_standard_event_registrations",
    "assessment_sessions",
    "opportunity_invites",
    "valoria_reentry_links",
    "rate_limits",
    "marketplace_profiles",
  ];

  test("no tracked migration creates any of the known-untracked tables", () => {
    // If this ever fails, the gap has been closed and this list must be updated
    // — which is the intended signal, not a problem.
    const created = new Set();
    for (const file of files) {
      for (const m of clean(read(file)).matchAll(
        /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.|private\.)?"?([a-z0-9_]+)"?/gi
      )) {
        created.add(m[1].toLowerCase());
      }
    }
    const nowTracked = KNOWN_UNTRACKED.filter((t) => created.has(t));
    expect(nowTracked).toEqual([]);
  });

  test("the private schema is created by exactly one tracked migration", () => {
    const creators = files.filter((f) => /create\s+schema\s+if\s+not\s+exists\s+private/i.test(clean(read(f))));
    expect(creators).toEqual(["20260827_marketplace_governance_v4.sql"]);
  });

  // Documents the ordering defect: migrations sorting before the one that
  // creates `private` already reference it. Asserted as a known condition so
  // that if the ordering is repaired, this test fails and the repair is noticed.
  test("migrations sorting before the private-schema creator already reference private", () => {
    const creator = "20260827_marketplace_governance_v4.sql";
    const early = files.filter(
      (f) => f < creator && /\bprivate\./.test(clean(read(f)))
    );
    expect(early.length).toBeGreaterThan(0);
  });
});
