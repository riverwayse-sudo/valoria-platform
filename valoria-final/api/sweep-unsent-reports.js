import { isInternalRequest } from "../src/internalAuth.js";

export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

async function sweepOne(origin, headers, query, endpoint) {
  const params = new URLSearchParams(query);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, { headers });
  const rows = await res.json();
  return Promise.all(rows.map(async (row) => {
    try {
      const r = await fetch(`${origin}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({ identity_hash: row.identity_hash }),
      });
      return { identity_hash: row.identity_hash, status: r.status };
    } catch (err) {
      return { identity_hash: row.identity_hash, error: String(err) };
    }
  }));
}

export default async function handler(req) {
  // Fail closed. Previously a missing CRON_SECRET disabled the check entirely.
  if (!isInternalRequest(req)) return new Response("Unauthorized", { status: 401 });

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
  const origin = new URL(req.url).origin;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [unsentConfirmations, unsentReports, unreportedCompletions, profileReminders] = await Promise.all([
    sweepOne(origin, headers, {
      email: "not.is.null", confirmation_email_sent_at: "is.null", select: "identity_hash", limit: "50",
    }, "/api/resend-confirmation"),
    sweepOne(origin, headers, {
      completed_at: "not.is.null", email: "not.is.null", report_email_sent_at: "is.null", ai_report: "not.is.null", select: "identity_hash", limit: "50",
    }, "/api/finalize-report"),
    sweepOne(origin, headers, {
      completed_at: "not.is.null", email: "not.is.null", ai_report: "is.null", report_email_sent_at: "is.null", select: "identity_hash", limit: "50",
    }, "/api/generate-and-send-report"),
    sweepOne(origin, headers, {
      completed_at: `lt.${oneDayAgo}`, email: "not.is.null", report_email_sent_at: "not.is.null", profile_reminder_sent_at: "is.null", select: "identity_hash", limit: "50",
    }, "/api/send-profile-reminder"),
  ]);

  return new Response(JSON.stringify({ unsentConfirmations, unsentReports, unreportedCompletions, profileReminders }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}
