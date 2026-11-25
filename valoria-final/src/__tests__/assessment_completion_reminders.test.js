const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "../../../");
const source = fs.readFileSync(
  path.join(REPO_ROOT, "supabase/functions/send-assessment-completion-reminders/index.ts"),
  "utf8"
);

describe("Assessment completion reminder delivery failure contract", () => {
  test("provider response bodies are not persisted in reminder error records", () => {
    expect(source).toContain('throw new Error("BREVO_EMAIL_"+response.status)');
    expect(source).not.toContain('text.slice(0,300)');
    expect(source).toContain("last_error:errorCode");
  });

  test("Brevo authentication and authorization failures are parked instead of retried", () => {
    expect(source).toContain("const permanentAuthFailure=/^BREVO_EMAIL_(401|403)$/.test(errorCode)");
    expect(source).toContain('"9999-12-31T00:00:00.000Z"');
    expect(source).toContain("next_send_at:nextSendAt");
  });

  test("transient delivery failures retain bounded exponential backoff", () => {
    expect(source).toContain("Math.min(1440,Math.max(30,2**Math.min(attemptCount,8)*5))");
    expect(source).toContain("new Date(Date.now()+retryMinutes*60000).toISOString()");
  });

  test("partial delivery failures return a non-success HTTP response with aggregate counts", () => {
    expect(source).toContain("if(failed>0) return Response.json({ok:false,...summary},{status:502})");
    expect(source).toContain("const summary={candidates:candidates.filter(c=>!c.done).length,due:dueRes.data?.length??0,sent,failed,skipped}");
  });
});
