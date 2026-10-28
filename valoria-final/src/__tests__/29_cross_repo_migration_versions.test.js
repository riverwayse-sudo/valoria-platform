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
// Both platform migration directories are scanned (valoria-final/supabase/migrations
// and the repository-root supabase/migrations). The root directory holds four files
// that also exist in valoria-site, and scanning only the first directory hid every
// one of those collisions.
//
//   * cross-repository — runs only when the valoria-site checkout is present.
//     Two shared versions have differing content, so one of the two is not what
//     the database ran and which one depends on application order. That test is
//     skipped, not passed, when the sibling repository is unavailable — a skipped
//     check is honest; a check that cannot see the other repository and reports
//     success anyway is not.
//
// It also checks that no shared version is unparseable in either repository.
// Byte-identity alone is not safety: two identically broken copies compare equal,
// so a version could be recorded as harmless while neither copy can apply. That
// is how 20260921123000 passed here on both main branches.

"use strict";

const fs = require("fs");
const path = require("path");

// Both directories hold migrations Supabase applies, and both hold files that
// collide with valoria-site. Scanning only the first one hid the collision at
// 20260921123000 and the collisions at 20260921131500 / 20260921133500.
const PLATFORM_DIRS = [
  path.join(__dirname, "..", "..", "supabase", "migrations"),
  path.join(__dirname, "..", "..", "..", "supabase", "migrations"),
].filter((d) => fs.existsSync(d));

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

function versionsIn(dir) {
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const m = file.match(/^(\d+)_/);
    if (!m) continue;
    if (!out.has(m[1])) out.set(m[1], []);
    out.get(m[1]).push({ dir, file });
  }
  return out;
}

function versionsOf(dirs) {
  const out = new Map();
  for (const dir of dirs) {
    for (const [v, files] of versionsIn(dir)) {
      if (!out.has(v)) out.set(v, []);
      out.get(v).push(...files);
    }
  }
  return out;
}

function readAt(entry) {
  return fs.readFileSync(path.join(entry.dir, entry.file), "utf8");
}

// A dollar-quote delimiter is `$$` or `$tag$`; a bare `$` is never one. A file
// carrying `do $` … `$;` is rejected by PostgreSQL with
// `syntax error at or near "$"`, so it can never apply to any database and the
// objects it defines silently never exist. Suite 28 checks this for this
// repository's own directories, but it cannot see the sibling checkout — and
// byte-identity does not catch it, because two *identically broken* copies
// compare equal. That is precisely how 20260921123000 stayed invisible: both
// main branches carried the same unparseable file, so this guard recorded the
// version as harmless and passed.
function stripSql(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:[^']|'')*'/g, "''");
}

function hasTruncatedDelimiter(sql) {
  return stripSql(sql)
    .split("\n")
    .some((line) => /(?:^|\s)\$[^$\w]?\s*$/.test(line) || /^\s*\$;\s*$/.test(line));
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
const KNOWN_HARMLESS_CROSS_REPO = [
  "20260921123000",
  "20260921124500",
  "20260921130000",
  "20260921131500",
  "20260921133500",
];

describe("within-repository migration versions", () => {
  const platform = versionsOf(PLATFORM_DIRS);

  test("the migrations directories are present", () => {
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
  const platform = versionsOf(PLATFORM_DIRS);
  const site = versionsOf([SITE_DIR]);

  function classify() {
    const shared = [...platform.keys()].filter((v) => site.has(v));
    const harmful = [];
    const harmless = [];
    for (const v of shared) {
      const sb = readAt(site.get(v)[0]);
      // Any platform copy identical to the site copy makes the version harmless.
      const anyIdentical = platform.get(v).some((entry) => readAt(entry) === sb);
      (anyIdentical ? harmless : harmful).push(v);
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

  test("no shared version is unparseable in either repository", () => {
    // Byte-identity is not safety: two identically broken copies compare equal.
    // A shared version whose platform or site copy cannot parse is a version
    // whose objects do not exist, whichever copy the database ran.
    const offenders = [];
    for (const v of [...platform.keys()].filter((v) => site.has(v))) {
      for (const [repo, entries] of [["platform", platform.get(v)], ["site", site.get(v)]]) {
        for (const entry of entries) {
          if (hasTruncatedDelimiter(readAt(entry))) {
            offenders.push(`${v}: ${repo}/${entry.file}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the known-harmful list is exactly the harmful set", () => {
    expect(classify().harmful).toEqual(Object.keys(KNOWN_HARMFUL_CROSS_REPO).sort());
  });

  test("the known-harmless list is exactly the identical-content set", () => {
    expect(classify().harmless).toEqual([...KNOWN_HARMLESS_CROSS_REPO].sort());
  });
});
