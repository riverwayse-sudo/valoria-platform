// valoria-final/src/__tests__/28_dollar_quote_integrity.test.js
//
// Three tracked migrations on `main` carried truncated dollar-quote delimiters:
// `as $` where `as $$` was meant, closed by `$;` instead of `$$;`. The file is
// still valid-looking text, and every static check in this repository passed,
// because the defect is only visible to a SQL parser.
//
// PostgreSQL reports it as `syntax error at or near "$"`. That means the
// migration can never apply to any database, clean or otherwise, so any object
// it defines silently never exists. Two of the three files are the signup →
// marketplace eligibility contract, so the drift they were written to close
// stayed open wherever they had not been applied by hand.
//
// A dollar-quote delimiter is `$$` or `$tag$`. A bare `$` is never one. This
// checks the token shape directly rather than waiting for a replay, because the
// replay currently stops early for an unrelated reason (the missing baseline)
// and would not reach these files anyway.

"use strict";

const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "supabase", "migrations");

// Comments and string literals can contain a lone `$` legitimately, so remove
// them before looking for delimiters.
function strip(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:[^']|'')*'/g, "''");
}

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

describe("dollar-quote integrity", () => {
  const files = migrationFiles();

  test("the migrations directory is non-empty", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test("no migration contains a truncated dollar-quote delimiter", () => {
    const offenders = [];
    for (const file of files) {
      const sql = strip(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      const lines = sql.split("\n");
      lines.forEach((line, i) => {
        // `$` that opens or closes a quoted body must be `$$` or `$tag$`.
        if (/(?:^|\s)\$[^$\w]?\s*$/.test(line) || /^\s*\$;\s*$/.test(line)) {
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test("every dollar-quote opener has a matching closer", () => {
    // `$tag$ ... $tag$` must balance. An unmatched opener is the same defect in
    // the other direction and produces the same parse failure.
    const unbalanced = [];
    for (const file of files) {
      const sql = strip(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      const counts = new Map();
      for (const m of sql.matchAll(/\$([A-Za-z_]*)\$/g)) {
        const tag = m[1];
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
      for (const [tag, n] of counts) {
        if (n % 2 !== 0) unbalanced.push(`${file}: $${tag}$ appears ${n} time(s)`);
      }
    }
    expect(unbalanced).toEqual([]);
  });
});
