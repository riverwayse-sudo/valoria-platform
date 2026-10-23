// valoria-final/src/__tests__/10_block_scope_static_check.test.js
//
// Guards against the defect class that broke every first-time assessment
// submission: a const/let declared inside a block (try, if, for) and read
// outside it. That is a ReferenceError at runtime, but only on the path that
// reaches it — a green build and text-assertion tests both miss it, which is
// exactly what happened to api/submit-assessment.js.
//
// scripts/find-block-scope-bugs.mjs does a real lexical-scope analysis with
// @babel/parser. This suite checks it catches the bug, does not fire on safe
// code, and reports nothing on the current codebase — so a reintroduction fails
// CI instead of production.

"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "../..");
const SCRIPT = path.join(ROOT, "scripts/find-block-scope-bugs.mjs");
const FIXTURES = path.join(ROOT, "test-fixtures/block-scope");

function run(...dirs) {
  const result = spawnSync("node", [SCRIPT, ...dirs], { cwd: ROOT, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

describe("block-scope static check", () => {
  test("the detector script exists and runs", () => {
    expect(fs.existsSync(SCRIPT)).toBe(true);
    const { status, stdout } = run(path.join(FIXTURES, "safe.js"));
    expect(status).toBe(0);
    expect(stdout).toMatch(/0 finding/);
  });

  test("it flags a const declared in a try and used after the block", () => {
    const { status, stdout } = run(path.join(FIXTURES, "buggy.js"));
    expect(status).toBe(1);
    expect(stdout).toContain("insertRes");
    expect(stdout).toMatch(/declared with const\/let at line 8/);
  });

  test("it does not fire on safe constructs (no false positives)", () => {
    const { status, stdout } = run(path.join(FIXTURES, "safe.js"));
    expect(status).toBe(0);
    expect(stdout).toMatch(/0 finding/);
  });

  test("the current codebase is clean", () => {
    const { status, stdout } = run("api", "src", "lib");
    expect(stdout).toMatch(/0 finding/);
    expect(status).toBe(0);
  });

  test("api/submit-assessment.js specifically is clean", () => {
    const { status, stdout } = run(path.join(ROOT, "api/submit-assessment.js"));
    expect(status).toBe(0);
    expect(stdout).toMatch(/0 finding/);
  });
});
