export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

async function sweepOne(origin, headers, query, endpoint) {
  const params = new URLSearchParams(query);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, { headers });
  const rows = await res.json();
  const results = [];
  for (const row of rows) {
    try {
      const r = await fetch(`${origin}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity_hash: row.identity_hash }),
      });
      results.push({ identity_hash: row.identity_hash, status: r.status });
    } catch (err) {
      results.push({ identity_hash: row.identity_hash, error: String(err) });
    }
  }
  return results;
}

export default async function handler(req) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
  const origin = new URL(req.url).origin;

  const unsentConfirmations = await sweepOne(origin, headers, {
    email: "not.is.null",
    confirmation_email_sent_at: "is.null",
    select: "identity_hash",
    limit: "50",
  }, "/api/resend-confirmation");

  const unsentReports = await sweepOne(origin, headers, {
    completed_at: "not.is.null",
    email: "not.is.null",
    report_email_sent_at: "is.null",
    ai_report: "not.is.null",
    select: "identity_hash",
    limit: "50",
  }, "/api/finalize-report");

  return new Response(JSON.stringify({ unsentConfirmations, unsentReports }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}
