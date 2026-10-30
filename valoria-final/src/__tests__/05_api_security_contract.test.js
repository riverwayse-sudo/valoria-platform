"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const API_ROOT = path.join(__dirname, "../../api");

function readApi(name) {
  return fs.readFileSync(path.join(API_ROOT, name), "utf8");
}

describe("Privileged API security contracts", () => {
  const internalApis = [
    "get-assessment-data.js",
    "report.js",
    "save-report.js",
    "finalize-report.js",
    "send-email.js",
    "sweep-unsent-reports.js",
    "system-status.js",
  ];

  test.each(internalApis)("%s requires CRON_SECRET", (file) => {
    const source = readApi(file);
    expect(source).toContain("CRON_SECRET");
    expect(source).toMatch(/!CRON_SECRET|CRON_SECRET.*missing|CRON_SECRET.*required/);
  });

  test("reconciliation health alerts on completed assessments whose reports are still pending", () => {
    const source = readApi("reconciliation-health.js");
    const migration = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261021124217_track_pending_assessment_reports_in_health.sql"), "utf8");
    expect(source).toContain('["pending_assessment_reports", "completed assessments awaiting report generation"]');
    expect(source).toContain('["failed_assessment_reports", "completed assessments whose report generation failed"]');
    expect(migration).toContain("'pending_assessment_reports'");
    expect(migration).toContain("a.report_status = 'PENDING'");
  });
  test("full VALU assessment restores saved answers by verified account-owned taster after login", () => {
    const progressApi = readApi("assessment-progress.js");
    const component = fs.readFileSync(path.join(__dirname, "../FullVALUAssessment.jsx"), "utf8");
    expect(progressApi).toContain('if (action === "restore")');
    expect(progressApi).toContain("await verifyValuHandoffTokenEdge(handoffToken, tasterId, reason =>");
    expect(progressApi).toContain("getProgressByTasterId(tasterId)");
    expect(progressApi).toContain("progress.user_id !== resolvedIdentity.user_id");
    expect(progressApi).toContain('status: "in.(in_progress,abandoned)"');
    expect(component).toContain("action:'restore'");
    expect(component).toContain("setAnswers(saved.answers");
    expect(component).toContain("setCurrent(Math.min(Math.max(Number(saved.current_question)");
    expect(component).toContain("remoteRestoreComplete");
    expect(component).toContain("Your saved VALU progress could not be restored");
  });
  test("all serverless API modules parse as valid Node.js source", () => {
    const apiFiles = fs.readdirSync(API_ROOT).filter((file) => file.endsWith(".js"));
    expect(apiFiles.length).toBeGreaterThan(0);
    for (const file of apiFiles) {
      execFileSync(process.execPath, ["--check", path.join(API_ROOT, file)]);
    }
  });
  test("reconciliation health requires CRON_SECRET or the private Vault-backed invocation key", () => {
    const source = readApi("reconciliation-health.js");
    expect(source).toContain("CRON_SECRET");
    expect(source).toContain("is_valid_valoria_function_invoke_key");
    expect(source).toContain("privateAuthorized");
  });
  test("report generation records machine-readable failures and allows bounded AI response time", () => {
    const source = readApi("generate-and-send-report.js");
    const sweep = readApi("sweep-unsent-reports.js");
    expect(source).toContain("}, 35000);");
    expect(source).toContain("report_failure_code: failureCode");
    expect(source).toContain("REQUEST_TIMEOUT");
    expect(source).toContain("AI_PROVIDER_REJECTED");
    expect(source).toContain("REPORT_VALIDATION_FAILED");
    expect(sweep).toContain('report_attempts: "lt.5"');
    expect(sweep).toContain('select: "identity_hash,report_token,report_attempts"');
  });
  test("public report generation requires the opaque report token instead of the short identity fingerprint", () => {
    const source = readApi("generate-and-send-report.js");
    const submit = readApi("submit-assessment.js");
    const sweep = readApi("sweep-unsent-reports.js");
    const fullAssessment = fs.readFileSync(path.join(__dirname, "../FullVALUAssessment.jsx"), "utf8");
    expect(source).toContain("isValidReportToken");
    expect(source).toContain("report_token: `eq.${reportToken}`");
    expect(source).toContain("Valid report token is required");
    expect(source).not.toContain("const { identity_hash } = req.body || {}");
    expect(submit).toContain("report_token: inserted.report_token");
    expect(submit).toContain("report_token: existing.report_token");
    expect(sweep).toContain('select: "identity_hash,report_token,report_attempts"');
    expect(fullAssessment).toContain("report_token:scoreData.report_token");
  });
  test("generate-and-send-report rate-limits public triggers and authenticates cron workers", () => {
    const source = readApi("generate-and-send-report.js");
    expect(source).toContain("CRON_SECRET");
    expect(source).toContain("consumePublicTriggerRateLimit");
    expect(source).toContain("isValidReportToken");
    expect(source).toContain("report_token: `eq.${reportToken}`");
    expect(source).toContain("CRON_SECRET && req.headers.authorization");
    expect(source).toContain("Report service temporarily unavailable");
  });

  test("reconciliation health is cron-authenticated, records aggregate snapshots, and alerts on missing taster links", () => {
    const source = readApi("reconciliation-health.js");
    expect(source).toContain("CRON_SECRET");
    expect(source).toContain("run_valu_reconciliation_health");
    expect(source).toContain("record_valu_reconciliation_health_snapshot");
    expect(source).toContain("completed_assessments_missing_taster_id");
    expect(source).toContain("missing_taster_link_assessments_without_review");
    expect(source).toContain("platform_notifications");
    expect(source).toContain("no-store");
  });

  test.each(internalApis)("%s does not expose raw provider/database errors", (file) => {
    const source = readApi(file);
    expect(source).not.toMatch(/return\s+json\(\{\s*error:\s*[^}]*\.message/);
    expect(source).not.toMatch(/error:\s*[^,}]*\.body/);
  });

  test("privileged endpoints disable caching where sensitive data is returned", () => {
    const sensitive = [
      "get-assessment-data.js",
      "report.js",
      "save-report.js",
      "finalize-report.js",
      "system-status.js",
      "reconciliation-health.js",
    ];
    sensitive.forEach((file) => {
      const source = readApi(file);
      expect(source).toContain("no-store");
    });
  });
});

