// Daily, service-role-only reconciliation monitor.
// Stores aggregate counts and alerts; never returns participant-level identity evidence.
export const config = { runtime: "nodejs", maxDuration: 20 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

function json(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(data);
}

function count(report, key) {
  const value = Number(report?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

const ALERT_METRICS = [
  ["completed_assessments_missing_taster_id", "completed assessments missing a snapshot link"],
  ["pending_assessment_reports", "completed assessments awaiting report generation"],
  ["missing_taster_link_assessments_without_review", "missing-link assessments without a review entry"],
  ["completed_assessment_taster_owner_conflicts", "assessment/snapshot owner or identity conflicts"],
  ["assessment_identity_owner_conflicts", "assessment identity-audit owner conflicts"],
  ["completed_assessments_missing_assessment_identity_audit_link", "assessments missing their account identity-audit link"],
  ["journey_missing_or_wrong_current_assessment", "completed assessments missing the correct journey state"],
  ["completed_assessments_without_profile", "completed assessments without a professional profile"],
  ["listed_profiles_eligibility_or_visibility_conflicts", "listed profiles with eligibility/visibility conflicts"],
  ["listed_profiles_missing_from_public_roster", "listed profiles missing from the public roster"],
  ["public_roster_rows_not_listed", "public roster rows that are not listed"],
  ["active_capabilities_eligible_but_not_listed", "eligible active capabilities not listed"],
  ["taster_progress_expired_in_progress", "expired snapshot progress records still in progress"],
  ["journey_records_stale_over_7_days", "stale non-completed journey records"],
  ["completed_tasters_unlinked", "completed snapshots without account ownership"],
  ["taster_identity_candidate_unresolved", "unresolved snapshot identity candidates"],
  ["identity_review_queue_open", "open identity reconciliation review records"],
];

async function supabase(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(res, 503, { ok: false, error: "Service unavailable" });
  }

  const authorization = req.headers.authorization || "";
  const expected = CRON_SECRET ? `Bearer ${CRON_SECRET}` : "";
  const cronAuthorized = Boolean(CRON_SECRET) &&
    authorization.length === expected.length &&
    authorization === expected;

  let privateAuthorized = false;
  const privateKey = req.headers["x-valoria-function-key"];
  if (typeof privateKey === "string" && privateKey.length > 0) {
    try {
      const validationRes = await supabase("rpc/is_valid_valoria_function_invoke_key", {
        method: "POST",
        body: JSON.stringify({ p_key: privateKey }),
      });
      privateAuthorized = validationRes.ok && (await validationRes.json().catch(() => false)) === true;
    } catch {
      privateAuthorized = false;
    }
  }

  if (!cronAuthorized && !privateAuthorized) {
    return json(res, 401, { ok: false, error: "Unauthorized" });
  }

  try {
    const healthRes = await supabase("rpc/run_valu_reconciliation_health", { method: "POST", body: "{}" });
    if (!healthRes.ok) throw new Error("Reconciliation health report could not be loaded");
    const health = await healthRes.json();
    if (!health || typeof health !== "object" || Array.isArray(health)) throw new Error("Invalid reconciliation health report");

    const alerts = ALERT_METRICS
      .map(([key, description]) => ({ key, description, count: count(health, key) }))
      .filter(item => item.count > 0);
    const alertKeys = alerts.map(item => `${item.key}=${item.count}`);

    const snapshotRes = await supabase("rpc/record_valu_reconciliation_health_snapshot", {
      method: "POST",
      body: JSON.stringify({ p_health: health, p_alert_keys: alertKeys }),
    });
    if (!snapshotRes.ok) throw new Error("Reconciliation health snapshot could not be recorded");
    const snapshot = await snapshotRes.json();

    let adminNotifications = "unchanged";
    if (snapshot?.alert_changed) {
      const adminsRes = await supabase("admin_users?select=id");
      if (!adminsRes.ok) throw new Error("Could not load reconciliation alert recipients");
      const admins = await adminsRes.json();
      const recovered = alerts.length === 0 && Number(snapshot?.previous_alert_count || 0) > 0;
      const message = recovered
        ? "The daily VALU reconciliation health check reports that all tracked alert conditions have cleared. Review the latest health snapshot and keep the normal monitoring schedule active."
        : "The daily VALU reconciliation check found open conditions: " +
          alerts.map(item => `${item.count} ${item.description}`).join("; ") +
          ". Review the admin reconciliation queue. These are review triggers, not permission to auto-link or delete records.";
      const notifications = (admins || []).map(admin => ({
        user_id: admin.id,
        type: recovered ? "reconciliation_health_recovery" : "reconciliation_health_alert",
        title: recovered ? "VALU reconciliation health restored" : "VALU reconciliation requires review",
        body: message,
        action_url: "/admin/reconciliation",
      }));
      if (notifications.length) {
        const notifyRes = await supabase("platform_notifications", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(notifications),
        });
        if (!notifyRes.ok) {
          console.error("[reconciliation-health] notification insert failed", notifyRes.status);
          adminNotifications = "failed";
        } else {
          const ackRes = await supabase("rpc/mark_valu_reconciliation_health_notification_sent", {
            method: "POST",
            body: JSON.stringify({ p_snapshot_id: snapshot?.id }),
          });
          const ack = ackRes.ok ? await ackRes.json().catch(() => false) : false;
          if (!ackRes.ok || ack !== true) {
            console.error("[reconciliation-health] notification acknowledgement failed", ackRes.status);
            adminNotifications = "inserted_but_ack_pending";
          } else {
            adminNotifications = recovered ? "recovery_sent" : "alert_sent";
          }
        }
      } else {
        adminNotifications = "no_admin_recipients";
      }
    }

    const summary = Object.fromEntries(alerts.map(item => [item.key, item.count]));
    if (alerts.length) console.error("[reconciliation-health] ALERT", JSON.stringify({ snapshotId: snapshot?.id, summary }));
    else console.log("[reconciliation-health] OK", JSON.stringify({ snapshotId: snapshot?.id, checkedAt: health.generated_at }));

    return json(res, 200, {
      ok: alerts.length === 0 && !["failed", "inserted_but_ack_pending", "no_admin_recipients"].includes(adminNotifications),
      checkedAt: health.generated_at,
      snapshotId: snapshot?.id ?? null,
      alertCount: alerts.length,
      alerts: summary,
      adminNotifications,
    });
  } catch (error) {
    console.error("[reconciliation-health] FAILED", error?.message || "unknown error");
    return json(res, 502, { ok: false, error: "Reconciliation health check failed", checkedAt: new Date().toISOString() });
  }
}
