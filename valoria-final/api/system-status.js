// api/system-status.js
//
// Internal health check + backlog visibility for the sweep-unsent-reports job.
// This endpoint exposes operational counts and therefore must never be public.
export const config = {
  runtime: "nodejs",
  maxDuration: 20,
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

function unauthorized(res) {
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

function configured(res) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CRON_SECRET) {
    res.status(503).json({ ok: false, error: "Service unavailable" });
    return false;
  }
  return true;
}

async function countAssessments(headers, params) {
  const url = `${SUPABASE_URL}/rest/v1/valu_assessments?${params}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error("Supabase request failed");

  // Prefer: count=exact returns the total in Content-Range even when the
  // response is limited to one row. Do not use response.length as the count.
  const contentRange = response.headers.get("content-range") || "";
  const match = contentRange.match(/\/([0-9]+|\*)$/);
  if (match && match[1] !== "*") return Number(match[1]);

  // Fail closed rather than reporting a misleading backlog count.
  throw new Error("Backlog count unavailable");
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!configured(res)) return;

  const authorization = req.headers.authorization || "";
  const expected = `Bearer ${CRON_SECRET}`;
  if (authorization.length !== expected.length || authorization !== expected) {
    return unauthorized(res);
  }

  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Prefer: "count=exact",
  };

  try {
    const [unsentConfirmations, unsentReports, unreportedCompletions] = await Promise.all([
      countAssessments(headers, new URLSearchParams({
        email: "not.is.null",
        "confirmation_email_sent_at": "is.null",
        select: "id",
        limit: "1",
      })),
      countAssessments(headers, new URLSearchParams({
        completed_at: "not.is.null",
        email: "not.is.null",
        "report_email_sent_at": "is.null",
        ai_report: "not.is.null",
        select: "id",
        limit: "1",
      })),
      countAssessments(headers, new URLSearchParams({
        completed_at: "not.is.null",
        email: "not.is.null",
        ai_report: "is.null",
        "report_email_sent_at": "is.null",
        select: "id",
        limit: "1",
      })),
    ]);

    const totalBacklog = unsentConfirmations + unsentReports + unreportedCompletions;
    const isHealthy = totalBacklog === 0;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: isHealthy,
      backlog: {
        unsentConfirmations,
        unsentReports,
        unreportedCompletions,
        total: totalBacklog,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[system-status] FAILED:", err.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(504).json({ ok: false, error: "Status check failed", checkedAt: new Date().toISOString() });
  }
}
