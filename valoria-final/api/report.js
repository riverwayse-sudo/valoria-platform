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

  // 3. Build prompt from saved row data
  const clusterScores = row.cluster_scores || {};
  const skillScores = row.skill_scores || {};

  const CLUSTERS_ORDER = ["P","R","I","M","E"];
  const CLUSTER_NAMES = { P:"Presence", R:"Relationships", I:"Intelligence", M:"Mastery", E:"Enterprise" };
  const SKILL_CLUSTER = {
    "Communication":"P","Negotiation":"P","Personal Brand & Executive Presence":"P",
    "Emotional Intelligence":"R","Conflict Resolution":"R","People Development":"R","Stakeholder Management":"R",
    "Critical Thinking":"I","Strategic Thinking":"I","Business Acumen":"I","Managing Ambiguity":"I","AI Fluency":"I",
    "Execution & Accountability":"M","Resilience & Self-Leadership":"M","Adaptability":"M",
    "Commercial Creativity":"E","Influence Without Authority":"E","Human-AI Collaboration":"E",
  };

  const sortedSkills = Object.entries(skillScores)
    .sort(([,a],[,b]) => b - a);
  const topSkills = sortedSkills.slice(0,3);
  const bottomSkills = sortedSkills.slice(-3).reverse();

  const sortedClusters = CLUSTERS_ORDER
    .map(id => ({ id, score: clusterScores[id] || 0 }))
    .sort((a,b) => b.score - a.score);
  const strongest = sortedClusters[0];
  const weakest = sortedClusters[sortedClusters.length - 1];

  const weakestClusterSkills = sortedSkills
    .filter(([s]) => SKILL_CLUSTER[s] === weakest.id)
    .sort(([,a],[,b]) => a - b);
  const primaryGapSkill = weakestClusterSkills[0]?.[0] || bottomSkills[0]?.[0];
  const secondaryGapSkill = weakestClusterSkills[1]?.[0] || bottomSkills[1]?.[0];

  const clusterSkillDetail = CLUSTERS_ORDER.map(id => {
    const skills = sortedSkills.filter(([s]) => SKILL_CLUSTER[s] === id);
    return `${CLUSTER_NAMES[id]} (${clusterScores[id] || 0}/100):\n` +
      skills.map(([s,sc]) => `  - ${s}: ${sc}/100`).join("\n");
  }).join("\n\n");

  const SKILL_ACTIONS = {
    "Communication": "Before your next important meeting, write down the one thing you need the room to leave believing — and build backwards from that, not from your slide order.",
    "Negotiation": "Before your next salary, contract, or vendor conversation, write down your walk-away position before you write down your opening ask.",
    "Personal Brand & Executive Presence": "Google yourself right now. What you find is what a hiring manager finds. Decide in the next 48 hours whether that is the profile you want representing you.",
    "Emotional Intelligence": "After your next meeting that frustrates you, write one sentence naming what you felt and one sentence naming what triggered it. Do this for two weeks.",
    "Conflict Resolution": "Name one unresolved tension in your team right now. Decide by end of week whether you are going to address it or not. Indecision is a decision.",
    "People Development": "Think of the person on your team with the most unrealised potential. Write down exactly what is blocking them. If you cannot name it precisely, that is the problem.",
    "Stakeholder Management": "Map the five people whose support or opposition most affects your current priority project. Next to each name, write whether they are aligned, neutral, or resistant.",
    "Critical Thinking": "The next time someone presents data to support a recommendation you are inclined to agree with, force yourself to ask: what would have to be true for this to be wrong?",
    "Strategic Thinking": "Take the most important task on your plate right now. Write down what it enables or prevents — not just what it delivers.",
    "Business Acumen": "Without looking anything up, write down how your organisation makes money, what the biggest cost is, and where the margin is actually generated.",
    "Managing Ambiguity": "Write down the most uncertain situation you are currently operating in. Then write the three things you know for certain, the two things you are assuming, and the one decision you can make today.",
    "AI Fluency": "List three tasks you did this week that took more than an hour. For each one, ask: could AI have done 80% of this in ten minutes?",
    "Execution & Accountability": "List every commitment you have made in the last 30 days that is not yet complete. Put a date next to each one. If any are past due, contact the person it affects today.",
    "Resilience & Self-Leadership": "Name the last setback that knocked you off your game for more than a day. Write down what specifically about it affected you — not the event, but the belief the event triggered.",
    "Adaptability": "Think of the last significant change at work you resisted. Write down what you were protecting.",
    "Commercial Creativity": "Look at your current role and write down one thing you could propose in the next 30 days that would either save money, make money, or create an advantage.",
    "Influence Without Authority": "Name one thing you need to move forward that requires someone else's cooperation — someone who does not report to you. Have you started that conversation?",
    "Human-AI Collaboration": "Pick one routine deliverable from your job. Use AI to produce a first draft this week. Your job is then to make it better. Notice where you add value and where you do not.",
  };

  const PRIME_PROGRAMMES = {
    sprint: { name:"PRIME Sprint", duration:"1 day", price:"₦150,000–₦300,000" },
    cluster: { name:"PRIME Cluster Programme", duration:"6 weeks", price:"₦500,000–₦1,200,000" },
    pcp: { name:"PRIME Certified Professional (PCP)", duration:"6 months", price:"₦200,000–₦400,000" },
    executive: { name:"Executive Immersion", duration:"3 days residential", price:"₦800,000–₦2,000,000" },
  };

  const SKILL_PROGRAMME_MAP = {
    "AI Fluency":"sprint","Human-AI Collaboration":"sprint",
  };
  const programmeKey = SKILL_PROGRAMME_MAP[primaryGapSkill] || "cluster";
  const programme = PRIME_PROGRAMMES[programmeKey];
  const listed = (row.total_score || 0) >= 35;

  const prompt = `You are writing a personalised professional development report for ${row.name}, a ${row.role} who just completed the VALU Index assessment.

YOUR WRITING RULES — follow these exactly:
1. Write like a trusted senior colleague who tells the truth — not a consultant, not a coach, not a wellness app.
2. Use plain, direct language. If a 12-year-old could not understand a word, replace it.
3. NEVER use: journey, leverage (as verb), holistic, impactful, synergy, empower, transformative, game-changer, paradigm, unlock, actionable.
4. Be specific. Name the actual skill. Name the actual consequence. Name the actual programme.
5. Short sentences. Maximum 20 words per sentence for the most important points.
6. No padding. Every sentence must earn its place.
7. Do not praise them for completing the assessment.
8. Speak directly to them as "you."

THEIR SCORE DATA:
VALU Index: ${row.total_score}/100 — ${row.designation}
Listed on platform: ${listed ? "Yes" : "No — needs score of 35+"}

SKILL SCORES:
${clusterSkillDetail}

THEIR STRONGEST SKILLS: ${topSkills.map(([s,sc]) => `${s} (${sc}/100)`).join(", ")}
THEIR WEAKEST SKILLS: ${bottomSkills.map(([s,sc]) => `${s} (${sc}/100)`).join(", ")}
PRIMARY GAP SKILL: ${primaryGapSkill} (${skillScores[primaryGapSkill]}/100)
SECONDARY GAP SKILL: ${secondaryGapSkill} (${skillScores[secondaryGapSkill]}/100)

RECOMMENDED PROGRAMME: ${programme.name} (${programme.duration}, ${programme.price})

IMMEDIATE WEEKLY ACTION for ${primaryGapSkill}:
"${SKILL_ACTIONS[primaryGapSkill] || "Name the exact gap in your own words — what specifically do you not yet do well, and what does that cost you right now?"}"

VALORIA'S PROGRAMME MENU:
- PRIME Sprint: 1 day, ₦150K–₦300K — best for one urgent cluster, fastest path to listing
- PRIME Cluster Programme: 6 weeks, ₦500K–₦1.2M — deep work on one cluster
- PRIME Certified Professional (PCP): 6 months, ₦200K–₦400K — full certification, all clusters
- Executive Immersion: 3 days residential, ₦800K–₦2M — for C-suite, all clusters, time-compressed

${!listed ? `IMPORTANT: ${row.name} scored ${row.total_score}/100 which is below the 35-point listing minimum. The PRIME Sprint is the direct path to getting listed. Name this clearly.` : ""}

WRITE THE REPORT IN THESE EXACT SECTIONS:

## YOUR SCORE: ${row.total_score}/100 — ${row.designation?.toUpperCase()}
One paragraph only. What this score means in plain language. What an employer sees when they find this profile. Be direct about where ${row.name} stands.

## WHAT YOU ARE GOOD AT
Start with: "Your strongest skill is [name it]." Then name the top 2–3 skills with their scores. One sentence per skill.

## WHERE YOU ARE LOSING GROUND
Start with: "Your biggest gap right now is [name the primary gap skill]."
Name the skill, name the score, name what it costs them as a ${row.role}. Maximum 150 words.

## WHAT THIS COSTS YOU IN THE NEXT 12 MONTHS
One paragraph. Say exactly what happens: who overtakes them, what they fail to get, what they keep being passed over for.

## YOUR ONE ACTION FOR THIS WEEK
Give them EXACTLY this action:
"${SKILL_ACTIONS[primaryGapSkill]}"
Then add one sentence connecting it to their score.

## THE PROGRAMME YOU NEED RIGHT NOW
Name: ${programme.name}
Duration: ${programme.duration}
Investment: ${programme.price}
Write 3–4 sentences explaining why this programme fits their profile. Reference their specific skill scores.

${!listed ? `## HOW TO GET LISTED\nThey are not yet listed — score is ${row.total_score}, below the 35-point minimum. Tell them the PRIME Sprint is the path.` : ""}

## THE QUESTION TO SIT WITH
A single question in italics. About their weakest skill (${primaryGapSkill}), specific to their role as a ${row.role}. Make it uncomfortable enough to be useful.

Write the complete report now. Start directly with ## YOUR SCORE. No introduction before it.`;

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
