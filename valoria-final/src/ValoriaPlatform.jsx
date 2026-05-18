/**
 * VALORIA INSTITUTE — FULL PLATFORM
 * ─────────────────────────────────────────────────────────────
 * Pages: Signup → Email Verify → Assessment → Results → Profile
 *
 * SETUP CHECKLIST (do once, then it all works):
 *
 * 1. SUPABASE — run this SQL in your SQL Editor:
 *    https://sbkgpisgkuhbalsxqkdr.supabase.co
 *
 *    create table profiles (
 *      id uuid references auth.users primary key,
 *      full_name text,
 *      role text,
 *      bio text,
 *      linkedin_url text,
 *      photo_url text,
 *      video_url text,
 *      created_at timestamptz default now()
 *    );
 *
 *    create table valu_assessments (
 *      id uuid default gen_random_uuid() primary key,
 *      user_id uuid references auth.users,
 *      full_name text, role text, email text,
 *      valu_index int, designation text,
 *      cluster_scores jsonb, skill_scores jsonb,
 *      future_ready_score int, pathway text, listed boolean,
 *      ai_report text, gaming_detected boolean,
 *      speed_flag boolean, uniformity_flag boolean,
 *      expires_at timestamptz,
 *      completed_at timestamptz default now()
 *    );
 *
 *    -- Storage bucket for profile media
 *    insert into storage.buckets (id, name, public)
 *    values ('profile-media', 'profile-media', true);
 *
 *    -- RLS policies
 *    alter table profiles enable row level security;
 *    alter table valu_assessments enable row level security;
 *    create policy "Users own profile" on profiles for all using (auth.uid() = id);
 *    create policy "Users own assessment" on valu_assessments for all using (auth.uid() = user_id);
 *    create policy "Public read profiles" on profiles for select using (true);
 *
 * 2. RESEND — Sign up at resend.com (free tier: 3,000 emails/month)
 *    - Get your API key
 *    - Verify your domain (valoriainstituteafrica.com)
 *    - Add a Supabase Edge Function (see EDGE_FUNCTION below)
 *
 * 3. Fill in the config below with your keys
 *
 * ─────────────────────────────────────────────────────────────
 * SUPABASE EDGE FUNCTION — create at:
 * Supabase Dashboard → Edge Functions → New Function → "send-email"
 *
 * import { Resend } from "npm:resend@2.0.0";
 * const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
 * Deno.serve(async (req) => {
 *   const { type, to, name, valu_index, designation, report_url } = await req.json();
 *   let subject, html;
 *   if (type === "welcome") {
 *     subject = "Welcome to Valoria Institute";
 *     html = `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#1A1A2E;color:#F7F4EE;padding:48px 40px;">
 *       <div style="color:#C9A84C;font-size:28px;margin-bottom:8px;">VALORIA</div>
 *       <div style="color:rgba(201,168,76,0.5);font-size:11px;letter-spacing:0.2em;margin-bottom:40px;">INSTITUTE</div>
 *       <h1 style="font-weight:300;font-size:32px;margin:0 0 24px;">Welcome, ${name}.</h1>
 *       <p style="color:rgba(247,244,238,0.65);line-height:1.8;margin:0 0 32px;">Your account is ready. The VALU Index assessment is waiting for you — 58 questions, 18–28 minutes, and a personalised AI report that tells you exactly where you stand professionally.</p>
 *       <a href="https://valoriainstitute.com/assessment" style="display:inline-block;background:#C9A84C;color:#1A1A2E;padding:16px 32px;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:0.15em;">BEGIN YOUR ASSESSMENT</a>
 *       <p style="color:rgba(247,244,238,0.3);font-size:12px;margin-top:40px;">Valoria Institute · hello@valoriainstituteafrica.com</p>
 *     </div>`;
 *   } else {
 *     subject = `Your VALU Index: ${valu_index}/100 — ${designation}`;
 *     html = `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#1A1A2E;color:#F7F4EE;padding:48px 40px;">
 *       <div style="color:#C9A84C;font-size:28px;margin-bottom:8px;">VALORIA</div>
 *       <div style="color:rgba(201,168,76,0.5);font-size:11px;letter-spacing:0.2em;margin-bottom:40px;">INSTITUTE</div>
 *       <h1 style="font-weight:300;font-size:32px;margin:0 0 8px;">${name}.</h1>
 *       <p style="color:rgba(247,244,238,0.5);margin:0 0 32px;">Your VALU Index results are ready.</p>
 *       <div style="border:1px solid rgba(201,168,76,0.3);padding:32px;margin-bottom:32px;text-align:center;">
 *         <div style="font-size:72px;color:#C9A84C;font-weight:300;line-height:1;">${valu_index}</div>
 *         <div style="font-size:11px;color:rgba(247,244,238,0.4);letter-spacing:0.2em;margin:8px 0;">OUT OF 100</div>
 *         <div style="font-size:18px;color:#F7F4EE;font-weight:500;">${designation}</div>
 *       </div>
 *       <a href="${report_url}" style="display:inline-block;background:#C9A84C;color:#1A1A2E;padding:16px 32px;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:0.15em;">VIEW YOUR FULL REPORT</a>
 *       <p style="color:rgba(247,244,238,0.3);font-size:12px;margin-top:40px;">Valoria Institute · hello@valoriainstituteafrica.com</p>
 *     </div>`;
 *   }
 *   const data = await resend.emails.send({ from:"Valoria Institute <hello@valoriainstituteafrica.com>", to, subject, html });
 *   return Response.json(data);
 * });
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ── CONFIG — fill these in ────────────────────────────────────────────────
const SUPABASE_URL      = "https://sbkgpisgkuhbalsxqkdr.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; // paste from Supabase > Settings > API

// ── SUPABASE CLIENT ───────────────────────────────────────────────────────
const sb = {
  headers: () => ({
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${sb.token || SUPABASE_ANON_KEY}`,
  }),
  token: null,
  userId: null,

  async signUp(email, password, meta) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method:"POST", headers: this.headers(),
      body: JSON.stringify({ email, password, data: meta }),
    });
    const d = await r.json();
    if (d.access_token) { this.token = d.access_token; this.userId = d.user?.id; }
    return d;
  },

  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:"POST", headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (d.access_token) { this.token = d.access_token; this.userId = d.user?.id; }
    return d;
  },

  async signOut() {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method:"POST", headers: this.headers() });
    this.token = null; this.userId = null;
  },

  async getSession() {
    // Check localStorage for persisted session
    try {
      const raw = localStorage.getItem("valoria_session");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.access_token && new Date(s.expires_at * 1000) > new Date()) {
          this.token = s.access_token;
          this.userId = s.user?.id;
          return s;
        }
      }
    } catch {}
    return null;
  },

  async upsert(table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:"POST",
      headers: { ...this.headers(), "Prefer":"resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(data),
    });
    return r.ok ? await r.json() : { error: await r.json() };
  },

  async select(table, filter="") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { headers: this.headers() });
    return r.ok ? await r.json() : [];
  },

  async update(table, filter, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
      method:"PATCH", headers: { ...this.headers(), "Prefer":"return=representation" },
      body: JSON.stringify(data),
    });
    return r.ok ? await r.json() : { error: await r.json() };
  },

  async uploadFile(bucket, path, file) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method:"POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${this.token}`, "Content-Type": file.type },
      body: file,
    });
    const d = await r.json();
    return d.Key ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` : null;
  },

  async invokeFunction(name, body) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method:"POST", headers: this.headers(), body: JSON.stringify(body),
    });
    return r.ok ? await r.json() : null;
  },
};

// Persist session to localStorage on auth
const origSignUp = sb.signUp.bind(sb);
sb.signUp = async function(email, password, meta) {
  const d = await origSignUp(email, password, meta);
  if (d.session) localStorage.setItem("valoria_session", JSON.stringify(d.session));
  return d;
};
const origSignIn = sb.signIn.bind(sb);
sb.signIn = async function(email, password) {
  const d = await origSignIn(email, password);
  if (d.access_token) localStorage.setItem("valoria_session", JSON.stringify(d));
  return d;
};

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────
const G = {
  gold:     "#C9A84C",
  dark:     "#1A1A2E",
  mid:      "#22223A",
  surface:  "#2A2A44",
  parchment:"#F7F4EE",
  muted:    "rgba(247,244,238,0.45)",
  border:   "rgba(201,168,76,0.15)",
  clusters: { P:"#1D9E75", R:"#378ADD", I:"#7F77DD", M:"#BA7517", E:"#D85A30" },
};

const CLUSTERS = [
  { id:"P", name:"Presence",      theme:"How you show up",  color:G.clusters.P, weight:0.20, maxRaw:36 },
  { id:"R", name:"Relationships", theme:"How you connect",  color:G.clusters.R, weight:0.25, maxRaw:48 },
  { id:"I", name:"Intelligence",  theme:"How you think",    color:G.clusters.I, weight:0.25, maxRaw:60 },
  { id:"M", name:"Mastery",       theme:"How you deliver",  color:G.clusters.M, weight:0.20, maxRaw:36 },
  { id:"E", name:"Enterprise",    theme:"How you create",   color:G.clusters.E, weight:0.10, maxRaw:36 },
];

const DESIGNATIONS = [
  { min:80, name:"Force to Align With",     color:G.gold,      bg:"rgba(201,168,76,0.10)" },
  { min:65, name:"Emerging Force",          color:"#378ADD",   bg:"rgba(55,138,221,0.10)" },
  { min:50, name:"Developing Professional", color:"#1D9E75",   bg:"rgba(29,158,117,0.10)" },
  { min:35, name:"Building Foundations",    color:"#BA7517",   bg:"rgba(186,117,23,0.10)" },
  { min:0,  name:"At the Starting Point",   color:"#888",      bg:"rgba(136,136,136,0.10)" },
];

// ── QUESTION BANK (abbreviated for artifact — full 58q in PRIMEAssessment.jsx) ──
const SKILL_CLUSTER_MAP = {
  "Communication":"P","Negotiation":"P","Personal Brand & Executive Presence":"P",
  "Emotional Intelligence":"R","Conflict Resolution":"R","People Development":"R","Stakeholder Management":"R",
  "Critical Thinking":"I","Strategic Thinking":"I","Business Acumen":"I","Managing Ambiguity":"I","AI Fluency":"I",
  "Execution & Accountability":"M","Resilience & Self-Leadership":"M","Adaptability":"M",
  "Commercial Creativity":"E","Influence Without Authority":"E","Human-AI Collaboration":"E",
};

// Full questions imported from PRIMEAssessment.jsx
// (In your actual project, import ALL_QUESTIONS from './PRIMEAssessment')
// Below is the same full question bank for self-contained demo
const ALL_QUESTIONS = [
  { id:"P1a",cluster:"P",skill:"Communication",type:"behavioural",q:"You need to explain a complex decision to a mixed audience — some technical, some not. What do you do?",options:[{text:"I share the full picture so everyone starts from the same information.",score:1},{text:"I lead with the decision and its implications, then add detail based on who asks.",score:3},{text:"I prepare a version for each audience type before the conversation.",score:4},{text:"I simplify the technical parts and signal that more detail is available.",score:2}]},
  { id:"P1b",cluster:"P",skill:"Communication",type:"situational",q:"You are presenting a recommendation to leadership when you sense they have already decided differently. What do you do?",options:[{text:"Finish the presentation — they should hear everything before I adjust.",score:1},{text:"Name what I am sensing and ask what their current thinking is before continuing.",score:3},{text:"Pivot to the one point most likely to shift their position and invite the disagreement.",score:4},{text:"Accelerate through the key points before I lose the room entirely.",score:2}]},
  { id:"P1c",cluster:"P",skill:"Communication",type:"reflective",q:"Think of the last time someone told you they did not understand your explanation. What was your honest reaction?",options:[{text:"I assumed the explanation was clear and wondered if they had followed it properly.",score:1},{text:"I treated it as a signal that my explanation was the problem and redesigned it.",score:4},{text:"I went through it again using simpler language to make it clearer.",score:2},{text:"I stopped and asked what specifically was unclear before rebuilding the explanation.",score:3}]},
  { id:"P2a",cluster:"P",skill:"Negotiation",type:"behavioural",q:"Before entering a significant negotiation — salary, contract, or partnership — what do you actually do to prepare?",options:[{text:"I research comparable benchmarks and prepare a clear justification for my position.",score:2},{text:"I map both sides — what I need, what they likely care about — before deciding my opening.",score:3},{text:"I know what I want and go in ready to make the case.",score:1},{text:"I map interests, trade-offs, walk-away positions, and what I will and will not concede.",score:4}]},
  { id:"P2b",cluster:"P",skill:"Negotiation",type:"situational",q:"You are negotiating and the other party opens significantly below your expectation. What is your move?",options:[{text:"State that it is too low and name what I actually need.",score:1},{text:"Ask what is driving their number before deciding how to respond.",score:3},{text:"Counter firmly with my number and a strong rationale for why it is justified.",score:2},{text:"Probe the interest behind their position, then explore whether non-price variables can close the gap.",score:4}]},
  { id:"P2c",cluster:"P",skill:"Negotiation",type:"reflective",q:"Describe a negotiation where you settled for less than you wanted. What actually went wrong?",options:[{text:"I had not defined my walk-away position, so I did not recognise the moment to use it.",score:4},{text:"The other side had stronger leverage or was better prepared than I expected.",score:1},{text:"I did not anchor high enough at the start, which limited the final range.",score:2},{text:"I did not fully understand what they valued, so I could not find a trade that worked for both sides.",score:3}]},
  { id:"P3a",cluster:"P",skill:"Personal Brand & Executive Presence",type:"behavioural",q:"How would a professional who can only see your digital presence describe what you stand for?",options:[{text:"They would know my role and industry but probably not much more.",score:1},{text:"They would know precisely what I stand for and why I am worth a conversation.",score:4},{text:"They would get a clear sense of my expertise and the kind of professional I am.",score:3},{text:"They would see my field and some of my thinking, though not a complete picture.",score:2}]},
  { id:"P3b",cluster:"P",skill:"Personal Brand & Executive Presence",type:"situational",q:"You walk into a high-stakes room where you know nobody. How do you show up?",options:[{text:"I research who will be in the room and arrive knowing exactly who I want to reach.",score:3},{text:"I let the conversation come to me and wait for the right introduction.",score:1},{text:"I introduce myself and make sure key people know my role and organisation.",score:2},{text:"I know precisely what impression I want to leave and have planned how I will create it.",score:4}]},
  { id:"P3c",cluster:"P",skill:"Personal Brand & Executive Presence",type:"reflective",q:"When did you last receive feedback about how you come across professionally — and what did you do with it?",options:[{text:"I treat how I come across as a practised skill — I seek feedback and track whether changes are landing.",score:4},{text:"I do not recall specific feedback of this kind in recent memory.",score:1},{text:"I have received feedback and I keep it in mind when relevant situations come up.",score:2},{text:"I actively seek this type of feedback and have made specific, traceable changes based on it.",score:3}]},
  { id:"R1a",cluster:"R",skill:"Emotional Intelligence",type:"behavioural",q:"You are in a high-pressure meeting and someone says something that genuinely irritates you. What actually happens next?",options:[{text:"I notice the reaction, give myself a beat, and choose my response rather than react.",score:3},{text:"I address it in the moment — it is better than letting it sit.",score:1},{text:"I hold back but the irritation probably shapes how I engage for the rest of the meeting.",score:2},{text:"I name the emotion to myself, regulate it in real time, and decide whether to address it now or later.",score:4}]},
  { id:"R1b",cluster:"R",skill:"Emotional Intelligence",type:"situational",q:"A colleague who is usually high-performing has become visibly disengaged over the past two weeks. Nobody else has noticed. What do you do?",options:[{text:"Find a quiet moment to check in directly without framing it as a performance conversation.",score:3},{text:"Let it unfold — they will address it themselves if it becomes a real problem.",score:1},{text:"Check in privately, create genuine space for what they want to share, and think carefully about what they actually need.",score:4},{text:"Mention it to their manager so someone with authority is aware of the change.",score:2}]},
  { id:"R1c",cluster:"R",skill:"Emotional Intelligence",type:"reflective",q:"Think of a time you handled a difficult emotion badly at work. What happened and what do you understand now that you did not then?",options:[{text:"I generally keep things professional — I cannot think of a clear example.",score:1},{text:"I have a specific example, a clear analysis of the trigger, and a practice I have built since then to catch it earlier.",score:4},{text:"I can think of a time. I would handle it differently now, though I am not entirely sure how.",score:2},{text:"I can name the situation, what triggered me, and how I would regulate it earlier if it happened again.",score:3}]},
  { id:"R2a",cluster:"R",skill:"Conflict Resolution",type:"behavioural",q:"You are aware of unspoken tension between two team members that is starting to affect group performance. What do you do?",options:[{text:"Give it time — most tensions resolve without intervention if not made worse.",score:1},{text:"Have a deliberate sequence — understand each side privately, diagnose whether it is relational or task-based, then design a resolution conversation.",score:4},{text:"Mention it to each of them separately and see if that shifts things.",score:2},{text:"Speak to each person individually to understand what is happening, then create a structure to address it.",score:3}]},
  { id:"R2b",cluster:"R",skill:"Conflict Resolution",type:"situational",q:"Two senior people are in open disagreement in a meeting and the conversation is breaking down. You are not the most senior person in the room. What do you do?",options:[{text:"Stay quiet — it is not my place to intervene when I am not the most senior.",score:1},{text:"Redirect toward the agenda to keep the meeting moving and limit further damage.",score:2},{text:"Name the breakdown, separate positions from interests, and redirect toward what both parties actually need.",score:4},{text:"Name what is happening and suggest a short pause or a reframe of the question.",score:3}]},
  { id:"R2c",cluster:"R",skill:"Conflict Resolution",type:"reflective",q:"Think of a workplace conflict you were involved in — directly or as a mediator. What made it difficult and what would you do differently?",options:[{text:"I have a specific example, a precise analysis of what each party needed, and an intervention that would have resolved it sooner.",score:4},{text:"Most conflicts I have experienced were mainly driven by the other party.",score:1},{text:"I understand what made it difficult and know specifically what I would do differently.",score:3},{text:"I can think of one. Emotions were high and I was focused on being right rather than resolving it.",score:2}]},
  { id:"R3a",cluster:"R",skill:"People Development",type:"behavioural",q:"Someone on your team makes a significant mistake on an important piece of work. What is your first move?",options:[{text:"Fix it — the outcome is the priority in the moment.",score:1},{text:"Use it as a deliberate development moment — diagnosis, structured reflection, a specific action, and a follow-up.",score:4},{text:"Correct it and walk them through what they should have done differently.",score:2},{text:"Ask them to walk me through their thinking, then help them identify where it went wrong.",score:3}]},
  { id:"R3b",cluster:"R",skill:"People Development",type:"situational",q:"You have a team member who is highly capable but consistently underdelivering. How do you approach this?",options:[{text:"Have a direct conversation about the performance gap and what needs to change.",score:1},{text:"Give them clearer direction and more scaffolding to help them get back on track.",score:2},{text:"Start with genuine curiosity about what is happening for them.",score:3},{text:"Treat it as a diagnostic challenge — separate capability, motivation, and context to identify the actual blocker.",score:4}]},
  { id:"R3c",cluster:"R",skill:"People Development",type:"reflective",q:"Who is the person whose professional growth you are most proud to have contributed to? What specifically did you do?",options:[{text:"I can name someone and describe the capability gaps I identified, the deliberate interventions I designed, and the measurable difference.",score:4},{text:"I have supported people but struggle to identify specific growth I directly caused.",score:1},{text:"I can name someone and describe specific things I did that I can trace to their development.",score:3},{text:"I can name someone. I gave them opportunities and encouragement when they needed it.",score:2}]},
  { id:"R4a",cluster:"R",skill:"Stakeholder Management",type:"behavioural",q:"You are about to lead a significant initiative requiring support from people across multiple functions. Where do you start?",options:[{text:"Build a stakeholder influence map — interests, concerns, level of support needed — and create a deliberate alignment sequence before I need it.",score:4},{text:"Start the work and bring stakeholders in as they become relevant to their area.",score:1},{text:"Brief all key stakeholders early so they are aware of what is coming.",score:2},{text:"Map who needs to be involved, understand what each person cares about, and sequence conversations before work begins.",score:3}]},
  { id:"R4b",cluster:"R",skill:"Stakeholder Management",type:"situational",q:"You are mid-project when a senior stakeholder who was supportive at the start becomes resistant. What do you do?",options:[{text:"Continue and trust that progress will bring them back around.",score:1},{text:"Request a conversation and go in with genuine curiosity about what has changed for them.",score:4},{text:"Escalate to my manager to help manage the stakeholder relationship.",score:2},{text:"Request a direct conversation to understand what has shifted and address it.",score:3}]},
  { id:"R4c",cluster:"R",skill:"Stakeholder Management",type:"reflective",q:"Tell me about a project that stalled because of a relationship or political dynamic you did not manage well. What did you miss?",options:[{text:"I cannot think of a project that failed for this reason.",score:1},{text:"I have a specific example with a precise analysis of what I misread and the mapping practice I now use to prevent it.",score:4},{text:"I have a clear example. I underestimated someone's concerns, did not address them early, and paid for it.",score:3},{text:"Something comes to mind. I did not communicate well enough with a key person and lost their support.",score:2}]},
  { id:"I1a",cluster:"I",skill:"Critical Thinking",type:"behavioural",q:"A respected colleague presents data that strongly supports a decision the team is aligned on. You notice something that does not add up. What do you do?",options:[{text:"Trust the analysis — they are experienced and the team is already aligned.",score:1},{text:"Raise it specifically — naming what I noticed, why it matters, and the question that forces it to be interrogated properly.",score:4},{text:"Mention it quietly to the colleague after the meeting rather than disrupting the group.",score:2},{text:"Raise it in the room — the decision should not move forward on flawed analysis.",score:3}]},
  { id:"I1b",cluster:"I",skill:"Critical Thinking",type:"situational",q:"You are asked to validate a business case that has already been signed off by leadership. You find assumptions that seem optimistic. What do you do?",options:[{text:"Treat the validation as genuinely independent — stress-test every assumption and present a complete picture including downside scenarios.",score:4},{text:"Validate it as requested — raising issues on an approved case creates problems without solving them.",score:1},{text:"Flag the assumptions informally to the person who asked me to validate it.",score:2},{text:"Document the assumptions, stress-test them, and present the risk they create.",score:3}]},
  { id:"I1c",cluster:"I",skill:"Critical Thinking",type:"reflective",q:"When did you last genuinely change your mind about something important at work — not updating a detail, but shifting your position entirely?",options:[{text:"I have a specific example — I can trace the disconfirming evidence, the resistance I initially had, and the reasoning that finally moved me.",score:4},{text:"I generally land in the right place from the start, so complete reversals are unusual for me.",score:1},{text:"I can think of something. Someone made a strong argument and I updated my position.",score:2},{text:"I have a clear example. I encountered evidence that contradicted my position and worked through it seriously before updating.",score:3}]},
  { id:"I2a",cluster:"I",skill:"Strategic Thinking",type:"behavioural",q:"Your manager gives you a task that is clearly important. Before starting, what goes through your mind?",options:[{text:"How to do it well and deliver it on time.",score:1},{text:"How this task connects to longer-term direction, what it enables or constrains, and whether this is the right task to be doing at all.",score:4},{text:"How this connects to the team's current priorities and where it sits in the queue.",score:2},{text:"How it fits the broader goal, who will use the output, and what success looks like beyond task completion.",score:3}]},
  { id:"I2b",cluster:"I",skill:"Strategic Thinking",type:"situational",q:"Your organisation is about to launch a product. You can see a market dynamic that makes the timing risky. What do you do?",options:[{text:"Trust that leadership has thought through the timing.",score:1},{text:"Prepare a structured analysis — what I am seeing, why it matters, the alternatives, and my recommendation — and get it to the decision-maker.",score:4},{text:"Flag my concern to my manager and leave it with them to handle.",score:2},{text:"Build a clear, evidence-based view of the risk and find the right channel to get it into the decision.",score:3}]},
  { id:"I2c",cluster:"I",skill:"Strategic Thinking",type:"reflective",q:"Describe a decision you made that looked right in the short term but created a problem further down the line. What did you not see?",options:[{text:"Most of my decisions hold up well over time — I struggle to think of a clear example.",score:1},{text:"I have a specific example — the second-order consequence I missed, why I missed it, and the thinking practice I now use to surface those consequences.",score:4},{text:"Something comes to mind. I focused on the immediate problem and did not think far enough ahead.",score:2},{text:"I have a clear example. I optimised for the near term and did not trace the downstream consequences.",score:3}]},
  { id:"I3a",cluster:"I",skill:"Business Acumen",type:"behavioural",q:"If someone asked you to explain how your current organisation actually makes money — the mechanics of it — how confident are you?",options:[{text:"I can explain unit economics, key metrics, where value is created and destroyed, and how my role connects to commercial outcomes.",score:4},{text:"I know what we do and roughly what we charge — beyond that I am less certain.",score:1},{text:"I understand the core revenue model and the main things we spend money on.",score:2},{text:"I can walk through the revenue model, the key cost drivers, and where the margin is actually made.",score:3}]},
  { id:"I3b",cluster:"I",skill:"Business Acumen",type:"situational",q:"You are proposing a new initiative that needs investment. A finance leader asks you to walk through the commercial case. How prepared are you?",options:[{text:"I can present a fully worked commercial case — cost, return, assumption ranges, downside scenarios, payback period, and tracking metrics.",score:4},{text:"I can explain what the initiative does and why it matters to the organisation.",score:1},{text:"I can explain the cost and the expected benefit at a high level.",score:2},{text:"I can present the cost, projected return, key assumptions, and the timeline to value.",score:3}]},
  { id:"I3c",cluster:"I",skill:"Business Acumen",type:"reflective",q:"Describe a decision you made or contributed to that had a meaningful commercial impact. How did you think about it?",options:[{text:"I have a specific example — I built the commercial case, modelled the options, made a recommendation based on financial reasoning, and can trace the outcome.",score:4},{text:"Most of my decisions are not directly commercial — my focus is functional rather than financial.",score:1},{text:"I can think of something. I made a call that saved costs or generated value, though I did not formally model it.",score:2},{text:"I have a clear example where I thought through the commercial implications deliberately before deciding.",score:3}]},
  { id:"I4a",cluster:"I",skill:"Managing Ambiguity",type:"behavioural",q:"You are asked to lead something where the goal is clear but the method is entirely undefined. How do you respond?",options:[{text:"Frame the ambiguity explicitly, make a directional move, communicate the uncertainty to stakeholders, and build in review points.",score:4},{text:"Ask for more direction before starting — I want to move in the right direction from the beginning.",score:1},{text:"Make a start and check in regularly to make sure I am not too far off course.",score:2},{text:"Define what I know, identify the smallest reversible step to generate new information, and move from there.",score:3}]},
  { id:"I4b",cluster:"I",skill:"Managing Ambiguity",type:"situational",q:"Your organisation is going through significant change and nobody can tell you clearly how your role will be affected. Work still needs to get done. How do you operate?",options:[{text:"Treat the uncertainty as the operating context — define short-term priorities, communicate them upward, and stay curious rather than anxious.",score:4},{text:"I find it genuinely hard to commit fully until I know where things are going to land.",score:1},{text:"Focus on what I can control and try not to let the uncertainty affect my output.",score:2},{text:"Name the uncertainty to my manager, agree on what to prioritise in the short term, and operate with full commitment within that frame.",score:3}]},
  { id:"I4c",cluster:"I",skill:"Managing Ambiguity",type:"reflective",q:"Tell me about a time you had to make a consequential decision with significantly less information than you wanted. What did you do?",options:[{text:"I have a specific example — what I knew, what I treated as an assumption, how I reduced reversibility risk, what happened, and what it taught me.",score:4},{text:"I generally try to gather enough information before making decisions with significant consequences.",score:1},{text:"I can think of an example. I made a call with incomplete information — it either worked out or it did not.",score:2},{text:"I have a clear example where I defined the decision threshold, made the call, and owned the outcome.",score:3}]},
  { id:"I5a",cluster:"I",skill:"AI Fluency",type:"behavioural",futureReady:true,q:"How are you currently using AI in your professional work — not what you have tried once, but what is genuinely part of how you work?",options:[{text:"I have explored AI tools but they are not yet a consistent part of my regular workflow.",score:1},{text:"I have deliberately redesigned how I work around AI — I know which tasks I delegate to it, which I keep human, and I refine how I work with it regularly.",score:4},{text:"I use AI for specific tasks like drafting and summarising, though not in a systematic way.",score:2},{text:"I have integrated AI into several parts of my workflow and I evaluate its outputs critically before using them.",score:3}]},
  { id:"I5b",cluster:"I",skill:"AI Fluency",type:"situational",futureReady:true,q:"An AI tool produces a confident-sounding output that is central to a piece of work you are delivering. You do not have time to fully verify it. What do you do?",options:[{text:"Use it — AI confidence is generally a reasonable signal of accuracy.",score:1},{text:"Identify exactly which parts are load-bearing, verify those specifically, and be explicit with the recipient about what was verified and what was not.",score:4},{text:"Add a note that the output was AI-generated so the recipient can evaluate accordingly.",score:2},{text:"Run a targeted spot-check on the specific claims most critical to the work before using it.",score:3}]},
  { id:"I5c",cluster:"I",skill:"AI Fluency",type:"reflective",futureReady:true,q:"What is your honest assessment of what AI does better than you in your professional work right now — and what remains genuinely yours?",options:[{text:"I have mapped my work explicitly against AI capability — I know precisely which tasks AI does better, which require human judgment, and I have restructured my time accordingly.",score:4},{text:"I am not certain AI is yet better than me at the things that matter most in my work.",score:1},{text:"AI is better at some routine tasks but the work that really matters still requires human judgment.",score:2},{text:"I have a clear picture of where AI outperforms me on specific tasks and where human judgment is essential.",score:3}]},
  { id:"M1a",cluster:"M",skill:"Execution & Accountability",type:"behavioural",q:"You realise partway through a project that you are not going to meet a commitment you made. What do you do?",options:[{text:"Flag it immediately with a revised timeline, an impact assessment, a recovery plan, and an honest account of what I missed.",score:4},{text:"Deliver what I can and explain the situation when I submit.",score:1},{text:"Let the relevant people know as soon as I am certain I will miss it.",score:2},{text:"Flag it the moment I see the risk — before certainty — and arrive with a revised plan.",score:3}]},
  { id:"M1b",cluster:"M",skill:"Execution & Accountability",type:"situational",q:"A colleague who was supposed to deliver a key input has not delivered and is now unreachable. Your deadline is tomorrow. What do you do?",options:[{text:"Miss the deadline and make clear that the dependency was not delivered.",score:1},{text:"Make every reasonable attempt to resolve the dependency, deliver the best version possible, document what was missing, and escalate the dependency separately.",score:4},{text:"Do what I can without the input and flag the gap clearly in what I deliver.",score:2},{text:"Find a way to deliver with what I have, escalate the dependency failure clearly, and keep my accountability separate from theirs.",score:3}]},
  { id:"M1c",cluster:"M",skill:"Execution & Accountability",type:"reflective",q:"Tell me about a commitment you made that you did not keep. What happened and what did you take from it?",options:[{text:"I have a specific example with a clear analysis of where my commitment-making process failed and the specific practices I have built since then.",score:4},{text:"I am generally reliable — I cannot think of a significant missed commitment.",score:1},{text:"Something comes to mind. Circumstances changed and I was not able to deliver what I had committed to.",score:2},{text:"I have a clear example. I overcommitted and underdelivered — and now I think much more carefully about what I agree to.",score:3}]},
  { id:"M2a",cluster:"M",skill:"Resilience & Self-Leadership",type:"behavioural",q:"After a significant professional setback — a failed project, a difficult performance conversation, a lost opportunity — how do you actually recover?",options:[{text:"I take time and eventually return to normal, though it can take longer than I would like.",score:1},{text:"I have a structured recovery practice — specific steps to process the emotion, extract the learning, and rebuild momentum.",score:4},{text:"I process it privately and try not to let it affect my work for too long.",score:2},{text:"I have a deliberate process — feel the setback, extract the lesson, make a conscious decision to move forward.",score:3}]},
  { id:"M2b",cluster:"M",skill:"Resilience & Self-Leadership",type:"situational",q:"You are in a sustained period of high pressure — competing demands, insufficient resources, no clear end in sight. How do you manage yourself?",options:[{text:"I push through — it is temporary and the work needs to get done.",score:1},{text:"I have a clear framework for sustained pressure — how I manage cognitive, emotional, and physical energy, what signals I watch for, and when I escalate.",score:4},{text:"I try to manage my time better and accept that some things will have to slip.",score:2},{text:"I actively manage my energy — not just my time — and make deliberate choices about what to protect and what to let go.",score:3}]},
  { id:"M2c",cluster:"M",skill:"Resilience & Self-Leadership",type:"reflective",q:"Have you ever come close to burnout or noticed your performance dropping significantly under sustained pressure? What did it teach you?",options:[{text:"I have a specific experience — what signals I missed, where my self-management failed, and the specific practices I have built since then.",score:4},{text:"I handle pressure well — I have not experienced anything I would describe as close to burnout.",score:1},{text:"I have had difficult periods. I got through them, though I am not sure I handled them as well as I could have.",score:2},{text:"I have a clear experience. I now understand what my warning signs are and what I need to do when I see them.",score:3}]},
  { id:"M3a",cluster:"M",skill:"Adaptability",type:"behavioural",q:"Your organisation announces a significant change that affects how you work. What is your honest first reaction?",options:[{text:"Frustration — I had a system that worked and rebuilding it feels like wasted effort.",score:1},{text:"Opportunity — I move quickly to understand the new landscape and where I can add the most value within it.",score:4},{text:"Uncertainty — I tend to wait and see how things settle before committing to the new way.",score:2},{text:"Curiosity — I start thinking about how to position myself well within the new context.",score:3}]},
  { id:"M3b",cluster:"M",skill:"Adaptability",type:"situational",q:"You are asked to take on a piece of work that is significantly outside your expertise. You have limited time to get up to speed. How do you approach it?",options:[{text:"Flag that this is outside my area and recommend someone who is better suited.",score:1},{text:"Take it on, map the specific knowledge gaps that matter most, fill them deliberately, and treat the unfamiliarity as a potential advantage.",score:4},{text:"Take it on and learn as I go, being transparent when I reach the edges of my knowledge.",score:2},{text:"Take it on, identify the specific gaps that matter most, fill them deliberately, and be transparent about what I am learning.",score:3}]},
  { id:"M3c",cluster:"M",skill:"Adaptability",type:"reflective",q:"What is something you used to believe or do professionally that you have since completely changed? What caused the shift?",options:[{text:"My core professional approach has been consistent — I have refined it but not fundamentally reversed anything.",score:1},{text:"I have a specific example of a fundamental shift — what I believed, what challenged it, how I unlearned it, and what replaced it.",score:4},{text:"Something comes to mind. I changed my approach when I could see it was not producing the results I wanted.",score:2},{text:"I have a clear example of a significant belief I abandoned — I encountered clear evidence it was wrong and updated deliberately.",score:3}]},
  { id:"E1a",cluster:"E",skill:"Commercial Creativity",type:"behavioural",q:"You are facing a significant constraint — budget cut, resource reduction, policy restriction — that threatens something you are trying to deliver. How do you respond?",options:[{text:"Deliver what is possible within the constraint and communicate clearly about what is not.",score:1},{text:"Treat the constraint as potentially generative — some of the best solutions come from working around limitations.",score:4},{text:"Push back and make the case for more resource or greater flexibility.",score:2},{text:"Treat the constraint as a design problem — look for a different way to achieve the same outcome.",score:3}]},
  { id:"E1b",cluster:"E",skill:"Commercial Creativity",type:"situational",q:"You spot an opportunity your organisation has not seen — a new revenue line, a partnership, an untapped market. You are not in the role that would normally pursue it. What do you do?",options:[{text:"Note it and wait for the right person or moment to raise it.",score:1},{text:"Develop it enough to be taken seriously — what it is, why it is real, what it would take, and what it costs to ignore.",score:4},{text:"Mention it to my manager and let them decide whether it is worth pursuing.",score:2},{text:"Build a basic case for the opportunity and find the right channel to put it in front of someone who can act on it.",score:3}]},
  { id:"E1c",cluster:"E",skill:"Commercial Creativity",type:"reflective",q:"Tell me about an idea you had that created real value. Where did it come from and how did you turn it into something real?",options:[{text:"I have a specific example — where the insight came from, how I developed it into a proposal, who I had to persuade, and what the outcome actually was.",score:4},{text:"I tend to contribute to other people's ideas more than originate my own.",score:1},{text:"I can think of an idea that worked. It came from noticing a problem and suggesting a practical fix.",score:2},{text:"I have a clear example of an idea I originated, developed into a real proposal, and drove to implementation with measurable impact.",score:3}]},
  { id:"E2a",cluster:"E",skill:"Influence Without Authority",type:"behavioural",q:"You need cooperation from someone who does not report to you — and they are currently not prioritising what you need. How do you approach it?",options:[{text:"Escalate to someone who has authority over them.",score:1},{text:"Invest in the relationship before I need something, understand their pressures, frame my request in terms of their interests, and make it easy for them to say yes.",score:4},{text:"Make the request clearly and explain why it matters to the organisation.",score:2},{text:"Take time to understand what they are prioritising and find a way to connect my need to something they already care about.",score:3}]},
  { id:"E2b",cluster:"E",skill:"Influence Without Authority",type:"situational",q:"You believe strongly in an idea that needs support from three people who are currently indifferent or mildly resistant. How do you build the coalition?",options:[{text:"Present the idea to all three together and make the strongest possible case.",score:1},{text:"Map each person's interests, sequence conversations to build momentum, address each objection with something that genuinely resolves it, and bring them together only when alignment is already close.",score:4},{text:"Start with the most sympathetic person and use their support to help move the others.",score:2},{text:"Meet each person separately first, understand their specific concerns, and tailor each conversation before bringing them together.",score:3}]},
  { id:"E2c",cluster:"E",skill:"Influence Without Authority",type:"reflective",q:"Tell me about a time you moved something forward that you had no formal authority to push. What did you actually do?",options:[{text:"I have a specific example — the stakeholder map I built, how I sequenced conversations, what I offered each person, and how I maintained momentum through the resistance.",score:4},{text:"I generally work through the proper channels rather than trying to influence things outside my remit.",score:1},{text:"I can think of a time. I made the case clearly and kept making it until people came around.",score:2},{text:"I have a clear example. I mapped who mattered, had deliberate conversations, and built enough support to move it.",score:3}]},
  { id:"E3a",cluster:"E",skill:"Human-AI Collaboration",type:"behavioural",futureReady:true,q:"How have you actually changed how you work because of AI — not in theory, but in practice?",options:[{text:"I have not made significant changes yet — I am still working out where AI genuinely fits in my work.",score:1},{text:"I have comprehensively redesigned how I work around the human-AI boundary — I can name precisely which tasks I have moved to AI and what I have kept human.",score:4},{text:"I have added AI to tasks at the edges of my workflow but my core approach has not changed significantly.",score:2},{text:"I have deliberately redesigned parts of my workflow around AI — deciding what to delegate and what to keep — and I can see a real difference.",score:3}]},
  { id:"E3b",cluster:"E",skill:"Human-AI Collaboration",type:"situational",futureReady:true,q:"Your organisation is introducing AI tools across your function. Some colleagues are resisting, others are adopting everything uncritically. What is your position?",options:[{text:"Wait until the adoption settles before deciding how to change how I work.",score:1},{text:"Lead the thinking in my function — map decisions against AI capability, define what stays human and why, build genuine fluency in the team.",score:4},{text:"Adopt the tools that seem useful and avoid the ones that feel like they are replacing work that matters.",score:2},{text:"Think through each tool systematically — what it does well, what risks it creates — and develop a clear position.",score:3}]},
  { id:"E3c",cluster:"E",skill:"Human-AI Collaboration",type:"reflective",futureReady:true,q:"What is genuinely irreplaceable about what you bring to your work — the thing AI cannot do, even in principle?",options:[{text:"Honestly, I am not certain there are things AI cannot eventually do that I currently do.",score:1},{text:"I have a precise and reasoned answer — what I bring that AI cannot replicate structurally, why it matters commercially, and how I am investing in deepening exactly those capabilities.",score:4},{text:"Relationships and judgment are areas where I think human presence will remain essential.",score:2},{text:"I have a clear view of where my specific value lies that AI cannot replicate — particular types of judgment, contextual knowledge, or relational work.",score:3}]},
  { id:"VA1",cluster:"VA",skill:"Validity",type:"anchor",validAnchor:true,q:"When you receive feedback from someone you genuinely respect, your first response is always to implement it.",options:[{text:"Yes — if someone I respect has taken the time to give feedback, acting on it is the right response.",score:1},{text:"Almost always — I occasionally push back but my default is to implement.",score:2},{text:"Not always — good feedback still needs to fit the context, even from people I respect.",score:4},{text:"Rarely — feedback is one input and I weigh it carefully against everything else I know.",score:2}]},
  { id:"VA2",cluster:"VA",skill:"Validity",type:"anchor",validAnchor:true,q:"You always know exactly what is driving your emotions in a professional setting.",options:[{text:"Yes — self-awareness is something I have worked hard to build and I have strong insight into my emotional drivers.",score:1},{text:"Usually — I sometimes need time to understand what is behind a strong reaction.",score:2},{text:"Not always — even with strong self-awareness, emotions in complex situations are not always immediately legible.",score:4},{text:"Rarely — I am not naturally introspective about my emotional drivers.",score:1}]},
  { id:"VA3",cluster:"VA",skill:"Validity",type:"anchor",validAnchor:true,q:"When you prepare thoroughly for a negotiation, you reliably get the outcome you are aiming for.",options:[{text:"Yes — thorough preparation is the consistent differentiator between winning and losing.",score:1},{text:"Usually — preparation significantly increases my success rate.",score:2},{text:"Often, but not always — even excellent preparation cannot overcome every structural constraint or the other party's position.",score:4},{text:"Not always — preparation is essential but the outcome also depends on variables outside my control.",score:3}]},
  { id:"VA4",cluster:"VA",skill:"Validity",type:"anchor",validAnchor:true,q:"You have never made a significant people decision you later regretted.",options:[{text:"Correct — I take people decisions seriously and my track record is strong.",score:1},{text:"Almost — there are minor things I would do differently but nothing significant.",score:2},{text:"No — people decisions are genuinely complex and some of my most important learning has come from the ones I got wrong.",score:4},{text:"No — I have made people decisions I later regretted, and I have thought carefully about why.",score:3}]},
];

function buildQuestionSequence() {
  const scored  = ALL_QUESTIONS.filter(q => q.cluster !== "VA");
  const anchors = ALL_QUESTIONS.filter(q => q.cluster === "VA");
  const seq = [...scored];
  [13,27,41,55].forEach((pos,i) => { if(anchors[i]) seq.splice(pos,0,anchors[i]); });
  return seq;
}
const QUESTIONS = buildQuestionSequence();
const TOTAL = QUESTIONS.length;

function seededShuffle(arr, seed) {
  const a = arr.map((item,i)=>({item,sort:Math.sin(seed*(i+1))*10000%1}));
  a.sort((x,y)=>x.sort-y.sort);
  return a.map(({item})=>item);
}

function computeResults(answers, timings, shuffleMap) {
  const cRaw={P:0,R:0,I:0,M:0,E:0}, cAll={P:[],R:[],I:[],M:[],E:[]}, skillRaw={};
  QUESTIONS.forEach((q,idx)=>{
    if(q.cluster==="VA") return;
    const di=answers[idx]; if(di===undefined) return;
    const opt=shuffleMap[idx]?shuffleMap[idx][di]:q.options[di];
    const sc=opt?.score||0;
    cRaw[q.cluster]+=sc; cAll[q.cluster].push(sc);
    if(q.skill&&q.skill!=="Validity") skillRaw[q.skill]=(skillRaw[q.skill]||0)+sc;
  });
  const skillScores={};
  Object.entries(skillRaw).forEach(([s,r])=>{skillScores[s]=Math.round((r/12)*100);});
  const clusterScores={};
  CLUSTERS.forEach(c=>{clusterScores[c.id]=Math.round((cRaw[c.id]/c.maxRaw)*100);});
  let vRaw=0; CLUSTERS.forEach(c=>{vRaw+=clusterScores[c.id]*c.weight;});
  let valuIndex=Math.round(vRaw);
  const consistencyFlags={};
  CLUSTERS.forEach(c=>{
    const sc=cAll[c.id]; if(sc.length<2) return;
    const m=sc.reduce((a,b)=>a+b,0)/sc.length;
    const sd=Math.sqrt(sc.reduce((a,b)=>a+(b-m)**2,0)/sc.length);
    if(sd>1.2){consistencyFlags[c.id]=true;clusterScores[c.id]=Math.round(clusterScores[c.id]*0.85);}
  });
  let vRaw2=0; CLUSTERS.forEach(c=>{vRaw2+=clusterScores[c.id]*c.weight;});
  valuIndex=Math.round(vRaw2);
  let anchorFlags=0;
  QUESTIONS.forEach((q,idx)=>{
    if(!q.validAnchor) return;
    const di=answers[idx]; if(di===undefined) return;
    const opt=shuffleMap[idx]?shuffleMap[idx][di]:q.options[di];
    if(opt?.score===1) anchorFlags++;
  });
  const gamingDetected=anchorFlags>=3;
  if(gamingDetected) valuIndex=Math.round(valuIndex*0.80);
  const totalTime=timings.filter(t=>t>0).reduce((a,b)=>a+b,0);
  const fastAnswers=timings.filter(t=>t>0&&t<8000).length;
  const speedFlag=totalTime<720000||fastAnswers>=3;
  const allSc=[]; QUESTIONS.forEach((q,idx)=>{
    if(q.cluster==="VA") return;
    const di=answers[idx]; if(di===undefined) return;
    const opt=shuffleMap[idx]?shuffleMap[idx][di]:q.options[di];
    if(opt?.score) allSc.push(opt.score);
  });
  const gm=allSc.reduce((a,b)=>a+b,0)/allSc.length;
  const gsd=Math.sqrt(allSc.reduce((a,b)=>a+(b-gm)**2,0)/allSc.length);
  const uniformityFlag=valuIndex>=65&&gsd<0.5;
  const desig=DESIGNATIONS.find(d=>valuIndex>=d.min)||DESIGNATIONS[DESIGNATIONS.length-1];
  const frQ=QUESTIONS.filter(q=>q.futureReady);
  const frRaw=frQ.reduce((sum,q)=>{
    const idx=QUESTIONS.indexOf(q),di=answers[idx];
    if(di===undefined) return sum;
    const opt=shuffleMap[idx]?shuffleMap[idx][di]:q.options[di];
    return sum+(opt?.score||0);
  },0);
  const futureReadyScore=Math.round((frRaw/(frQ.length*4))*100);
  const sorted=[...CLUSTERS].sort((a,b)=>clusterScores[b.id]-clusterScores[a.id]);
  return {
    valuIndex,clusterScores,skillScores,desig,futureReadyScore,
    strongest:sorted[0],weakest:sorted[sorted.length-1],
    consistencyFlags,gamingDetected,anchorFlags,speedFlag,uniformityFlag,
    listed:valuIndex>=35&&!uniformityFlag,
    pathway:valuIndex>=80?"PCP Certification":valuIndex>=65?"PRIME Programme":valuIndex>=50?"PRIME Cluster":"PRIME Sprint",
    globalSD:Math.round(gsd*100)/100,
  };
}

// ── RADAR ─────────────────────────────────────────────────────────────────
function Radar({scores,size=180}) {
  const cx=size/2,cy=size/2,r=size*0.37,n=5;
  const angle=i=>(Math.PI*2*i/n)-Math.PI/2;
  const pt=(i,f)=>({x:cx+r*f*Math.cos(angle(i)),y:cy+r*f*Math.sin(angle(i))});
  const gp=f=>CLUSTERS.map((_,i)=>{const p=pt(i,f);return`${p.x},${p.y}`;}).join(" ");
  const dp=CLUSTERS.map((c,i)=>pt(i,(scores[c.id]||0)/100));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible"}}>
      {[0.25,0.5,0.75,1].map(f=><polygon key={f} points={gp(f)} fill="none" stroke={f===1?"rgba(201,168,76,0.4)":"rgba(201,168,76,0.15)"} strokeWidth={f===1?0.8:0.5}/>)}
      {CLUSTERS.map((_,i)=>{const p=pt(i,1);return<line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(201,168,76,0.2)" strokeWidth={0.5}/>;})}
      <polygon points={dp.map(p=>`${p.x},${p.y}`).join(" ")} fill="rgba(201,168,76,0.15)" stroke={G.gold} strokeWidth={1.5} style={{transition:"all 0.5s"}}/>
      {dp.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={3} fill={CLUSTERS[i].color} style={{transition:"all 0.5s"}}/>)}
      {CLUSTERS.map((c,i)=>{const lp=pt(i,1.25);return<text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central" style={{fontSize:9,fontWeight:700,fill:c.color}}>{c.id}</text>;})}
    </svg>
  );
}

// ── REPORT RENDERER ───────────────────────────────────────────────────────
function ReportRenderer({text}) {
  if (!text) return null;
  return (
    <div>
      {text.split("\n").map((line,i)=>{
        if(line.startsWith("## ")) return (
          <div key={i} style={{marginTop:28,marginBottom:10}}>
            <div style={{fontSize:9,color:G.gold,letterSpacing:"0.2em",marginBottom:5}}>{line.replace("## ","").toUpperCase()}</div>
            <div style={{height:1,background:"rgba(201,168,76,0.15)"}}/>
          </div>
        );
        if(line.startsWith("*")&&line.endsWith("*")&&line.length>2) return (
          <div key={i} style={{padding:"18px 20px",background:"rgba(201,168,76,0.05)",borderLeft:`3px solid ${G.gold}`,borderRadius:"0 6px 6px 0",margin:"14px 0"}}>
            <p style={{fontFamily:"Georgia,serif",fontSize:17,fontWeight:300,color:G.parchment,lineHeight:1.6,margin:0,fontStyle:"italic"}}>{line.slice(1,-1)}</p>
          </div>
        );
        if(line.trim()&&!line.startsWith("#")) {
          const parts=line.split(/(\*\*[^*]+\*\*)/g);
          return <p key={i} style={{fontSize:14,color:"rgba(247,244,238,0.65)",lineHeight:1.85,margin:"0 0 12px"}}>{parts.map((p,pi)=>p.startsWith("**")&&p.endsWith("**")?<strong key={pi} style={{color:G.parchment,fontWeight:600}}>{p.slice(2,-2)}</strong>:p)}</p>;
        }
        return null;
      })}
    </div>
  );
}

// ── GLOBAL STYLES ─────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#1A1A2E;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pulse{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  input,textarea{font-family:'DM Sans',sans-serif;color:#F7F4EE;}
  input::placeholder,textarea::placeholder{color:rgba(247,244,238,0.2);}
  input:focus,textarea:focus{outline:none;}
  button{font-family:'DM Sans',sans-serif;cursor:pointer;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:rgba(255,255,255,0.03);}
  ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.2);border-radius:2px;}
  .tab-btn:hover{background:rgba(201,168,76,0.06)!important;}
  .opt-btn:hover{border-color:rgba(201,168,76,0.4)!important;background:rgba(201,168,76,0.06)!important;}
  .gold-btn:hover{background:#E2C97E!important;}
  .ghost-btn:hover{border-color:rgba(201,168,76,0.3)!important;color:rgba(247,244,238,0.5)!important;}
`;

// ── COMPONENTS ────────────────────────────────────────────────────────────
const Input = ({label,optional,...props}) => (
  <div style={{marginBottom:16}}>
    {label&&<label style={{display:"block",fontSize:9,fontWeight:600,color:"rgba(201,168,76,0.5)",letterSpacing:"0.2em",marginBottom:8}}>
      {label}{optional&&<span style={{color:"rgba(201,168,76,0.3)",fontWeight:400,marginLeft:6}}>(optional)</span>}
    </label>}
    {props.as==="textarea"
      ? <textarea {...props} as={undefined} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(247,244,238,0.09)",borderRadius:4,padding:"12px 14px",fontSize:14,lineHeight:1.6,resize:"vertical",minHeight:100,...props.style}}/>
      : <input {...props} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(247,244,238,0.09)",borderRadius:4,padding:"13px 14px",fontSize:14,...props.style}}/>
    }
  </div>
);

const Btn = ({children,variant="gold",fullWidth,loading,style,...props}) => {
  const base={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,padding:"13px 24px",fontSize:11,fontWeight:700,letterSpacing:"0.15em",border:"none",borderRadius:3,transition:"all 0.2s",width:fullWidth?"100%":"auto",...style};
  const styles={
    gold:{...base,background:G.gold,color:G.dark,className:"gold-btn"},
    ghost:{...base,background:"transparent",border:`1px solid ${G.border}`,color:"rgba(247,244,238,0.4)",className:"ghost-btn"},
    danger:{...base,background:"rgba(216,90,48,0.12)",border:"1px solid rgba(216,90,48,0.35)",color:"#D85A30"},
  };
  return (
    <button {...props} style={styles[variant]}>
      {loading&&<div style={{width:12,height:12,border:"2px solid rgba(26,26,46,0.3)",borderTopColor:G.dark,borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>}
      {children}
    </button>
  );
};

const ClusterBar = ({label,score,color}) => (
  <div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
      <span style={{fontSize:11,color:"rgba(247,244,238,0.5)"}}>{label}</span>
      <span style={{fontSize:11,fontWeight:600,color}}>{score}</span>
    </div>
    <div style={{height:4,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${score}%`,background:color,borderRadius:2,transition:"width 1s ease"}}/>
    </div>
  </div>
);

// ── NOISE OVERLAY ─────────────────────────────────────────────────────────
const Noise = () => (
  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,opacity:0.03,
    backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize:"256px"}}/>
);

const Stripe = () => (
  <div style={{position:"fixed",top:0,left:0,right:0,height:3,display:"flex",zIndex:100}}>
    {[["#1D9E75",20],["#378ADD",25],["#7F77DD",25],["#BA7517",20],["#D85A30",10]].map(([c,w],i)=>(
      <div key={i} style={{flex:w,background:c,opacity:0.9}}/>
    ))}
  </div>
);

const Wordmark = ({size=1}) => (
  <div>
    <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:28*size,fontWeight:600,color:G.gold,letterSpacing:"0.15em",lineHeight:1}}>VALORIA</div>
    <div style={{fontSize:8*size,color:"rgba(201,168,76,0.4)",letterSpacing:"0.3em",marginTop:2}}>INSTITUTE</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: AUTH (Signup / Login)
// ═══════════════════════════════════════════════════════════════════════════
function AuthPage({onAuth}) {
  const [mode,setMode]         = useState("signup"); // signup | login
  const [fullName,setFullName] = useState("");
  const [role,setRole]         = useState("");
  const [email,setEmail]       = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading]   = useState(false);
  const [error,setError]       = useState("");
  const [done,setDone]         = useState(false);

  async function handleSubmit() {
    setError(""); setLoading(true);
    try {
      if (mode==="signup") {
        if (!fullName.trim()||!role.trim()||!email.trim()||!password.trim()) {
          setError("Please fill in all fields."); setLoading(false); return;
        }
        const d = await sb.signUp(email, password, { full_name:fullName, role });
        if (d.error||d.msg) { setError(d.msg||d.error?.message||"Signup failed."); setLoading(false); return; }

        // Create profile row
        if (d.user?.id || sb.userId) {
          await sb.upsert("profiles", { id: d.user?.id||sb.userId, full_name:fullName, role });
        }

        // Send welcome email via Edge Function
        await sb.invokeFunction("send-email", { type:"welcome", to:email, name:fullName });

        // If email confirmation is disabled in Supabase, log in directly
        if (d.access_token) { onAuth({...d.user, full_name:fullName, role}); }
        else setDone(true);

      } else {
        const d = await sb.signIn(email, password);
        if (d.error||!d.access_token) { setError(d.error?.message||d.error_description||"Login failed. Check your credentials."); setLoading(false); return; }
        // Fetch profile
        const profiles = await sb.select("profiles", `id=eq.${d.user?.id}`);
        const profile = profiles[0]||{};
        onAuth({...d.user, ...profile});
      }
    } catch(e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  if (done) return (
    <div style={{minHeight:"100vh",background:G.dark,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:24}}>
      <Noise/><Stripe/>
      <div style={{textAlign:"center",maxWidth:400,position:"relative",zIndex:1,animation:"fadeUp 0.8s ease both"}}>
        <Wordmark/>
        <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(29,158,117,0.1)",border:"1px solid rgba(29,158,117,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"32px auto 20px"}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <h2 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:28,fontWeight:300,color:G.parchment,marginBottom:12}}>Check your inbox.</h2>
        <p style={{fontSize:14,color:G.muted,lineHeight:1.7,marginBottom:24}}>We've sent a confirmation link to <strong style={{color:G.gold}}>{email}</strong>. Click it to verify your account, then return here to log in.</p>
        <Btn onClick={()=>setMode("login")} fullWidth>GO TO LOGIN</Btn>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:G.dark,display:"grid",gridTemplateColumns:"1fr 1fr",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{CSS}</style>
      <Noise/><Stripe/>

      {/* LEFT PANEL */}
      <div style={{padding:"clamp(40px,7vw,80px) clamp(32px,5vw,64px)",display:"flex",flexDirection:"column",justifyContent:"center",borderRight:`1px solid ${G.border}`,position:"relative",zIndex:1}}>
        <div style={{animation:"fadeUp 0.8s ease 0.1s both",marginBottom:48}}><Wordmark/></div>
        <h1 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:"clamp(38px,5vw,64px)",fontWeight:300,color:G.parchment,lineHeight:0.97,letterSpacing:"-0.02em",animation:"fadeUp 0.9s ease 0.25s both",marginBottom:24}}>
          Know exactly<br/>where you <em style={{fontStyle:"italic",color:G.gold}}>stand.</em>
        </h1>
        <p style={{fontSize:15,color:G.muted,lineHeight:1.8,maxWidth:380,animation:"fadeUp 0.9s ease 0.4s both",marginBottom:40}}>
          The VALU Index is a 58-question professional assessment across five PRIME clusters. Your results are scored and interpreted by AI in real time.
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:10,animation:"fadeUp 0.9s ease 0.55s both"}}>
          {CLUSTERS.map((c,i)=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,animation:`fadeUp 0.7s ease ${0.6+i*0.08}s both`}}>
              <div style={{width:28,height:28,borderRadius:4,background:`${c.color}18`,border:`1px solid ${c.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:c.color,flexShrink:0}}>{c.id}</div>
              <span style={{fontSize:12,color:G.parchment,fontWeight:500}}>{c.name}</span>
              <span style={{fontSize:11,color:"rgba(247,244,238,0.3)",fontStyle:"italic",marginLeft:4}}>{c.theme}</span>
              <span style={{marginLeft:"auto",fontSize:10,color:`${c.color}70`}}>{Math.round(c.weight*100)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{padding:"clamp(40px,7vw,80px) clamp(32px,5vw,64px)",display:"flex",flexDirection:"column",justifyContent:"center",background:"rgba(20,20,36,0.6)",position:"relative",zIndex:1}}>
        <div style={{maxWidth:420,width:"100%"}}>
          {/* Tab toggle */}
          <div style={{display:"flex",gap:0,marginBottom:32,background:"rgba(255,255,255,0.03)",borderRadius:4,padding:3}}>
            {["signup","login"].map(m=>(
              <button key={m} className="tab-btn" onClick={()=>{setMode(m);setError("");}}
                style={{flex:1,padding:"10px",fontSize:11,fontWeight:600,letterSpacing:"0.12em",border:"none",borderRadius:3,transition:"all 0.2s",
                  background:mode===m?"rgba(201,168,76,0.15)":"transparent",
                  color:mode===m?G.gold:"rgba(247,244,238,0.3)"}}>
                {m==="signup"?"CREATE ACCOUNT":"SIGN IN"}
              </button>
            ))}
          </div>

          <div style={{animation:"fadeUp 0.7s ease both"}}>
            {mode==="signup"&&<>
              <Input label="FULL NAME" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name"/>
              <Input label="CURRENT ROLE" value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Head of Operations"/>
            </>}
            <Input label="EMAIL ADDRESS" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"/>
            <Input label="PASSWORD" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="signup"?"Create a password (8+ chars)":"Your password"}
              style={{marginBottom:0}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>

            {error&&<div style={{marginTop:12,padding:"10px 14px",background:"rgba(216,90,48,0.08)",border:"1px solid rgba(216,90,48,0.25)",borderRadius:4,fontSize:12,color:"#D85A30"}}>{error}</div>}

            <Btn fullWidth loading={loading} onClick={handleSubmit} style={{marginTop:20}}>
              {mode==="signup"?"CREATE MY ACCOUNT":"SIGN IN"}
            </Btn>

            {mode==="signup"&&(
              <p style={{fontSize:11,color:"rgba(247,244,238,0.2)",textAlign:"center",marginTop:16,lineHeight:1.6}}>
                By signing up you agree to our terms. Your data is stored securely via Supabase and is NDPA 2023 compliant.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════════
function AssessmentPage({user, onComplete}) {
  const [currentQ,setCurrentQ]     = useState(0);
  const [answers,setAnswers]       = useState({});
  const [selected,setSelected]     = useState(null);
  const [timings,setTimings]       = useState(Array(TOTAL).fill(0));
  const [qStart,setQStart]         = useState(null);
  const [shuffleMap,setShuffleMap] = useState({});
  const [transitioning,setTrans]   = useState(false);
  const [sessionSeed]              = useState(()=>Math.random()*99999);

  const question  = QUESTIONS[currentQ];
  const progress  = Math.round((currentQ/TOTAL)*100);
  const cluster   = CLUSTERS.find(c=>c.id===question?.cluster);

  const displayedOptions = useMemo(()=>{
    if(!question) return [];
    if(question.type==="anchor") return question.options;
    const seed=sessionSeed+currentQ;
    const shuffled=seededShuffle(question.options,seed);
    setShuffleMap(prev=>({...prev,[currentQ]:shuffled}));
    return shuffled;
  },[currentQ,question,sessionSeed]);

  useEffect(()=>{ setQStart(Date.now()); },[currentQ]);

  const liveScores={};
  CLUSTERS.forEach(c=>{
    const qs=QUESTIONS.filter((q,i)=>q.cluster===c.id&&answers[i]!==undefined);
    const raw=qs.reduce((s,q)=>{
      const idx=QUESTIONS.indexOf(q),di=answers[idx];
      const opt=shuffleMap[idx]?shuffleMap[idx][di]:q.options[di];
      return s+(opt?.score||0);
    },0);
    liveScores[c.id]=Math.round((raw/c.maxRaw)*100);
  });

  function handleNext() {
    if(selected===null) return;
    const elapsed=qStart?Date.now()-qStart:0;
    const newTimings=[...timings]; newTimings[currentQ]=elapsed;
    setTimings(newTimings);
    const newAnswers={...answers,[currentQ]:selected};
    setAnswers(newAnswers);
    setTrans(true);
    setTimeout(()=>{
      if(currentQ+1<TOTAL){setCurrentQ(currentQ+1);setSelected(null);setTrans(false);}
      else{onComplete(newAnswers,newTimings,shuffleMap);}
    },260);
  }

  return (
    <div style={{minHeight:"100vh",background:G.dark,display:"flex",flexDirection:"column",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{CSS}</style>
      {/* Progress */}
      <div style={{position:"fixed",top:0,left:0,right:0,height:3,background:"rgba(255,255,255,0.05)",zIndex:50}}>
        <div style={{height:"100%",width:`${progress}%`,background:G.gold,transition:"width 0.4s ease"}}/>
      </div>
      {/* Header */}
      <div style={{position:"fixed",top:0,left:0,right:0,padding:"14px 24px 12px",background:"rgba(22,22,40,0.98)",borderBottom:`1px solid ${G.border}`,backdropFilter:"blur(16px)",zIndex:40,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:11,color:"rgba(201,168,76,0.6)",letterSpacing:"0.15em",fontWeight:600}}>VALU INDEX</div>
        <div style={{fontSize:12,color:"rgba(247,244,238,0.3)"}}>{currentQ+1} / {TOTAL}</div>
        {cluster&&<div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:18,height:18,borderRadius:3,background:`${cluster.color}20`,border:`1px solid ${cluster.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:cluster.color}}>{cluster.id}</div>
          <span style={{fontSize:11,color:cluster.color,letterSpacing:"0.08em",fontWeight:500}}>{cluster.name.toUpperCase()}</span>
        </div>}
      </div>

      {/* Question */}
      <div style={{flex:1,display:"flex",padding:"80px 20px 140px",maxWidth:700,margin:"0 auto",width:"100%",flexDirection:"column",justifyContent:"center"}}>
        {question?.skill&&question.cluster!=="VA"&&(
          <div style={{fontSize:9,color:"rgba(201,168,76,0.4)",letterSpacing:"0.2em",marginBottom:16,fontWeight:600}}>{question.skill.toUpperCase()} · {question.type.toUpperCase()}</div>
        )}
        <div style={{fontFamily:"Georgia,serif",fontSize:"clamp(17px,2.4vw,22px)",fontWeight:300,color:G.parchment,lineHeight:1.6,marginBottom:32,opacity:transitioning?0:1,transition:"opacity 0.2s"}}>
          {question?.q}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,opacity:transitioning?0:1,transition:"opacity 0.2s"}}>
          {displayedOptions.map((opt,di)=>{
            const isSel=selected===di;
            return (
              <button key={di} className="opt-btn" onClick={()=>!transitioning&&setSelected(di)}
                style={{padding:"16px 20px",background:isSel?"rgba(201,168,76,0.1)":"rgba(255,255,255,0.025)",
                  border:`1px solid ${isSel?"rgba(201,168,76,0.45)":"rgba(255,255,255,0.07)"}`,
                  borderRadius:6,textAlign:"left",color:isSel?G.parchment:"rgba(247,244,238,0.6)",
                  fontSize:14,lineHeight:1.55,transition:"all 0.15s",outline:"none"}}>
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"14px 24px",background:"rgba(22,22,40,0.98)",borderTop:`1px solid ${G.border}`,backdropFilter:"blur(16px)",display:"flex",gap:10,justifyContent:"center"}}>
        {currentQ>0&&<Btn variant="ghost" onClick={()=>{setSelected(answers[currentQ-1]??null);setCurrentQ(currentQ-1);}}>BACK</Btn>}
        <button onClick={handleNext} disabled={selected===null}
          style={{flex:1,maxWidth:320,padding:14,background:selected!==null?G.gold:"rgba(201,168,76,0.18)",border:"none",borderRadius:3,
            color:selected!==null?G.dark:"rgba(201,168,76,0.35)",fontSize:11,fontWeight:700,letterSpacing:"0.14em",
            cursor:selected!==null?"pointer":"not-allowed",transition:"background 0.2s"}}>
          {currentQ+1<TOTAL?"NEXT QUESTION":"COMPLETE ASSESSMENT"}
        </button>
      </div>

      {/* Live radar */}
      <div style={{position:"fixed",bottom:80,right:16,opacity:0.45}}>
        <Radar scores={liveScores} size={72}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: GENERATING REPORT
// ═══════════════════════════════════════════════════════════════════════════
function GeneratingPage({user,results,onDone}) {
  const [reportText,setReport]   = useState("");
  const [status,setStatus]       = useState("generating");
  const [error,setError]         = useState(null);
  const reportRef = useRef(null);

  useEffect(()=>{ generate(); },[]);

  async function generate() {
    try {
      const prompt = buildPrompt(results,user);
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","x-api-key":import.meta.env.VITE_ANTHROPIC_KEY},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,stream:true,messages:[{role:"user",content:prompt}]}),
      });
      if(!res.ok) throw new Error("API error");
      const reader=res.body.getReader(),dec=new TextDecoder();
      let buf="",full="";
      while(true){
        const{done,value}=await reader.read(); if(done) break;
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split("\n"); buf=lines.pop()||"";
        for(const line of lines){
          if(!line.startsWith("data: ")) continue;
          const d=line.slice(6).trim(); if(d==="[DONE]") continue;
          try{const p=JSON.parse(d);if(p.type==="content_block_delta"&&p.delta?.type==="text_delta"){full+=p.delta.text;setReport(full);if(reportRef.current)reportRef.current.scrollTop=reportRef.current.scrollHeight;}}catch{}
        }
      }
      setStatus("complete");

      // Save to Supabase
      const exp=new Date(); exp.setFullYear(exp.getFullYear()+1);
      await sb.upsert("valu_assessments",{
        user_id:sb.userId, full_name:user.full_name||user.email,
        role:user.role||"", email:user.email,
        valu_index:results.valuIndex, designation:results.desig?.name,
        cluster_scores:results.clusterScores, skill_scores:results.skillScores,
        future_ready_score:results.futureReadyScore, pathway:results.pathway,
        listed:results.listed, ai_report:full,
        gaming_detected:results.gamingDetected, speed_flag:results.speedFlag,
        uniformity_flag:results.uniformityFlag,
        expires_at:exp.toISOString(), completed_at:new Date().toISOString(),
      });

      // Send results email
      await sb.invokeFunction("send-email",{
        type:"results", to:user.email, name:user.full_name||"Professional",
        valu_index:results.valuIndex, designation:results.desig?.name,
        report_url:`https://valoriainstitute.com/profile`,
      });

      onDone(full);
    } catch(e){
      setError(e.message);setStatus("error");
    }
  }

  function buildPrompt(r,u) {
    const sorted=Object.entries(r.skillScores||{}).filter(([s])=>s!=="Validity").sort(([,a],[,b])=>b-a);
    const top=sorted.slice(0,3),bot=sorted.slice(-3).reverse();
    const wkCluster=r.weakest?.id;
    const wkSkills=sorted.filter(([s])=>SKILL_CLUSTER_MAP[s]===wkCluster).sort(([,a],[,b])=>a-b);
    const gap=wkSkills[0]?.[0]||bot[0]?.[0];
    const clusterDetail=CLUSTERS.map(c=>{
      const sk=sorted.filter(([s])=>SKILL_CLUSTER_MAP[s]===c.id);
      return `${c.name} (${r.clusterScores[c.id]}/100):\n`+sk.map(([s,sc])=>`  - ${s}: ${sc}/100`).join("\n");
    }).join("\n\n");
    return `You are writing a personalised professional development report for ${u.full_name||"this professional"}, a ${u.role||"professional"} who completed the VALU Index.

WRITING RULES:
1. Direct, plain language — trusted senior colleague tone.
2. Short sentences. Never use: journey, leverage (verb), holistic, impactful, synergy, empower, transformative, unlock, actionable.
3. Specific. Name the actual skill, actual consequence, actual programme.
4. Speak directly: "you."
5. No fluff. Every sentence earns its place.

THEIR SCORES:
VALU Index: ${r.valuIndex}/100 — ${r.desig?.name}
Listed: ${r.listed?"Yes":"No — needs 35+"}
Future-Ready: ${r.futureReadyScore}/100

${clusterDetail}

STRONGEST: ${top.map(([s,sc])=>`${s} (${sc})`).join(", ")}
WEAKEST: ${bot.map(([s,sc])=>`${s} (${sc})`).join(", ")}
PRIMARY GAP: ${gap} (${r.skillScores?.[gap]}/100)

PROGRAMMES:
- PRIME Sprint: 1 day, ₦150K–₦300K
- PRIME Cluster: 6 weeks, ₦500K–₦1.2M
- PRIME Certified Professional: 6 months, ₦200K–₦400K
- Executive Immersion: 3 days, ₦800K–₦2M

${!r.listed?`IMPORTANT: Score ${r.valuIndex} is below the 35-point listing minimum. PRIME Sprint is the path to getting listed.`:""}

WRITE THESE EXACT SECTIONS (start directly with ## YOUR SCORE, no preamble):

## YOUR SCORE: ${r.valuIndex}/100 — ${r.desig?.name?.toUpperCase()}
One paragraph. Plain language. What this score means to an employer who finds this profile.

## WHAT YOU ARE GOOD AT
Start: "Your strongest skill is [name it]." Top 2–3 skills, one sentence each. Make them feel seen — not flattered.

## WHERE YOU ARE LOSING GROUND
Start: "Your biggest gap right now is [name the gap skill]." Name the skill, score, what it costs them as a ${u.role||"professional"}. Direct. Max 130 words.

## WHAT THIS COSTS YOU IN THE NEXT 12 MONTHS
One paragraph. Specific: who overtakes them, what they fail to get, what they keep being passed over for.

## YOUR ONE ACTION FOR THIS WEEK
Give them one specific, concrete action for ${gap}. Then one sentence connecting it to their score.

## THE PROGRAMME YOU NEED RIGHT NOW
Name the programme. 3 sentences on why it fits their profile. Reference their actual skill scores.

${!r.listed?`\n## HOW TO GET LISTED\nScore ${r.valuIndex} is below minimum 35. PRIME Sprint is the direct path. Say clearly what score movement to expect.`:""}

## THE QUESTION TO SIT WITH
*One question in italics about ${gap}, specific to their role as a ${u.role||"professional"}. Make it uncomfortable enough to be useful.*`;
  }

  return (
    <div style={{minHeight:"100vh",background:G.dark,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{CSS}</style>
      <Stripe/>
      {/* Score header */}
      <div style={{background:G.mid,borderBottom:`1px solid ${G.border}`,padding:"28px 24px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:660,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
          <div>
            <div style={{fontSize:9,color:"rgba(201,168,76,0.45)",letterSpacing:"0.2em",marginBottom:4}}>VALU INDEX REPORT — {user.full_name||user.email}</div>
            <div style={{fontSize:11,color:G.muted}}>{user.role}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:52,fontWeight:300,color:G.gold,lineHeight:1}}>{results.valuIndex}</div>
              <div style={{fontSize:9,color:"rgba(247,244,238,0.2)",letterSpacing:"0.1em"}}>OUT OF 100</div>
            </div>
            <Radar scores={results.clusterScores} size={88}/>
          </div>
        </div>
        {/* Cluster pills */}
        <div style={{maxWidth:660,margin:"16px auto 0",display:"flex",gap:8,flexWrap:"wrap"}}>
          {CLUSTERS.map(c=>(
            <div key={c.id} style={{padding:"6px 12px",background:`${c.color}10`,border:`1px solid ${c.color}28`,borderRadius:4}}>
              <span style={{fontSize:12,color:c.color,fontWeight:600}}>{c.id} {results.clusterScores[c.id]}</span>
              <span style={{fontSize:10,color:"rgba(247,244,238,0.2)"}}>/100</span>
            </div>
          ))}
          <div style={{padding:"6px 14px",background:results.desig.bg,border:`1px solid ${results.desig.color}40`,borderRadius:4}}>
            <span style={{fontSize:10,fontWeight:700,color:results.desig.color,letterSpacing:"0.1em"}}>{results.desig.name.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Report body */}
      <div ref={reportRef} style={{maxWidth:660,margin:"0 auto",padding:"32px 24px 80px"}}>
        {status==="generating"&&reportText.length===0&&(
          <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",background:"rgba(201,168,76,0.05)",border:`1px solid ${G.border}`,borderRadius:6,marginBottom:24}}>
            <div style={{display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:G.gold,animation:`pulse 1.4s ease ${i*0.2}s infinite`}}/>)}</div>
            <span style={{fontSize:12,color:"rgba(201,168,76,0.65)",letterSpacing:"0.08em"}}>Analysing your profile across all 18 skills...</span>
          </div>
        )}
        {error&&<div style={{padding:"16px 20px",background:"rgba(216,90,48,0.08)",border:"1px solid rgba(216,90,48,0.3)",borderRadius:6,fontSize:13,color:"#D85A30",marginBottom:24}}>Report generation failed: {error}. Your score has been saved — contact hello@valoriainstituteafrica.com.</div>}
        {reportText&&<ReportRenderer text={reportText}/>}
        {status==="generating"&&reportText.length>0&&<span style={{display:"inline-block",width:2,height:16,background:G.gold,animation:"blink 1s step-end infinite",verticalAlign:"text-bottom",marginLeft:2}}/>}
        {status==="complete"&&(
          <div style={{marginTop:32,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{padding:"18px 22px",background:results.listed?"rgba(29,158,117,0.08)":"rgba(136,136,136,0.08)",border:`1px solid ${results.listed?"rgba(29,158,117,0.3)":"rgba(136,136,136,0.2)"}`,borderRadius:6,fontSize:13,color:results.listed?"#1D9E75":"#888",fontWeight:600,letterSpacing:"0.1em"}}>
              {results.listed?"✓ YOUR PROFILE IS NOW LISTED AND SEARCHABLE":"YOUR PROFILE IS NOT YET LISTED — SCORE BELOW 35"}
            </div>
            <div style={{padding:"14px 18px",background:"rgba(201,168,76,0.06)",border:`1px solid ${G.border}`,borderRadius:6,fontSize:12,color:G.muted}}>
              📧 Your results have been sent to <strong style={{color:G.gold}}>{user.email}</strong>
            </div>
            <Btn fullWidth onClick={()=>onDone(reportText)} style={{marginTop:8}}>VIEW MY PROFILE →</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: PROFILE DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function ProfilePage({user, assessment, onSignOut, onRetakeAssessment}) {
  const [tab,setTab]           = useState("results");
  const [bio,setBio]           = useState(user.bio||"");
  const [linkedin,setLinkedin] = useState(user.linkedin_url||"");
  const [saving,setSaving]     = useState(false);
  const [saved,setSaved]       = useState(false);
  const [photoUrl,setPhotoUrl] = useState(user.photo_url||null);
  const [videoUrl,setVideoUrl] = useState(user.video_url||null);
  const [uploading,setUploading] = useState({photo:false,video:false});
  const photoRef=useRef(),videoRef=useRef();

  async function saveProfile() {
    setSaving(true);
    await sb.update("profiles","id=eq."+sb.userId,{bio,linkedin_url:linkedin,photo_url:photoUrl,video_url:videoUrl});
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
  }

  async function handleFileUpload(type,file) {
    if(!file) return;
    const maxMB=type==="photo"?5:100;
    if(file.size>maxMB*1024*1024){alert(`File too large. Max ${maxMB}MB.`);return;}
    setUploading(u=>({...u,[type]:true}));
    const path=`${sb.userId}/${type}-${Date.now()}.${file.name.split(".").pop()}`;
    const url=await sb.uploadFile("profile-media",path,file);
    if(url){type==="photo"?setPhotoUrl(url):setVideoUrl(url);}
    setUploading(u=>({...u,[type]:false}));
  }

  const a = assessment;
  const desig = a ? (DESIGNATIONS.find(d=>a.valu_index>=d.min)||DESIGNATIONS[DESIGNATIONS.length-1]) : null;
  const tabs = [
    {id:"results",label:"MY RESULTS"},
    {id:"profile",label:"MY PROFILE"},
    {id:"report",label:"AI REPORT"},
    {id:"training",label:"TRAINING"},
  ];

  return (
    <div style={{minHeight:"100vh",background:G.dark,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{CSS}</style>
      <Stripe/>

      {/* TOP NAV */}
      <div style={{position:"sticky",top:0,zIndex:40,background:"rgba(22,22,40,0.98)",borderBottom:`1px solid ${G.border}`,backdropFilter:"blur(16px)",padding:"0 24px",display:"flex",alignItems:"stretch",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:32}}>
          <div style={{padding:"16px 0"}}><Wordmark size={0.7}/></div>
          <div style={{display:"flex",gap:2}}>
            {tabs.map(t=>(
              <button key={t.id} className="tab-btn" onClick={()=>setTab(t.id)}
                style={{padding:"18px 16px",background:"transparent",border:"none",fontSize:10,fontWeight:600,letterSpacing:"0.14em",
                  color:tab===t.id?G.gold:"rgba(247,244,238,0.3)",
                  borderBottom:tab===t.id?`2px solid ${G.gold}`:"2px solid transparent",
                  transition:"all 0.2s",cursor:"pointer"}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          {photoUrl
            ? <img src={photoUrl} alt="Profile" style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:`1px solid ${G.border}`}}/>
            : <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(201,168,76,0.1)",border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:G.gold}}>{(user.full_name||user.email||"?")[0].toUpperCase()}</div>
          }
          <span style={{fontSize:12,color:G.muted}}>{user.full_name||user.email}</span>
          <Btn variant="ghost" onClick={onSignOut} style={{padding:"8px 14px",fontSize:10}}>SIGN OUT</Btn>
        </div>
      </div>

      {/* ── TAB: RESULTS ─────────────────────────────────────────── */}
      {tab==="results"&&(
        <div style={{maxWidth:900,margin:"0 auto",padding:"40px 24px"}}>
          {!a ? (
            <div style={{textAlign:"center",padding:"80px 24px"}}>
              <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:36,fontWeight:300,color:G.parchment,marginBottom:16}}>You haven't taken the assessment yet.</div>
              <p style={{fontSize:14,color:G.muted,marginBottom:28}}>The VALU Index takes 18–28 minutes. Your personalised AI report is generated immediately on completion.</p>
              <Btn onClick={onRetakeAssessment}>BEGIN THE VALU INDEX</Btn>
            </div>
          ) : (
            <>
              {/* Score hero */}
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:32,marginBottom:32,padding:"36px",background:G.mid,borderRadius:8,border:`1px solid ${G.border}`}}>
                <div>
                  <div style={{fontSize:9,color:"rgba(201,168,76,0.4)",letterSpacing:"0.2em",marginBottom:12}}>VALU INDEX SCORE</div>
                  <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:80,fontWeight:300,color:G.gold,lineHeight:0.9,marginBottom:12}}>{a.valu_index}</div>
                  <div style={{fontSize:10,color:"rgba(247,244,238,0.3)",letterSpacing:"0.1em",marginBottom:20}}>OUT OF 100</div>
                  <div style={{display:"inline-flex",alignItems:"center",padding:"8px 16px",background:desig.bg,border:`1px solid ${desig.color}40`,borderRadius:4}}>
                    <span style={{fontSize:11,fontWeight:700,color:desig.color,letterSpacing:"0.1em"}}>{desig.name.toUpperCase()}</span>
                  </div>
                  <div style={{marginTop:16,display:"flex",gap:16}}>
                    <div>
                      <div style={{fontSize:9,color:G.muted,letterSpacing:"0.12em",marginBottom:4}}>FUTURE-READY</div>
                      <div style={{fontSize:20,fontWeight:600,color:"#E8A020"}}>{a.future_ready_score}<span style={{fontSize:12,color:G.muted}}>/100</span></div>
                    </div>
                    <div style={{width:1,background:G.border}}/>
                    <div>
                      <div style={{fontSize:9,color:G.muted,letterSpacing:"0.12em",marginBottom:4}}>PATHWAY</div>
                      <div style={{fontSize:13,fontWeight:500,color:G.parchment}}>{a.pathway}</div>
                    </div>
                    <div style={{width:1,background:G.border}}/>
                    <div>
                      <div style={{fontSize:9,color:G.muted,letterSpacing:"0.12em",marginBottom:4}}>LISTED</div>
                      <div style={{fontSize:13,fontWeight:500,color:a.listed?"#1D9E75":"#888"}}>{a.listed?"Yes":"Not yet"}</div>
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center"}}>
                  <Radar scores={a.cluster_scores||{}} size={160}/>
                </div>
              </div>

              {/* Cluster breakdown */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,marginBottom:32}}>
                {CLUSTERS.map(c=>{
                  const skillsInCluster=Object.entries(a.skill_scores||{}).filter(([s])=>SKILL_CLUSTER_MAP[s]===c.id).sort(([,a],[,b])=>b-a);
                  return (
                    <div key={c.id} style={{padding:"20px",background:G.mid,borderRadius:6,border:`1px solid ${c.color}25`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                        <div style={{width:24,height:24,borderRadius:4,background:`${c.color}18`,border:`1px solid ${c.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:c.color}}>{c.id}</div>
                        <span style={{fontSize:12,fontWeight:600,color:c.color}}>{c.name}</span>
                        <span style={{marginLeft:"auto",fontSize:18,fontWeight:300,color:c.color}}>{(a.cluster_scores||{})[c.id]}<span style={{fontSize:11,color:"rgba(247,244,238,0.2)"}}>/100</span></span>
                      </div>
                      {skillsInCluster.map(([skill,score])=><ClusterBar key={skill} label={skill} score={score} color={c.color}/>)}
                    </div>
                  );
                })}
              </div>

              {/* Retake */}
              <div style={{textAlign:"center",paddingTop:16}}>
                <p style={{fontSize:12,color:"rgba(247,244,238,0.2)",marginBottom:12}}>Assessment completed: {new Date(a.completed_at).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</p>
                <Btn variant="ghost" onClick={onRetakeAssessment}>RETAKE ASSESSMENT</Btn>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: PROFILE ─────────────────────────────────────────── */}
      {tab==="profile"&&(
        <div style={{maxWidth:720,margin:"0 auto",padding:"40px 24px"}}>
          <h2 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:32,fontWeight:300,color:G.parchment,marginBottom:8}}>Your Profile</h2>
          <p style={{fontSize:13,color:G.muted,marginBottom:32}}>This is what employers and event organisers see when they find your Valoria profile.</p>

          {/* Photo upload */}
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:24,marginBottom:32,padding:24,background:G.mid,borderRadius:8,border:`1px solid ${G.border}`,alignItems:"center"}}>
            <div style={{position:"relative"}}>
              {photoUrl
                ? <img src={photoUrl} alt="Profile" style={{width:88,height:88,borderRadius:"50%",objectFit:"cover",border:`2px solid ${G.border}`}}/>
                : <div style={{width:88,height:88,borderRadius:"50%",background:"rgba(201,168,76,0.08)",border:`2px dashed ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={G.gold} strokeWidth="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={G.gold} strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
              }
              {uploading.photo&&<div style={{position:"absolute",inset:0,borderRadius:"50%",background:"rgba(26,26,46,0.7)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:20,height:20,border:"2px solid rgba(201,168,76,0.3)",borderTopColor:G.gold,borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/></div>}
            </div>
            <div>
              <div style={{fontSize:13,color:G.parchment,fontWeight:500,marginBottom:4}}>Profile photo</div>
              <div style={{fontSize:12,color:G.muted,marginBottom:12}}>JPG or PNG, max 5MB. Square images work best.</div>
              <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFileUpload("photo",e.target.files[0])}/>
              <Btn variant="ghost" onClick={()=>photoRef.current?.click()} style={{padding:"8px 16px",fontSize:10}}>{uploading.photo?"UPLOADING...":"UPLOAD PHOTO"}</Btn>
            </div>
          </div>

          {/* Profile fields */}
          <div style={{padding:24,background:G.mid,borderRadius:8,border:`1px solid ${G.border}`,marginBottom:24}}>
            <Input label="PROFESSIONAL BIO" as="textarea" value={bio} onChange={e=>setBio(e.target.value)} placeholder="Write 2–3 sentences about your professional focus, what you're known for, and what you're building toward." style={{minHeight:120}}/>
            <Input label="LINKEDIN URL" optional value={linkedin} onChange={e=>setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/yourname" style={{marginBottom:0}}/>
          </div>

          {/* Video upload */}
          <div style={{padding:24,background:G.mid,borderRadius:8,border:`1px solid ${G.border}`,marginBottom:24}}>
            <div style={{fontSize:9,color:"rgba(201,168,76,0.5)",letterSpacing:"0.2em",marginBottom:12}}>INTRODUCTION VIDEO <span style={{color:"rgba(201,168,76,0.3)",fontWeight:400"}}>(optional)</span></div>
            <p style={{fontSize:12,color:G.muted,lineHeight:1.7,marginBottom:16}}>A 60–90 second introduction video significantly increases profile engagement. Record yourself sharing your professional focus and what you're looking for. MP4, max 100MB.</p>
            {videoUrl&&(
              <video src={videoUrl} controls style={{width:"100%",borderRadius:6,marginBottom:16,background:"#000",maxHeight:240}}/>
            )}
            <input ref={videoRef} type="file" accept="video/*" style={{display:"none"}} onChange={e=>handleFileUpload("video",e.target.files[0])}/>
            <Btn variant="ghost" onClick={()=>videoRef.current?.click()} style={{padding:"8px 16px",fontSize:10}}>{uploading.video?"UPLOADING...":videoUrl?"REPLACE VIDEO":"UPLOAD VIDEO"}</Btn>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <Btn loading={saving} onClick={saveProfile}>SAVE PROFILE</Btn>
            {saved&&<span style={{fontSize:12,color:"#1D9E75"}}>✓ Profile saved</span>}
          </div>
        </div>
      )}

      {/* ── TAB: AI REPORT ───────────────────────────────────────── */}
      {tab==="report"&&(
        <div style={{maxWidth:700,margin:"0 auto",padding:"40px 24px"}}>
          {!a?.ai_report ? (
            <div style={{textAlign:"center",padding:"80px 0"}}>
              <p style={{fontSize:14,color:G.muted}}>Complete your assessment to see your AI report here.</p>
              <Btn onClick={onRetakeAssessment} style={{marginTop:20}}>BEGIN THE VALU INDEX</Btn>
            </div>
          ) : (
            <>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
                <div>
                  <h2 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:28,fontWeight:300,color:G.parchment,marginBottom:4}}>Your AI Report</h2>
                  <p style={{fontSize:12,color:G.muted}}>Generated {new Date(a.completed_at).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</p>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:40,fontWeight:300,color:G.gold,lineHeight:1}}>{a.valu_index}</div>
                  <div style={{fontSize:9,color:G.muted,letterSpacing:"0.1em"}}>VALU INDEX</div>
                </div>
              </div>
              <div style={{padding:"28px",background:G.mid,borderRadius:8,border:`1px solid ${G.border}`}}>
                <ReportRenderer text={a.ai_report}/>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: TRAINING ────────────────────────────────────────── */}
      {tab==="training"&&(
        <div style={{maxWidth:900,margin:"0 auto",padding:"40px 24px"}}>
          <h2 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:32,fontWeight:300,color:G.parchment,marginBottom:8}}>Training Programmes</h2>
          <p style={{fontSize:13,color:G.muted,marginBottom:32}}>
            {a ? `Based on your VALU Index of ${a.valu_index}/100, your recommended pathway is the ${a.pathway}.` : "Complete your assessment to get a personalised programme recommendation."}
          </p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:20}}>
            {[
              {name:"PRIME Sprint",duration:"1 Day Intensive",price:"₦150,000–₦300,000",desc:"One urgent cluster. Fast score movement. The fastest path to getting listed on the platform.",color:"#1D9E75",recommended:a?.pathway==="PRIME Sprint"},
              {name:"PRIME Cluster Programme",duration:"6 Weeks",price:"₦500,000–₦1,200,000",desc:"Deep work on your weakest cluster. Designed for measurable VALU Index movement.",color:"#378ADD",recommended:a?.pathway==="PRIME Cluster"},
              {name:"PRIME Certified Professional",duration:"6 Months",price:"₦200,000–₦400,000",desc:"Full PRIME certification across all five clusters. The credential that opens the facilitator pathway.",color:G.gold,recommended:a?.pathway==="PRIME Programme"||a?.pathway==="PCP Certification"},
              {name:"Executive Immersion",duration:"3 Days Residential",price:"₦800,000–₦2,000,000",desc:"C-suite and senior leaders. All five clusters. Time-compressed for maximum impact.",color:"#D85A30",recommended:false},
            ].map(p=>(
              <div key={p.name} style={{padding:"24px",background:G.mid,borderRadius:8,border:`1px solid ${p.recommended?`${p.color}50`:G.border}`,position:"relative",overflow:"hidden"}}>
                {p.recommended&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:p.color,opacity:0.8}}/>}
                {p.recommended&&<div style={{display:"inline-block",padding:"3px 10px",background:`${p.color}20`,border:`1px solid ${p.color}40`,borderRadius:2,fontSize:9,fontWeight:700,color:p.color,letterSpacing:"0.15em",marginBottom:12}}>RECOMMENDED FOR YOU</div>}
                <div style={{fontSize:14,fontWeight:600,color:p.color,marginBottom:4}}>{p.name}</div>
                <div style={{fontSize:11,color:G.muted,marginBottom:12}}>{p.duration}</div>
                <p style={{fontSize:13,color:"rgba(247,244,238,0.55)",lineHeight:1.7,marginBottom:16}}>{p.desc}</p>
                <div style={{fontSize:15,fontWeight:600,color:G.parchment,marginBottom:16}}>{p.price}</div>
                <Btn variant="ghost" style={{padding:"9px 18px",fontSize:10,width:"100%",justifyContent:"center"}} onClick={()=>window.open("https://valoriainstitute.com/programmes","_blank")}>ENQUIRE NOW →</Btn>
              </div>
            ))}
          </div>

          {/* Materials section */}
          <div style={{marginTop:40}}>
            <h3 style={{fontSize:14,fontWeight:600,color:G.parchment,letterSpacing:"0.1em",marginBottom:20}}>PRIME FRAMEWORK RESOURCES</h3>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {title:"The PRIME Framework — Overview",type:"PDF",locked:false},
                {title:"Cluster P: Presence — Development Guide",type:"PDF",locked:!a},
                {title:"Cluster R: Relationships — Development Guide",type:"PDF",locked:!a},
                {title:"Cluster I: Intelligence — Development Guide",type:"PDF",locked:!a},
                {title:"Cluster M: Mastery — Development Guide",type:"PDF",locked:!a},
                {title:"Cluster E: Enterprise — Development Guide",type:"PDF",locked:!a},
                {title:"VALU Index Interpretation Guide",type:"PDF",locked:!a},
              ].map((m,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",background:G.mid,borderRadius:6,border:`1px solid ${G.border}`,opacity:m.locked?0.45:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:32,height:32,borderRadius:4,background:"rgba(201,168,76,0.08)",border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:G.gold}}>{m.type}</div>
                    <span style={{fontSize:13,color:G.parchment}}>{m.title}</span>
                  </div>
                  {m.locked
                    ? <span style={{fontSize:10,color:"rgba(247,244,238,0.2)"}}>🔒 Complete assessment to unlock</span>
                    : <Btn variant="ghost" style={{padding:"6px 14px",fontSize:10}}>DOWNLOAD</Btn>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT — APP ROUTER
// ═══════════════════════════════════════════════════════════════════════════
export default function ValoriaApp() {
  const [page,setPage]             = useState("loading"); // loading | auth | assessment | generating | profile
  const [user,setUser]             = useState(null);
  const [assessment,setAssessment] = useState(null);
  const [pendingResults,setPending] = useState(null);

  // On mount — check for existing session
  useEffect(()=>{
    (async()=>{
      const session = await sb.getSession();
      if (session?.user) {
        const profiles = await sb.select("profiles","id=eq."+session.user.id);
        const assessments = await sb.select("valu_assessments","user_id=eq."+session.user.id+"&order=completed_at.desc&limit=1");
        setUser({...session.user,...(profiles[0]||{})});
        setAssessment(assessments[0]||null);
        setPage("profile");
      } else {
        setPage("auth");
      }
    })();
  },[]);

  async function handleAuth(u) {
    setUser(u);
    // Fetch any existing assessment
    if(u.id||sb.userId){
      const assessments = await sb.select("valu_assessments","user_id=eq."+(u.id||sb.userId)+"&order=completed_at.desc&limit=1");
      setAssessment(assessments[0]||null);
    }
    setPage("profile");
  }

  function handleAssessmentComplete(answers, timings, shuffleMap) {
    const results = computeResults(answers, timings, shuffleMap);
    setPending(results);
    setPage("generating");
  }

  function handleReportDone(reportText) {
    // Refresh assessment from DB
    (async()=>{
      if(sb.userId){
        const assessments = await sb.select("valu_assessments","user_id=eq."+sb.userId+"&order=completed_at.desc&limit=1");
        setAssessment(assessments[0]||null);
      }
      setPage("profile");
    })();
  }

  async function handleSignOut() {
    await sb.signOut();
    localStorage.removeItem("valoria_session");
    setUser(null); setAssessment(null); setPending(null);
    setPage("auth");
  }

  // Loading screen
  if (page==="loading") return (
    <div style={{minHeight:"100vh",background:G.dark,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{CSS}</style>
      <div style={{textAlign:"center"}}>
        <Wordmark/>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:24}}>
          {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:G.gold,animation:`pulse 1.4s ease ${i*0.2}s infinite`}}/>)}
        </div>
      </div>
    </div>
  );

  if (page==="auth")       return <AuthPage onAuth={handleAuth}/>;
  if (page==="assessment") return <AssessmentPage user={user} onComplete={handleAssessmentComplete}/>;
  if (page==="generating") return <GeneratingPage user={user} results={pendingResults} onDone={handleReportDone}/>;
  if (page==="profile")    return (
    <ProfilePage
      user={user}
      assessment={assessment}
      onSignOut={handleSignOut}
      onRetakeAssessment={()=>setPage("assessment")}
    />
  );
  return null;
}
