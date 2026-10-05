export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const APP_URL = "https://valoriainstitute.com/valu/assessment/?full=1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function headers() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function supabase(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
    cache: "no-store",
  });
}

async function resolveTasterIdentity(tasterId) {
  if (!tasterId) return {};
  const params = new URLSearchParams({ id: `eq.${tasterId}`, select: "user_id", limit: "1" });
  const tasterRes = await supabase(`taster_sessions?${params}`);
  if (!tasterRes.ok) return {};
  const taster = (await tasterRes.json())?.[0];
  if (!taster?.user_id) return {};
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${taster.user_id}`, { headers: headers(), cache: "no-store" });
  if (!userRes.ok) return { user_id: taster.user_id };
  const user = await userRes.json();
  return { user_id: taster.user_id, email: user.email || null };
}

async function getProgressBySession(sessionId) {
  const params = new URLSearchParams({
    session_id: `eq.${sessionId}`,
    select: "id,session_id,resume_token,name,role,experience,email,current_question,total_questions,answers,timings,session_seed,status,last_activity_at",
    limit: "1",
  });
  const res = await supabase(`valu_assessment_progress?${params}`);
  if (!res.ok) throw new Error("Could not retrieve assessment progress.");
  return (await res.json())?.[0] || null;
}

async function getProgressByResumeToken(token) {
  const params = new URLSearchParams({
    resume_token: `eq.${token}`,
    select: "id,session_id,resume_token,name,role,experience,email,current_question,total_questions,answers,timings,session_seed,status,last_activity_at",
    limit: "1",
  });
  const res = await supabase(`valu_assessment_progress?${params}`);
  if (!res.ok) throw new Error("Could not retrieve assessment progress.");
  return (await res.json())?.[0] || null;
}

async function sendReminder(row, reminderNumber) {
  if (!RESEND_API_KEY || !validEmail(row.email)) return { sent: false, reason: "email unavailable" };

  const resumeUrl = `${APP_URL}&resume=${encodeURIComponent(row.resume_token)}`;
  const remaining = Math.max(0, row.total_questions - row.current_question);
  const subject = reminderNumber === 1
    ? "Your VALU assessment is waiting for you"
    : "Continue your VALU journey";

  const html = `<!doctype html><html><body style="margin:0;background:#1A1A2E;color:#F7F4EE;font-family:Arial,sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:48px 28px">
    <div style="font-size:11px;letter-spacing:.18em;color:#C9A84C;font-weight:700">VALORIA INSTITUTE · VALU</div>
    <h1 style="font-weight:400;font-size:34px;line-height:1.15;margin:26px 0 16px">You can continue where you stopped.</h1>
    <p style="color:rgba(247,244,238,.7);font-size:15px;line-height:1.8">
      ${row.name || "Your"} VALU assessment is still in progress. Your answers have been saved, so you do not need to start again.
    </p>
    <div style="margin:28px 0;padding:20px;border:1px solid rgba(201,168,76,.22);background:rgba(201,168,76,.06);border-radius:8px">
      <div style="font-size:11px;letter-spacing:.14em;color:#C9A84C;font-weight:700">YOUR PROGRESS</div>
      <div style="font-size:26px;margin-top:8px">${row.current_question} / ${row.total_questions} questions</div>
      <div style="color:rgba(247,244,238,.55);font-size:13px;margin-top:6px">${remaining} remaining</div>
    </div>
    <a href="${resumeUrl}" style="display:inline-block;background:#C9A84C;color:#1A1A2E;text-decoration:none;font-weight:700;letter-spacing:.1em;font-size:12px;padding:16px 24px;border-radius:999px">CONTINUE MY VALU ASSESSMENT →</a>
    <p style="color:rgba(247,244,238,.35);font-size:11px;line-height:1.7;margin-top:34px">Your progress is retained as part of your Valoria journey. If you have already completed the assessment, no further action is required.</p>
  </div></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Valoria Institute <info@valoriainstitute.com>",
      to: [row.email],
      subject,
      html,
    }),
  });
  if (!res.ok) return { sent: false, status: res.status, detail: (await res.text()).slice(0, 300) };
  return { sent: true };
}

