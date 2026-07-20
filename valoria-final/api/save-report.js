export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Pure persistence step — just writes fields to the row. No Anthropic call,
// no email call, so it's fast and safe on Hobby's 10s function cap.
// Pass either or both of report_text / mark_sent in the body.
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

  const { identity_hash, report_text, mark_sent } = payload;
  if (!identity_hash) {
    return new Response(JSON.stringify({ error: "identity_hash is required." }), { status: 400 });
  }
  if (!report_text && !mark_sent) {
    return new Response(JSON.stringify({ error: "Nothing to save — pass report_text and/or mark_sent." }), { status: 400 });
  }

  const patchBody = {};
  if (report_text) patchBody.ai_report = report_text;
  if (mark_sent) patchBody.report_email_sent_at = new Date().toISOString();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identity_hash}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patchBody),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: "Supabase save failed", detail: err }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, saved: Object.keys(patchBody) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}