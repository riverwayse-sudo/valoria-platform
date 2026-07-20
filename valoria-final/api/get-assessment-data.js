export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fast, single-purpose lookup — only returns the fields needed to build a
// report prompt and to decide whether generation/sending already happened.
// Does not call Anthropic, does not send email. Should finish in well
// under a second, so it's safe on Hobby's 10s cap.
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const { identity_hash } = payload;
  if (!identity_hash) {
    return new Response(JSON.stringify({ error: "identity_hash is required." }), { status: 400 });
  }

  const params = new URLSearchParams({
    identity_hash: `eq.${identity_hash}`,
    select:
      "name,role,email,total_score,cluster_scores,skill_scores,designation,ai_report,report_email_sent_at",
    limit: "1",
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: "Supabase lookup failed", detail: err }), { status: 502 });
  }

  const rows = await res.json();
  const row = rows?.[0];

  if (!row) {
    return new Response(JSON.stringify({ error: "No assessment found." }), { status: 404 });
  }

  return new Response(JSON.stringify({ ok: true, row }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}