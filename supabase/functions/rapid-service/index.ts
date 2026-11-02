// supabase/functions/send-welcome-email/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")?.default ?? "" } catch { return "" } })();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function deriveTier(score: number | null): string {
  if (score === null || score === undefined) return "Assessment Follow-up";
  if (score >= 80) return "Force to Align With";
  if (score >= 65) return "Emerging Force";
  if (score >= 50) return "Developing Professional";
  if (score >= 35) return "Building Foundations";
  return "Assessment Follow-up";
}

function getNextSteps(score: number | null, designation: string): string {
  if (score === null) {
    return `
      <li>Complete your VALU Index assessment to receive your official points score.</li>
      <li>Return to your dashboard to continue your professional profile.</li>
      <li>Marketplace visibility follows the full assessment, profile and capability eligibility checks.</li>
    `;
  }
  if (score >= 80) {
    return `
      <li>Your merit designation is <strong>Force to Align With</strong>. Complete your professional profile and capability details.</li>
      <li>Marketplace visibility is subject to the Institute's profile, assessment and capability eligibility checks.</li>
      <li>Use your PRIME dimension results to identify where to sustain and extend your professional strength.</li>
    `;
  }
  if (score >= 65) {
    return `
      <li>Your merit designation is <strong>Emerging Force</strong>. Strengthen the evidence behind your professional capabilities.</li>
      <li>Complete your professional profile and selected capability details for eligibility review.</li>
      <li>Use your PRIME results to identify the next development priority.</li>
    `;
  }
  if (score >= 50) {
    return `
      <li>Your merit designation is <strong>Developing Professional</strong>. Identify the dimensions where focused development will matter most.</li>
      <li>Complete your professional profile and capability details before marketplace eligibility can be assessed.</li>
      <li>Explore PRIME-aligned development opportunities that address your priority areas.</li>
    `;
  }
  if (score >= 35) {
    return `
      <li>Your merit designation is <strong>Building Foundations</strong>. Review your PRIME dimension results and select a development priority.</li>
      <li>Complete your professional profile and capability details. A score of 35 points is only one marketplace eligibility condition.</li>
      <li>Marketplace listing is confirmed only after all required checks are satisfied.</li>
    `;
  }
  return `
    <li>Your assessment is recorded. Your current score does not meet the 35-point marketplace score threshold.</li>
    <li>Review your PRIME dimension results and choose a focused development priority.</li>
    <li>Continue developing your professional evidence before your next assessment.</li>
  `;
}

function dimensionRow(label: string, score: number | null): string {
  if (score === null || score === undefined) return "";
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 75 ? "#C9A84C" : pct >= 55 ? "#9B8A5A" : "#5a5a6e";
  return `
    <tr>
      <td style="padding:6px 0; font-size:12px; color:#aaa; width:130px; font-family:'Arial',sans-serif; letter-spacing:0.05em; text-transform:uppercase;">${label}</td>
      <td style="padding:6px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#1e1e30; border-radius:3px; height:8px; overflow:hidden;">
              <div style="width:${pct}%; background:${color}; height:8px; border-radius:3px;"></div>
            </td>
          </tr>
        </table>
      </td>
      <td style="padding:6px 0 6px 8px; font-size:13px; color:#F7F4EE; font-weight:700; white-space:nowrap; font-family:'Arial',sans-serif;">${pct}</td>
    </tr>
  `;
}

