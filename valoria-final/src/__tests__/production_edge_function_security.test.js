const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "../../../");
const readFunction = (slug) =>
  fs.readFileSync(path.join(REPO_ROOT, "supabase", "functions", slug, "index.ts"), "utf8");

describe("Production Edge Function authorization contract", () => {
  test("reconciliation health accepts only cron secret or the private Vault-backed invocation key", () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, "valoria-final", "api", "reconciliation-health.js"), "utf8");
    const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "valoria-final", "vercel.json"), "utf8"));
    expect(source).toContain("is_valid_valoria_function_invoke_key");
    expect(source).toContain("privateAuthorized");
    expect(config.crons.some((job) => job.path === "/api/reconciliation-health")).toBe(false);
  });
  test.each([
    "process-meta-leads",
    "sync-leads-to-brevo",
    "send-lead-meeting-link",
    "send-assessment-completion-reminders",
  ])("%s requires a verified administrator or exact service-role bearer", (slug) => {
    const source = readFunction(slug);
    expect(source).toContain("async function isPrivileged(req:Request)");
    expect(source).toContain('db.from("admin_users").select("id").eq("id",user.id)');
    expect(source).toContain("await isPrivileged(req)");
    expect(source).not.toContain('startsWith("bearer ")');
  });

  test.each([
    "process-meta-leads",
    "sync-leads-to-brevo",
    "send-lead-meeting-link",
    "send-assessment-completion-reminders",
  ])("%s accepts only the private Vault-backed cron invocation credential for scheduled callers", (slug) => {
    const source = readFunction(slug);
    expect(source).toContain('req.headers.get("x-valoria-function-key")');
    expect(source).toContain('db.rpc("is_valid_valoria_function_invoke_key"');
  });

  test("scheduled jobs send the private invocation header without exposing its value in source", () => {
    const migration = fs.readFileSync(
      path.join(REPO_ROOT, "valoria-final", "supabase", "migrations", "20261020202611_update_cron_privileged_function_headers_20261020.sql"),
      "utf8"
    );
    expect(migration).toContain("x-valoria-function-key");
    expect(migration).toContain("valoria_privileged_function_invoke_key");
    expect(migration).not.toContain("Bearer eyJ");
  });
  test.each(["smart-action", "rapid-service"])(
    "%s rejects requests that do not present the exact server service-role bearer before processing input",
    (slug) => {
      const source = readFunction(slug);
      const authGuard = source.indexOf("Unauthorized");
      const bodyRead = source.indexOf("await req.json()");
      expect(source).toContain("const SERVICE_ROLE_KEY = Deno.env.get");
      expect(authGuard).toBeGreaterThan(-1);
      expect(bodyRead).toBeGreaterThan(authGuard);
    }
  );

  test("public report generation is rate-limited by IP as well as assessment reference", () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, "valoria-final", "api", "generate-and-send-report.js"),
      "utf8"
    );
    expect(source).toContain('namespace: "report-trigger-ip"');
    expect(source).toContain("p_rate_key: `report-trigger:${reportToken}`");
  });

  test("CV-assessment failure handling only updates the authenticated owner's previously verified assessment", () => {
    const source = readFunction("process-cv-assessment");
    expect(source).toContain("let ownerId:string|null=null;let ownedAssessmentId:string|null=null;");
    expect(source).toContain("ownedAssessmentId=id;");
    expect(source).toContain("if(ownedAssessmentId&&ownerId)");
    expect(source).toContain('.eq("id",ownedAssessmentId).eq("professional_id",ownerId)');
    expect(source).not.toContain('.eq("id",body.assessment_id);');
  });
});
