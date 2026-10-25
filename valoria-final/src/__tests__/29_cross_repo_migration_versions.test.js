// valoria-final/src/__tests__/29_cross_repo_migration_versions.test.js
//
// The two repositories share one Supabase database (AGENTS.md: "Shared database
// with valoria-site"), and each contributes migrations to it. Supabase records
// an applied migration by its version — the leading numeric prefix of the
// filename — and will not apply a second file with a version it has already
// seen. So when both repositories contain a file with the same version, only one
// can ever be applied; the other is skipped, and nothing reports it.
//
// Two such collisions exist, both with differing content:
//
//   20260908150000  platform: valu_teaser_profile_handoff.sql
//                   site:     fix_taster_profile_handoff_trigger.sql
//   20260921121500  platform: close_signup_profile_capability_listing_drift.sql
//                   site:     close_signup_profile_capability_listing_drift.sql
//
// The second is the sharper of the two: the same filename, the same intent, and
// different bodies — the platform copy is missing the cv_url completeness clause
// and the private.valu_assessment_is_current() check that the site copy has. One
// of the two is therefore not what staging actually ran, and which one depends on
// application order rather than on anything in the repository.
//
// This test pins the collision set so it cannot grow silently. Adding a new
// cross-repository version collision fails here, which is the point: the
// resolution is to renumber, and that is a decision for a human, not a default.

"use strict";

const fs = require("fs");
const path = require("path");

const PLATFORM_DIR = path.join(__dirname, "..", "..", "supabase", "migrations");
const SITE_DIR = "/workspace/project/valoria-site/supabase/migrations";

// Versions already known to collide with DIFFERING content. These are the
// harmful ones: one of the two files is not what the database ran, and which one
// depends on application order. This list may only shrink, and shrinking it
// requires renumbering a migration.
const KNOWN_HARMFUL_COLLISIONS = {
  20260908150000:
    "platform adds taster_sessions columns and a trigger; site replaces the function only. " +
    "Different objects, so neither is a strict superset; needs a human to decide the ordering.",
  20260921121500:
    "same filename and intent, different bodies: the platform copy omits the cv_url clause and " +
    "the private.valu_assessment_is_current() check the site copy has. Renumbering is required " +
    "before either can be trusted as the applied definition.",
};

// Versions present in both repositories with byte-identical content. These are
// harmless — applying either produces the same database — but they are listed so
// the guard can tell "the same file copied into both repositories" apart from
// "two different files claiming one version", which is the defect that matters.
const KNOWN_HARMLESS_DUPLICATES = ["20260921124500", "20260921130000"];

function versions(dir) {
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const m = file.match(/^(\d+)_/);
    if (!m) continue;
    if (!out.has(m[1])) out.set(m[1], []);
    out.get(m[1]).push(file);
  }
  return out;
}

// Classify every shared version by whether the bodies agree.
function classify(platform, site) {
  const shared = [...platform.keys()].filter((v) => site.has(v));
  const harmful = [];
  const harmless = [];
  for (const v of shared) {
    const pb = fs.readFileSync(path.join(PLATFORM_DIR, platform.get(v)[0]), "utf8");
    const sb = fs.readFileSync(path.join(SITE_DIR, site.get(v)[0]), "utf8");
    ;(pb === sb ? harmless : harmful).push(v);
  }
  return { harmful: harmful.sort(), harmless: harmless.sort() };
}

describe("cross-repository migration versions", () => {
  const platform = versions(PLATFORM_DIR);
  const site = versions(SITE_DIR);
  const { harmful, harmless } = classify(platform, site);

  test("the site migrations directory is reachable", () => {
    expect(fs.existsSync(SITE_DIR)).toBe(true);
  });

  test("no new harmful version collision has appeared", () => {
    // A new collision means two different files claim one version, so one is
    // silently never applied. This must be resolved by renumbering, which is a
    // human decision — so the test stops rather than picking a winner.
    const unexpected = harmful.filter((v) => !(v in KNOWN_HARMFUL_COLLISIONS));
    expect(unexpected).toEqual([]);
  });

  test("no new harmless duplicate has appeared", () => {
    const unexpected = harmless.filter((v) => !KNOWN_HARMLESS_DUPLICATES.includes(v));
    expect(unexpected).toEqual([]);
  });

  test("the known-harmful list is exactly the harmful set", () => {
    // If a collision is resolved, this fails until the entry is deleted, so the
    // list cannot quietly outlive the defect.
    expect(harmful).toEqual(Object.keys(KNOWN_HARMFUL_COLLISIONS).sort());
  });

  test("the known-harmless list is exactly the identical-content set", () => {
    expect(harmless).toEqual([...KNOWN_HARMLESS_DUPLICATES].sort());
  });
});
