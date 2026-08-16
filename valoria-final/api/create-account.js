export const config = { runtime: "edge" };

import { checkRateLimit } from "./_rateLimit.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const VALORIA_SITE_URL = "https://valoriainstitute.com";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function confirmationEmailHtml(name, actionLink) {
  return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0F0F1A;font-family:Georgia,serif;color:#F7F4EE;">
      <div style="max-width:600px;margin:0 auto;padding:48px 32px;text-align:center;">
        <img src="https://valoriainstitute.com/logo.png" alt="Valoria Institute" style="height:40px;margin-bottom:32px;">
        <h1 style="font-size:26px;font-weight:300;color:#F7F4EE;margin-bottom:12px;">Confirm your email, ${escapeHtml(name)}.</h1>
        <p style="font-size:14px;line-height:1.7;color:rgba(247,244,238,0.6);margin-bottom:32px;">Click below to confirm your address and unlock your VALU Index report.</p>
        <a href="${actionLink}" style="display:inline-block;padding:16px 36px;background:#C9A84C;color:#1A1A2E;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.16em;border-radius:9999px;">CONFIRM EMAIL &rarr;</a>
        <p style="font-size:11px;color:rgba(247,244,238,0.25);margin-top:40px;">If you didn't request this, you can ignore this email.</p>
      </div>
    </body></html>`;
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const ipLimit = await checkRateLimit(req, { namespace: "account-create-ip", limit: 5, windowSeconds: 3600 });
  if (!ipLimit.allowed) return ipLimit.response;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Server misconfigured." }, 500);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: "Invalid request body" }, 400); }

  const { email, password, name, role, identity_hash } = payload;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRe.test(email)) return json({ error: "A valid email is required." }, 400);
  const normalizedEmail = email.trim().toLowerCase();
  const emailLimit = await checkRateLimit(req, { namespace: "account-create-email", limit: 3, windowSeconds: 3600, subject: normalizedEmail });
  if (!emailLimit.allowed) return emailLimit.response;
  if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) return json({ error: "Password must be 8–128 characters." }, 400);
  if (identity_hash !== undefined && identity_hash !== null && (typeof identity_hash !== "string" || !/^fp_[a-f0-9]{16,128}$/i.test(identity_hash))) return json({ error: "Invalid identity reference." }, 400);

  const adminHeaders = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };

  if (identity_hash) {
    let assessmentRes;
    try {
      assessmentRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?select=id,email,user_id&identity_hash=eq.${encodeURIComponent(identity_hash)}&limit=1`, { headers: adminHeaders });
    } catch { return json({ error: "Could not verify the assessment reference." }, 502); }
    if (!assessmentRes.ok) return json({ error: "Could not verify the assessment reference." }, 502);
    const assessments = await assessmentRes.json();
    const assessment = assessments?.[0];
    if (!assessment || String(assessment.email || "").trim().toLowerCase() !== normalizedEmail) return json({ error: "The account details do not match the assessment." }, 403);
    if (assessment.user_id) return json({ error: "This assessment is already linked to an account." }, 409);
  }

  const redirectUrl = identity_hash ? `${VALORIA_SITE_URL}/login?identity_hash=${encodeURIComponent(identity_hash)}` : `${VALORIA_SITE_URL}/dashboard`;
  let genRes, genData;
  try {
    genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ type: "signup", email: normalizedEmail, password, data: { full_name: name, role }, options: { redirectTo: redirectUrl } }),
    });
    genData = await genRes.json();
  } catch { return json({ error: "Could not reach auth service." }, 502); }
  if (!genRes.ok) return json({ error: "Could not create account." }, genRes.status >= 400 && genRes.status < 500 ? genRes.status : 502);

  const actionLink = genData.action_link || genData.properties?.action_link;
  if (!actionLink) return json({ warning: "Account created, but confirmation email could not be prepared. Contact support to resend." });
  if (!RESEND_API_KEY) return json({ warning: "Account created, but email service is not configured. Contact support to resend confirmation." });

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: "Valoria Institute <hello@valoriainstitute.com>", to: normalizedEmail, subject: "Confirm Your Signup — Valoria Institute", html: confirmationEmailHtml(name || "there", actionLink) }),
    });
    if (!resendRes.ok) return json({ warning: "Account created, but confirmation email failed to send. Contact support to resend." });
  } catch { return json({ warning: "Account created, but confirmation email failed to send. Contact support to resend." }); }

  if (identity_hash) {
    try {
      const stitchRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${encodeURIComponent(identity_hash)}&user_id=is.null`, {
        method: "PATCH", headers: { ...adminHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ email: normalizedEmail, confirmation_email_sent_at: new Date().toISOString() }),
      });
      if (!stitchRes.ok) console.error("create-account: assessment stitch failed", stitchRes.status);
    } catch { console.error("create-account: assessment stitch failed"); }
  }

  return json({ success: true });
}
