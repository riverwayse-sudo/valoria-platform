// Server-side report generation + email send for the sweep workflow.
export const config = { runtime: "nodejs", maxDuration: 60 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getSiteOrigin() {
  try { return new URL(process.env.SITE_ORIGIN || "https://valoriainstitute.com").origin; }
  catch { return "https://valoriainstitute.com"; }
}

function isValidIdentityHash(value) {
  return typeof value === "string" && /^fp_[a-z0-9]{8,120}$/i.test(value);
}

async function fetchAssessment(identityHash) {
  const params = new URLSearchParams({ identity_hash: `eq.${identityHash}`, select: "name,role,email,total_score,designation,cluster_scores,skill_scores,ai_report,report_email_sent_at,report_status,report_attempts", limit: "1" });
  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }, cache: "no-store" });
  if (!res.ok) throw new Error("Assessment lookup failed");
  const rows = await res.json();
  return rows?.[0] || null;
}

async function claimReport(identityHash, idempotencyKey) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/claim_report_generation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ p_identity_hash: identityHash, p_idempotency_key: idempotencyKey })
  });
  if (!res.ok) throw new Error("Report claim failed");
  const rows = await res.json();
  return rows?.[0] || null;
}

async function patchAssessment(identityHash, body) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${encodeURIComponent(identityHash)}`, { method: "PATCH", headers: { "Content-Type": "application/json", apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: "return=minimal" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Failed to update report state");
}

async function saveAiReport(identityHash, report) { await patchAssessment(identityHash, { ai_report: report, report_status: "READY", report_locked_at: null }); }
async function markEmailPending(identityHash) { await patchAssessment(identityHash, { report_status: "EMAIL_PENDING", report_locked_at: null }); }
async function markEmailSent(identityHash) { await patchAssessment(identityHash, { report_email_sent_at: new Date().toISOString(), report_status: "SENT", report_locked_at: null }); }
async function markFailed(identityHash) {
  try { await patchAssessment(identityHash, { report_status: "FAILED", report_locked_at: null }); }
  catch { console.error("[generate-and-send-report] failed to persist failure state"); }
}

async function generateAiReport({ name, role, valuIndex, designation, clusterScores, skillScores }) {
  const sortedSkills = Object.entries(skillScores || {}).filter(([s]) => s !== "Validity").sort(([,a],[,b]) => b - a);
  const topSkills = sortedSkills.slice(0, 3), bottomSkills = sortedSkills.slice(-3).reverse();
  const prompt = `You are writing a personalised professional development report for ${name}, a ${role} who just completed the VALU Index assessment.
YOUR WRITING RULES:
1. Write like a trusted senior colleague who tells the truth.
2. Use plain, direct language.
3. NEVER use: journey, leverage (as verb), holistic, impactful, synergy, empower, transformative, game-changer, paradigm, unlock, actionable.
4. Be specific. Name the actual skill. Name the actual consequence.
5. Short sentences. Maximum 20 words per sentence for the most important points.
6. No padding. Every sentence must earn its place.
7. Do not praise them for completing the assessment.
8. Speak directly to them as "you."
THEIR SCORE DATA:
VALU Index: ${valuIndex}/100 — ${designation}
SKILL SCORES: ${Object.entries(clusterScores || {}).map(([k,v]) => `${k}: ${v}/100`).join(", ")}
TOP SKILLS: ${topSkills.map(([s,sc]) => `${s} (${sc}/100)`).join(", ")}
BOTTOM SKILLS: ${bottomSkills.map(([s,sc]) => `${s} (${sc}/100)`).join(", ")}
WRITE THE REPORT IN THESE EXACT SECTIONS:
---
## YOUR SCORE: ${valuIndex}/100 — ${designation.toUpperCase()}
## WHAT YOU ARE GOOD AT
## WHERE YOU ARE LOSING GROUND
## WHAT THIS COSTS YOU IN THE NEXT 12 MONTHS
## YOUR ONE ACTION FOR THIS WEEK
## THE PROGRAMME YOU NEED RIGHT NOW
## THE QUESTION TO SIT WITH
---
Start directly with ## YOUR SCORE. No introduction before it.`;
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2500, messages: [{ role: "user", content: prompt }] }) });
  if (!response.ok) throw new Error("AI report generation failed");
  const data = await response.json();
  return data.content?.[0]?.text || null;
}

async function sendReportEmail(email, identityHash, reportText) {
  const res = await fetchWithTimeout(`${getSiteOrigin()}/api/send-email`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` }, body: JSON.stringify({ email, identity_hash: identityHash, reportText }) });
  if (!res.ok) throw new Error("send-email failed");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) return res.status(503).json({ ok: false, error: "Service unavailable" });

  const { identity_hash } = req.body || {};
  if (!isValidIdentityHash(identity_hash)) return res.status(400).json({ ok: false, error: "Invalid identity_hash" });

  const idempotencyKey = typeof req.headers["idempotency-key"] === "string" && /^[A-Za-z0-9._:-]{16,128}$/.test(req.headers["idempotency-key"])
    ? req.headers["idempotency-key"]
    : `report-${identity_hash}`;

  try {
    const assessment = await fetchAssessment(identity_hash);
    if (!assessment) return res.status(404).json({ ok: false, error: "Assessment not found" });
    if (assessment.report_email_sent_at || assessment.report_status === "SENT") return res.status(200).json({ ok: true, alreadySent: true });
    if (!assessment.email) return res.status(200).json({ ok: true, skipped: "no_email" });

    const claim = await claimReport(identity_hash, idempotencyKey);
    if (!claim?.claimed) {
      if (claim?.status === "SENT") return res.status(200).json({ ok: true, alreadySent: true });
      return res.status(202).json({ ok: true, status: claim?.status || "IN_PROGRESS" });
    }

    let reportText = assessment.ai_report;
    if (!reportText) {
      reportText = await generateAiReport({ name: assessment.name, role: assessment.role, valuIndex: assessment.total_score, designation: assessment.designation, clusterScores: assessment.cluster_scores, skillScores: assessment.skill_scores });
      if (!reportText) throw new Error("AI report generation returned empty");
      await saveAiReport(identity_hash, reportText);
    }

    await markEmailPending(identity_hash);
    await sendReportEmail(assessment.email, identity_hash, reportText);
    await markEmailSent(identity_hash);
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error("[generate-and-send-report] failed:", err.message);
    await markFailed(identity_hash);
    return res.status(500).json({ ok: false, error: "Report generation failed" });
  }
}
