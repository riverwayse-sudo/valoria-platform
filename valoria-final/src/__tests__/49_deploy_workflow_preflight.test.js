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
// used, and the failure names the missing secret. They parse the workflow with
// js-yaml rather than grepping it, so reformatting cannot defeat them.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "vercel-production.yml");

function loadWorkflow() {
  return yaml.load(fs.readFileSync(WORKFLOW, "utf8"));
}

/** Every `run:` script in a job, in order, as {name, script} pairs. */
function runSteps(job) {
  return (job.steps || [])
    .filter((s) => typeof s.run === "string")
    .map((s) => ({ name: s.name || "", script: s.run }));
}

describe("vercel-production workflow deploy preflight", () => {
  let workflow;
  let job;

  beforeAll(() => {
    workflow = loadWorkflow();
    job = workflow.jobs.deploy;
  });

  test("the deploy job exists and uses the production token", () => {
    expect(job).toBeDefined();
    expect(job.env.VERCEL_TOKEN).toContain("secrets.VERCEL_TOKEN");
  });

  test("a preflight step checks the token BEFORE any vercel command consumes it", () => {
    const steps = runSteps(job);
    const firstVercelStep = steps.findIndex((s) => /vercel\s+(pull|build|deploy)/.test(s.script));
    const preflightStep = steps.findIndex((s) => /VERCEL_TOKEN/.test(s.script) && /-z|:-/.test(s.script));

    expect(firstVercelStep).toBeGreaterThanOrEqual(0);
    expect(preflightStep).toBeGreaterThanOrEqual(0);
    // The check must come first, otherwise the opaque CLI error returns.
    expect(preflightStep).toBeLessThan(firstVercelStep);
  });

  test("the preflight fails the job and names the missing secret", () => {
    const preflight = runSteps(job).find((s) => /VERCEL_TOKEN/.test(s.script) && /-z|:-/.test(s.script));
    expect(preflight).toBeDefined();
    expect(preflight.script).toMatch(/exit\s+1/);
    expect(preflight.script).toMatch(/VERCEL_TOKEN is not configured/);
  });

  test("no step uses the token with the bare --token=$VAR form that hides emptiness", () => {
    // Every vercel invocation must either be guarded by the preflight above or
    // use a form that cannot silently expand to an empty value.
    const steps = runSteps(job);
    const vercelSteps = steps.filter((s) => /vercel\s+(pull|build|deploy)/.test(s.script));
    expect(vercelSteps.length).toBeGreaterThan(0);
    for (const s of vercelSteps) {
      expect(s.script).toMatch(/--token="\$VERCEL_TOKEN"/);
    }
  });

  test("the workflow does not embed a token literal", () => {
    const raw = fs.readFileSync(WORKFLOW, "utf8");
    // A real Vercel token is a long opaque string; the only permitted reference is
    // the secrets context. This catches an accidental paste into the file.
    expect(raw).not.toMatch(/--token=["']?(?!\$)[A-Za-z0-9]{20,}/);
    expect(raw).not.toMatch(/vercel_[A-Za-z0-9]{20,}/);
  });

  test("the job requests read-only repository permissions", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
  });
});
