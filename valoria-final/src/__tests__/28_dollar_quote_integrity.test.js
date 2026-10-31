// Guards dollar-quote delimiters in both migration directories Supabase applies.
"use strict";

const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIRS = [
  path.join(__dirname, "..", "..", "supabase", "migrations"),
  path.join(__dirname, "..", "..", "..", "supabase", "migrations"),
].filter(dir => fs.existsSync(dir));

function strip(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:[^']|'')*'/g, "''");
}

describe("dollar-quote integrity across platform migration directories", () => {
  const files = MIGRATIONS_DIRS.flatMap(dir =>
    fs.readdirSync(dir).filter(file => file.endsWith(".sql")).map(file => ({ dir, file }))
  );

  test("both migration directories are present and non-empty", () => {
    expect(MIGRATIONS_DIRS).toHaveLength(2);
    expect(files.length).toBeGreaterThan(0);
  });

  test("duplicate migration versions across the two directories must be byte-identical", () => {
    const byVersion = new Map();
    const collisions = [];
    for (const { dir, file } of files) {
      const version = file.match(/^([0-9]{14})_/);
      if (!version) continue;
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      if (byVersion.has(version[1]) && byVersion.get(version[1]).content !== content) {
        collisions.push(version[1]);
      } else {
        byVersion.set(version[1], { dir, file, content });
      }
    }
    expect(collisions).toEqual([]);
  });

  test("no migration contains a truncated dollar-quote delimiter", () => {
    const offenders = [];
    for (const { dir, file } of files) {
      const sql = strip(fs.readFileSync(path.join(dir, file), "utf8"));
      sql.split("\n").forEach((line, index) => {
        if (/(?:^|\s)\$[^$\w]?\s*$/.test(line) || /^\s*\$;\s*$/.test(line)) {
          offenders.push(`${path.relative(path.join(__dirname, "..", "..", ".."), dir)}/${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test("every dollar-quote opener has a matching closer", () => {
    const unbalanced = [];
    for (const { dir, file } of files) {
      const sql = strip(fs.readFileSync(path.join(dir, file), "utf8"));
      const counts = new Map();
      for (const match of sql.matchAll(/\$([A-Za-z_]*)\$/g)) {
        counts.set(match[1], (counts.get(match[1]) || 0) + 1);
      }
      for (const [tag, count] of counts) {
        if (count % 2 !== 0) unbalanced.push(`${file}: $${tag}$ appears ${count} time(s)`);
      }
    }
    expect(unbalanced).toEqual([]);
  });
});
