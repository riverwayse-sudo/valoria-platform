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
// The workflow is parsed with js-yaml, a declared devDependency, rather than
// matched as text — reformatting cannot defeat the assertions. An earlier version
// of this suite used a hand-written parser to avoid the dependency; a differential
// test against PyYAML showed it silently dropped comments inside `run:` blocks and
// mishandled `uses:` steps. A security guard must not depend on a parser that
// quietly disagrees with the real one, so the dependency is declared instead.
//
// The shape test below is the important one: it asserts that the parse produced
// the structure the rest of the suite assumes, so a workflow restructure fails
// loudly rather than letting the remaining assertions pass vacuously.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "vercel-production.yml");

const raw = fs.readFileSync(WORKFLOW, "utf8");
const workflow = yaml.load(raw);
const job = workflow.jobs.deploy;
const steps = job.steps;
const runs = steps.filter((s) => typeof s.run === "string");
const vercelSteps = runs.filter((s) => /vercel\s+(pull|build|deploy)/.test(s.run));
const preflight = runs.find((s) => /VERCEL_TOKEN/.test(s.run) && /-z/.test(s.run));

describe("vercel-production workflow deploy preflight", () => {
  test("the parse produced the structure the suite assumes", () => {
    // Without this, a restructure could leave `vercelSteps` empty and every
    // assertion below would pass without checking anything.
    expect(workflow.jobs).toBeDefined();
    expect(Array.isArray(steps)).toBe(true);
    expect(vercelSteps).toHaveLength(3); // pull, build, deploy
    expect(preflight).toBeDefined();
  });

  test("the deploy job uses the production token secret", () => {
    expect(job.env.VERCEL_TOKEN).toBe("${{ secrets.VERCEL_TOKEN }}");
  });

  test("a preflight step checks the token BEFORE any vercel command consumes it", () => {
    const preflightIndex = runs.indexOf(preflight);
    const firstVercelIndex = runs.indexOf(vercelSteps[0]);
    expect(preflightIndex).toBeGreaterThanOrEqual(0);
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
    // A real Vercel token is a long opaque string; only the secret context may
    // appear. This catches an accidental paste into the file.
    expect(raw).not.toMatch(/--token=["']?(?!\$)[A-Za-z0-9]{20,}/);
    expect(raw).not.toMatch(/vercel_[A-Za-z0-9]{20,}/);
  });

  test("the job requests read-only repository permissions", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
  });
});
