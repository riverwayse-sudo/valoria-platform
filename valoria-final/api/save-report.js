import { privilegedWriteAllowed } from '../lib/environment-guard.js';
export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const __guard = privilegedWriteAllowed();
  if (!__guard.allowed) return new Response(JSON.stringify({ error: 'Write refused: this deployment is not authorised to modify this database.', detail: __guard.reason }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let payload;
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const { identity_hash, report_text, mark_sent } = payload;
  if (!identity_hash || typeof identity_hash !== "string" || identity_hash.length > 128) {
    return new Response(JSON.stringify({ error: "Invalid identity_hash." }), { status: 400 });
  }
  if (!report_text && !mark_sent) {
    return new Response(JSON.stringify({ error: "Nothing to save." }), { status: 400 });
  }

  const patchBody = {};
  if (typeof report_text === "string" && report_text.trim()) patchBody.ai_report = report_text;
  if (mark_sent === true) patchBody.report_email_sent_at = new Date().toISOString();
  if (!Object.keys(patchBody).length) {
    return new Response(JSON.stringify({ error: "Nothing to save." }), { status: 400 });
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${encodeURIComponent(identity_hash)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      // return=representation so a PATCH that matched no row is distinguishable
      // from one that wrote. With return=minimal an unknown identity_hash was
      // reported as ok:true while nothing was stored.
      Prefer: "return=representation",
    },
    body: JSON.stringify(patchBody),
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Supabase save failed" }), { status: 502 });
  }

  const updated = await res.json().catch(() => []);
  if (!Array.isArray(updated) || updated.length === 0) {
    return new Response(JSON.stringify({ error: "No assessment matched that identity." }), { status: 404 });
  }

  return new Response(JSON.stringify({ ok: true, saved: Object.keys(patchBody) }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
