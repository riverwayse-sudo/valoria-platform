export const config = { runtime: "edge" };

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

  const { email, name, role, score, designation, reportText } = payload;
  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const safeReport = reportText && reportText.trim()
    ? reportText
    : `Your VALU Index is ${score}/100 — ${designation}. Your full AI report will follow shortly.`;

  // Format report as HTML
  const reportHtml = safeReport
    .split("\n")
    .map(line => {
      if (line.startsWith("## ")) return `<h2 style="font-size:18px;color:#C9A84C;margin:24px 0 8px;font-family:Georgia,serif;">${line.slice(3)}</h2>`;
      if (line.startsWith("# ")) return `<h1 style="font-size:24px;color:#F7F4EE;margin:0 0 16px;font-family:Georgia,serif;">${line.slice(2)}</h1>`;
      if (line.trim() === "") return "<br/>";
      return `<p style="font-size:14px;line-height:1.8;color:rgba(247,244,238,0.8);margin:0 0 8px;">${line}</p>`;
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
        <h1 style="font-size:28px;font-weight:300;color:#F7F4EE;margin-bottom:8px;">Welcome, ${name}.</h1>
        <p style="font-size:15px;color:rgba(247,244,238,0.5);margin-bottom:32px;">Your VALU Index assessment is complete. Here is your full AI report.</p>
        <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:24px;margin-bottom:32px;text-align:center;">
          <div style="font-size:52px;font-weight:700;color:#C9A84C;line-height:1;">${score}</div>
          <div style="font-size:11px;color:rgba(247,244,238,0.4);letter-spacing:0.12em;margin-top:6px;">VALU INDEX · OUT OF 100</div>
          <div style="font-size:15px;color:#F7F4EE;margin-top:8px;font-weight:600;">${designation}</div>
          <div style="font-size:12px;color:rgba(247,244,238,0.3);margin-top:4px;">${role}</div>
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
