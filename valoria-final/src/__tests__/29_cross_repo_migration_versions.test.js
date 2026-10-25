// valoria-final/src/__tests__/29_cross_repo_migration_versions.test.js
//
// Supabase records an applied migration by its version — the leading numeric
// prefix of the filename — and will not apply a second file with a version it has
// already seen. So when two files claim one version, only one is ever applied and
// the other is skipped without any report. That holds both within a repository
// and across the two that share the database (AGENTS.md: "Shared database with
// valoria-site").
//
// Two parts:
//
//   * within-repository — always runs. This repository has three date-only
//     versions covering 28 files (20260816, 20260827, 20260828). Pinned here so a
//     new duplicate fails rather than joining them unnoticed.
//
//   * cross-repository — runs only when the valoria-site checkout is present.
//     Two shared versions have differing content, so one of the two is not what
//     the database ran and which one depends on application order. That test is
//     skipped, not passed, when the sibling repository is unavailable — a skipped
//     check is honest; a check that cannot see the other repository and reports
//     success anyway is not.

"use strict";

const fs = require("fs");
const path = require("path");

const PLATFORM_DIR = path.join(__dirname, "..", "..", "supabase", "migrations");

// The site repository is a sibling checkout in the development workspace and a
// separate repository in CI, where it is absent. VALORIA_SITE_DIR lets a combined
// job point at it. Returns the migrations directory, not the repository root.
function resolveSiteDir() {
  const candidates = [
    process.env.VALORIA_SITE_DIR,
    "/workspace/project/valoria-site",
    path.join(__dirname, "..", "..", "..", "..", "valoria-site"),
  ].filter(Boolean);
  for (const d of candidates) {
    const migrations = path.join(d, "supabase", "migrations");
    if (fs.existsSync(migrations)) return migrations;
  }
  return null;
}

const SITE_DIR = resolveSiteDir();

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

// Versions this repository uses for more than one file. These are date-only
// (YYYYMMDD), which cannot be unique per file, so either they are applied out of
// band rather than by version, or all but one is skipped. Recorded as observed;
// this list may only shrink.
const KNOWN_WITHIN_REPO_DUPLICATES = {
  20260816: 17,
  20260827: 9,
  20260828: 2,
};

// Cross-repository versions with DIFFERING content. Harmful: one of the two is
// not what the database ran.
const KNOWN_HARMFUL_CROSS_REPO = {
  20260908150000:
    "platform adds taster_sessions columns and a trigger; site replaces the function only. " +
    "Different objects, so neither is a strict superset; needs a human to decide the ordering.",
  20260921121500:
    "same filename and intent, different bodies: the platform copy omits the cv_url clause and " +
    "the private.valu_assessment_is_current() check the site copy has. Renumbering is required " +
    "before either can be trusted as the applied definition.",
};

// Cross-repository versions with byte-identical content. Harmless: applying
// either produces the same database.
const KNOWN_HARMLESS_CROSS_REPO = ["20260921124500", "20260921130000"];

describe("within-repository migration versions", () => {
  const platform = versions(PLATFORM_DIR);

  test("the migrations directory is present", () => {
    expect(platform.size).toBeGreaterThan(0);
  });

  test("no new duplicate version has appeared", () => {
    const dupes = [...platform.entries()].filter(([, files]) => files.length > 1);
    const unexpected = dupes.filter(([v]) => !(v in KNOWN_WITHIN_REPO_DUPLICATES));
    expect(unexpected.map(([v]) => v)).toEqual([]);
  });

  test("the known duplicates are exactly the ones present", () => {
    // If one is split into unique versions, this fails until the entry is removed.
    const dupes = [...platform.entries()].filter(([, files]) => files.length > 1);
    expect(dupes.map(([v]) => v).sort()).toEqual(Object.keys(KNOWN_WITHIN_REPO_DUPLICATES).sort());
  });

  test("the recorded file counts are accurate", () => {
    // A duplicate group that grows is also a change worth seeing.
    const dupes = Object.fromEntries(
      [...platform.entries()].filter(([, files]) => files.length > 1).map(([v, f]) => [v, f.length])
    );
    expect(dupes).toEqual(KNOWN_WITHIN_REPO_DUPLICATES);
  });
});

const describeCrossRepo = SITE_DIR ? describe : describe.skip;
if (!SITE_DIR) {
  console.warn(
    "cross-repository migration guard SKIPPED: no valoria-site checkout found.\n" +
      "  Set VALORIA_SITE_DIR=/path/to/valoria-site to run it. This guard cannot run\n" +
      "  in a platform-only checkout, and reporting it as passing would be false."
  );
}

describeCrossRepo("cross-repository migration versions", () => {
  const platform = versions(PLATFORM_DIR);
  const site = versions(SITE_DIR);

  function classify() {
    const shared = [...platform.keys()].filter((v) => site.has(v));
    const harmful = [];
    const harmless = [];
    for (const v of shared) {
      const pb = fs.readFileSync(path.join(PLATFORM_DIR, platform.get(v)[0]), "utf8");
      const sb = fs.readFileSync(path.join(SITE_DIR, site.get(v)[0]), "utf8");
      (pb === sb ? harmless : harmful).push(v);
    }
    return { harmful: harmful.sort(), harmless: harmless.sort() };
  }

  test("no new harmful version collision has appeared", () => {
    // Two different files claiming one version: one is silently never applied.
    // Resolved by renumbering, which is a human decision — so this stops rather
    // than picking a winner.
    const unexpected = classify().harmful.filter((v) => !(v in KNOWN_HARMFUL_CROSS_REPO));
    expect(unexpected).toEqual([]);
  });

  test("no new harmless duplicate has appeared", () => {
    const unexpected = classify().harmless.filter((v) => !KNOWN_HARMLESS_CROSS_REPO.includes(v));
    expect(unexpected).toEqual([]);
  });

  test("the known-harmful list is exactly the harmful set", () => {
    expect(classify().harmful).toEqual(Object.keys(KNOWN_HARMFUL_CROSS_REPO).sort());
  });

  test("the known-harmless list is exactly the identical-content set", () => {
    expect(classify().harmless).toEqual([...KNOWN_HARMLESS_CROSS_REPO].sort());
  });
});
