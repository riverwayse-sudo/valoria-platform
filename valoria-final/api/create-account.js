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


function journeyEmailHtml(name, score, designation) {
  return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#1A1A2E;font-family:Arial,sans-serif;color:#F7F4EE;">
      <div style="max-width:600px;margin:0 auto;padding:48px 32px;">
        <div style="text-align:center;margin-bottom:36px;"><img src="https://valoriainstitute.com/logo.png" alt="Valoria Institute" style="height:42px;"></div>
        <p style="font-size:11px;letter-spacing:.18em;color:#C9A84C;font-weight:700;">VALU INDEX · ASSESSMENT COMPLETE</p>
        <h1 style="font-size:30px;line-height:1.2;font-weight:600;color:#F7F4EE;">Your Valoria journey has moved forward.</h1>
        <p style="font-size:15px;line-height:1.8;color:rgba(247,244,238,.72);">Hello ${escapeHtml(name)}, your VALU assessment is complete and your professional record has been placed in the Valoria marketplace.</p>
        <div style="margin:28px 0;padding:24px;border:1px solid rgba(201,168,76,.25);background:rgba(201,168,76,.06);border-radius:10px;text-align:center;">
          <div style="font-size:48px;font-weight:700;color:#C9A84C;">${escapeHtml(score)}</div>
          <div style="font-size:11px;letter-spacing:.14em;color:rgba(247,244,238,.55);">VALU INDEX</div>
          <div style="margin-top:8px;font-size:14px;color:#F7F4EE;">${escapeHtml(designation)}</div>
        </div>
        <h2 style="font-size:18px;color:#F7F4EE;">What happens next</h2>
        <p style="font-size:14px;line-height:1.8;color:rgba(247,244,238,.7);">1. Confirm your email address.<br>2. Complete your professional profile.<br>3. Add the capabilities you want Valoria to surface.<br>4. Your profile becomes fully actionable across the marketplace.</p>
        <div style="text-align:center;margin:34px 0;"><a href="https://valoriainstitute.com/profile/edit" style="display:inline-block;padding:15px 30px;background:#C9A84C;color:#1A1A2E;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.14em;border-radius:999px;">COMPLETE YOUR PROFILE →</a></div>
        <p style="font-size:11px;line-height:1.6;color:rgba(247,244,238,.35);text-align:center;">Valoria Institute · Worth. Built.<br>Questions? info@valoriainstitute.com</p>
      </div>
    </body></html>`;
}

function confirmationEmailHtml(name, actionLink) {
  return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#1A1A2E;font-family:Georgia,serif;color:#F7F4EE;">
      <div style="max-width:600px;margin:0 auto;padding:48px 32px;text-align:center;">
        <img src="https://valoriainstitute.com/valoria-original.png?v=20260922-4" alt="Valoria Institute" style="height:40px;margin-bottom:32px;">
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

  let assessment = null;
  if (identity_hash) {
    let assessmentRes;
    try {
      assessmentRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?select=id,name,role,email,user_id,total_score,cluster_scores,skill_scores,designation,completed_at,expires_at&identity_hash=eq.${encodeURIComponent(identity_hash)}&limit=1`, { headers: adminHeaders });
    } catch { return json({ error: "Could not verify the assessment reference." }, 502); }
    if (!assessmentRes.ok) return json({ error: "Could not verify the assessment reference." }, 502);
    const assessments = await assessmentRes.json();
    assessment = assessments?.[0] || null;
    if (!assessment || String(assessment.email || "").trim().toLowerCase() !== normalizedEmail) return json({ error: "The account details do not match the assessment." }, 403);
    if (assessment.user_id) return json({ error: "This assessment is already linked to an account." }, 409);
  }

  const redirectUrl = identity_hash ? `${VALORIA_SITE_URL}/login?identity_hash=${encodeURIComponent(identity_hash)}` : `${VALORIA_SITE_URL}/login`;
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

  let marketplaceProfileCreated = false;
  if (identity_hash && assessment) {
    try {
      // The server owns the assessment-to-marketplace handoff. The browser
      // does not receive or need a service-role key or privileged listing token.
      let userId = genData?.user?.id || null;
      if (!userId) {
        const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}&select=id&limit=1`, { headers: adminHeaders });
        if (userRes.ok) {
          const users = await userRes.json();
          userId = users?.[0]?.id || null;
        }
      }
      if (!userId) {
        console.error("create-account: application user row not available after Auth signup");
        return json({ success: true, marketplace_profile_created: false, warning: "Account created. Your VALU profile will appear after confirmation." });
      }
      const stitchRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?id=eq.${encodeURIComponent(assessment.id)}&user_id=is.null`, {
        method: "PATCH",
        headers: { ...adminHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ email: normalizedEmail, user_id: userId, confirmation_email_sent_at: new Date().toISOString() }),
      });
      if (!stitchRes.ok) {
        console.error("create-account: assessment ownership stitch failed", stitchRes.status);
        return json({ success: true, marketplace_profile_created: false, warning: "Account created, but your VALU profile needs a final sync." });
      }
      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/professional_profiles`, {
        method: "POST",
        headers: { ...adminHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          id: userId, display_name: assessment.name || name, headline: assessment.role || role,
          listing_status: "listed", profile_complete: false, visibility: "public", active_tracks: ["candidate"],
          eligible_for_listing: true, availability_status: "available", valu_index: assessment.total_score,
          cluster_scores: assessment.cluster_scores, skill_scores: assessment.skill_scores, designation: assessment.designation,
          assessment_completed_at: assessment.completed_at, assessment_expires_at: assessment.expires_at,
        }),
      });
      if (!profileRes.ok) {
        console.error("create-account: marketplace profile upsert failed", profileRes.status);
        return json({ success: true, marketplace_profile_created: false, warning: "Account created, but your VALU profile needs a final sync." });
      }
      marketplaceProfileCreated = true;

      // Completion is a first-class journey event. The unique key makes this
      // safe against retries and guarantees notification/email delivery is not duplicated.
      const journeyEventKey = "assessment.completed.marketplace";
      const eventRes = await fetch(`${SUPABASE_URL}/rest/v1/journey_events`, {
        method: "POST",
        headers: { ...adminHeaders, Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          user_id: userId,
          event_key: journeyEventKey,
          assessment_id: assessment.id,
          metadata: { score: assessment.total_score, designation: assessment.designation, listing_status: "listed" },
        }),
      });
      if (!eventRes.ok) console.error("create-account: journey event failed", eventRes.status);

      const notificationRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: "POST",
        headers: { ...adminHeaders, Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          user_id: userId,
          type: "assessment_complete",
          title: "Your VALU assessment is complete",
          body: "Your professional profile has been placed in the marketplace. Confirm your email and complete your profile to unlock the next stage.",
          action_label: "Complete your profile",
          action_url: "/profile/edit",
        }),
      });
      if (!notificationRes.ok) console.error("create-account: notification failed", notificationRes.status);

      // This is separate from the authentication email: it explains the
      // completed assessment, marketplace placement, and the next action.
      if (RESEND_API_KEY) {
        const journeyEmailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: "Valoria Institute <hello@valoriainstitute.com>",
            to: normalizedEmail,
            subject: "Your VALU Assessment Is Complete — Here's What Happens Next",
            html: journeyEmailHtml(assessment.name || name || "there", assessment.total_score, assessment.designation),
          }),
        });
        if (!journeyEmailRes.ok) console.error("create-account: journey email failed", journeyEmailRes.status);
      }
    } catch (err) {
      console.error("create-account: marketplace sync failed", err);
      return json({ success: true, marketplace_profile_created: false, warning: "Account created, but your VALU profile needs a final sync." });
    }
  }

  return json({ success: true, marketplace_profile_created: marketplaceProfileCreated });
}
