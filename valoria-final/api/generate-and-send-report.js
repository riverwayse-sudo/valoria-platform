// api/generate-and-send-report.js
//
// FIX APPLIED: forces Node.js serverless runtime (not Edge) so that
// vercel.json's `maxDuration` setting actually applies to this function.
export const config = {
  runtime: "nodejs",
  maxDuration: 60, // keep in sync with the value set for this file in vercel.json
};

// TODO: paste your existing imports here, e.g.:
// import { createClient } from "@supabase/supabase-js";
// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// TODO: paste your existing email-sending import here (Brevo, etc.)

// SITE_ORIGIN fix: build the origin safely instead of crashing on malformed
// or missing env values.
function getSiteOrigin() {
  const raw = process.env.SITE_ORIGIN || "";
  try {
    return new URL(raw).origin;
  } catch {
    console.warn("[generate-and-send-report] SITE_ORIGIN invalid or missing, falling back");
    return "https://valoriainstitute.com"; // TODO: confirm correct fallback domain
  }
}

function withTimeout(promiseFactory, ms, label) {
  return Promise.race([
    promiseFactory(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[generate-and-send-report] TIMEOUT after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

export default async function handler(req, res) {
  const { reportId } = req.body || {};

  if (!reportId) {
    return res.status(400).json({ ok: false, error: "Missing reportId" });
  }

  try {
    // Double-send guard: check whether this report was already sent
    // before doing any expensive work.
    // TODO: replace with your real lookup, e.g.:
    // const { data: existing } = await supabase
    //   .from("reports")
    //   .select("sent_at")
    //   .eq("id", reportId)
    //   .single();
    const existing = { sent_at: null }; // placeholder

    if (existing?.sent_at) {
      console.log(`[generate-and-send-report] already sent for ${reportId}, skipping`);
      return res.status(200).json({ ok: true, alreadySent: true });
    }

    const siteOrigin = getSiteOrigin();

    console.log(`[generate-and-send-report] generating report for ${reportId}`);

    // TODO: replace with your real report-generation call
    const report = await withTimeout(
      async () => {
        return { id: reportId, url: `${siteOrigin}/reports/${reportId}` };
      },
      8000,
      "generate report"
    );

    console.log(`[generate-and-send-report] sending email for ${reportId}`);

    // TODO: replace with your real email-send call (Brevo, etc.)
    await withTimeout(
      async () => {
        // await sendEmail({ to: ..., reportUrl: report.url });
        return true;
      },
      8000,
      "send email"
    );

    // TODO: mark as sent in Supabase, e.g.:
    // await supabase.from("reports").update({ sent_at: new Date().toISOString() }).eq("id", reportId);

    console.log(`[generate-and-send-report] completed for ${reportId}`);

    return res.status(200).json({ ok: true, report });
  } catch (err) {
    console.error("[generate-and-send-report] FAILED:", err.message);
    return res.status(504).json({ ok: false, error: err.message });
  }
}
