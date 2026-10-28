import { privilegedWriteAllowed } from '../lib/environment-guard.js';
export const config = { runtime: "edge" };

import { checkRateLimit } from "./_rateLimit.js";
import { resolveSiteUrl } from "../lib/site-url.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Environment-specific; hardcoding production sent staging confirmations to the
// production callback.
const VALORIA_SITE_URL = resolveSiteUrl();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function confirmationEmailHtml(name, actionLink) {
  const safeName = escapeHtml(name || "there");
  const safeLink = escapeHtml(actionLink);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#F3F0E8;font-family:Arial,Helvetica,sans-serif;color:#1A1A2E">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F0E8"><tr><td align="center" style="padding:30px 14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E7E0D2">
        <tr><td style="background:#1A1A2E;padding:30px 32px"><p style="margin:0;color:#C9A84C;font-size:11px;letter-spacing:3px;font-weight:700">VALORIA INSTITUTE</p><p style="margin:8px 0 0;color:#F7F4EE;font-family:Georgia,serif;font-size:15px">Worth. Built.</p></td></tr>
        <tr><td style="padding:36px 32px 24px"><p style="margin:0 0 12px;color:#92752D;font-size:11px;letter-spacing:2px;font-weight:700">WELCOME TO VALORIA</p>
          <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;line-height:1.25;font-weight:400;color:#1A1A2E">Your next step starts here.</h1>
          <p style="font-size:15px;line-height:1.8;color:#555566">Hello ${safeName},</p><p style="font-size:15px;line-height:1.8;color:#555566">We’ve saved your VALU Index result. Confirm your email to secure your account and return to Valoria, where you can continue your journey without starting again.</p>
          <p style="margin:26px 0"><a href="${safeLink}" style="display:inline-block;padding:16px 26px;background:#C9A84C;color:#1A1A2E;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px">CONFIRM MY EMAIL &rarr;</a></p>
          <p style="font-size:12px;line-height:1.7;color:#777789">If the button does not work, copy this link into your browser:<br><a href="${safeLink}" style="color:#72591C;word-break:break-all">${safeLink}</a></p>
          <p style="border-top:1px solid #EAE5DA;padding-top:18px;font-size:12px;line-height:1.7;color:#777789">If you didn’t create this account, you can ignore this message.</p></td></tr>
        <tr><td style="background:#FAF8F3;padding:22px 32px"><p style="margin:0;font-size:11px;line-height:1.8;color:#777789">Valoria Institute · Worth. Built.<br><a href="https://valoriainstitute.com" style="color:#72591C">valoriainstitute.com</a> · <a href="mailto:info@valoriainstitute.com" style="color:#72591C">Contact support</a></p></td></tr>
      </table></td></tr></table></body></html>`;
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Service temporarily unavailable." }, 503);
  const __guard = privilegedWriteAllowed();
  if (!__guard.allowed) return json({ error: 'Write refused: this deployment is not authorised to modify this database.', detail: __guard.reason }, 503);

  const ipLimit = await checkRateLimit(req, { namespace: "confirmation-resend-ip", limit: 10, windowSeconds: 900 });
  if (!ipLimit.allowed) return ipLimit.response;

  let payload;
  try { payload = await req.json(); } catch { return json({ error: "Invalid request body" }, 400); }
  const identityHash = String(payload?.identity_hash || "").trim();
  if (!/^fp_[a-z0-9]{1,128}$/i.test(identityHash)) return json({ error: "Invalid identity reference." }, 400);

  const identityLimit = await checkRateLimit(req, { namespace: "confirmation-resend-identity", limit: 3, windowSeconds: 900, subject: identityHash });
  if (!identityLimit.allowed) return identityLimit.response;

  const adminHeaders = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
  const params = new URLSearchParams({ identity_hash: `eq.${identityHash}`, select: "name,email,user_id,confirmation_email_sent_at,report_token", limit: "1" });

  let lookupRes;
  try { lookupRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, { headers: adminHeaders }); }
  catch (err) { console.error("resend-confirmation: assessment lookup failed", err); return json({ error: "Could not process confirmation request." }, 502); }
  if (!lookupRes.ok) return json({ error: "Could not process confirmation request." }, 502);

  let rows;
  try { rows = await lookupRes.json(); } catch { return json({ error: "Could not process confirmation request." }, 502); }
  const row = rows?.[0];
  if (!row || !row.email || !row.report_token) return json({ ok: true });

  // Re-issue a signup confirmation, not a magic-link sign-in. The canonical callback
  // establishes the session and links the assessment only after email verification.
  const redirectUrl = `${VALORIA_SITE_URL}/auth/callback?identity_hash=${encodeURIComponent(identityHash)}&report_token=${encodeURIComponent(row.report_token)}`;
  // If the account is already confirmed, avoid sending another signup link.
  if (row.user_id) {
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(row.user_id)}`, { headers: adminHeaders });
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData?.user?.email_confirmed_at || userData?.email_confirmed_at) return json({ ok: true, sent: false, already_confirmed: true });
      }
    } catch { /* Continue with a generic resend attempt; do not expose account state. */ }
  }

  let actionLink = null;
  let genRes;
  try {
    genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ type: "signup", email: String(row.email).trim().toLowerCase(), redirect_to: redirectUrl }) });
    const genData = await genRes.json().catch(() => ({}));
    actionLink = genData.action_link || genData.properties?.action_link || null;
  } catch { /* Fall through to Supabase's own resend endpoint below. */ }

  let sent = false;
  if (genRes?.ok && actionLink && RESEND_API_KEY) {
    try {
      const resendRes = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` }, body: JSON.stringify({ from: "Valoria Institute <hello@valoriainstitute.com>", to: String(row.email).trim().toLowerCase(), subject: "Welcome to Valoria Institute — confirm your email", text: `Welcome to Valoria Institute.\\n\\nWe’ve saved your VALU Index result. Confirm your email to secure your account and return to Valoria.\\n\\nConfirm your email: ${actionLink}\\n\\nIf you did not create this account, ignore this message.\\n\\nValoria Institute · Worth. Built.\\nhttps://valoriainstitute.com`, html: confirmationEmailHtml(row.name || "there", actionLink) }) });
      sent = resendRes.ok;
    } catch { sent = false; }
  }

  // If an existing unconfirmed Auth user cannot be issued a fresh admin signup
  // link, fall back to Supabase's supported resend endpoint with the same canonical
  // callback. That endpoint may use the configured Supabase template rather than
  // the custom Resend design, but restores a delivery path instead of a dead end.
  if (!sent && SUPABASE_ANON_KEY) {
    try {
      const fallbackRes = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "signup", email: String(row.email).trim().toLowerCase(), options: { emailRedirectTo: redirectUrl }, redirect_to: redirectUrl }),
      });
      sent = fallbackRes.ok;
    } catch { sent = false; }
  }
  if (!sent) return json({ error: "Could not process confirmation request. Please try again later or contact Valoria support." }, 502);

  try {
    const markRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${encodeURIComponent(identityHash)}`, { method: "PATCH", headers: { ...adminHeaders, Prefer: "return=minimal" }, body: JSON.stringify({ confirmation_email_sent_at: new Date().toISOString() }) });
    if (!markRes.ok) console.error("resend-confirmation: send marker update failed", markRes.status);
  } catch { console.error("resend-confirmation: send marker update failed"); }

  return json({ ok: true, sent: true });
}
