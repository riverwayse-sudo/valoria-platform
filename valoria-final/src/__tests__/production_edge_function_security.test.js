const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "../../../");
const readFunction = (slug) =>
  fs.readFileSync(path.join(REPO_ROOT, "supabase", "functions", slug, "index.ts"), "utf8");

describe("Production Edge Function authorization contract", () => {
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

  test.each(["smart-action", "rapid-service"])(
    "%s rejects requests that do not present the exact server service-role bearer before processing input",
    (slug) => {
      const source = readFunction(slug);
      const authGuard = source.indexOf("authorization !== `Bearer ${SERVICE_ROLE_KEY}`");
      const bodyRead = source.indexOf("await req.json()");
      expect(source).toContain("const SERVICE_ROLE_KEY = Deno.env.get");
      expect(authGuard).toBeGreaterThan(-1);
      expect(bodyRead).toBeGreaterThan(authGuard);
    }
  );

  test("CV-assessment failure handling only updates the authenticated owner's previously verified assessment", () => {
    const source = readFunction("process-cv-assessment");
    expect(source).toContain("let ownerId:string|null=null;let ownedAssessmentId:string|null=null;");
    expect(source).toContain("ownedAssessmentId=id;");
    expect(source).toContain("if(ownedAssessmentId&&ownerId)");
    expect(source).toContain('.eq("id",ownedAssessmentId).eq("professional_id",ownerId)');
    expect(source).not.toContain('.eq("id",body.assessment_id);');
  });
});
