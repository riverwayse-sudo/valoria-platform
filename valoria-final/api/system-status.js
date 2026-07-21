export const config = { maxDuration: 10 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STATUS_ACCESS_KEY = process.env.STATUS_ACCESS_KEY;

function getQueryParam(req, name) {
  const raw = req.url || "";
  const qIndex = raw.indexOf("?");
  if (qIndex === -1) return null;
  return new URLSearchParams(raw.slice(qIndex + 1)).get(name);
}

export default async function handler(req) {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  if (!STATUS_ACCESS_KEY || getQueryParam(req, "key") !== STATUS_ACCESS_KEY) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };

  const backlogParams = new URLSearchParams({
    select: "identity_hash,email,completed_at",
    completed_at: "not.is.null",
    report_email_sent_at: "is.null",
    order: "completed_at.asc",
    limit: "50",
  });

  const lastSentParams = new URLSearchParams({
    select: "identity_hash,report_email_sent_at",
    report_email_sent_at: "not.is.null",
    order: "report_email_sent_at.desc",
    limit: "1",
  });

  let backlog = [];
  let lastSent = null;

  try {
    const [backlogRes, lastSentRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${backlogParams}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${lastSentParams}`, { headers }),
    ]);
    backlog = await backlogRes.json();
    const lastSentRows = await lastSentRes.json();
    lastSent = lastSentRows?.[0]?.report_email_sent_at || null;
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "supabase query failed", detail: err.message }), { status: 502 });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      checked_at: new Date().toISOString(),
      deployed_commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
      report_backlog_count: backlog.length,
      report_backlog_sample: backlog.slice(0, 5),
      last_report_sent_at: lastSent,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
