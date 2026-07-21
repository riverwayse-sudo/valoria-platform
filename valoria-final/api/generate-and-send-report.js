// api/generate-and-send-report.js
//
// Server-side report generation + email send for the sweep workflow.
// Called by sweep-unsent-reports when a user closed the tab mid-stream
// or landed via identity_hash redirect before client-side generation fired.
// This endpoint is idempotent — calling it repeatedly is safe.
export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

function getSiteOrigin() {
  const raw = process.env.SITE_ORIGIN || "";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://valoriainstitute.com";
  }
}

async function fetchAssessment(identityHash) {
  const params = new URLSearchParams({
    identity_hash: `eq.${identityHash}`,
    select: "name,role,email,total_score,designation,cluster_scores,skill_scores,ai_report,report_email_sent_at",
    limit: "1",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  const rows = await res.json();
  return rows?.[0] || null;
}

async function saveAiReport(identityHash, report) {
  await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identityHash}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ ai_report: report }),
  });
}

async function markEmailSent(identityHash) {
  await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identityHash}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
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
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || null;
}

async function sendReportEmail(email, identityHash, reportText, scoreProfile) {
  const siteOrigin = getSiteOrigin();
  
  const res = await fetch(`${siteOrigin}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      identity_hash: identityHash,
      reportText,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`send-email failed: ${err}`);
  }
}

export default async function handler(req, res) {
  const { identity_hash } = req.body || {};

  if (!identity_hash) {
    return res.status(400).json({ ok: false, error: "Missing identity_hash" });
  }

  console.log(`[generate-and-send-report] processing ${identity_hash}`);

  try {
    // Step 1: Look up the assessment
    const assessment = await fetchAssessment(identity_hash);
    
    if (!assessment) {
      return res.status(404).json({ ok: false, error: "Assessment not found" });
    }

    // Already sent — skip
    if (assessment.report_email_sent_at) {
      console.log(`[generate-and-send-report] already sent for ${identity_hash}`);
      return res.status(200).json({ ok: true, alreadySent: true });
    }

    // No email on record — can't send
    if (!assessment.email) {
      console.log(`[generate-and-send-report] no email for ${identity_hash}`);
      return res.status(200).json({ ok: true, skipped: "no_email" });
    }

    let reportText = assessment.ai_report;

    // Step 2: Generate report if not already generated
    if (!reportText) {
      console.log(`[generate-and-send-report] generating AI report for ${identity_hash}`);
      reportText = await generateAiReport({
        name: assessment.name,
        role: assessment.role,
        valuIndex: assessment.total_score,
        designation: assessment.designation,
        clusterScores: assessment.cluster_scores,
        skillScores: assessment.skill_scores,
      });

      if (!reportText) {
        throw new Error("AI report generation returned empty");
      }

      // Save to DB
      await saveAiReport(identity_hash, reportText);
      console.log(`[generate-and-send-report] saved AI report for ${identity_hash}`);
    }

    // Step 3: Send the email
    console.log(`[generate-and-send-report] sending email for ${identity_hash}`);
    await sendReportEmail(assessment.email, identity_hash, reportText, assessment);

    // Step 4: Mark as sent
    await markEmailSent(identity_hash);
    console.log(`[generate-and-send-report] completed for ${identity_hash}`);

    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error(`[generate-and-send-report] FAILED for ${identity_hash}:`, err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
