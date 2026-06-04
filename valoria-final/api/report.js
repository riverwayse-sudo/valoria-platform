export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { token } = await req.json();
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Validate token in Supabase
  const sbRes = await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/valu_assessments?report_token=eq.${token}&select=*`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  const rows = await sbRes.json();
  const row = rows?.[0];

  if (!row) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (row.token_used) {
    return new Response(
      JSON.stringify({ error: "This link has already been used. Log in to view your report." }),
      { status: 410, headers: { "Content-Type": "application/json" } }
    );
  }
  if (new Date(row.token_expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ error: "This link has expired. Log in to view your report." }),
      { status: 410, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Mark token used immediately — prevents double spend
  await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/valu_assessments?report_token=eq.${token}`,
    {
      method: "PATCH",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ token_used: true }),
    }
  );

  // 3. Build the prompt from the saved row data
  const scoreProfile = {
    name: row.name,
    role: row.role,
    valuIndex: row.total_score,
    clusterScores: row.cluster_scores,
    skillScores: row.skill_scores,
    desig: { name: row.designation },
    futureReadyScore: row.future_ready_score,
    pathway: row.pathway,
    listed: row.listed,
  };

  // Import prompt builder — inline here since edge runtime
  // This is a simplified version; replace with your full buildReportPrompt logic
  const prompt = `You are writing a personalised professional development report for ${row.name}, a ${row.role}.
Their VALU Index is ${row.total_score}/100 — ${row.designation}.
Cluster scores: ${JSON.stringify(row.cluster_scores)}.
Skill scores: ${JSON.stringify(row.skill_scores)}.

Write a direct, plain-language report covering:
## YOUR SCORE: ${row.total_score}/100 — ${row.designation?.toUpperCase()}
## WHAT YOU ARE GOOD AT
## WHERE YOU ARE LOSING GROUND  
## WHAT THIS COSTS YOU IN THE NEXT 12 MONTHS
## YOUR ONE ACTION FOR THIS WEEK
## THE PROGRAMME YOU NEED RIGHT NOW
## THE QUESTION TO SIT WITH

Be specific. Name actual skills and scores. No jargon. Max 20 words per key sentence.`;

  // 4. Stream AI report
  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!aiRes.ok) {
    // Restore token so they can try again
    await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/valu_assessments?report_token=eq.${token}`,
      {
        method: "PATCH",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ token_used: false }),
      }
    );
    return new Response("AI generation failed", { status: 500 });
  }

  // Stream directly back to browser
  return new Response(aiRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
