export const config = { maxDuration: 20 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STATUS_ACCESS_KEY = process.env.STATUS_ACCESS_KEY;

function getQueryParam(req, name) {
  const raw = req.url || "";
  const qIndex = raw.indexOf("?");
  if (qIndex === -1) return null;
  return new URLSearchParams(raw.slice(qIndex + 1)).get(name);
}

function fetchWithTimeout(url, options, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  console.log(`[system-status] starting: ${label}`);
  return fetch(url, { ...options, signal: controller.signal })
    .then((res) => {
      clearTimeout(timer);
      console.log(`[system-status] finished: ${label} (status ${res.status})`);
      return res;
    })
    .catch((err) => {
      clearTimeout(timer);
      console.log(`[system-status] FAILED: ${label} — ${err.name}: ${err.message}`);
      throw err;
    });
}

export default async function handler(req) {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  if (!STATUS_ACCESS_KEY || getQueryParam(req, "key") !== STATUS_ACCESS_KEY) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "missing SUPABASE_URL or SERVICE_ROLE_KEY env var" }), { status: 500 });
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
    const backlogRes = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/valu_assessments?${backlogParams}`,
      { headers },
      8000,
      "backlog query"
    );
    backlog = await backlogRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "backlog query timed out or failed", detail: err.message }), { status: 504 });
  }

  try {
    const lastSentRes = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/valu_assessments?${lastSentParams}`,
      { headers },
      8000,
      "last-sent query"
    );
    const lastSentRows = await lastSentRes.json();
    lastSent = lastSentRows?.[0]?.report_email_sent_at || null;
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "last-sent query timed out or failed", detail: err.message }), { status: 504 });
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
