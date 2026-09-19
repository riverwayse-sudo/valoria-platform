export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

async function sweepOne(origin, headers, query, endpoint) {
  const params = new URLSearchParams(query);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params.toString()}`, { headers, cache: "no-store" });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`Sweep lookup failed for ${endpoint}:`, res.status, detail.slice(0, 500));
    return { endpoint, rows: [], lookupFailed: true, status: res.status };
  }
  const rows = await res.json();
  return {
    endpoint,
    rows: await Promise.all(rows.map(async (row) => {
      try {
        const r = await fetch(`${origin}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
          body: JSON.stringify({ identity_hash: row.identity_hash }),
        });
        return { identity_hash: row.identity_hash, status: r.status };
      } catch (err) {
        return { identity_hash: row.identity_hash, error: String(err) };
      }
    })),
    lookupFailed: false,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export default async function handler(req) {
  const auth = req?.headers?.get?.("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) return json({ error: "Unauthorized" }, 401);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Server configuration error" }, 500);

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
  const origin = new URL(req.url).origin;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const jobs = [
    sweepOne(origin, headers, { email: "not.is.null", confirmation_email_sent_at: "is.null", select: "identity_hash", limit: "50" }, "/api/resend-confirmation"),
    sweepOne(origin, headers, { completed_at: "not.is.null", email: "not.is.null", report_email_sent_at: "is.null", ai_report: "not.is.null", select: "identity_hash", limit: "50" }, "/api/finalize-report"),
    sweepOne(origin, headers, { completed_at: "not.is.null", email: "not.is.null", ai_report: "is.null", report_email_sent_at: "is.null", select: "identity_hash", limit: "50" }, "/api/generate-and-send-report"),
    sweepOne(origin, headers, { completed_at: `lt.${oneDayAgo}`, email: "not.is.null", report_email_sent_at: "not.is.null", profile_reminder_sent_at: "is.null", select: "identity_hash", limit: "50" }, "/api/send-profile-reminder"),
  ];

  const [unsentConfirmations, unsentReports, unreportedCompletions, profileReminders] = await Promise.all(jobs);

  return json({
    ok: true,
    unsentConfirmations,
    unsentReports,
    unreportedCompletions,
    profileReminders,
    lookupFailures: [unsentConfirmations, unsentReports, unreportedCompletions, profileReminders]
      .filter(x => x.lookupFailed)
      .map(x => ({ endpoint: x.endpoint, status: x.status })),
  });
}