function buildEmailHtml(params: {
  firstName: string;
  email: string;
  score: number | null;
  tier: string;
  dimensions: Record<string, number> | null;
}): string {
  const { firstName, score, tier, dimensions } = params;
  const scoreDisplay = score !== null ? `${score}` : "—";
  const nextSteps = getNextSteps(score, tier);

  const DIMENSION_LABELS: Record<string, string> = {
    presence: "Presence",
    relationships: "Relationships",
    intelligence: "Intelligence",
    mastery: "Mastery",
    enterprise: "Enterprise",
  };

  let dimensionHtml = "";
  if (dimensions && typeof dimensions === "object") {
    const rows = Object.entries(DIMENSION_LABELS)
      .map(([key, label]) => dimensionRow(label, dimensions[key] ?? null))
      .filter(Boolean)
      .join("");
    if (rows) {
      dimensionHtml = `
        <tr><td style="padding:32px 0 16px;">
          <p style="margin:0 0 16px; font-size:11px; font-weight:700; color:#C9A84C; letter-spacing:3px; text-transform:uppercase; font-family:'Arial',sans-serif;">Your PRIME Dimension Breakdown</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
        </td>
      </tr>
      `;
    }
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your VALU Index Results — Valoria Institute</title>
</head>
<body style="margin:0; padding:0; background:#0F0F1A; font-family:'Arial',Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0F0F1A; padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#13131f; border-radius:8px; overflow:hidden; border:1px solid rgba(201,168,76,0.15);">
        <tr><td style="background:#C9A84C; height:4px; font-size:0; line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:40px 48px 32px; border-bottom:1px solid rgba(255,255,255,0.06);">
          <img src="https://cdn.prod.website-files.com/69dc1aa64e9486349988bac7/69dc1c27ba1412845b48c9e6_relume-885162.png" alt="Valoria Institute" width="140" style="display:block; margin-bottom:28px;">
          <p style="margin:0 0 4px; font-size:11px; font-weight:700; color:#C9A84C; letter-spacing:3px; text-transform:uppercase;">VALU INDEX RESULTS</p>
          <h1 style="margin:0; font-size:28px; font-weight:800; color:#F7F4EE; line-height:1.2;">${score !== null ? "Your score is in." : "Welcome to Valoria."}</h1>
        </td></tr>
        <tr><td style="padding:0 48px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:32px 0 0;">
              <p style="margin:0; font-size:15px; color:rgba(247,244,238,0.75); line-height:1.7;">Hi ${firstName},</p>
              <p style="margin:16px 0 0; font-size:15px; color:rgba(247,244,238,0.75); line-height:1.7;">${score !== null ? `Thank you for completing the <strong style="color:#F7F4EE;">VALU Index</strong>. Your results have been recorded and your verified profile is now active on the Valoria marketplace.` : `Thank you for joining <strong style="color:#F7F4EE;">Valoria Institute</strong>. You're one step away from your verified professional standard.`}</p>
            </td></tr>
            ${score !== null ? `
            <tr><td style="padding:28px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(201,168,76,0.06); border:1px solid rgba(201,168,76,0.2); border-radius:6px;">
                <tr>
                  <td style="padding:28px 32px; text-align:center; border-right:1px solid rgba(201,168,76,0.15); width:50%;">
                    <p style="margin:0 0 4px; font-size:10px; font-weight:700; color:#C9A84C; letter-spacing:2px; text-transform:uppercase;">VALU Score</p>
                    <p style="margin:0; font-size:52px; font-weight:800; color:#F7F4EE; line-height:1;">${scoreDisplay}</p>
                    <p style="margin:4px 0 0; font-size:11px; color:rgba(247,244,238,0.35);">points</p>
                  </td>
                  <td style="padding:28px 32px; text-align:center; width:50%;">
                    <p style="margin:0 0 4px; font-size:10px; font-weight:700; color:#C9A84C; letter-spacing:2px; text-transform:uppercase;">Merit designation</p>
                    <p style="margin:0; font-size:28px; font-weight:800; color:#C9A84C; line-height:1;">${tier}</p>
                    <p style="margin:4px 0 0; font-size:11px; color:rgba(247,244,238,0.35);">Valoria Standard</p>
                  </td>
                </tr>
              </table>
            </td></tr>
            ` : ""}
            ${dimensionHtml}
            <tr><td style="padding:8px 0;"><div style="height:1px; background:rgba(255,255,255,0.06);"></div></td></tr>
            <tr><td style="padding:24px 0 0;">
              <p style="margin:0 0 16px; font-size:11px; font-weight:700; color:#C9A84C; letter-spacing:3px; text-transform:uppercase;">What Happens Next</p>
              <ul style="margin:0; padding:0 0 0 18px; color:rgba(247,244,238,0.75); font-size:14px; line-height:1.9;">${nextSteps}</ul>
            </td></tr>
            <tr><td style="padding:32px 0;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr><td style="background:#C9A84C; border-radius:4px;">
                  <a href="${score !== null ? 'https://valoriainstitute.com/profile' : 'https://valoriainstitute.com/'}" style="display:inline-block; padding:14px 28px; font-size:11px; font-weight:800; color:#0a0a0a; text-decoration:none; letter-spacing:2px; text-transform:uppercase;">${score !== null ? "View My Profile" : "Complete My Assessment"}</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 48px; background:#07070F; border-top:1px solid rgba(201,168,76,0.1);">
          <p style="margin:0; font-size:12px; color:rgba(247,244,238,0.2); line-height:1.7;">&copy; 2026 African Talent Bureau Ltd &middot; Valoria Institute is a trading name &middot; Lagos, Nigeria</p>
          <p style="margin:8px 0 0; font-size:11px; font-style:italic; color:rgba(201,168,76,0.3);">Worth, Built.</p>
        </td></tr>
      </table>
    </td><tr>
  </table>
</body>
</html>
  `.trim();
}

function buildEmailText(params: { firstName: string; score: number | null; tier: string }): string {
  const { firstName, score, tier } = params;
  return [
    `Hi ${firstName},`,
    "",
    score !== null ? `Your VALU Index results are in.\n\nScore: ${score} points  |  Merit designation: ${tier}` : "Welcome to Valoria Institute. Complete your VALU Index to receive your verified score.",
    "",
    "View your profile: https://valoriainstitute.com/profile",
    "",
    "Worth, Built.",
    "Valoria Institute — Lagos, Nigeria",
  ].join("\n");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
  const authorization = req.headers.get("authorization") ?? "";
  if (!SERVICE_ROLE_KEY || authorization !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  let body: { email?: string; first_name?: string; score?: number | null; tier?: string | null; dimensions?: Record<string, number> | null };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }); }
  const { email, first_name, score = null, dimensions = null } = body;
  let { tier = null } = body;
  if (!email) { return new Response(JSON.stringify({ error: "email is required" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }); }
  const firstName = first_name || "Professional";
  const resolvedTier = tier || deriveTier(score ?? null);
  const htmlContent = buildEmailHtml({ firstName, email, score: score ?? null, tier: resolvedTier, dimensions: dimensions ?? null });
  const textContent = buildEmailText({ firstName, score: score ?? null, tier: resolvedTier });
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "hello@valoriainstitute.com";
  const REPLY_TO = Deno.env.get("REPLY_TO_EMAIL") || "support@valoriainstitute.com";
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not set");
    return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
  const subject = score !== null ? `Your VALU Index results — ${resolvedTier} tier (${score} points)` : "Welcome to Valoria Institute — complete your VALU assessment";
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [email], reply_to: REPLY_TO, subject, html: htmlContent, text: textContent }),
  });
  if (!resendResponse.ok) {
    const errText = await resendResponse.text();
    console.error("Resend error:", errText);
    return new Response(JSON.stringify({ error: "Email delivery failed", detail: errText }), { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
  const resendData = await resendResponse.json();
  return new Response(JSON.stringify({ success: true, id: resendData.id }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
});