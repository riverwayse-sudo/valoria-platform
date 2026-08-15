export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

function authorized(req) {
  if (!CRON_SECRET) return false;
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  return header === `Bearer ${CRON_SECRET}`;
}

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Server misconfigured." }), { status: 500 });
  }
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), { status: 401 });
  }

  let payload;
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const identityHash = typeof payload?.identity_hash === "string" ? payload.identity_hash.trim() : "";
  if (!identityHash || identityHash.length > 256) {
    return new Response(JSON.stringify({ error: "Valid identity_hash is required." }), { status: 400 });
  }

  const params = new URLSearchParams({
    identity_hash: `eq.${identityHash}`,
    select: "name,role,email,total_score,cluster_scores,skill_scores,designation,ai_report,report_email_sent_at",
    limit: "1",
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) return new Response(JSON.stringify({ error: "Supabase lookup failed" }), { status: 502 });

  const rows = await res.json();
  const row = rows?.[0];
  if (!row) return new Response(JSON.stringify({ error: "No assessment found." }), { status: 404 });

  return new Response(JSON.stringify({ ok: true, row }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
