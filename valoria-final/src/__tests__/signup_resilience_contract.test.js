const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "../../api/create-account.js"),
  "utf8"
);

describe("signup resilience contract", () => {
  test("retains the existing branded confirmation flow as primary", () => {
    expect(source).toContain("/auth/v1/admin/generate_link");
    expect(source).toContain("confirmationMode = \"resend\"");
    expect(source).toContain("CONFIRMATION_EMAIL_SEND_FAILED");
  });

  test("falls back to the supported public signup endpoint on an Auth link failure", () => {
    expect(source).toContain("/auth/v1/signup?redirect_to=");
    expect(source).toContain("SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY");
    expect(source).toContain("auth_signup_fallback_succeeded");
    expect(source).toContain('confirmationMode = "supabase"');
  });

  test("does not bypass email confirmation or expose a privileged key to the fallback", () => {
    expect(source).toContain("apikey: SUPABASE_ANON_KEY");
    expect(source).toContain("Authorization: `Bearer ${SUPABASE_ANON_KEY}`");
    expect(source).toContain("confirmation_required: !signupData?.session");
    expect(source).not.toContain("email_confirm: true");
  });

  test("preserves assessment ownership validation and post-signup handoff", () => {
    expect(source).toContain("assessment.email");
    expect(source).toContain("assessment.user_id");
    expect(source).toContain("assessment ownership stitch failed");
    expect(source).toContain("professional_capabilities");
  });

  test("does not retry signup when the admin call may already have created an account", () => {
    expect(source).toContain('generateLinkFailure === "missing_action_link"');
    expect(source).toContain("Do not retry signup");
  });
  test("confirmation email failures do not stop the assessment/profile handoff", () => {
    const confirmationStart = source.indexOf('if (confirmationMode === "resend")');
    const handoffStart = source.indexOf("let marketplaceProfileCreated = false;");
    expect(confirmationStart).toBeGreaterThan(-1);
    expect(handoffStart).toBeGreaterThan(confirmationStart);
    const confirmationBlock = source.slice(confirmationStart, handoffStart);
    expect(confirmationBlock).toContain("confirmationWarning =");
    expect(confirmationBlock).not.toContain("return json(");
    expect(source).toContain("marketplace_profile_created: marketplaceProfileCreated");
  });

  test("bounds external dependency latency and keeps journey email best-effort", () => {
    expect(source).toContain("EXTERNAL_REQUEST_TIMEOUT_MS = 8000");
    expect(source).toContain("AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS)");
    expect(source).toContain("journey_email_network_error");
    expect(source).toContain("confirmationEmailSent ? { confirmation_email_sent_at:");
  });

});
