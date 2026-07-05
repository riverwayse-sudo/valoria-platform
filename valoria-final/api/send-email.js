export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// HTML-escape any string interpolated into the email template. Without this,
// name/role/reportText were being dropped into the outbound HTML verbatim —
// meaning anyone calling this endpoint directly could inject arbitrary HTML
// into an email sent "from" our own domain to any address they supplied.
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Look up the real, server-computed score/designation for this identity
// instead of trusting whatever the client's request body says. This also
// doubles as the auth check: this endpoint sends email "from" our domain,
// so it must only fire for a real completed assessment.
async function getStoredAssessment(identityHash) {
  if (!identityHash || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const params = new URLSearchParams({
      identity_hash: `eq.${identityHash}`,
      select: "total_score,designation,name,role",
      limit: "1",
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

// Sends the completed VALU Index report by email.
// The AI report is generated separately (streamed via /api/report) and passed
// in as `reportText` — this function only formats and delivers it, which keeps
// it well within the edge runtime time budget.
export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const { email, reportText, identity_hash } = payload;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRe.test(email)) {
    return new Response(JSON.stringify({ error: "A valid email is required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const stored = await getStoredAssessment(identity_hash);
  if (!stored) {
    return new Response(JSON.stringify({ error: "No completed assessment found for this request." }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }
  const name = stored.name;
  const role = stored.role;
  const score = stored.total_score;
  const designation = stored.designation;

  const rawReport = reportText && reportText.trim()
    ? reportText
    : `Your VALU Index is ${score}/100 — ${designation}. Your full AI report will follow shortly.`;

  // Format report as HTML — escape every line's text content first.
  const reportHtml = rawReport
    .split("\n")
    .map(line => {
      if (line.startsWith("## ")) return `<h2 style="font-size:18px;color:#C9A84C;margin:24px 0 8px;font-family:Georgia,serif;">${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("# ")) return `<h1 style="font-size:24px;color:#F7F4EE;margin:0 0 16px;font-family:Georgia,serif;">${escapeHtml(line.slice(2))}</h1>`;
      if (line.trim() === "") return "<br/>";
      return `<p style="font-size:14px;line-height:1.8;color:rgba(247,244,238,0.8);margin:0 0 8px;">${escapeHtml(line)}</p>`;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0F0F1A;font-family:Georgia,serif;color:#F7F4EE;">
      <div style="max-width:600px;margin:0 auto;padding:48px 32px;">
        <div style="text-align:center;margin-bottom:40px;">
          <img src="https://valoriainstitute.com/logo.png" alt="Valoria Institute" style="height:40px;">
        </div>
        <h1 style="font-size:28px;font-weight:300;color:#F7F4EE;margin-bottom:8px;">Welcome, ${escapeHtml(name)}.</h1>
        <p style="font-size:15px;color:rgba(247,244,238,0.5);margin-bottom:32px;">Your VALU Index assessment is complete. Here is your full AI report.</p>
        <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:24px;margin-bottom:32px;text-align:center;">
          <div style="font-size:52px;font-weight:700;color:#C9A84C;line-height:1;">${escapeHtml(score)}</div>
          <div style="font-size:11px;color:rgba(247,244,238,0.4);letter-spacing:0.12em;margin-top:6px;">VALU INDEX · OUT OF 100</div>
          <div style="font-size:15px;color:#F7F4EE;margin-top:8px;font-weight:600;">${escapeHtml(designation)}</div>
          <div style="font-size:12px;color:rgba(247,244,238,0.3);margin-top:4px;">${escapeHtml(role)}</div>
        </div>
        <div style="background:#1A1A2E;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:28px;margin-bottom:32px;">
          ${reportHtml}
        </div>
        <div style="text-align:center;margin-bottom:40px;">
          <a href="https://valoriainstitute.com/profile/edit" style="display:inline-block;padding:16px 36px;background:#C9A84C;color:#1A1A2E;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.16em;border-radius:9999px;">COMPLETE YOUR PROFILE &rarr;</a>
        </div>
        <p style="font-size:11px;color:rgba(247,244,238,0.2);text-align:center;border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
          Valoria Institute &middot; Africa's Professional Capability Index<br>
          Questions? info@valoriainstitute.com
        </p>
      </div>
    </body>
    </html>
  `;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Valoria Institute <hello@valoriainstitute.com>",
      to: email,
      subject: `Your VALU Index Report — ${score}/100 · ${designation}`,
      html,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
