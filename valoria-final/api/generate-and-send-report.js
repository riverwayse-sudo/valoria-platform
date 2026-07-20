export const config = { maxDuration: 60 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

function buildPrompt({ name, role, total_score, cluster_scores, skill_scores, designation }) {
  const skillLines = Object.entries(skill_scores || {})
    .filter(([s]) => s !== "Validity")
    .sort(([, a], [, b]) => b - a)
    .map(([s, sc]) => `  - ${s}: ${sc}/100`)
    .join("\n");

  return `You are writing a personalised professional development report for ${name}, a ${role} who completed the VALU Index assessment.
WRITING RULES:
1. Write like a trusted senior colleague who tells the truth.
2. Plain, direct language. No jargon: never use journey, leverage (as verb), holistic, impactful, synergy, empower, transformative, game-changer, paradigm, unlock, actionable.
3. Be specific and name real skills and consequences.
4. Speak directly to them as "you."
SCORE DATA:
VALU Index: ${total_score}/100 — ${designation}
SKILL SCORES:
${skillLines}
WRITE IN THESE SECTIONS:
## YOUR SCORE: ${total_score}/100 — ${String(designation).toUpperCase()}
## WHAT YOU ARE GOOD AT
## WHERE YOU ARE LOSING GROUND
## WHAT THIS COSTS YOU IN THE NEXT 12 MONTHS
## YOUR ONE ACTION FOR THIS WEEK
## THE QUESTION TO SIT WITH
Start directly with ## YOUR SCORE, no introduction.`;
}

function fetchWithTimeout(url, options, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  console.log(`[generate-and-send-report] starting: ${label}`);
  return fetch(url, { ...options, signal: controller.signal })
    .then((res) => {
      clearTimeout(timer);
      console.log(`[generate-and-send-report] finished: ${label} (status ${res.status})`);
      return res;
    })
    .catch((err) => {
      clearTimeout(timer);
      console.log(`[generate-and-send-report] FAILED: ${label} — ${err.name}: ${err.message}`);
      throw err;
    });
}

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured." }), { status: 500 });
  }

  let payload;
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }
  const { identity_hash } = payload;
  if (!identity_hash) {
    return new Response(JSON.stringify({ error: "identity_hash is required." }), { status: 400 });
  }

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
  const params = new URLSearchParams({
    identity_hash: `eq.${identity_hash}`,
    select: "name,role,email,total_score,cluster_scores,skill_scores,designation,ai_report,report_email_sent_at",
    limit: "1",
  });

  let lookupRes;
  try {
    lookupRes = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/valu_assessments?${params}`,
      { headers },
      15000,
      "supabase lookup"
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Supabase lookup timed out or failed", detail: err.message }), { status: 504 });
  }
  const rows = await lookupRes.json();
  const row = rows?.[0];

  if (!row) return new Response(JSON.stringify({ error: "No assessment found." }), { status: 404 });

  // Guard against double-sending: previously this endpoint had no check here,
  // so calling it twice for the same person (e.g. a page reload, or the
  // client and the cron sweep both firing) would email them the report twice.
  if (row.report_email_sent_at) {
    return new Response(JSON.stringify({ ok: true, already_sent: true }), { status: 200 });
  }
  if (!row.email) return new Response(JSON.stringify({ ok: true, skipped: "no_email" }), { status: 200 });

  let reportText = row.ai_report;

  if (!reportText) {
    const prompt = buildPrompt(row);
    let claudeRes;
    try {
      claudeRes = await fetchWithTimeout(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1500,
            messages: [{ role: "user", content: prompt }],
          }),
        },
        30000,
        "claude api call"
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: "Claude API timed out or failed", detail: err.message }), { status: 504 });
    }
    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return new Response(JSON.stringify({ error: "Claude API failed", detail: err }), { status: 502 });
    }
    const claudeData = await claudeRes.json();
    reportText = claudeData.content?.[0]?.text || "";

    try {
      await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identity_hash}`,
        {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ ai_report: reportText }),
        },
        15000,
        "supabase save ai_report"
      );
    } catch (err) {
      console.log(`[generate-and-send-report] non-fatal: failed to save ai_report — ${err.message}`);
    }
  }

  let sendRes;
  try {
    sendRes = await fetchWithTimeout(
      `${new URL(req.url).origin}/api/send-email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.email, identity_hash, reportText }),
      },
      20000,
      "send-email call"
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "send-email timed out or failed", detail: err.message }), { status: 504 });
  }
  if (!sendRes.ok) {
    const err = await sendRes.text();
    return new Response(JSON.stringify({ error: "send-email failed", detail: err }), { status: 502 });
  }

  try {
    await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identity_hash}`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ report_email_sent_at: new Date().toISOString() }),
      },
      15000,
      "supabase save report_email_sent_at"
    );
  } catch (err) {
    console.log(`[generate-and-send-report] non-fatal: failed to save report_email_sent_at — ${err.message}`);
  }

  return new Response(JSON.stringify({ ok: true, sent: true }), { status: 200 });
}