describe("Identity ownership contracts", () => {
  test("claim-listing derives ownership from the verified auth user", () => {
    const source = readApi("claim-listing.js");
    expect(source).toContain("/auth/v1/user");
    // Ownership must be derived from the verified Supabase identity, never from client payload.

    expect(source).toContain("authUser.id");
    expect(source).toContain("authUser.email");
    expect(source).toContain("userId");
    expect(source).toContain("assessment.user_id");
    expect(source).not.toMatch(/user_id\s*=\s*fields\.user_id/);
  });

  test("update-assessment verifies the authenticated user", () => {
    const source = readApi("update-assessment.js");
    expect(source).toContain("/auth/v1/user");
    expect(source).toContain("verifiedUser");
    expect(source).toContain("user_id");
  });

  test("account creation verifies assessment/email matching before linking", () => {
    const source = readApi("create-account.js");
    expect(source).toContain("assessment.email");
    expect(source).toContain("assessment.user_id");
    expect(source).toContain("identity_hash");
    expect(source).toContain("assessment.report_token");
  });

  test("confirmation resend preserves the report token through the verified email redirect", () => {
    const source = readApi("resend-confirmation.js");
    expect(source).toContain("confirmation_email_sent_at");
    expect(source).toContain("report_token");
    expect(source).toContain("redirect_to: redirectUrl");
  });
  test("full VALU handoff preserves ownership and rejects conflicting taster links", () => {
    const source = readApi("link-assessment-to-taster.js");
    expect(source).toContain("assessment.taster_id && assessment.taster_id !== tasterId");
    expect(source).toContain("user_id.is.null,user_id.eq.");
    expect(source).toContain("assessment_identity_links");
    expect(source).toContain("refresh_professional_journey");
    expect(source).toContain("return=representation");
    expect(source).toContain("assessment ownership changed during linking");
    expect(source).toContain("assessment.identity_hash !== identityHash");
    expect(source).not.toContain("fallbackParams");
  });
});

