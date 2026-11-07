"use strict";

const fs = require("node:fs");
const path = require("node:path");

const read = relative => fs.readFileSync(path.join(__dirname, "../..", relative), "utf8");
const readRepo = relative => fs.readFileSync(path.join(__dirname, "../../..", relative), "utf8");

describe("staging formal assessment uses the isolated API", () => {
  test("the staging build does not compile the full assessment into local-only preview mode", () => {
    const workflow = readRepo(".github/workflows/cloudflare-assessment-staging-deploy.yml");
    expect(workflow).toContain('VITE_VALU_PREVIEW: "0"');
    expect(workflow).toContain('VITE_VALU_API_ORIGIN: "https://valoria-staging-assessment.riverwayse.workers.dev"');
    expect(workflow).toContain('VITE_VALU_SITE_ORIGIN: "https://valoria-staging-site.riverwayse.workers.dev"');
    expect(workflow).not.toContain('VITE_VALU_PREVIEW: "1"');
    const wrangler = read("wrangler.jsonc");
    expect(wrangler).toContain('"VALU_STAGING_API_ENABLED": "1"');
    expect(wrangler).toContain('"SUPABASE_URL": "https://yccxgjdqworgcbircnvn.supabase.co"');
  });

  test("staging deployment is opt-in for same-repository deploy branches", () => {
    const deployWorkflow = readRepo(".github/workflows/cloudflare-assessment-staging-deploy.yml");
    expect(deployWorkflow).toContain("pull_request:");
    expect(deployWorkflow).toContain("startsWith(github.event.pull_request.head.ref, 'deploy/staging-')");
    expect(deployWorkflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(deployWorkflow).toContain("environment: staging");
    expect(deployWorkflow).toContain("npx --yes wrangler@4.156.0 deploy");
  });

  test("the taster and formal assessment remain separate instruments", () => {
    const taster = read("src/valuTaster.js");
    const tasterIdsMatch = taster.match(/const TASTER_IDS = \[([\s\S]*?)\]/);
    expect(tasterIdsMatch).not.toBeNull();
    const tasterIds = [...tasterIdsMatch[1].matchAll(/["']([^"']+)["']/g)].map(match => match[1]);
    const questionBank = read("src/questions.js");
    const formalIds = [...questionBank.matchAll(/\{\s*id:\s*["']([^"']+)["']/g)].map(match => match[1]);
    expect(tasterIds).toHaveLength(9);
    expect(formalIds).toHaveLength(58);
    expect(formalIds.filter(id => /^VA\d+$/.test(id))).toHaveLength(4);
  });

  test("the formal assessment persists, restores and submits through the assessment API", () => {
    const assessment = read("src/FullVALUAssessment.jsx");
    expect(assessment).toContain("fetch(API_BASE + '/api/assessment-progress'");
    expect(assessment).toContain("fetch(API_BASE + '/api/submit-assessment'");
    expect(assessment).toContain("fetch(API_BASE + '/api/link-assessment-to-taster'");
    expect(assessment).toContain("const IS_PREVIEW = import.meta.env.VITE_VALU_PREVIEW === '1';");
  });
});
