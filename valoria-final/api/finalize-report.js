export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

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
    select: "email,ai_report,report_email_sent_at",
    limit: "1",
  });
  const lookupRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, { headers });
  const rows = await lookupRes.json();
  const row = rows?.[0];

  if (!row) {
    return new Response(JSON.stringify({ error: "No assessment found." }), { status: 404 });
  }
  if (row.report_email_sent_at) {
    return new Response(JSON.stringify({ ok: true, already_sent: true }), { status: 200 });
  }
  if (!row.email) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_email_yet" }), { status: 200 });
  }
  if (!row.ai_report) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_report_yet" }), { status: 200 });
  }

  const sendRes = await fetch(`${new URL(req.url).origin}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: row.email, identity_hash, reportText: row.ai_report }),
  });
  if (!sendRes.ok) {
    const err = await sendRes.text();
    return new Response(JSON.stringify({ error: "send-email failed", detail: err }), { status: 502 });
  }

  await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identity_hash}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ report_email_sent_at: new Date().toISOString() }),
  });

  return new Response(JSON.stringify({ ok: true, sent: true }), { status: 200 });
}
