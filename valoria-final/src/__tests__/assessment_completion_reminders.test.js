const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "../../../");
const source = fs.readFileSync(
  path.join(REPO_ROOT, "supabase/functions/send-assessment-completion-reminders/index.ts"),
  "utf8"
);

describe("Assessment completion reminder delivery contract", () => {
  test("reminders use the verified Resend sender rather than Brevo", () => {
    expect(source).toContain('Deno.env.get("RESEND_API_KEY")');
    expect(source).toContain('fetch("https://api.resend.com/emails"');
    expect(source).toContain("from: FROM_EMAIL");
    expect(source).toContain("reply_to: REPLY_TO_EMAIL");
    expect(source).not.toContain("api.brevo.com");
    expect(source).not.toContain("BREVO_API_KEY");
  });

  test("each reminder stage has a deterministic idempotency key", () => {
    expect(source).toContain('"Idempotency-Key"');
    expect(source).toContain('`valoria-assessment-completion-${candidate.id}-${stage}`');
  });

  test("dry run reports provider configuration and due counts before any writes", () => {
    expect(source).toContain("const dryRun = payload?.dry_run === true");
    expect(source).toContain("dry_run: true");
    expect(source).toContain("provider_configured: Boolean(RESEND_API_KEY)");
    const dryRunIndex = source.indexOf("if (dryRun) {");
    const upsertIndex = source.indexOf('db.from("assessment_completion_reminders").upsert');
    expect(dryRunIndex).toBeGreaterThan(-1);
    expect(upsertIndex).toBeGreaterThan(dryRunIndex);
  });

  test("permanent provider failures are parked and transient failures use bounded backoff", () => {
    expect(source).toContain("/^RESEND_EMAIL_(401|403)$/");
    expect(source).toContain("/^RESEND_EMAIL_(400|422)$/");
    expect(source).toContain('"9999-12-31T00:00:00.000Z"');
    expect(source).toContain("Math.min(1440,Math.max(30,2**Math.min(attemptCount,8)*5))");
  });

  test("partial delivery failures return a non-success response with aggregate counts", () => {
    expect(source).toContain('console.error("assessment-completion-reminders-delivery-failed",summary)');
    expect(source).toContain("return Response.json({ok:false,...summary},{status:502})");
  });
});
