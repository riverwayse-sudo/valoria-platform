// api/system-status.js
//
// Health check + backlog visibility for the sweep-unsent-reports job.
// Returns counts of three categories of "stuck" assessments:
// 1. Confirmed but no confirmation email sent
// 2. Report generated but no email sent
// 3. Not yet generated (tab closed mid-stream, etc.)
export const config = {
  runtime: "nodejs",
  maxDuration: 20,
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function countAssessments(headers, params) {
  const url = `${SUPABASE_URL}/rest/v1/valu_assessments?${params}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Supabase returned ${res.status}`);
  const data = await res.json();
  return data?.length ?? 0;
}

export default async function handler(req, res) {
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Prefer: 'count=exact'
  };

  try {
    const [unsentConfirmations, unsentReports, unreportedCompletions] = await Promise.all([
      countAssessments(headers, new URLSearchParams({
        email: "not.is.null",
        "confirmation_email_sent_at": "is.null",
        select: "id",
        limit: "1"
      })),
      countAssessments(headers, new URLSearchParams({
        completed_at: "not.is.null",
        email: "not.is.null",
        "report_email_sent_at": "is.null",
        "ai_report": "not.is.null",
        select: "id",
        limit: "1"
      })),
      countAssessments(headers, new URLSearchParams({
        completed_at: "not.is.null",
        email: "not.is.null",
        "ai_report": "is.null",
        "report_email_sent_at": "is.null",
        select: "id",
        limit: "1"
      })),
    ]);

    const totalBacklog = unsentConfirmations + unsentReports + unreportedCompletions;
    const isHealthy = totalBacklog === 0;

    return res.status(200).json({
      ok: isHealthy,
      backlog: {
        unsentConfirmations,
        unsentReports,
        unreportedCompletions,
        total: totalBacklog
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[system-status] FAILED:", err.message);
    return res.status(504).json({ ok: false, error: err.message, checkedAt: new Date().toISOString() });
  }
}
