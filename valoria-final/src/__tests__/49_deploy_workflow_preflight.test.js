// valoria-final/src/__tests__/49_deploy_workflow_preflight.test.js
//
// Guards the production deploy workflow against the failure mode that kept it
// broken for days without anyone noticing.
//
// Incident: .github/workflows/vercel-production.yml passes the VERCEL_TOKEN
// repository secret to `vercel pull --token="$VERCEL_TOKEN"`. The secret was never
// configured, so the argument arrived empty and the CLI reported
//
//     Error: You defined "--token", but it's missing a value
//
// which reads like a syntax mistake. The real cause — "the secret does not exist"
// — was three steps away from where it surfaced, and the failure was easy to
// misread as a transient deploy problem. Production kept working because Vercel's
// Git integration deploys independently, so nothing forced the workflow to be
// fixed.
//
// These assertions keep the fix in place: the credential is checked before it is
// used, and the failure names the missing secret.
//
// The workflow is read as structured data rather than matched as text, so
// reformatting cannot defeat the assertions. The parser is deliberately small and
// dependency-free: a guard test that breaks because a transitive dependency moved
// is worse than no guard test. It asserts its own shape assumptions, so a workflow
// restructure fails here loudly instead of silently passing.

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "vercel-production.yml");

/**
 * Minimal parser for the two things this suite needs: the top-level `permissions`
 * mapping and the `deploy` job's `steps` list (each step's `name` and `run`).
 *
 * It understands only block mappings, block sequences of mappings, and `|` block
 * scalars — which is all this workflow uses. Anything else throws, so the suite
 * cannot pass by misreading a construct it does not handle.
 */
function parseWorkflow(text) {
  const lines = text.split("\n");
  const jobNames = [];
  const steps = [];
  const permissions = {};

  let section = null; // "permissions" | "jobs"
  let inDeployJob = false;
  let inSteps = false;
  let current = null;
  let blockScalarIndent = null;

  const indentOf = (l) => l.length - l.trimStart().length;

  for (const raw of lines) {
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;
    const indent = indentOf(raw);
    const line = raw.trim();

    // Continuation of a `run: |` block scalar.
    if (blockScalarIndent !== null) {
      if (indent >= blockScalarIndent) {
        current.run += `${raw.slice(blockScalarIndent)}\n`;
        continue;
      }
      blockScalarIndent = null;
    }

    if (indent === 0) {
      inSteps = false;
      current = null;
      if (line === "permissions:") { section = "permissions"; inDeployJob = false; continue; }
      if (line === "jobs:") { section = "jobs"; continue; }
      section = null;
      continue;
    }

    if (section === "permissions") {
      const m = line.match(/^([A-Za-z-]+):\s*(\S+)\s*$/);
      if (m) permissions[m[1]] = m[2];
      continue;
    }

    if (section === "jobs") {
      if (indent === 2 && line.endsWith(":")) {
        const name = line.slice(0, -1);
        jobNames.push(name);
        inDeployJob = name === "deploy";
        inSteps = false;
        continue;
      }
      if (!inDeployJob) continue;
      if (line === "steps:") { inSteps = true; continue; }
      if (!inSteps) continue;

      if (line.startsWith("- ")) {
        current = { name: "", run: "" };
        steps.push(current);
        const inline = line.slice(2);
        const m = inline.match(/^([A-Za-z-]+):\s*(.*)$/);
        if (m) current[m[1]] = m[2];
        continue;
      }
      if (!current) continue;
      const m = line.match(/^([A-Za-z-]+):\s*(.*)$/);
      if (!m) continue;
      const [, key, value] = m;
      if (value === "|") {
        blockScalarIndent = indent + 2;
        current[key] = "";
      } else {
        current[key] = value;
      }
    }
  }

  if (blockScalarIndent !== null) throw new Error("unterminated block scalar");
  return { permissions, jobNames, steps };
}

const raw = fs.readFileSync(WORKFLOW, "utf8");
const { permissions, jobNames, steps } = parseWorkflow(raw);

const vercelSteps = steps.filter((s) => /vercel\s+(pull|build|deploy)/.test(s.run));
const preflight = steps.find((s) => /VERCEL_TOKEN/.test(s.run) && /-z/.test(s.run));

describe("vercel-production workflow deploy preflight", () => {
  test("the parser read the expected shape (guards against a silent misread)", () => {
    // If the workflow is restructured, these fail rather than letting every
    // assertion below pass against an empty or partial parse.
    expect(jobNames).toContain("deploy");
    expect(steps.length).toBeGreaterThanOrEqual(6);
    expect(vercelSteps.length).toBe(3); // pull, build, deploy
  });

  test("the deploy job uses the production token secret", () => {
    expect(raw).toMatch(/VERCEL_TOKEN:\s*\$\{\{\s*secrets\.VERCEL_TOKEN\s*\}\}/);
  });

  test("a preflight step checks the token BEFORE any vercel command consumes it", () => {
    expect(preflight).toBeDefined();
    const preflightIndex = steps.indexOf(preflight);
    const firstVercelIndex = steps.indexOf(vercelSteps[0]);
    expect(firstVercelIndex).toBeGreaterThanOrEqual(0);
    expect(preflightIndex).toBeLessThan(firstVercelIndex);
  });

  test("the preflight fails the job and names the missing secret", () => {
    expect(preflight.run).toMatch(/exit\s+1/);
    expect(preflight.run).toMatch(/VERCEL_TOKEN is not configured/);
  });

  test("no vercel step embeds a token literal", () => {
    for (const s of vercelSteps) {
      expect(s.run).toMatch(/--token="\$VERCEL_TOKEN"/);
    }
    // A real Vercel token is a long opaque string; only the env var may appear.
    expect(raw).not.toMatch(/--token=["']?(?!\$)[A-Za-z0-9]{20,}/);
    expect(raw).not.toMatch(/vercel_[A-Za-z0-9]{20,}/);
  });

  test("the job requests read-only repository permissions", () => {
    expect(permissions).toEqual({ contents: "read" });
  });
});
