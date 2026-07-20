export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

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
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let payload;
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }
  const { identity_hash } = payload;
  if (!identity_hash) {
    return new Response(JSON.stringify({ error: "identity_hash is required." }), { status: 400 });
  }

  const adminHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  const params = new URLSearchParams({
    identity_hash: `eq.${identity_hash}`,
    select: "name,email,confirmation_email_sent_at",
    limit: "1",
  });
  const lookupRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, { headers: adminHeaders });
  const rows = await lookupRes.json();
  const row = rows?.[0];

  if (!row) return new Response(JSON.stringify({ error: "No assessment found." }), { status: 404 });
  if (row.confirmation_email_sent_at) {
    return new Response(JSON.stringify({ ok: true, already_sent: true }), { status: 200 });
  }
  if (!row.email) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_email_on_record" }), { status: 200 });
  }

  let genRes, genData;
  try {
    genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ type: "magiclink", email: row.email }),
    });
    genData = await genRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Could not reach auth service." }), { status: 502 });
  }
  if (!genRes.ok) {
    return new Response(JSON.stringify({ error: genData.msg || genData.error || "Could not regenerate link." }), { status: genRes.status });
  }

  const actionLink = genData.action_link || genData.properties?.action_link;
  if (!actionLink) {
    return new Response(JSON.stringify({ error: "No action link returned." }), { status: 502 });
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "Valoria Institute <hello@valoriainstitute.com>",
      to: row.email,
      subject: "Confirm Your Signup — Valoria Institute",
      html: confirmationEmailHtml(row.name || "there", actionLink),
    }),
  });
  if (!resendRes.ok) {
    const err = await resendRes.text();
    return new Response(JSON.stringify({ error: "Resend failed", detail: err }), { status: 502 });
  }

  await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identity_hash}`, {
    method: "PATCH",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ confirmation_email_sent_at: new Date().toISOString() }),
  });

  return new Response(JSON.stringify({ ok: true, sent: true }), { status: 200 });
}