async function createNotification(row) {
  if (!row.user_id) return;
  const body = "Your VALU assessment is still in progress. Your answers are saved — continue from where you stopped.";
  const payload = {
    user_id: row.user_id,
    type: "assessment_abandoned",
    title: "Your VALU assessment is waiting",
    body,
    action_label: "Continue assessment",
    action_url: `/valu/assessment/?full=1&resume=${row.resume_token}`,
  };
  await supabase("notifications?on_conflict=user_id,type,title", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

async function runReminderSweep(req) {
  const auth = req?.headers?.get?.("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) return json({ error: "Unauthorized" }, 401);

  const now = Date.now();
  const rowsRes = await supabase("valu_assessment_progress?status=in.(in_progress,abandoned)&email=not.is.null&select=*&limit=100");
  if (!rowsRes.ok) return json({ error: "Could not load assessment progress." }, 502);
  const rows = await rowsRes.json();

  const results = [];
  for (const row of rows) {
    const ageHours = (now - new Date(row.last_activity_at).getTime()) / 3600000;
    let reminderNumber = 0;
    if (ageHours >= 72 && (row.reminder_count || 0) < 2) reminderNumber = 2;
    else if (ageHours >= 24 && (row.reminder_count || 0) < 1) reminderNumber = 1;

    if (reminderNumber) {
      const send = await sendReminder(row, reminderNumber);
      if (send.sent) {
        const patch = await supabase(`valu_assessment_progress?id=eq.${row.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ reminder_count: reminderNumber, last_reminder_at: new Date().toISOString(), status: "abandoned", abandoned_at: new Date().toISOString() }),
        });
        if (row.user_id) await createNotification(row);
        results.push({ id: row.id, reminderNumber, sent: true, patched: patch.ok });
      } else {
        results.push({ id: row.id, reminderNumber, sent: false, reason: send.reason || send.status });
      }
    } else if (ageHours >= 168) {
      const patch = await supabase(`valu_assessment_progress?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "abandoned", abandoned_at: new Date().toISOString() }),
      });
      results.push({ id: row.id, abandoned: patch.ok });
    }
  }

  return json({ ok: true, processed: rows.length, results });
}

export default async function handler(req) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Server configuration error" }, 500);

  if (req.method === "GET") {
    const auth = req?.headers?.get?.("authorization") || "";
    if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}` && !new URL(req.url).searchParams.get("resume")) {
      return runReminderSweep(req);
    }
    const token = new URL(req.url).searchParams.get("resume");
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return json({ error: "Invalid resume token." }, 400);
    try {
      const row = await getProgressByResumeToken(token);
      if (!row || row.status === "completed") return json({ error: "This assessment session is no longer resumable." }, 404);
      return json({ ok: true, progress: row });
    } catch (err) {
      return json({ error: err.message }, 502);
    }
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  if (body.action === "sweep") return runReminderSweep(req);

  const {
    action = "save",
    session_id: sessionId,
    taster_id: tasterId,
    identity_hash: identityHash,
    name,
    role,
    email,
    current_question: currentQuestion,
    total_questions: totalQuestions,
    answers,
    timings,
    session_seed: sessionSeed,
    user_id: userId,
  } = body;

  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId) || !name || !role || !Number.isInteger(currentQuestion) || !Number.isInteger(totalQuestions)) {
    return json({ error: "Invalid assessment progress payload." }, 400);
  }
  if (!identityHash || typeof identityHash !== "string") return json({ error: "Assessment identity is required." }, 400);
  if (currentQuestion < 0 || currentQuestion > totalQuestions || totalQuestions < 1 || totalQuestions > 100) return json({ error: "Invalid assessment position." }, 400);
  if (answers && typeof answers !== "object") return json({ error: "Invalid answers." }, 400);
  if (timings && !Array.isArray(timings)) return json({ error: "Invalid timings." }, 400);

  const existing = await getProgressBySession(sessionId).catch(() => null);
  const resolvedIdentity = (!email || !userId) && tasterId ? await resolveTasterIdentity(tasterId) : {};
  const resolvedUserId = userId || resolvedIdentity.user_id || null;
  const resolvedEmail = validEmail(email) ? email.trim().toLowerCase() : (validEmail(resolvedIdentity.email) ? resolvedIdentity.email.trim().toLowerCase() : null);
  const payload = {
    session_id: sessionId,
    identity_hash: identityHash,
    name: String(name).trim().slice(0, 200),
    role: String(role).trim().slice(0, 200),
    ...(body.experience ? { experience: String(body.experience).trim().slice(0, 100) } : {}),
    ...(resolvedEmail ? { email: resolvedEmail } : {}),
    ...(resolvedUserId ? { user_id: resolvedUserId } : {}),
    ...(tasterId ? { taster_id: tasterId } : {}),
    current_question: currentQuestion,
    total_questions: totalQuestions,
    answers: answers || {},
    timings: timings || [],
    session_seed: Number.isInteger(sessionSeed) ? sessionSeed : null,
    status: action === "complete" ? "completed" : "in_progress",
    last_activity_at: new Date().toISOString(),
    ...(action === "complete" ? { completed_at: new Date().toISOString(), abandoned_at: null } : {}),
  };

  if (existing) {
    const res = await supabase(`valu_assessment_progress?id=eq.${existing.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return json({ error: "Could not save assessment progress." }, 502);
    return json({ ok: true, resume_token: existing.resume_token, status: payload.status });
  }

  const res = await supabase("valu_assessment_progress", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return json({ error: "Could not create assessment progress." }, 502);
  const created = (await res.json())?.[0];
  return json({ ok: true, resume_token: created?.resume_token || null, status: payload.status });
}
