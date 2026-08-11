export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Redirect to Valoria Institute login after confirmation, not the assessment app
const VALORIA_SITE_URL = "https://valoriainstitute.com";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function confirmationEmailHtml(name, actionLink) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
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
        <p style="font-size:11px;color:rgba(247,244,238,0.25);margin-top:40px;">
          If you didn't request this, you can ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;
}

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const { email, password, name, role, identity_hash } = payload;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRe.test(email)) {
    return new Response(JSON.stringify({ error: "A valid email is required." }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  if (!password || password.length < 8) {
    return new Response(JSON.stringify({ error: "Password must be at least 8 characters." }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const adminHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  // Build redirect URL: go to Valoria Institute login with identity_hash as param
  // so they land on their profile/report after logging in
  const redirectUrl = identity_hash
    ? `${VALORIA_SITE_URL}/login?identity_hash=${encodeURIComponent(identity_hash)}`
    : `${VALORIA_SITE_URL}/dashboard`;

  let genRes, genData;
  try {
    genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        type: "signup",
        email,
        password,
        data: { full_name: name, role },
        options: {
          redirectTo: redirectUrl,
        },
      }),
    });
    genData = await genRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Could not reach auth service." }), {
      status: 502, headers: { "Content-Type": "application/json" },
    });
  }

  if (!genRes.ok) {
    return new Response(JSON.stringify({ error: genData.msg || genData.error_description || genData.error || "Could not create account." }), {
      status: genRes.status, headers: { "Content-Type": "application/json" },
    });
  }

  const actionLink = genData.action_link || genData.properties?.action_link;
  const userId = genData.id || genData.user?.id;

  if (!actionLink) {
    return new Response(JSON.stringify({
      warning: "Account created, but no confirmation link was returned. Contact support to resend.",
      user_id: userId,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({
      warning: "Account created, but email service is not configured. Contact support to resend confirmation.",
      user_id: userId,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Valoria Institute <hello@valoriainstitute.com>",
        to: email,
        subject: "Confirm Your Signup — Valoria Institute",
        html: confirmationEmailHtml(name || "there", actionLink),
      }),
    });
    if (!resendRes.ok) {
      const err = await resendRes.text();
      return new Response(JSON.stringify({
        warning: "Account created, but confirmation email failed to send. Contact support to resend.",
        user_id: userId,
        email_error: err,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  } catch (err) {
    return new Response(JSON.stringify({
      warning: "Account created, but confirmation email failed to send. Contact support to resend.",
      user_id: userId,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // Stitch email + confirmation-sent timestamp onto the assessment row
  // server-side, right here — not left to the client's follow-up call.
  if (identity_hash) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identity_hash}`, {
        method: "PATCH",
        headers: { ...adminHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ email, confirmation_email_sent_at: new Date().toISOString() }),
      });
    } catch (err) {
      console.error("create-account: failed to stitch email onto assessment row", err);
    }
  }

  return new Response(JSON.stringify({ success: true, user_id: userId }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}
