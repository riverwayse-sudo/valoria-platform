export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

async function hasCompletedAssessment(identityHash) {
  if (!identityHash || !SUPABASE_URL || !SERVICE_ROLE_KEY) return false;
  try {
    const params = new URLSearchParams({
      identity_hash: `eq.${identityHash}`,
      select: "identity_hash",
      limit: "1",
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 });
  }

  let payload;
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: { message: "Invalid request body." } }), { status: 400 });
  }

  const { prompt, identity_hash } = payload;
  if (!prompt || typeof prompt !== "string" || prompt.length > 8000) {
    return new Response(JSON.stringify({ error: { message: "Invalid prompt." } }), { status: 400 });
  }

  const authorized = await hasCompletedAssessment(identity_hash);
  if (!authorized) {
    return new Response(JSON.stringify({ error: { message: "No completed assessment found for this request." } }), { status: 403 });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ error: { message: "AI report generation failed." } }), { status: 502 });
  }

  return new Response(response.body, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-store" },
  });
}
