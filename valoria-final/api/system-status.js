// api/system-status.js
//
// FIX APPLIED: forces Node.js serverless runtime (not Edge) so that
// vercel.json's `maxDuration` setting actually applies to this function.
// Edge Functions ignore vercel.json's per-function maxDuration entirely,
// which is why increasing it previously had no effect.
export const config = {
  runtime: "nodejs",
  maxDuration: 20, // keep in sync with the value set for this file in vercel.json
};

// TODO: paste your existing Supabase client import here, e.g.:
// import { createClient } from "@supabase/supabase-js";
// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Wraps any promise with a hard timeout, aborting cleanly instead of
// letting the platform kill the whole function with an opaque 504.
function withTimeout(promise, ms, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  return Promise.race([
    promise(controller.signal),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[system-status] TIMEOUT after ${ms}ms: ${label}`)), ms)
    ),
  ]).finally(() => clearTimeout(timeout));
}

export default async function handler(req, res) {
  console.log("[system-status] starting: backlog query");

  try {
    // TODO: replace this block with your real backlog query, e.g.:
    //
    // const backlog = await withTimeout(
    //   (signal) => supabase.from("reports_queue").select("*").eq("sent", false),
    //   8000,
    //   "backlog query"
    // );

    const backlog = await withTimeout(
      async () => {
        // placeholder — replace with actual Supabase call
        return { data: [], error: null };
      },
      8000,
      "backlog query"
    );

    if (backlog.error) {
      console.error("[system-status] FAILED: backlog query error", backlog.error);
      return res.status(500).json({ ok: false, error: backlog.error.message });
    }

    console.log("[system-status] backlog query completed");

    return res.status(200).json({
      ok: true,
      backlogCount: backlog.data?.length ?? 0,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[system-status] FAILED:", err.message);
    return res.status(504).json({ ok: false, error: err.message });
  }
}
