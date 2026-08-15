import { isInternalRequest } from "../src/internalAuth.js";

// Server-side report generation + email send for the sweep workflow.
export const config = { runtime: "nodejs", maxDuration: 60 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

function getSiteOrigin() {
  const raw = process.env.SITE_ORIGIN || "";
  try { return new URL(raw).origin; } catch { return "https://valoriainstitute.com"; }
}

async function fetchAssessment(identityHash) {
  const params = new URLSearchParams({
    identity_hash: `eq.${identityHash}`,
    select: "name,role,email,total_score,designation,cluster_scores,skill_scores,ai_report,report_email_sent_at",
    limit: "1",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  const rows = await res.json();
  return rows?.[0] || null;
}

async function saveAiReport(identityHash, report) {
  return fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identityHash}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: "return=minimal" },
    body: JSON.stringify({ ai_report: report }),
  });
}

async function markEmailSent(identityHash) {
  return fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identityHash}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: "return=minimal" },
    body: JSON.stringify({ report_email_sent_at: new Date().toISOString() }),
  });
}

async function generateAiReport(scoreProfile) {
  const { name, role, valuIndex, designation, clusterScores, skillScores } = scoreProfile;
  const sortedSkills = Object.entries(skillScores || {}).filter(([s]) => s !== "Validity").sort(([,a],[,b]) => b - a);
  const topSkills = sortedSkills.slice(0, 3);
  const bottomSkills = sortedSkills.slice(-3).reverse();
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

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`Anthropic error: ${await response.text()}`);
  const data = await response.json();
  return data.content?.[0]?.text || null;
}

async function sendReportEmail(email, identityHash, reportText) {
  const res = await fetch(`${getSiteOrigin()}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` },
    body: JSON.stringify({ email, identity_hash: identityHash, reportText }),
  });
  if (!res.ok) throw new Error(`send-email failed: ${await res.text()}`);
}

export default async function handler(req, res) {
  if (!isInternalRequest(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { identity_hash } = req.body || {};
  if (!identity_hash || !/^fp_[a-z0-9]+$/i.test(identity_hash)) {
    return res.status(400).json({ ok: false, error: "Valid identity_hash is required" });
  }

  try {
    const assessment = await fetchAssessment(identity_hash);
    if (!assessment) return res.status(404).json({ ok: false, error: "Assessment not found" });
    if (assessment.report_email_sent_at) return res.status(200).json({ ok: true, alreadySent: true });
    if (!assessment.email) return res.status(200).json({ ok: true, skipped: "no_email" });

    let reportText = assessment.ai_report;
    if (!reportText) {
      reportText = await generateAiReport({
        name: assessment.name,
        role: assessment.role,
        valuIndex: assessment.total_score,
        designation: assessment.designation,
        clusterScores: assessment.cluster_scores,
        skillScores: assessment.skill_scores,
      });
      if (!reportText) throw new Error("AI report generation returned empty");
      const saved = await saveAiReport(identity_hash, reportText);
      if (!saved.ok) throw new Error(`Saving report failed: ${await saved.text()}`);
    }

    await sendReportEmail(assessment.email, identity_hash, reportText);
    const marked = await markEmailSent(identity_hash);
    if (!marked.ok) throw new Error(`Marking email sent failed: ${await marked.text()}`);

    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error(`[generate-and-send-report] FAILED for ${identity_hash}:`, err.message);
    return res.status(500).json({ ok: false, error: "Report generation or delivery failed." });
  }
}
