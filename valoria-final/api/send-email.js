export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { email, name, role, score, designation, identity_hash } =
    await req.json();

  if (!email || !identity_hash) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Fetch the report token from Supabase for this identity
  const sbRes = await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${encodeURIComponent(identity_hash)}&order=completed_at.desc&limit=1&select=report_token,total_score,designation`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  const rows = await sbRes.json();
  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ error: "Assessment not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { report_token } = rows[0];
  const reportUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/report?token=${report_token}`;

  // 2. Send welcome email with token link — NO AI generation here
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0F0F1A;font-family:Georgia,serif;color:#F7F4EE;">
      <div style="max-width:600px;margin:0 auto;padding:48px 32px;">
        <div style="text-align:center;margin-bottom:40px;">
          <img src="https://cdn.prod.website-files.com/6809df2885d0286c1f1a6e79/680adbd23a5c0f3fbb885162_relume-885162.png"
               alt="Valoria Institute" style="height:40px;">
        </div>
        <h1 style="font-size:28px;font-weight:300;color:#F7F4EE;margin-bottom:8px;">
          Welcome, ${name}.
        </h1>
        <p style="font-size:15px;color:rgba(247,244,238,0.5);margin-bottom:32px;">
          Your VALU Index assessment is complete.
        </p>
        <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);
                    border-radius:8px;padding:24px;margin-bottom:32px;text-align:center;">
          <div style="font-size:52px;font-weight:700;color:#C9A84C;line-height:1;">${score}</div>
          <div style="font-size:11px;color:rgba(247,244,238,0.4);letter-spacing:0.12em;margin-top:6px;">
            VALU INDEX · OUT OF 100
          </div>
          <div style="font-size:15px;color:#F7F4EE;margin-top:8px;font-weight:600;">${designation}</div>
          <div style="font-size:12px;color:rgba(247,244,238,0.3);margin-top:4px;">${role}</div>
        </div>
        <p style="font-size:15px;line-height:1.8;color:rgba(247,244,238,0.7);margin-bottom:32px;">
          Your full AI-powered report is ready. It names exactly where your capability
          gaps are, what they are costing you right now, and what to do about it.
        </p>
        <div style="text-align:center;margin-bottom:40px;">
          <a href="${reportUrl}"
             style="display:inline-block;padding:16px 36px;background:#C9A84C;color:#1A1A2E;
                    text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.16em;
                    border-radius:4px;">
            READ YOUR FULL REPORT →
          </a>
        </div>
        <p style="font-size:12px;color:rgba(247,244,238,0.25);line-height:1.7;margin-bottom:32px;">
          This link works once and expires in 24 hours.
          After that, log in to your Valoria account to access your report.
        </p>
        <p style="font-size:11px;color:rgba(247,244,238,0.2);text-align:center;
                  border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
          Valoria Institute · Africa's Professional Capability Index<br>
          Questions? hello@valoriainstitute.com
        </p>
      </div>
    </body>
    </html>
  `;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
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
    return new Response(JSON.stringify({ error: err }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