describe("Assessment integrity contracts", () => {
  test("taster submission records server-stamped version provenance", () => {
    const source = readApi("submit-taster.js");
    expect(source).toContain("VALU_VERSION");
    expect(source).toContain("p_taster_version: String(VALU_VERSION)");
    expect(source).toContain("submit_taster_with_identity_candidate");
  });

  test("full assessment submission requires a completed, account-owned, email-confirmed snapshot", () => {
    const source = readApi("submit-assessment.js");
    expect(source).toContain("valid snapshot reference is required");
    expect(source).toContain("select: 'id,user_id,name,role,completed_at'");
    expect(source).toContain("if (!taster.completed_at)");
    expect(source).toContain("if (!taster.user_id)");
    expect(source).toContain("if (!user.email_confirmed_at)");
    expect(source).toContain("taster_id: tasterId, user_id: resolvedUserId");
    expect(source).not.toContain("taster_id: tasterId || null");
  });

  test("full assessment submission and attachment require a signed account-bound handoff", () => {
    const source = readApi("submit-assessment.js");
    const link = readApi("link-assessment-to-taster.js");
    const verifier = fs.readFileSync(path.join(__dirname, "../../lib/valu-handoff-token.js"), "utf8");
    expect(source).toContain("await verifyValuHandoffTokenEdge(body?.handoff_token, tasterId, reason =>");
    expect(source).toContain("await verifyValuHandoffTokenEdge(handoffToken, tasterId, reason =>");
    expect(source).toContain("../lib/valu-handoff-token-edge.js");
    expect(source).not.toContain("verifyValuHandoffToken(handoffToken, tasterId)");
    expect(source).toContain("taster.user_id !== handoff.sub");
    expect(source).toContain("handoff_token: handoffToken");
    expect(link).toContain("await verifyValuHandoffTokenEdge(handoffToken, tasterId, reason =>");
    expect(link).toContain("../lib/valu-handoff-token-edge.js");
    expect(link).toContain("taster.user_id !== handoff.sub");
    expect(link).toContain("!user.email_confirmed_at");
    expect(verifier).toContain("timingSafeEqual");
    expect(verifier).toContain("valu-full-assessment");
    expect(source).toContain("action === 'verify-handoff'");
    expect(source).toContain("Confirm your Valoria account email before continuing.");
  });

  test("completed full assessment submission is idempotent for the same verified owner and snapshot", () => {
    const source = readApi("submit-assessment.js");
    expect(source).toContain("findExistingAssessment(tasterId, fingerprint)");
    expect(source).toContain("alreadyCompleted: true");
    expect(source).toContain("report_token: existing.report_token");
    expect(source).toContain("report_token: inserted.report_token");
    expect(source).toContain("existing.user_id !== resolvedUserId");
  });

  test("full assessment UI verifies the signed handoff before showing questions or submitting", () => {
    const component = fs.readFileSync(path.join(__dirname, "../FullVALUAssessment.jsx"), "utf8");
    expect(component).toContain("readHandoffToken");
    expect(component).toContain("action:'verify-handoff'");
    expect(component).toContain("handoffStatus !== 'ready'");
    expect(component).toContain("handoff_token:handoffToken");
    expect(component).toContain("professional-signup");
    expect(component).toContain("sessionStorage.removeItem");
    expect(component).toContain("fragment.get('resume_token')");
    expect(component).toContain("Strip legacy identity/resume query parameters from the visible URL");
    expect(component).toContain("cleanParams.set('full', '1')");
    expect(component).toContain("resume:fragmentResume || queryIdentity.resume");
    expect(component).toContain("loadRemoteProgress(identity.resume)");
    expect(component).toContain("if (identity.resume || handoffStatus !== 'ready'");
    expect(component).toContain("resume: identity.resume");
    expect(component).toContain("handoffStatus === 'ready' && !identity.resume && !remoteRestoreComplete");
  });

  test("full assessment progress writes and reminders require verified account-owned snapshots", () => {
    const source = readApi("assessment-progress.js");
    expect(source).toContain("await verifyValuHandoffTokenEdge(handoffToken, tasterId, reason =>");
    expect(source).toContain("resolvedIdentity.user_id !== handoff.sub");
    expect(source).toContain("verified account-owned snapshot required");
    expect(source).toContain("snapshot/account identity did not verify");
    expect(source).toContain("Could not verify the saved progress session");
    expect(source).not.toContain("getProgressBySession(sessionId).catch(() => null)");
    expect(source).not.toContain("const resolvedUserId = userId ||");
    expect(source).toContain('runtime: "edge"');
    expect(source).toContain('../lib/valu-handoff-token-edge.js');
  });

  test("progress resume links return through the signed assessment continuation", () => {
    const source = readApi("assessment-progress.js");
    expect(source).toContain("https://valoriainstitute.com/journey/continue?stage=assess");
    expect(source).not.toContain("https://valoriainstitute.com/valu/assessment/?full=1");
    expect(source).toContain("handoff_token: handoffToken");
  });

  test("submission cannot overwrite an existing identity assessment", () => {
    const source = readApi("submit-assessment.js");
    expect(source).toContain("computeFingerprint");
    expect(source).not.toContain("resolution=merge-duplicates");
    expect(source).toContain("status === 409");
  });

  test("submission bounds attacker-controlled collections", () => {
    const source = readApi("submit-assessment.js");
    expect(source).toContain("MAX_NAME_LENGTH");
    expect(source).toContain("MAX_ROLE_LENGTH");
    expect(source).toContain("MAX_TIMINGS_LENGTH");
    expect(source).toContain("MAX_SHUFFLE_KEYS");
    expect(source).toContain("Number.isFinite");
  });

  test("reconciliation health closes only persisted verified links and separately flags unreviewed taster links", () => {
    const migration = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261017184500_reconciliation_health_applied_review_state.sql"), "utf8");
    expect(migration).toContain("identity_review_queue_applied");
    expect(migration).toContain("missing_taster_link_assessments_without_verified_taster_review");
    expect(migration).toContain("candidate_record_type = 'taster'");
    expect(migration).toContain("a.taster_id = t.id");
    expect(migration).toContain("a.user_id = t.user_id");
    expect(migration).toContain("decision = 'resolved_no_link'");
  });

});
