export const config = { runtime: "edge" };

// Decouples account creation from email delivery.
//
// The old flow called Supabase's built-in POST /auth/v1/signup, which does
// both "create the user" and "send the confirmation email" as a single
// atomic operation. When Supabase's SMTP relay (Brevo) rejects the send —
// as it has been tonight, with `535 5.7.8 Authentication failed` — the
// entire request fails and NO user is created at all, even though the
// account itself had nothing wrong with it.
//
// This endpoint splits that into two independent steps:
//   1. Create the user via the Admin API (service role key). This is a
//      pure database insert — it does not touch SMTP and cannot fail
//      because of it.
//   2. Generate a signup confirmation link via the Admin API (also no
//      email sent). We then deliver that link ourselves through Resend —
//      the same provider /api/send-email.js already uses successfully,
//      independent of Supabase's mailer and Brevo entirely.
//
// If step 2 or the email delivery fails, the account still exists — the
// user can request a fresh confirmation link (via /api/resend-confirmation,
// same pattern) without ever losing their signup.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

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

  const { email, password, name, role } = payload;
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

  // Step 1 + 2 combined: generate_link creates the user (if they don't
  // already exist) AND returns a confirmation action_link — with no email
  // sent by Supabase at any point. This is the step that used to be
  // bundled with a forced SMTP send; now it's just a database operation.
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
      }),
    });
    genData = await genRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Could not reach auth service." }), {
      status: 502, headers: { "Content-Type": "application/json" },
    });
  }

  if (!genRes.ok) {
    // Most common real case: email already registered.
    return new Response(JSON.stringify({ error: genData.msg || genData.error_description || genData.error || "Could not create account." }), {
      status: genRes.status, headers: { "Content-Type": "application/json" },
    });
  }

  const actionLink = genData.action_link || genData.properties?.action_link;
  const userId = genData.id || genData.user?.id;

  // Account now exists in auth.users regardless of what happens below.
  // If email delivery fails, the account is NOT lost — this is the whole
  // point of splitting these two steps apart.
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
      // Account still exists — this is a soft failure, not a signup failure.
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

  return new Response(JSON.stringify({ success: true, user_id: userId }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}
