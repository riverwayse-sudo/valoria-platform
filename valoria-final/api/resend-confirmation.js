export const config = { runtime: "edge" };

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
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0F0F1A;font-family:Georgia,serif;color:#F7F4EE;">
      <div style="max-width:600px;margin:0 auto;padding:48px 32px;text-align:center;">
        <img src="https://valoriainstitute.com/logo.png" alt="Valoria Institute" style="height:40px;margin-bottom:32px;">
        <h1 style="font-size:26px;font-weight:300;color:#F7F4EE;margin-bottom:12px;">Confirm your email, ${escapeHtml(name)}.</h1>
        <p style="font-size:14px;line-height:1.7;color:rgba(247,244,238,0.6);margin-bottom:32px;">
          Click below to confirm your address and unlock your VALU Index report.
        </p>
        <a href="${actionLink}" style="display:inline-block;padding:16px 36px;background:#C9A84C;color:#1A1A2E;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.16em;border-radius:9999px;">
          CONFIRM EMAIL &rarr;
        </a>
      </div>
    </body>
    </html>
  `;
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    console.error("resend-confirmation: missing server configuration");
    return json({ error: "Service temporarily unavailable." }, 503);
  }

  let payload;
  try { payload = await req.json(); } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const identityHash = String(payload?.identity_hash || "").trim();
  if (!/^fp_[a-f0-9]{16,128}$/i.test(identityHash)) {
    return json({ error: "Invalid identity reference." }, 400);
  }

  const adminHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  const params = new URLSearchParams({
    identity_hash: `eq.${identityHash}`,
    select: "name,email,confirmation_email_sent_at",
    limit: "1",
  });

  let lookupRes;
  try {
    lookupRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, { headers: adminHeaders });
  } catch (err) {
    console.error("resend-confirmation: assessment lookup failed", err);
    return json({ error: "Could not process confirmation request." }, 502);
  }

  if (!lookupRes.ok) {
    console.error("resend-confirmation: assessment lookup failed", lookupRes.status);
    return json({ error: "Could not process confirmation request." }, 502);
  }

  let rows;
  try { rows = await lookupRes.json(); } catch {
    return json({ error: "Could not process confirmation request." }, 502);
  }

  const row = rows?.[0];
  if (!row) return json({ ok: true });
  if (row.confirmation_email_sent_at || !row.email) return json({ ok: true });

  const redirectUrl = `${VALORIA_SITE_URL}/login?identity_hash=${encodeURIComponent(identityHash)}`;

  let genRes, genData;
  try {
    genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        type: "magiclink",
        email: String(row.email).trim().toLowerCase(),
        options: { redirectTo: redirectUrl },
      }),
    });
    genData = await genRes.json();
  } catch (err) {
    console.error("resend-confirmation: auth link generation failed", err);
    return json({ error: "Could not process confirmation request." }, 502);
  }

  if (!genRes.ok) {
    console.error("resend-confirmation: auth link generation failed", genRes.status);
    return json({ error: "Could not process confirmation request." }, 502);
  }

  const actionLink = genData.action_link || genData.properties?.action_link;
  if (!actionLink) {
    console.error("resend-confirmation: no action link returned");
    return json({ error: "Could not process confirmation request." }, 502);
  }

  let resendRes;
  try {
    resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "Valoria Institute <hello@valoriainstitute.com>",
        to: String(row.email).trim().toLowerCase(),
        subject: "Confirm Your Signup — Valoria Institute",
        html: confirmationEmailHtml(row.name || "there", actionLink),
      }),
    });
  } catch (err) {
    console.error("resend-confirmation: email delivery failed", err);
    return json({ error: "Could not process confirmation request." }, 502);
  }

  if (!resendRes.ok) {
    console.error("resend-confirmation: email delivery failed", resendRes.status);
    return json({ error: "Could not process confirmation request." }, 502);
  }

  try {
    const markRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${encodeURIComponent(identityHash)}&confirmation_email_sent_at=is.null`, {
      method: "PATCH",
      headers: { ...adminHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ confirmation_email_sent_at: new Date().toISOString() }),
    });
    if (!markRes.ok) console.error("resend-confirmation: send marker update failed", markRes.status);
  } catch (err) {
    console.error("resend-confirmation: send marker update failed", err);
  }

  return json({ ok: true, sent: true });
}
