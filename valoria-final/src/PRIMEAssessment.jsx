// PRIMEAssessment.jsx — v2.2
// Changes from v2.1:
//  - isLockActive now receives assessmentLockRecord.fingerprint (was always-false bug)
//  - Resume name-match re-introduction fixed in assessing phase block
//  - ClusterStripe removed from all four screens — owned by ValoriaNav in platform shell
//  - Radar size in live assessment bottom bar: 56 → 100px
//  - Token sweep: all hardcoded borderRadius 2/3 replaced with T.radius.chip
//  - saveCheckpoint useEffect deps completed: [answers, currentQ, name, role, sessionSeed]
//  - saveToSupabase now retries once on transient failure before surfacing error
//  - localStorage pending report fallback error state wired to UI
//  - Lock set immediately on assessment completion via onAssessmentSubmitted callback
//  - onPhaseChange callback fires on every phase transition so ValoriaPlatform can
//    switch nav to minimal mode during the question sequence
//  - Welcome email sent on signup (combined with report delivery in /api/send-email)
//  - Email stored in Supabase row on both initial save and on signup

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  computeFingerprint,
  isLockActive,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "./assessmentLock.js";

// ── FONT INJECTION — once at module level ─────────────────────────────────
if (typeof document !== "undefined") {
  const FONT_ID = "vi-fonts-raleway";
  if (!document.getElementById(FONT_ID)) {
    const s = document.createElement("style");
    s.id = FONT_ID;
    s.textContent = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&family=Raleway:ital,wght@0,400;0,600;1,300;1,400&family=DM+Mono:wght@400&display=swap');
    *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    input, select, textarea { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
    input::placeholder { color: rgba(247,244,238,0.2) !important; }
    input:focus { outline: none; border-color: rgba(201,168,76,0.5) !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.08) !important; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
    @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pulse { 0%,80%,100% { opacity:0.2; transform:scale(0.8); } 40% { opacity:1; transform:scale(1); } }
    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
    @keyframes checkIn { from { transform:scale(0) rotate(-10deg); opacity:0; } to { transform:scale(1) rotate(0deg); opacity:1; } }
    @keyframes optionSelect { 0% { transform:scale(1); } 50% { transform:scale(0.985); } 100% { transform:scale(1); } }`;
    document.head.appendChild(s);
  }
}

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────
const T = {
  dark:      "#0F0F1A",
  midnight:  "#1A1A2E",
  parchment: "#F7F4EE",
  gold:      "#C9A84C",
  amber:     "#BA7517",
  coral:     "#D85A30",
  text: {
    primary:   "rgba(247,244,238,1)",
    secondary: "rgba(247,244,238,0.65)",
    tertiary:  "rgba(247,244,238,0.45)",
    muted:     "rgba(247,244,238,0.30)",
    ghost:     "rgba(247,244,238,0.15)",
  },
  size: {
    display: 48,
    h1:      28,
    h2:      20,
    body:    14,
    small:   12,
    caption: 10,
    micro:   11,
  },
  radius: {
    pill: 9999,
    card: 12,
    chip: 6,
  },
  font: {
    display: "'Cormorant Garamond', Georgia, serif",
    body:    "'DM Sans', sans-serif",
    label:   "'Raleway', sans-serif",
    mono:    "'DM Mono', monospace",
  },
  cluster: {
    P: "#1D9E75",
    R: "#378ADD",
    I: "#7F77DD",
    M: "#BA7517",
    E: "#D85A30",
  },
};

// ── SHARED STYLE HELPERS ───────────────────────────────────────────────────
const inputBase = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(247,244,238,0.1)",
  borderRadius: T.radius.chip,
  padding: "13px 16px",
  color: T.parchment,
  fontSize: T.size.body,
  fontFamily: T.font.body,
  transition: "border-color 0.25s, box-shadow 0.25s",
};
const labelBase = {
  display: "block",
  fontSize: T.size.micro,
  fontWeight: 700,
  color: "rgba(201,168,76,0.5)",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  marginBottom: 8,
  fontFamily: T.font.label,
};
const pillBtn = (variant = "primary") => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 28px",
  borderRadius: T.radius.pill,
  fontSize: T.size.caption,
  fontWeight: 700,
  letterSpacing: "0.16em",
  fontFamily: T.font.body,
  cursor: "pointer",
  transition: "background 0.2s, color 0.2s, box-shadow 0.2s, transform 0.1s",
  border: "none",
  ...(variant === "primary" && {
    background: T.gold,
    color: T.dark,
    boxShadow: "0 4px 20px rgba(201,168,76,0.25)",
  }),
  ...(variant === "ghost" && {
    background: "transparent",
    color: T.text.tertiary,
    border: "1px solid rgba(247,244,238,0.15)",
  }),
  ...(variant === "gold-ghost" && {
    background: "rgba(201,168,76,0.08)",
    color: T.gold,
    border: "1px solid rgba(201,168,76,0.25)",
  }),
  ...(variant === "danger" && {
    background: "rgba(216,90,48,0.12)",
    color: T.coral,
    border: "1px solid rgba(216,90,48,0.35)",
  }),
  ...(variant === "disabled" && {
    background: "rgba(201,168,76,0.12)",
    color: "rgba(201,168,76,0.25)",
    border: "1px solid rgba(201,168,76,0.15)",
    cursor: "not-allowed",
  }),
});

// ── PAGE NUMBER ────────────────────────────────────────────────────────────
function PageNumber({ current, total }) {
  return (
    <div style={{
      fontFamily: T.font.label,
      fontStyle: "italic",
      fontWeight: 300,
      fontSize: T.size.body,
      color: T.text.muted,
      letterSpacing: "0.04em",
      whiteSpace: "nowrap",
      userSelect: "none",
    }}>
      {current} <span style={{ color: T.text.ghost }}>/ {total}</span>
    </div>
  );
}

// ── NOISE GRAIN ────────────────────────────────────────────────────────────
function Grain() {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.06,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundSize: "256px",
    }} />
  );
}

// ── AMBIENT GLOW ──────────────────────────────────────────────────────────
function AmbientGlow({ color = "rgba(201,168,76,0.09)" }) {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
      background: `radial-gradient(ellipse 100% 50% at 50% 0%, ${color} 0%, transparent 60%)`,
    }} />
  );
}

// ── CLUSTER CONFIG ─────────────────────────────────────────────────────────
const CLUSTERS = [
  { id:"P", name:"Presence",      theme:"How you show up",  color: T.cluster.P, weight:0.20, maxRaw:36 },
  { id:"R", name:"Relationships", theme:"How you connect",  color: T.cluster.R, weight:0.25, maxRaw:48 },
  { id:"I", name:"Intelligence",  theme:"How you think",    color: T.cluster.I, weight:0.25, maxRaw:60 },
  { id:"M", name:"Mastery",       theme:"How you deliver",  color: T.cluster.M, weight:0.20, maxRaw:36 },
  { id:"E", name:"Enterprise",    theme:"How you create",   color: T.cluster.E, weight:0.10, maxRaw:36 },
];

const DESIGNATIONS = [
  { min:80, name:"Force to Align With",    color: T.gold,       bg:"rgba(201,168,76,0.12)",  desc:"Operating at the highest expression of professional capability. You are recognised on the platform as a priority professional." },
  { min:65, name:"Emerging Force",         color:"#378ADD",     bg:"rgba(55,138,221,0.10)",  desc:"Strong foundations with clear areas of excellence. You are on the trajectory — deliberate development will complete the picture." },
  { min:50, name:"Developing Professional",color:"#1D9E75",     bg:"rgba(29,158,117,0.10)",  desc:"Genuine capability with uneven development. Your PRIME pathway is shown on your profile." },
  { min:35, name:"Building Foundations",   color: T.amber,      bg:"rgba(186,117,23,0.10)",  desc:"Early-stage professional architecture. A PRIME Sprint is your recommended next step." },
  { min:0,  name:"At the Starting Point",  color:"#888888",     bg:"rgba(136,136,136,0.10)", desc:"Not yet listed on the candidate platform. Complete a PRIME Sprint to qualify for listing." },
];

// ── QUESTION BANK ──────────────────────────────────────────────────────────
const ALL_QUESTIONS = [
  { id:"P1a", cluster:"P", skill:"Communication", type:"behavioural",
    q:"You need to explain a complex decision to a mixed audience — some technical, some not. What do you do?",
    options:[
      {text:"I share the full picture so everyone starts from the same information.",score:1},
      {text:"I lead with the decision and its implications, then add detail based on who asks.",score:3},
      {text:"I prepare a version for each audience type before the conversation.",score:4},
      {text:"I simplify the technical parts and signal that more detail is available.",score:2},
    ]},
  { id:"P1b", cluster:"P", skill:"Communication", type:"situational",
    q:"You are presenting a recommendation to leadership when you sense they have already decided differently. What do you do?",
    options:[
      {text:"Finish the presentation — they should hear everything before I adjust.",score:1},
      {text:"Name what I am sensing and ask what their current thinking is before continuing.",score:3},
      {text:"Pivot to the one point most likely to shift their position and invite the disagreement.",score:4},
      {text:"Accelerate through the key points before I lose the room entirely.",score:2},
    ]},
  { id:"P1c", cluster:"P", skill:"Communication", type:"reflective",
    q:"Think of the last time someone told you they did not understand your explanation. What was your honest reaction?",
    options:[
      {text:"I assumed the explanation was clear and wondered if they had followed it properly.",score:1},
      {text:"I treated it as a signal that my explanation was the problem and redesigned it.",score:4},
      {text:"I went through it again using simpler language to make it clearer.",score:2},
      {text:"I stopped and asked what specifically was unclear before rebuilding the explanation.",score:3},
    ]},
  { id:"P2a", cluster:"P", skill:"Negotiation", type:"behavioural",
    q:"Before entering a significant negotiation — salary, contract, or partnership — what do you actually do to prepare?",
    options:[
      {text:"I research comparable benchmarks and prepare a clear justification for my position.",score:2},
      {text:"I map both sides — what I need, what they likely care about — before deciding my opening.",score:3},
      {text:"I know what I want and go in ready to make the case.",score:1},
      {text:"I map interests, trade-offs, walk-away positions, and what I will and will not concede — before the conversation starts.",score:4},
    ]},
  { id:"P2b", cluster:"P", skill:"Negotiation", type:"situational",
    q:"You are negotiating and the other party opens significantly below your expectation. What is your move?",
    options:[
      {text:"State that it is too low and name what I actually need.",score:1},
      {text:"Ask what is driving their number before deciding how to respond.",score:3},
      {text:"Counter firmly with my number and a strong rationale for why it is justified.",score:2},
      {text:"Probe the interest behind their position, then explore whether non-price variables can close the gap.",score:4},
    ]},
  { id:"P2c", cluster:"P", skill:"Negotiation", type:"reflective",
    q:"Describe a negotiation where you settled for less than you wanted. What actually went wrong?",
    options:[
      {text:"I had not defined my walk-away position, so I did not recognise the moment to use it.",score:4},
      {text:"The other side had stronger leverage or was better prepared than I expected.",score:1},
      {text:"I did not anchor high enough at the start, which limited the final range.",score:2},
      {text:"I did not fully understand what they valued, so I could not find a trade that worked for both sides.",score:3},
    ]},
  { id:"P3a", cluster:"P", skill:"Personal Brand & Executive Presence", type:"behavioural",
    q:"How would a professional who can only see your digital presence describe what you stand for?",
    options:[
      {text:"They would know my role and industry but probably not much more.",score:1},
      {text:"They would know precisely what I stand for and why I am worth a conversation.",score:4},
      {text:"They would get a clear sense of my expertise and the kind of professional I am.",score:3},
      {text:"They would see my field and some of my thinking, though not a complete picture.",score:2},
    ]},
  { id:"P3b", cluster:"P", skill:"Personal Brand & Executive Presence", type:"situational",
    q:"You walk into a high-stakes room where you know nobody — a client pitch, a leadership meeting, a major conference. How do you show up?",
    options:[
      {text:"I research who will be in the room and arrive knowing exactly who I want to reach.",score:3},
      {text:"I let the conversation come to me and wait for the right introduction.",score:1},
      {text:"I introduce myself and make sure key people know my role and organisation.",score:2},
      {text:"I know precisely what impression I want to leave and have planned how I will create it — entry, approach, conversation, and close.",score:4},
    ]},
  { id:"P3c", cluster:"P", skill:"Personal Brand & Executive Presence", type:"reflective",
    q:"When did you last receive feedback about how you come across professionally — and what did you do with it?",
    options:[
      {text:"I treat how I come across as a practised skill — I seek feedback and track whether changes are landing.",score:4},
      {text:"I do not recall specific feedback of this kind in recent memory.",score:1},
      {text:"I have received feedback and I keep it in mind when relevant situations come up.",score:2},
      {text:"I actively seek this type of feedback and have made specific, traceable changes based on it.",score:3},
    ]},
  { id:"R1a", cluster:"R", skill:"Emotional Intelligence", type:"behavioural",
    q:"You are in a high-pressure meeting and someone says something that genuinely irritates you. What actually happens next?",
    options:[
      {text:"I notice the reaction, give myself a beat, and choose my response rather than react.",score:3},
      {text:"I address it in the moment — it is better than letting it sit.",score:1},
      {text:"I hold back but the irritation probably shapes how I engage for the rest of the meeting.",score:2},
      {text:"I name the emotion to myself, regulate it in real time, and decide whether to address it now or later.",score:4},
    ]},
  { id:"R1b", cluster:"R", skill:"Emotional Intelligence", type:"situational",
    q:"A colleague who is usually high-performing has become visibly disengaged over the past two weeks. Nobody else has noticed. What do you do?",
    options:[
      {text:"Find a quiet moment to check in directly without framing it as a performance conversation.",score:3},
      {text:"Let it unfold — they will address it themselves if it becomes a real problem.",score:1},
      {text:"Check in privately, create genuine space for what they want to share, and think carefully about what they actually need.",score:4},
      {text:"Mention it to their manager so someone with authority is aware of the change.",score:2},
    ]},
  { id:"R1c", cluster:"R", skill:"Emotional Intelligence", type:"reflective",
    q:"Think of a time you handled a difficult emotion badly at work. What happened and what do you understand now that you did not then?",
    options:[
      {text:"I generally keep things professional — I cannot think of a clear example of handling emotion badly.",score:1},
      {text:"I have a specific example, a clear analysis of the trigger, and a practice I have built since then to catch it earlier.",score:4},
      {text:"I can think of a time. I would handle it differently now, though I am not entirely sure how.",score:2},
      {text:"I can name the situation, what triggered me, and how I would regulate it earlier if it happened again.",score:3},
    ]},
  { id:"R2a", cluster:"R", skill:"Conflict Resolution", type:"behavioural",
    q:"You are aware of unspoken tension between two team members that is starting to affect group performance. What do you do?",
    options:[
      {text:"Give it time — most tensions resolve without intervention if not made worse.",score:1},
      {text:"Have a deliberate sequence — understand each side privately, diagnose whether it is relational or task-based, then design a resolution conversation.",score:4},
      {text:"Mention it to each of them separately and see if that shifts things.",score:2},
      {text:"Speak to each person individually to understand what is happening, then create a structure to address it.",score:3},
    ]},
  { id:"R2b", cluster:"R", skill:"Conflict Resolution", type:"situational",
    q:"Two senior people are in open disagreement in a meeting and the conversation is breaking down. You are not the most senior person in the room. What do you do?",
    options:[
      {text:"Stay quiet — it is not my place to intervene when I am not the most senior.",score:1},
      {text:"Redirect toward the agenda to keep the meeting moving and limit further damage.",score:2},
      {text:"Name the breakdown, separate positions from interests, and redirect toward what both parties actually need.",score:4},
      {text:"Name what is happening and suggest a short pause or a reframe of the question.",score:3},
    ]},
  { id:"R2c", cluster:"R", skill:"Conflict Resolution", type:"reflective",
    q:"Think of a workplace conflict you were involved in — directly or as a mediator. What made it difficult and what would you do differently?",
    options:[
      {text:"I have a specific example, a precise analysis of what each party needed, and an intervention that would have resolved it sooner — which I have since used successfully.",score:4},
      {text:"Most conflicts I have experienced were mainly driven by the other party — I tend to be reasonable in these situations.",score:1},
      {text:"I understand what made it difficult and know specifically what I would do differently — go to understand their position earlier and with more genuine curiosity.",score:3},
      {text:"I can think of one. Emotions were high and I was focused on being right rather than resolving it.",score:2},
    ]},
  { id:"R3a", cluster:"R", skill:"People Development", type:"behavioural",
    q:"Someone on your team makes a significant mistake on an important piece of work. What is your first move?",
    options:[
      {text:"Fix it — the outcome is the priority in the moment.",score:1},
      {text:"Use it as a deliberate development moment — diagnosis, structured reflection, a specific action, and a follow-up to confirm the learning has landed.",score:4},
      {text:"Correct it and walk them through what they should have done differently.",score:2},
      {text:"Ask them to walk me through their thinking, then help them identify where it went wrong.",score:3},
    ]},
  { id:"R3b", cluster:"R", skill:"People Development", type:"situational",
    q:"You have a team member who is highly capable but consistently underdelivering. Their potential is obvious but something is blocking it. How do you approach this?",
    options:[
      {text:"Have a direct conversation about the performance gap and what needs to change.",score:1},
      {text:"Give them clearer direction and more scaffolding to help them get back on track.",score:2},
      {text:"Start with genuine curiosity about what is happening for them — capability gaps usually have context that is not visible.",score:3},
      {text:"Treat it as a diagnostic challenge — separate capability, motivation, and context to identify the actual blocker and design a specific intervention for it.",score:4},
    ]},
  { id:"R3c", cluster:"R", skill:"People Development", type:"reflective",
    q:"Who is the person whose professional growth you are most proud to have contributed to? What specifically did you do?",
    options:[
      {text:"I can name someone and describe the capability gaps I identified, the deliberate interventions I designed, and the measurable difference in their trajectory.",score:4},
      {text:"I have supported people but struggle to identify specific growth I directly caused.",score:1},
      {text:"I can name someone and describe specific things I did that I can trace to their development.",score:3},
      {text:"I can name someone. I gave them opportunities and encouragement when they needed it.",score:2},
    ]},
  { id:"R4a", cluster:"R", skill:"Stakeholder Management", type:"behavioural",
    q:"You are about to lead a significant initiative requiring support from people across multiple functions. Where do you start?",
    options:[
      {text:"Build a stakeholder influence map — interests, concerns, level of support needed — and create a deliberate alignment sequence before I need it.",score:4},
      {text:"Start the work and bring stakeholders in as they become relevant to their area.",score:1},
      {text:"Brief all key stakeholders early so they are aware of what is coming.",score:2},
      {text:"Map who needs to be involved, understand what each person cares about, and sequence conversations before work begins.",score:3},
    ]},
  { id:"R4b", cluster:"R", skill:"Stakeholder Management", type:"situational",
    q:"You are mid-project when a senior stakeholder who was supportive at the start becomes resistant. What do you do?",
    options:[
      {text:"Continue and trust that progress will bring them back around.",score:1},
      {text:"Request a conversation and go in with genuine curiosity about what has changed for them.",score:4},
      {text:"Escalate to my manager to help manage the stakeholder relationship.",score:2},
      {text:"Request a direct conversation to understand what has shifted and address it.",score:3},
    ]},
  { id:"R4c", cluster:"R", skill:"Stakeholder Management", type:"reflective",
    q:"Tell me about a project that stalled or failed because of a relationship or political dynamic you did not manage well. What did you miss?",
    options:[
      {text:"I cannot think of a project that failed for this reason — I tend to manage relationships well.",score:1},
      {text:"I have a specific example with a precise analysis of what I misread, what they actually needed, and the mapping practice I now use to prevent it.",score:4},
      {text:"I have a clear example. I underestimated someone's concerns, did not address them early, and paid for it.",score:3},
      {text:"Something comes to mind. I did not communicate well enough with a key person and lost their support.",score:2},
    ]},
  { id:"I1a", cluster:"I", skill:"Critical Thinking", type:"behavioural",
    q:"A respected colleague presents data that strongly supports a decision the team is aligned on. You notice something in the analysis that does not add up. What do you actually do?",
    options:[
      {text:"Trust the analysis — they are experienced and the team is already aligned.",score:1},
      {text:"Raise it specifically — naming what I noticed, why it matters to the decision, and the question that forces it to be interrogated properly.",score:4},
      {text:"Mention it quietly to the colleague after the meeting rather than disrupting the group.",score:2},
      {text:"Raise it in the room — the decision should not move forward on flawed analysis regardless of who produced it.",score:3},
    ]},
  { id:"I1b", cluster:"I", skill:"Critical Thinking", type:"situational",
    q:"You are asked to validate a business case that has already been signed off by leadership. You find assumptions that seem optimistic. What do you do?",
    options:[
      {text:"Treat the validation as genuinely independent — stress-test every assumption and present a complete picture including downside scenarios.",score:4},
      {text:"Validate it as requested — raising issues on an approved case creates problems without solving them.",score:1},
      {text:"Flag the assumptions informally to the person who asked me to validate it.",score:2},
      {text:"Document the assumptions, stress-test them, and present the risk they create — even though the case is already approved.",score:3},
    ]},
  { id:"I1c", cluster:"I", skill:"Critical Thinking", type:"reflective",
    q:"When did you last genuinely change your mind about something important at work — not updating a detail, but shifting your position entirely? What caused it?",
    options:[
      {text:"I have a specific example — I can trace the disconfirming evidence I encountered, the resistance I initially had, and the reasoning that finally moved me.",score:4},
      {text:"I generally land in the right place from the start, so complete reversals are unusual for me.",score:1},
      {text:"I can think of something. Someone made a strong argument and I updated my position.",score:2},
      {text:"I have a clear example. I encountered evidence that contradicted my position and worked through it seriously before updating.",score:3},
    ]},
  { id:"I2a", cluster:"I", skill:"Strategic Thinking", type:"behavioural",
    q:"Your manager gives you a task that is clearly important. Before starting, what goes through your mind?",
    options:[
      {text:"How to do it well and deliver it on time.",score:1},
      {text:"How this task connects to longer-term direction, what it enables or constrains, and whether this is the right task to be doing at all.",score:4},
      {text:"How this connects to the team's current priorities and where it sits in the queue.",score:2},
      {text:"How it fits the broader goal, who will use the output, and what success looks like beyond task completion.",score:3},
    ]},
  { id:"I2b", cluster:"I", skill:"Strategic Thinking", type:"situational",
    q:"Your organisation is about to launch a product. You are not on the leadership team but you can see a market dynamic that makes the timing risky. What do you do?",
    options:[
      {text:"Trust that leadership has thought through the timing — they have more context than I do.",score:1},
      {text:"Prepare a structured analysis — what I am seeing, why it matters, the alternatives, and my recommendation — and get it to the decision-maker.",score:4},
      {text:"Flag my concern to my manager and leave it with them to handle.",score:2},
      {text:"Build a clear, evidence-based view of the risk and find the right channel to get it into the decision.",score:3},
    ]},
  { id:"I2c", cluster:"I", skill:"Strategic Thinking", type:"reflective",
    q:"Describe a decision you made that looked right in the short term but created a problem further down the line. What did you not see?",
    options:[
      {text:"Most of my decisions hold up well over time — I struggle to think of a clear example.",score:1},
      {text:"I have a specific example — the second-order consequence I missed, why I missed it, and the thinking practice I now use to surface those consequences before deciding.",score:4},
      {text:"Something comes to mind. I focused on the immediate problem and did not think far enough ahead.",score:2},
      {text:"I have a clear example. I optimised for the near term and did not trace the downstream consequences.",score:3},
    ]},
  { id:"I3a", cluster:"I", skill:"Business Acumen", type:"behavioural",
    q:"If someone asked you to explain how your current or most recent organisation actually makes money — the mechanics of it — how confident are you?",
    options:[
      {text:"I can explain unit economics, key metrics, where value is created and destroyed, and how my role connects to commercial outcomes.",score:4},
      {text:"I know what we do and roughly what we charge — beyond that I am less certain.",score:1},
      {text:"I understand the core revenue model and the main things we spend money on.",score:2},
      {text:"I can walk through the revenue model, the key cost drivers, and where the margin is actually made.",score:3},
    ]},
  { id:"I3b", cluster:"I", skill:"Business Acumen", type:"situational",
    q:"You are proposing a new initiative that needs investment. A finance leader asks you to walk through the commercial case. How prepared are you?",
    options:[
      {text:"I can present a fully worked commercial case — cost, return, assumption ranges, downside scenarios, payback period, and the metrics I would use to track it.",score:4},
      {text:"I can explain what the initiative does and why it matters to the organisation.",score:1},
      {text:"I can explain the cost and the expected benefit at a high level.",score:2},
      {text:"I can present the cost, projected return, key assumptions, and the timeline to value.",score:3},
    ]},
  { id:"I3c", cluster:"I", skill:"Business Acumen", type:"reflective",
    q:"Describe a decision you made or contributed to that had a meaningful commercial impact. How did you think about it?",
    options:[
      {text:"I have a specific example — I built the commercial case, modelled the options, made a recommendation based on financial reasoning, and can trace what the outcome was against what I projected.",score:4},
      {text:"Most of my decisions are not directly commercial — my focus is functional rather than financial.",score:1},
      {text:"I can think of something. I made a call that saved costs or generated value, though I did not formally model it.",score:2},
      {text:"I have a clear example where I thought through the commercial implications deliberately before deciding.",score:3},
    ]},
  { id:"I4a", cluster:"I", skill:"Managing Ambiguity", type:"behavioural",
    q:"You are asked to lead something where the goal is clear but the method is entirely undefined. How do you respond?",
    options:[
      {text:"Frame the ambiguity explicitly, make a directional move, communicate the uncertainty to stakeholders, and build in review points.",score:4},
      {text:"Ask for more direction before starting — I want to move in the right direction from the beginning.",score:1},
      {text:"Make a start and check in regularly to make sure I am not too far off course.",score:2},
      {text:"Define what I know, identify the smallest reversible step to generate new information, and move from there.",score:3},
    ]},
  { id:"I4b", cluster:"I", skill:"Managing Ambiguity", type:"situational",
    q:"Your organisation is going through significant change and nobody can tell you clearly how your role will be affected. Work still needs to get done. How do you operate?",
    options:[
      {text:"Treat the uncertainty as the operating context — define short-term priorities, communicate them upward, and stay curious rather than anxious about how things are unfolding.",score:4},
      {text:"I find it genuinely hard to commit fully until I know where things are going to land.",score:1},
      {text:"Focus on what I can control and try not to let the uncertainty affect my output.",score:2},
      {text:"Name the uncertainty to my manager, agree on what to prioritise in the short term, and operate with full commitment within that frame.",score:3},
    ]},
  { id:"I4c", cluster:"I", skill:"Managing Ambiguity", type:"reflective",
    q:"Tell me about a time you had to make a consequential decision with significantly less information than you wanted. What did you do?",
    options:[
      {text:"I have a specific example — what I knew, what I treated as an assumption, how I reduced reversibility risk, what happened, and what it taught me about the right threshold for action under uncertainty.",score:4},
      {text:"I generally try to gather enough information before making decisions with significant consequences.",score:1},
      {text:"I can think of an example. I made a call with incomplete information — it either worked out or it did not.",score:2},
      {text:"I have a clear example where I defined the decision threshold — enough information to act responsibly — made the call, and owned the outcome.",score:3},
    ]},
  { id:"I5a", cluster:"I", skill:"AI Fluency", type:"behavioural", futureReady:true,
    q:"How are you currently using AI in your professional work — not what you have tried once, but what is genuinely part of how you work?",
    options:[
      {text:"I have explored AI tools but they are not yet a consistent part of my regular workflow.",score:1},
      {text:"I have deliberately redesigned how I work around AI — I know which tasks I delegate to it, which I keep human, and I refine how I work with it regularly.",score:4},
      {text:"I use AI for specific tasks like drafting and summarising, though not in a systematic way.",score:2},
      {text:"I have integrated AI into several parts of my workflow and I evaluate its outputs critically before using them.",score:3},
    ]},
  { id:"I5b", cluster:"I", skill:"AI Fluency", type:"situational", futureReady:true,
    q:"An AI tool produces a confident-sounding output that is central to a piece of work you are delivering. You do not have time to fully verify it. What do you do?",
    options:[
      {text:"Use it — AI confidence is generally a reasonable signal of accuracy.",score:1},
      {text:"Identify exactly which parts are load-bearing, verify those specifically, and be explicit with the recipient about what was verified and what was not.",score:4},
      {text:"Add a note that the output was AI-generated so the recipient can evaluate accordingly.",score:2},
      {text:"Run a targeted spot-check on the specific claims most critical to the work before using it.",score:3},
    ]},
  { id:"I5c", cluster:"I", skill:"AI Fluency", type:"reflective", futureReady:true,
    q:"What is your honest assessment of what AI does better than you in your professional work right now — and what remains genuinely yours?",
    options:[
      {text:"I have mapped my work explicitly against AI capability — I know precisely which tasks AI does better, which require human judgment, and I have restructured my time accordingly.",score:4},
      {text:"I am not certain AI is yet better than me at the things that matter most in my work.",score:1},
      {text:"AI is better at some routine tasks but the work that really matters still requires human judgment.",score:2},
      {text:"I have a clear picture of where AI outperforms me on specific tasks and where human judgment is essential — and I have started reorganising my work around that boundary.",score:3},
    ]},
  { id:"M1a", cluster:"M", skill:"Execution & Accountability", type:"behavioural",
    q:"You realise partway through a project that you are not going to meet a commitment you made. What do you do?",
    options:[
      {text:"Flag it immediately with a revised timeline, an impact assessment, a recovery plan, and an honest account of what I missed in the original commitment.",score:4},
      {text:"Deliver what I can and explain the situation when I submit.",score:1},
      {text:"Let the relevant people know as soon as I am certain I will miss it.",score:2},
      {text:"Flag it the moment I see the risk — before certainty — and arrive with a revised plan and an impact assessment.",score:3},
    ]},
  { id:"M1b", cluster:"M", skill:"Execution & Accountability", type:"situational",
    q:"A colleague who was supposed to deliver a key input has not delivered and is now unreachable. Your deadline is tomorrow. What do you do?",
    options:[
      {text:"Miss the deadline and make clear that the dependency was not delivered.",score:1},
      {text:"Make every reasonable attempt to resolve the dependency, deliver the best version possible, document what was missing, and escalate the dependency separately — never using it as cover for my own accountability.",score:4},
      {text:"Do what I can without the input and flag the gap clearly in what I deliver.",score:2},
      {text:"Find a way to deliver with what I have, escalate the dependency failure clearly, and keep my accountability separate from theirs.",score:3},
    ]},
  { id:"M1c", cluster:"M", skill:"Execution & Accountability", type:"reflective",
    q:"Tell me about a commitment you made that you did not keep. What happened and what did you take from it?",
    options:[
      {text:"I have a specific example with a clear analysis of where my commitment-making process failed and the specific practices I have built since then.",score:4},
      {text:"I am generally reliable — I cannot think of a significant missed commitment.",score:1},
      {text:"Something comes to mind. Circumstances changed and I was not able to deliver what I had committed to.",score:2},
      {text:"I have a clear example. I overcommitted and underdelivered — and now I think much more carefully about what I agree to.",score:3},
    ]},
  { id:"M2a", cluster:"M", skill:"Resilience & Self-Leadership", type:"behavioural",
    q:"After a significant professional setback — a failed project, a difficult performance conversation, a lost opportunity — how do you actually recover?",
    options:[
      {text:"I take time and eventually return to normal, though it can take longer than I would like.",score:1},
      {text:"I have a structured recovery practice — specific steps to process the emotion, extract the learning, and rebuild momentum — and my recovery time has shortened because of it.",score:4},
      {text:"I process it privately and try not to let it affect my work for too long.",score:2},
      {text:"I have a deliberate process — feel the setback, extract the lesson, make a conscious decision to move forward.",score:3},
    ]},
  { id:"M2b", cluster:"M", skill:"Resilience & Self-Leadership", type:"situational",
    q:"You are in a sustained period of high pressure — competing demands, insufficient resources, no clear end in sight. How do you manage yourself?",
    options:[
      {text:"I push through — it is temporary and the work needs to get done.",score:1},
      {text:"I have a clear framework for sustained pressure — how I manage cognitive, emotional, and physical energy, what signals I watch for, and when I escalate.",score:4},
      {text:"I try to manage my time better and accept that some things will have to slip.",score:2},
      {text:"I actively manage my energy — not just my time — and make deliberate choices about what to protect and what to let go.",score:3},
    ]},
  { id:"M2c", cluster:"M", skill:"Resilience & Self-Leadership", type:"reflective",
    q:"Have you ever come close to burnout or noticed your performance dropping significantly under sustained pressure? What did it teach you?",
    options:[
      {text:"I have a specific experience — what signals I missed, where my self-management failed, and the specific practices I have built since then to catch it earlier.",score:4},
      {text:"I handle pressure well — I have not experienced anything I would describe as close to burnout.",score:1},
      {text:"I have had difficult periods. I got through them, though I am not sure I handled them as well as I could have.",score:2},
      {text:"I have a clear experience. I now understand what my warning signs are and what I need to do when I see them.",score:3},
    ]},
  { id:"M3a", cluster:"M", skill:"Adaptability", type:"behavioural",
    q:"Your organisation announces a significant change that affects how you work — new structure, new process, new direction. What is your honest first reaction?",
    options:[
      {text:"Frustration — I had a system that worked and rebuilding it feels like wasted effort.",score:1},
      {text:"Opportunity — I move quickly to understand the new landscape and where I can add the most value within it.",score:4},
      {text:"Uncertainty — I tend to wait and see how things settle before committing to the new way.",score:2},
      {text:"Curiosity — I start thinking about how to position myself well within the new context.",score:3},
    ]},
  { id:"M3b", cluster:"M", skill:"Adaptability", type:"situational",
    q:"You are asked to take on a piece of work that is significantly outside your expertise. You have limited time to get up to speed. How do you approach it?",
    options:[
      {text:"Flag that this is outside my area and recommend someone who is better suited.",score:1},
      {text:"Take it on, map the specific knowledge gaps that matter most, fill them deliberately, and treat the unfamiliarity as a potential advantage.",score:4},
      {text:"Take it on and learn as I go, being transparent when I reach the edges of my knowledge.",score:2},
      {text:"Take it on, identify the specific gaps that matter most, fill them deliberately, and be transparent about what I am learning as I go.",score:3},
    ]},
  { id:"M3c", cluster:"M", skill:"Adaptability", type:"reflective",
    q:"What is something you used to believe or do professionally that you have since completely changed? What caused the shift?",
    options:[
      {text:"My core professional approach has been consistent — I have refined it but not fundamentally reversed anything.",score:1},
      {text:"I have a specific example of a fundamental shift — what I believed, what challenged it, how I unlearned it, what replaced it, and why this kind of adaptability is one of the most important things I have built.",score:4},
      {text:"Something comes to mind. I changed my approach when I could see it was not producing the results I wanted.",score:2},
      {text:"I have a clear example of a significant belief I abandoned — I encountered clear evidence it was wrong and updated deliberately.",score:3},
    ]},
  { id:"E1a", cluster:"E", skill:"Commercial Creativity", type:"behavioural",
    q:"You are facing a significant constraint — budget cut, resource reduction, policy restriction — that threatens something you are trying to deliver. How do you respond?",
    options:[
      {text:"Deliver what is possible within the constraint and communicate clearly about what is not.",score:1},
      {text:"Treat the constraint as potentially generative — some of the best solutions come from working around limitations you never would have encountered otherwise.",score:4},
      {text:"Push back and make the case for more resource or greater flexibility.",score:2},
      {text:"Treat the constraint as a design problem — look for a different way to achieve the same outcome.",score:3},
    ]},
  { id:"E1b", cluster:"E", skill:"Commercial Creativity", type:"situational",
    q:"You spot an opportunity your organisation has not seen — a new revenue line, a partnership, an untapped market. You are not in the role that would normally pursue it. What do you do?",
    options:[
      {text:"Note it and wait for the right person or moment to raise it.",score:1},
      {text:"Develop it enough to be taken seriously — what it is, why it is real, what it would take, and what it costs to ignore — and navigate it to the right decision-maker.",score:4},
      {text:"Mention it to my manager and let them decide whether it is worth pursuing.",score:2},
      {text:"Build a basic case for the opportunity and find the right channel to put it in front of someone who can act on it.",score:3},
    ]},
  { id:"E1c", cluster:"E", skill:"Commercial Creativity", type:"reflective",
    q:"Tell me about an idea you had that created real value — commercial, operational, or strategic. Where did it come from and how did you turn it into something real?",
    options:[
      {text:"I have a specific example — where the insight came from, how I developed it into a proposal, who I had to persuade, how I navigated the resistance, and what the outcome actually was.",score:4},
      {text:"I tend to contribute to other people's ideas more than originate my own.",score:1},
      {text:"I can think of an idea that worked. It came from noticing a problem and suggesting a practical fix.",score:2},
      {text:"I have a clear example of an idea I originated, developed into a real proposal, and drove to implementation with measurable impact.",score:3},
    ]},
  { id:"E2a", cluster:"E", skill:"Influence Without Authority", type:"behavioural",
    q:"You need cooperation from someone who does not report to you — and they are currently not prioritising what you need. How do you approach it?",
    options:[
      {text:"Escalate to someone who has authority over them.",score:1},
      {text:"Invest in the relationship before I need something, understand their pressures, frame my request in terms of their interests, and make it easy for them to say yes.",score:4},
      {text:"Make the request clearly and explain why it matters to the organisation.",score:2},
      {text:"Take time to understand what they are prioritising and find a way to connect my need to something they already care about.",score:3},
    ]},
  { id:"E2b", cluster:"E", skill:"Influence Without Authority", type:"situational",
    q:"You believe strongly in an idea that needs support from three people who are currently indifferent or mildly resistant. How do you build the coalition?",
    options:[
      {text:"Present the idea to all three together and make the strongest possible case.",score:1},
      {text:"Map each person's interests, sequence conversations to build momentum, address each objection with something that genuinely resolves it, and bring them together only when alignment is already close.",score:4},
      {text:"Start with the most sympathetic person and use their support to help move the others.",score:2},
      {text:"Meet each person separately first, understand their specific concerns, and tailor each conversation before bringing them together.",score:3},
    ]},
  { id:"E2c", cluster:"E", skill:"Influence Without Authority", type:"reflective",
    q:"Tell me about a time you moved something forward — a decision, a project, an outcome — that you had no formal authority to push. What did you actually do?",
    options:[
      {text:"I have a specific example — the stakeholder map I built, how I sequenced conversations, what I offered each person, and how I maintained momentum through the resistance.",score:4},
      {text:"I generally work through the proper channels rather than trying to influence things outside my remit.",score:1},
      {text:"I can think of a time. I made the case clearly and kept making it until people came around.",score:2},
      {text:"I have a clear example. I mapped who mattered, had deliberate conversations, and built enough support to move it.",score:3},
    ]},
  { id:"E3a", cluster:"E", skill:"Human-AI Collaboration", type:"behavioural", futureReady:true,
    q:"How have you actually changed how you work because of AI — not in theory, but in practice?",
    options:[
      {text:"I have not made significant changes yet — I am still working out where AI genuinely fits in my work.",score:1},
      {text:"I have comprehensively redesigned how I work around the human-AI boundary — I can name precisely which tasks I have moved to AI, what I have kept human, and how that has changed my output.",score:4},
      {text:"I have added AI to tasks at the edges of my workflow but my core approach has not changed significantly.",score:2},
      {text:"I have deliberately redesigned parts of my workflow around AI — deciding what to delegate and what to keep — and I can see a real difference in what I produce.",score:3},
    ]},
  { id:"E3b", cluster:"E", skill:"Human-AI Collaboration", type:"situational", futureReady:true,
    q:"Your organisation is introducing AI tools across your function. Some colleagues are resisting, others are adopting everything uncritically. What is your position?",
    options:[
      {text:"Wait until the adoption settles before deciding how to change how I work.",score:1},
      {text:"Lead the thinking in my function — map decisions against AI capability, define what stays human and why, build genuine fluency in the team, and establish governance that protects quality.",score:4},
      {text:"Adopt the tools that seem useful and avoid the ones that feel like they are replacing work that matters.",score:2},
      {text:"Think through each tool systematically — what it does well, what risks it creates, what it should and should not be used for — and develop a clear position.",score:3},
    ]},
  { id:"E3c", cluster:"E", skill:"Human-AI Collaboration", type:"reflective", futureReady:true,
    q:"What is genuinely irreplaceable about what you bring to your work — the thing AI cannot do, even in principle?",
    options:[
      {text:"Honestly, I am not certain there are things AI cannot eventually do that I currently do.",score:1},
      {text:"I have a precise and reasoned answer — what I bring that AI cannot replicate structurally, why it matters commercially, and how I am investing in deepening exactly those capabilities.",score:4},
      {text:"Relationships and judgment are areas where I think human presence will remain essential.",score:2},
      {text:"I have a clear view of where my specific value lies that AI cannot replicate — particular types of judgment, contextual knowledge, or relational work that requires genuine human presence.",score:3},
    ]},
  // ── VALIDITY ANCHORS ────────────────────────────────────────────────────
  { id:"VA1", cluster:"VA", skill:"Validity", type:"anchor", validAnchor:true,
    q:"When you receive feedback from someone you genuinely respect, your first response is always to implement it.",
    options:[
      {text:"Yes — if someone I respect has taken the time to give feedback, acting on it is the right response.",score:1},
      {text:"Almost always — I occasionally push back but my default is to implement.",score:2},
      {text:"Not always — good feedback still needs to fit the context, even from people I respect.",score:4},
      {text:"Rarely — feedback is one input and I weigh it carefully against everything else I know.",score:2},
    ]},
  { id:"VA2", cluster:"VA", skill:"Validity", type:"anchor", validAnchor:true,
    q:"You always know exactly what is driving your emotions in a professional setting.",
    options:[
      {text:"Yes — self-awareness is something I have worked hard to build and I have strong insight into my emotional drivers.",score:1},
      {text:"Usually — I sometimes need time to understand what is behind a strong reaction.",score:2},
      {text:"Not always — even with strong self-awareness, emotions in complex situations are not always immediately legible.",score:4},
      {text:"Rarely — I am not naturally introspective about my emotional drivers.",score:1},
    ]},
  { id:"VA3", cluster:"VA", skill:"Validity", type:"anchor", validAnchor:true,
    q:"When you prepare thoroughly for a negotiation, you reliably get the outcome you are aiming for.",
    options:[
      {text:"Yes — thorough preparation is the consistent differentiator between winning and losing.",score:1},
      {text:"Usually — preparation significantly increases my success rate.",score:2},
      {text:"Often, but not always — even excellent preparation cannot overcome every structural constraint or the other party's position.",score:4},
      {text:"Not always — preparation is essential but the outcome also depends on variables outside my control.",score:3},
    ]},
  { id:"VA4", cluster:"VA", skill:"Validity", type:"anchor", validAnchor:true,
    q:"You have never made a significant people decision you later regretted.",
    options:[
      {text:"Correct — I take people decisions seriously and my track record is strong.",score:1},
      {text:"Almost — there are minor things I would do differently but nothing significant.",score:2},
      {text:"No — people decisions are genuinely complex and some of my most important learning has come from the ones I got wrong.",score:4},
      {text:"No — I have made people decisions I later regretted, and I have thought carefully about why.",score:3},
    ]},
];

// ── FISHER-YATES SEEDED SHUFFLE ────────────────────────────────────────────
function seededShuffle(arr, seed) {
  const result = [...arr];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── BUILD QUESTION SEQUENCE ────────────────────────────────────────────────
function buildQuestionSequence() {
  const scored  = ALL_QUESTIONS.filter(q => q.cluster !== "VA");
  const anchors = ALL_QUESTIONS.filter(q => q.cluster === "VA");
  const seq = [...scored];
  const step = Math.floor(scored.length / (anchors.length + 1));
  [...anchors].reverse().forEach((a, ri) => {
    const i = anchors.length - 1 - ri;
    const pos = step * (i + 1) + i;
    seq.splice(Math.min(pos, seq.length), 0, a);
  });
  return seq;
}

const QUESTIONS = buildQuestionSequence();
const TOTAL     = QUESTIONS.length;

const SKILL_CLUSTER = {
  "Communication":                        "P",
  "Negotiation":                          "P",
  "Personal Brand & Executive Presence":  "P",
  "Emotional Intelligence":               "R",
  "Conflict Resolution":                  "R",
  "People Development":                   "R",
  "Stakeholder Management":               "R",
  "Critical Thinking":                    "I",
  "Strategic Thinking":                   "I",
  "Business Acumen":                      "I",
  "Managing Ambiguity":                   "I",
  "AI Fluency":                           "I",
  "Execution & Accountability":           "M",
  "Resilience & Self-Leadership":         "M",
  "Adaptability":                         "M",
  "Commercial Creativity":                "E",
  "Influence Without Authority":          "E",
  "Human-AI Collaboration":              "E",
};

const SKILL_MAX_RAW = 12;

// ── SESSION STORAGE CHECKPOINT ─────────────────────────────────────────────
const SESSION_KEY = "vi_session_v2";
function saveCheckpoint(data) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch {}
}
function loadCheckpoint() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearCheckpoint() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

// ── PENDING REPORT (localStorage) ─────────────────────────────────────────
const PENDING_KEY = "valu_pending_report_v2";
function setPendingReport(payload) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch (e) {
    // Storage quota or private-browsing restriction — not fatal.
    // The hash-return flow will fall back to fetching from Supabase by email.
    console.warn("setPendingReport: could not write to localStorage:", e.message);
  }
}
function getPendingReport() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearPendingReport() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

// ── SUPABASE HELPERS ───────────────────────────────────────────────────────
// Retries once on any non-4xx failure (network blip, 5xx).
async function saveToSupabase(data, attempt = 0) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    // Retry once on server errors; do not retry client errors (4xx).
    if (attempt === 0 && res.status >= 500) {
      await new Promise(r => setTimeout(r, 1200));
      return saveToSupabase(data, 1);
    }
    throw new Error(`Supabase save failed (${res.status}): ${err}`);
  }
}

async function signUpWithSupabase(email, password, name, role) {
  const redirectTo = encodeURIComponent(window.location.origin + "/");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup?redirect_to=${redirectTo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password, data: { full_name: name, role } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || "Signup failed.");
  return data;
}

async function joinWaitlist({ name, email, role }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({ name, email, type: "professional", role }),
  });
  // 409 = already on waitlist — not an error.
  if (!res.ok && res.status !== 409) throw new Error(await res.text());
}

async function fetchAssessmentByEmail(email) {
  try {
    const params = new URLSearchParams({
      email: `eq.${email}`,
      select: "name,role,total_score,cluster_scores,skill_scores",
      order: "completed_at.desc",
      limit: "1",
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length) return null;
    const row = rows[0];
    const valuIndex = row.total_score ?? 0;
    const clusterScores = row.cluster_scores ?? {};
    const sorted = [...CLUSTERS].sort((a, b) => (clusterScores[b.id] ?? 0) - (clusterScores[a.id] ?? 0));
    return {
      name: row.name, role: row.role,
      results: {
        valuIndex, clusterScores, skillScores: row.skill_scores ?? {},
        desig: DESIGNATIONS.find(d => valuIndex >= d.min) || DESIGNATIONS[DESIGNATIONS.length - 1],
        futureReadyScore: Math.round(CLUSTERS.reduce((s, c) => s + (clusterScores[c.id] ?? 0), 0) / CLUSTERS.length),
        strongest: sorted[0], weakest: sorted[sorted.length - 1],
        consistencyFlags: {}, gamingDetected: false, anchorFlags: 0,
        speedFlag: false, uniformityFlag: false, anyFlag: false,
        listed: valuIndex >= 35,
        pathway: valuIndex >= 80 ? "PCP Certification" : valuIndex >= 65 ? "PRIME Programme" : valuIndex >= 50 ? "PRIME Cluster" : "PRIME Sprint",
        globalSD: 1,
      },
    };
  } catch { return null; }
}

async function fetchAssessmentByFingerprint(fingerprint) {
  try {
    const params = new URLSearchParams({
      identity_hash: `eq.${fingerprint}`,
      select: "name,role,total_score,cluster_scores,skill_scores,ai_report",
      order: "completed_at.desc",
      limit: "1",
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length) return null;
    const row = rows[0];
    const valuIndex = row.total_score ?? 0;
    const clusterScores = row.cluster_scores ?? {};
    const sorted = [...CLUSTERS].sort((a, b) => (clusterScores[b.id] ?? 0) - (clusterScores[a.id] ?? 0));
    return {
      name: row.name, role: row.role,
      aiReport: row.ai_report || null,
      results: {
        valuIndex, clusterScores, skillScores: row.skill_scores ?? {},
        desig: DESIGNATIONS.find(d => valuIndex >= d.min) || DESIGNATIONS[DESIGNATIONS.length - 1],
        futureReadyScore: Math.round(CLUSTERS.reduce((s, c) => s + (clusterScores[c.id] ?? 0), 0) / CLUSTERS.length),
        strongest: sorted[0], weakest: sorted[sorted.length - 1],
        consistencyFlags: {}, gamingDetected: false, anchorFlags: 0,
        speedFlag: false, uniformityFlag: false, anyFlag: false,
        listed: valuIndex >= 35,
        pathway: valuIndex >= 80 ? "PCP Certification" : valuIndex >= 65 ? "PRIME Programme" : valuIndex >= 50 ? "PRIME Cluster" : "PRIME Sprint",
        globalSD: 1,
      },
    };
  } catch { return null; }
}

function parseAuthHash() {
  if (typeof window === "undefined" || !window.location.hash) return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const errorDescription = params.get("error_description");
  if (errorDescription) return { error: errorDescription.replace(/\+/g, " ") };
  const accessToken = params.get("access_token");
  const type = params.get("type");
  if (!accessToken) return null;
  let email = null;
  try { email = JSON.parse(atob(accessToken.split(".")[1])).email || null; } catch {}
  return { accessToken, type, email };
}

// ── SCORING ENGINE ─────────────────────────────────────────────────────────
function computeResults(answers, timings, shuffleMap) {
  const clusterRaw       = { P:0, R:0, I:0, M:0, E:0 };
  const clusterAllScores = { P:[], R:[], I:[], M:[], E:[] };
  const skillRaw         = {};
  QUESTIONS.forEach((q, idx) => {
    if (q.cluster === "VA") return;
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return;
    const originalOption = shuffleMap[idx] ? shuffleMap[idx][displayedIdx] : q.options[displayedIdx];
    const score = originalOption?.score || 0;
    clusterRaw[q.cluster] += score;
    clusterAllScores[q.cluster].push(score);
    if (q.skill && q.skill !== "Validity") {
      skillRaw[q.skill] = (skillRaw[q.skill] || 0) + score;
    }
  });
  const skillScores = {};
  Object.entries(skillRaw).forEach(([skill, raw]) => {
    skillScores[skill] = Math.round((raw / SKILL_MAX_RAW) * 100);
  });
  const clusterScores = {};
  CLUSTERS.forEach(c => {
    clusterScores[c.id] = Math.round((clusterRaw[c.id] / c.maxRaw) * 100);
  });
  let valuRaw = 0;
  CLUSTERS.forEach(c => { valuRaw += clusterScores[c.id] * c.weight; });
  let valuIndex = Math.round(valuRaw);
  const consistencyFlags = {};
  CLUSTERS.forEach(c => {
    const scores = clusterAllScores[c.id];
    if (scores.length < 2) return;
    const mean = scores.reduce((a,b) => a+b,0) / scores.length;
    const sd = Math.sqrt(scores.reduce((a,b) => a+(b-mean)**2,0) / scores.length);
    if (sd > 1.2) {
      consistencyFlags[c.id] = true;
      clusterScores[c.id] = Math.round(clusterScores[c.id] * 0.85);
    }
  });
  let valuRaw2 = 0;
  CLUSTERS.forEach(c => { valuRaw2 += clusterScores[c.id] * c.weight; });
  valuIndex = Math.round(valuRaw2);
  let anchorFlags = 0;
  QUESTIONS.forEach((q, idx) => {
    if (!q.validAnchor) return;
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return;
    const originalOption = shuffleMap[idx] ? shuffleMap[idx][displayedIdx] : q.options[displayedIdx];
    if (originalOption?.score === 1) anchorFlags++;
  });
  const gamingDetected = anchorFlags >= 3;
  if (gamingDetected) valuIndex = Math.round(valuIndex * 0.80);
  const answeredTimings = timings.filter(t => t > 0);
  const totalTime = answeredTimings.reduce((a,b) => a+b, 0);
  const fastAnswers = timings.filter(t => t > 0 && t < 8000).length;
  const speedFlag = totalTime < 720000 || fastAnswers >= 3;
  const allScores = [];
  QUESTIONS.forEach((q, idx) => {
    if (q.cluster === "VA") return;
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return;
    const originalOption = shuffleMap[idx] ? shuffleMap[idx][displayedIdx] : q.options[displayedIdx];
    if (originalOption?.score) allScores.push(originalOption.score);
  });
  const globalMean = allScores.reduce((a,b) => a+b,0) / allScores.length;
  const globalSD   = Math.sqrt(allScores.reduce((a,b) => a+(b-globalMean)**2,0) / allScores.length);
  const uniformityFlag = valuIndex >= 65 && globalSD < 0.5;
  const desig = DESIGNATIONS.find(d => valuIndex >= d.min) || DESIGNATIONS[DESIGNATIONS.length-1];
  const frQuestions = QUESTIONS.filter(q => q.futureReady);
  const frRaw = frQuestions.reduce((sum, q) => {
    const idx = QUESTIONS.indexOf(q);
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return sum;
    const originalOption = shuffleMap[idx] ? shuffleMap[idx][displayedIdx] : q.options[displayedIdx];
    return sum + (originalOption?.score || 0);
  }, 0);
  const futureReadyScore = Math.round((frRaw / (frQuestions.length * 4)) * 100);
  const sorted = [...CLUSTERS].sort((a,b) => clusterScores[b.id] - clusterScores[a.id]);
  return {
    valuIndex, clusterScores, skillScores, desig, futureReadyScore,
    strongest: sorted[0], weakest: sorted[sorted.length-1],
    consistencyFlags, gamingDetected, anchorFlags, speedFlag, uniformityFlag,
    listed: valuIndex >= 35 && !uniformityFlag,
    pathway: valuIndex >= 80 ? "PCP Certification"
           : valuIndex >= 65 ? "PRIME Programme"
           : valuIndex >= 50 ? "PRIME Cluster"
           : "PRIME Sprint",
    anyFlag: Object.keys(consistencyFlags).length > 0 || gamingDetected || speedFlag || uniformityFlag,
    globalSD: Math.round(globalSD * 100) / 100,
  };
}

// ── RADAR CHART ────────────────────────────────────────────────────────────
function Radar({ scores, size = 200 }) {
  const cx = size/2, cy = size/2, r = size * 0.37, n = 5;
  const angle = i => (Math.PI*2*i/n) - Math.PI/2;
  const pt = (i, frac) => ({ x: cx + r*frac*Math.cos(angle(i)), y: cy + r*frac*Math.sin(angle(i)) });
  const gridPoly = frac => CLUSTERS.map((_,i) => { const p=pt(i,frac); return `${p.x},${p.y}`; }).join(" ");
  const dataPts = CLUSTERS.map((c,i) => pt(i, (scores[c.id]||0)/100));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible",display:"block"}}>
      {[0.25,0.5,0.75,1].map(f =>
        <polygon key={f} points={gridPoly(f)} fill="none"
          stroke={f===1?"rgba(201,168,76,0.4)":"rgba(201,168,76,0.15)"}
          strokeWidth={f===1?0.8:0.5}/>)}
      {CLUSTERS.map((_,i) => { const p=pt(i,1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(201,168,76,0.2)" strokeWidth={0.5}/>; })}
      <polygon points={dataPts.map(p=>`${p.x},${p.y}`).join(" ")}
        fill="rgba(201,168,76,0.15)" stroke={T.gold} strokeWidth={1.5}
        style={{transition:"all 0.5s"}}/>
      {dataPts.map((p,i) =>
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={CLUSTERS[i].color}
          style={{transition:"all 0.5s"}}/>)}
      {CLUSTERS.map((c,i) => {
        const lp=pt(i,1.28);
        return <text key={i} x={lp.x} y={lp.y} textAnchor="middle"
          dominantBaseline="central"
          style={{fontSize:10,fontWeight:600,fill:c.color,fontFamily:T.font.body}}>{c.id}</text>;
      })}
    </svg>
  );
}

// ── CLUSTER SCORE STRIP ────────────────────────────────────────────────────
function ClusterStrip({ clusterScores, skillScores, compact = false }) {
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
      {CLUSTERS.map(c => {
        const clusterSkillList = Object.entries(skillScores || {})
          .filter(([s]) => SKILL_CLUSTER[s] === c.id)
          .sort(([,a],[,b]) => a - b);
        const weakestSkill = clusterSkillList[0];
        return (
          <div key={c.id} style={{
            padding: compact ? "7px 10px" : "8px 12px",
            background: `${c.color}10`,
            border: `1px solid ${c.color}30`,
            borderRadius: T.radius.chip,
            minWidth: compact ? 80 : 110,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom: weakestSkill && !compact ? 4 : 0 }}>
              <div style={{
                width:14, height:14, borderRadius: T.radius.chip,
                background:`${c.color}20`, border:`1px solid ${c.color}40`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:8, fontWeight:700, color:c.color, flexShrink:0,
                fontFamily: T.font.body,
              }}>{c.id}</div>
              <span style={{ fontSize:T.size.small, color:c.color, fontWeight:600, fontFamily:T.font.body }}>{clusterScores[c.id]}</span>
              <span style={{ fontSize:T.size.caption, color:T.text.ghost, fontFamily:T.font.body }}>/100</span>
            </div>
            {weakestSkill && !compact && (
              <div style={{ fontSize:T.size.caption, color:T.text.muted, lineHeight:1.4, fontFamily:T.font.body }}>
                Gap: {weakestSkill[0].split(" ")[0]} ({weakestSkill[1]})
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── DESIGNATION BADGE ──────────────────────────────────────────────────────
function DesignationBadge({ desig }) {
  return (
    <div style={{
      display:"inline-flex", alignItems:"center",
      padding:"8px 14px",
      background: desig.bg,
      border: `1px solid ${desig.color}40`,
      borderRadius: T.radius.chip,
    }}>
      <span style={{
        fontSize: T.size.caption, fontWeight:700,
        color: desig.color, letterSpacing:"0.1em",
        fontFamily: T.font.body,
      }}>{desig.name.toUpperCase()}</span>
    </div>
  );
}

// ── SCORE HEADER ──────────────────────────────────────────────────────────
function ScoreHeader({ name, role, valuIndex, clusterScores, skillScores, desig, futureReadyScore, sticky = false }) {
  return (
    <div style={{
      background: T.midnight,
      borderBottom: "1px solid rgba(201,168,76,0.12)",
      padding: "28px 24px",
      ...(sticky && { position:"sticky", top:0, zIndex:10 }),
    }}>
      <div style={{ maxWidth:720, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:T.size.caption, color:"rgba(201,168,76,0.45)", letterSpacing:"0.2em", marginBottom:4, fontFamily:T.font.body }}>
              VALU INDEX · {name?.toUpperCase()}
            </div>
            <div style={{ fontSize:T.size.caption, color:T.text.tertiary, fontFamily:T.font.body }}>{role}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:20 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:T.font.display, fontSize:T.size.display, fontWeight:300, color:T.gold, lineHeight:1 }}>{valuIndex}</div>
              <div style={{ fontSize:T.size.micro, color:T.text.ghost, letterSpacing:"0.1em", fontFamily:T.font.body }}>OUT OF 100</div>
            </div>
            <Radar scores={clusterScores} size={100} />
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <ClusterStrip clusterScores={clusterScores} skillScores={skillScores} compact={false} />
          <div style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"8px 12px",
            background:"rgba(186,117,23,0.08)",
            border:"1px solid rgba(186,117,23,0.2)",
            borderRadius: T.radius.chip,
          }}>
            <span style={{ fontSize:T.size.caption, color:T.amber, letterSpacing:"0.06em", fontFamily:T.font.body }}>FUTURE-READY</span>
            <span style={{ fontSize:T.size.small, color:T.amber, fontWeight:600, fontFamily:T.font.body }}>{futureReadyScore}</span>
          </div>
          <DesignationBadge desig={desig} />
        </div>
      </div>
    </div>
  );
}

// ── AI REPORT HELPERS ──────────────────────────────────────────────────────
const PROMPT_VERSION = "v2.2";
const PRIME_PROGRAMMES = {
  sprint:    { name:"PRIME Sprint",                       duration:"1 day",              price:"₦150,000–₦300,000" },
  cluster:   { name:"PRIME Cluster Programme",            duration:"6 weeks",            price:"₦500,000–₦1,200,000" },
  pcp:       { name:"PRIME Certified Professional (PCP)", duration:"6 months",           price:"₦200,000–₦400,000" },
  executive: { name:"Executive Immersion",                duration:"3 days residential", price:"₦800,000–₦2,000,000" },
};
const SKILL_ACTIONS = {
  "Communication": "Before your next important meeting, write down the one thing you need the room to leave believing — and build backwards from that, not from your slide order.",
  "Negotiation": "Before your next salary, contract, or vendor conversation, write down your walk-away position before you write down your opening ask.",
  "Personal Brand & Executive Presence": "Google yourself right now. What you find is what a hiring manager finds. Decide in the next 48 hours whether that is the profile you want representing you.",
  "Emotional Intelligence": "After your next meeting that frustrates you, write one sentence naming what you felt and one sentence naming what triggered it. Do this for two weeks.",
  "Conflict Resolution": "Name one unresolved tension in your team right now. Not a vague one — a specific one between specific people. Decide by end of week whether you are going to address it or not. Indecision is a decision.",
  "People Development": "Think of the person on your team with the most unrealised potential. Write down exactly what is blocking them. If you cannot name it precisely, that is the problem.",
  "Stakeholder Management": "Map the five people whose support or opposition most affects your current priority project. Next to each name, write whether they are aligned, neutral, or resistant. If you do not know, that is urgent information.",
  "Critical Thinking": "The next time someone presents data to support a recommendation you are inclined to agree with, force yourself to ask: what would have to be true for this to be wrong?",
  "Strategic Thinking": "Take the most important task on your plate right now. Write down what it enables or prevents — not just what it delivers. If you cannot do that in two sentences, you may be executing without understanding.",
  "Business Acumen": "Without looking anything up, write down how your organisation makes money, what the biggest cost is, and where the margin is actually generated. The gaps in your answer are exactly where your business acumen needs work.",
  "Managing Ambiguity": "Write down the most uncertain situation you are currently operating in. Next to it, write the three things you know for certain, the two things you are assuming, and the one decision you can make today that does not require the uncertainty to resolve first.",
  "AI Fluency": "List three tasks you did this week that took more than an hour. For each one, ask honestly: could AI have done 80% of this in ten minutes? If yes, you have a workflow redesign to make.",
  "Execution & Accountability": "List every commitment you have made in the last 30 days that is not yet complete. Put a date next to each one. If any are past due, contact the person it affects today — before they contact you.",
  "Resilience & Self-Leadership": "Name the last setback that knocked you off your game for more than a day. Write down what specifically about it affected you — not the event, but the belief the event triggered. That belief is where the work is.",
  "Adaptability": "Think of the last significant change at work you resisted. Write down what you were protecting. Usually what we resist change to protect is worth examining.",
  "Commercial Creativity": "Look at your current role and write down one thing you could propose in the next 30 days that would either save money, make money, or create an advantage. If nothing comes to mind immediately, that is worth noting.",
  "Influence Without Authority": "Name one thing you need to move forward that requires someone else's cooperation — someone who does not report to you. Have you started that conversation? If not, what is stopping you?",
  "Human-AI Collaboration": "Pick one routine deliverable from your job — a report, a brief, a summary. Use AI to produce a first draft this week. Your job is then to make it better. Notice where you add value and where you do not.",
};
const SKILL_PROGRAMME_MAP = {
  "Communication": "cluster", "Negotiation": "cluster",
  "Personal Brand & Executive Presence": "cluster", "Emotional Intelligence": "cluster",
  "Conflict Resolution": "cluster", "People Development": "cluster",
  "Stakeholder Management": "cluster", "Critical Thinking": "cluster",
  "Strategic Thinking": "cluster", "Business Acumen": "cluster",
  "Managing Ambiguity": "cluster", "AI Fluency": "sprint",
  "Execution & Accountability": "cluster", "Resilience & Self-Leadership": "cluster",
  "Adaptability": "cluster", "Commercial Creativity": "cluster",
  "Influence Without Authority": "cluster", "Human-AI Collaboration": "sprint",
};

function buildReportPrompt(scoreProfile) {
  const { name, role, valuIndex, clusterScores, skillScores, desig, futureReadyScore, strongest, weakest, pathway, listed, globalSD } = scoreProfile;
  const sortedSkills = Object.entries(skillScores || {}).filter(([s]) => s !== "Validity").sort(([,a],[,b]) => b - a);
  const topSkills    = sortedSkills.slice(0, 3);
  const bottomSkills = sortedSkills.slice(-3).reverse();
  const weakestClusterSkills = sortedSkills.filter(([s]) => SKILL_CLUSTER[s] === weakest?.id).sort(([,a],[,b]) => a - b);
  const primaryGapSkill   = weakestClusterSkills[0]?.[0] || bottomSkills[0]?.[0];
  const secondaryGapSkill = weakestClusterSkills[1]?.[0] || bottomSkills[1]?.[0];
  const primaryProgrammeKey = SKILL_PROGRAMME_MAP[primaryGapSkill] || "cluster";
  const primaryProgramme    = PRIME_PROGRAMMES[primaryProgrammeKey];
  const clusterSkillDetail = CLUSTERS.map(c => {
    const skills = sortedSkills.filter(([s]) => SKILL_CLUSTER[s] === c.id);
    return `${c.name} (${clusterScores[c.id]}/100):\n` + skills.map(([s,sc]) => `  - ${s}: ${sc}/100`).join("\n");
  }).join("\n\n");
  return `You are writing a personalised professional development report for ${name}, a ${role} who just completed the VALU Index assessment.
YOUR WRITING RULES:
1. Write like a trusted senior colleague who tells the truth.
2. Use plain, direct language.
3. NEVER use: journey, leverage (as verb), holistic, impactful, synergy, empower, transformative, game-changer, paradigm, unlock, actionable.
4. Be specific. Name the actual skill. Name the actual consequence. Name the actual programme.
5. Short sentences. Maximum 20 words per sentence for the most important points.
6. No padding. Every sentence must earn its place.
7. Do not praise them for completing the assessment.
8. Speak directly to them as "you."
THEIR SCORE DATA:
VALU Index: ${valuIndex}/100 — ${desig.name}
Listed on platform: ${listed ? "Yes" : "No — needs score of 35+"}
Future-Ready score: ${futureReadyScore}/100
SKILL SCORES:\n${clusterSkillDetail}
THEIR STRONGEST SKILLS: ${topSkills.map(([s,sc]) => `${s} (${sc}/100)`).join(", ")}
THEIR WEAKEST SKILLS: ${bottomSkills.map(([s,sc]) => `${s} (${sc}/100)`).join(", ")}
PRIMARY GAP SKILL: ${primaryGapSkill} (${skillScores?.[primaryGapSkill]}/100)
SECONDARY GAP SKILL: ${secondaryGapSkill} (${skillScores?.[secondaryGapSkill]}/100)
RECOMMENDED PROGRAMME: ${primaryProgramme.name} (${primaryProgramme.duration}, ${primaryProgramme.price})
IMMEDIATE WEEKLY ACTION for ${primaryGapSkill}: "${SKILL_ACTIONS[primaryGapSkill] || "Start by naming the exact gap in your own words."}"
${!listed ? `IMPORTANT: ${name} scored ${valuIndex}/100 which is below the 35-point listing minimum. The PRIME Sprint is the direct path to getting listed.` : ""}
WRITE THE REPORT IN THESE EXACT SECTIONS:
---
## YOUR SCORE: ${valuIndex}/100 — ${desig.name.toUpperCase()}
## WHAT YOU ARE GOOD AT
## WHERE YOU ARE LOSING GROUND
## WHAT THIS COSTS YOU IN THE NEXT 12 MONTHS
## YOUR ONE ACTION FOR THIS WEEK
Give them EXACTLY: "${SKILL_ACTIONS[primaryGapSkill]}"
## THE PROGRAMME YOU NEED RIGHT NOW
Name: ${primaryProgramme.name} | Duration: ${primaryProgramme.duration} | Investment: ${primaryProgramme.price}
${!listed ? `\n## HOW TO GET LISTED` : ""}
## THE QUESTION TO SIT WITH
A single question in italics about ${primaryGapSkill}, specific to their role as a ${role}.
---
Start directly with ## YOUR SCORE. No introduction before it.`;
}

// ── RETAKE MODAL ───────────────────────────────────────────────────────────
function RetakeModal({ mode, onClose, onConfirm, expiryDateFormatted }) {
  if (!mode) return null;
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:999,
      background:"rgba(15,15,26,0.92)",
      backdropFilter:"blur(12px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:"24px",
    }}>
      <div style={{
        background: T.midnight, border:"1px solid rgba(201,168,76,0.2)",
        borderRadius: T.radius.card, padding:"36px 32px",
        maxWidth:460, width:"100%", position:"relative",
      }}>
        <button onClick={onClose} style={{
          position:"absolute", top:16, right:16,
          background:"none", border:"none", color:T.text.muted,
          fontSize:20, cursor:"pointer", lineHeight:1, fontFamily:T.font.body,
        }}>×</button>
        {mode === "locked" ? (
          <>
            <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.3)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke={T.gold} strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0110 0v4" stroke={T.gold} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div style={{ fontFamily:T.font.display, fontSize:26, fontWeight:300, color:T.parchment, marginBottom:12, lineHeight:1.2 }}>Your VALU Index is still valid.</div>
            <p style={{ fontSize:T.size.body, color:T.text.tertiary, lineHeight:1.75, marginBottom:16 }}>You can retake the assessment on <strong style={{color:T.gold}}>{expiryDateFormatted}</strong>. Your score expires 12 months after your assessment date.</p>
            <p style={{ fontSize:T.size.small, color:T.text.muted, lineHeight:1.7, marginBottom:24 }}>If you believe there is an error, contact <span style={{color:T.gold}}>info@valoriainstitute.com</span> and a Valoria adviser will review your session.</p>
            <button onClick={onClose} style={{...pillBtn("gold-ghost"), width:"100%"}}>CLOSE</button>
          </>
        ) : (
          <>
            <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(216,90,48,0.1)", border:"1px solid rgba(216,90,48,0.3)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={T.coral} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontFamily:T.font.display, fontSize:26, fontWeight:300, color:T.parchment, marginBottom:12, lineHeight:1.2 }}>Are you sure you want to retake?</div>
            <p style={{ fontSize:T.size.body, color:T.text.tertiary, lineHeight:1.75, marginBottom:8 }}>Retaking permanently replaces your current result. Your VALU Index, cluster scores, and AI report will all be overwritten.</p>
            <p style={{ fontSize:T.size.small, color:T.text.muted, lineHeight:1.7, marginBottom:24 }}>The assessment is designed to be taken once every 12 months. Retaking it immediately is unlikely to produce a meaningfully different result.</p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onClose} style={{...pillBtn("ghost"), flex:1}}>KEEP MY RESULT</button>
              <button onClick={onConfirm} style={{...pillBtn("danger"), flex:1}}>YES, RETAKE</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN: INTRO
// ════════════════════════════════════════════════════════════════════════════
function IntroScreen({ onBegin, assessmentIsLocked, expiryDateFormatted, checkpoint, lockRecord }) {
  const [name, setName] = useState(checkpoint?.name || "");
  const [role, setRole] = useState(checkpoint?.role || "");
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width:1024px)").matches : false
  );
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevError, setPrevError]     = useState(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width:1024px)");
    const fn = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const canBegin = name.trim().length > 0 && role.trim().length > 0 && !assessmentIsLocked;
  const hasCheckpoint = checkpoint && checkpoint.currentQ > 0;

  async function handleViewPrevious() {
    if (!lockRecord?.fingerprint) {
      setPrevError("Could not locate your previous result. Contact info@valoriainstitute.com.");
      return;
    }
    setPrevLoading(true);
    setPrevError(null);
    try {
      const profile = await fetchAssessmentByFingerprint(lockRecord.fingerprint);
      if (!profile) {
        setPrevError("Your previous result could not be retrieved. Contact info@valoriainstitute.com.");
        return;
      }
      onBegin({ name: profile.name, role: profile.role, resume: false, previousProfile: profile });
    } catch {
      setPrevError("Something went wrong. Try again or contact info@valoriainstitute.com.");
    } finally {
      setPrevLoading(false);
    }
  }

  const fieldStyle = (filled) => ({
    ...inputBase,
    border: `1.5px solid ${filled ? "rgba(201,168,76,0.4)" : "rgba(247,244,238,0.1)"}`,
    borderRadius: T.radius.card,
    padding: "16px 18px",
    fontSize: 16,
  });

  return (
    <div style={{ minHeight:"100vh", background:T.dark, fontFamily:T.font.body, position:"relative", overflowX:"hidden" }}>
      <Grain />
      <AmbientGlow />

      <div style={{
        position:"relative", zIndex:1,
        maxWidth: isDesktop ? 1400 : 600,
        margin:"0 auto",
        padding: isDesktop ? "60px 48px" : "clamp(48px,10vw,72px) 20px clamp(40px,8vw,64px)",
        display:"flex",
        flexDirection: isDesktop ? "row" : "column",
        gap: isDesktop ? 80 : 0,
      }}>

        {/* DESKTOP LEFT — marketing column */}
        {isDesktop && (
          <div style={{ flex:1.2, paddingRight:20 }}>
            <div style={{ marginBottom:40 }}>
              <div style={{ fontFamily:T.font.display, fontSize:34, fontWeight:600, color:T.gold, letterSpacing:"0.22em", lineHeight:1, marginBottom:4 }}>VALORIA</div>
              <div style={{ fontSize:T.size.micro, color:"rgba(201,168,76,0.4)", letterSpacing:"0.3em", fontFamily:T.font.label }}>INSTITUTE</div>
            </div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"5px 14px", background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:T.radius.pill, marginBottom:28 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:T.gold }} />
              <span style={{ fontSize:T.size.micro, fontWeight:600, color:T.gold, letterSpacing:"0.2em", fontFamily:T.font.label }}>FOUNDING COHORT — NOW OPEN</span>
            </div>
            <h1 style={{ fontFamily:T.font.display, fontSize:"clamp(48px,5vw,68px)", fontWeight:300, lineHeight:1, letterSpacing:"-0.02em", color:T.parchment, margin:"0 0 20px" }}>
              Know exactly<br/>where you <em style={{ fontStyle:"italic", color:T.gold }}>stand.</em>
            </h1>
            <p style={{ fontSize:16, fontWeight:300, color:T.text.tertiary, lineHeight:1.75, margin:"0 0 40px", maxWidth:460, fontFamily:T.font.body }}>
              55 questions across five PRIME clusters. Designed to surface what you genuinely do — not what you aspire to do.
            </p>
            <div style={{ display:"flex", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:T.radius.chip, overflow:"hidden", marginBottom:40, maxWidth:400 }}>
              {[{l:"Questions",v:"55"},{l:"Minutes",v:"18–28"},{l:"Always",v:"Free"}].map((s,i)=>(
                <div key={i} style={{ flex:1, padding:"18px 8px", textAlign:"center", borderRight:i<2?"1px solid rgba(255,255,255,0.06)":"none" }}>
                  <div style={{ fontSize:22, fontWeight:700, color:T.gold, lineHeight:1, fontFamily:T.font.display }}>{s.v}</div>
                  <div style={{ fontSize:T.size.caption, color:T.text.ghost, marginTop:5, letterSpacing:"0.06em", fontFamily:T.font.body }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:T.size.micro, color:"rgba(201,168,76,0.35)", letterSpacing:"0.18em", marginBottom:14, fontFamily:T.font.label }}>WHAT IS ASSESSED</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {CLUSTERS.map(c=>(
                  <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"rgba(255,255,255,0.02)", border:`1px solid ${c.color}22`, borderRadius:T.radius.chip }}>
                    <div style={{ width:36, height:36, borderRadius:T.radius.chip, background:`${c.color}15`, border:`1px solid ${c.color}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:c.color, flexShrink:0, fontFamily:T.font.body }}>{c.id}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:T.size.body, color:T.parchment, fontWeight:500, fontFamily:T.font.body }}>{c.name}</div>
                      <div style={{ fontSize:T.size.caption+1, color:T.text.muted, fontStyle:"italic", fontFamily:T.font.body }}>{c.theme}</div>
                    </div>
                    <div style={{ fontSize:T.size.caption, color:`${c.color}70`, letterSpacing:"0.06em", fontFamily:T.font.mono }}>{Math.round(c.weight*100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT / MOBILE — form column */}
        <div style={{ flex:isDesktop ? 1 : "unset", width:isDesktop ? "auto" : "100%" }}>
          {!isDesktop && (
            <div style={{ marginBottom:28, animation:"fadeUp 0.7s ease 0.05s both" }}>
              <div style={{ fontFamily:T.font.display, fontSize:26, fontWeight:600, color:T.gold, letterSpacing:"0.2em", lineHeight:1, marginBottom:3 }}>VALORIA</div>
              <div style={{ fontSize:T.size.micro, color:"rgba(201,168,76,0.4)", letterSpacing:"0.3em", marginBottom:16, fontFamily:T.font.label }}>INSTITUTE</div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"4px 12px", background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:T.radius.pill, marginBottom:18 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:T.gold }} />
                <span style={{ fontSize:T.size.micro, fontWeight:600, color:T.gold, letterSpacing:"0.18em", fontFamily:T.font.label }}>FOUNDING COHORT — NOW OPEN</span>
              </div>
              <h1 style={{ fontFamily:T.font.display, fontSize:"clamp(34px,8vw,48px)", fontWeight:300, lineHeight:1.05, color:T.parchment, margin:"0 0 12px" }}>
                Know exactly<br/>where you <em style={{ fontStyle:"italic", color:T.gold }}>stand.</em>
              </h1>
              <p style={{ fontSize:T.size.body, color:T.text.tertiary, lineHeight:1.65, margin:"0 0 24px", fontFamily:T.font.body }}>55 questions across five PRIME clusters.</p>
              <div style={{ display:"flex", marginBottom:28, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:T.radius.chip, overflow:"hidden" }}>
                {[{l:"Questions",v:"55"},{l:"Minutes",v:"18–28"},{l:"Free",v:"Always"}].map((s,i)=>(
                  <div key={i} style={{ flex:1, padding:"12px 6px", textAlign:"center", borderRight:i<2?"1px solid rgba(255,255,255,0.06)":"none" }}>
                    <div style={{ fontSize:18, fontWeight:700, color:T.gold, fontFamily:T.font.display }}>{s.v}</div>
                    <div style={{ fontSize:T.size.micro, color:T.text.ghost, marginTop:4, fontFamily:T.font.body }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasCheckpoint && (
            <div style={{ marginBottom:16, padding:"14px 18px", background:"rgba(55,138,221,0.06)", border:"1px solid rgba(55,138,221,0.25)", borderRadius:T.radius.chip }}>
              <div style={{ fontSize:T.size.caption, fontWeight:700, color:"#378ADD", letterSpacing:"0.14em", marginBottom:6, fontFamily:T.font.body }}>SESSION IN PROGRESS</div>
              <p style={{ fontSize:T.size.small, color:T.text.tertiary, lineHeight:1.7, margin:"0 0 10px" }}>
                You have a session in progress at question {checkpoint.currentQ + 1} of {TOTAL}.
              </p>
              <button
                onClick={() => onBegin({ name: checkpoint.name, role: checkpoint.role, resume: true })}
                style={{...pillBtn("gold-ghost"), padding:"10px 20px", fontSize:T.size.caption}}>
                RESUME SESSION →
              </button>
            </div>
          )}

          {assessmentIsLocked && (
            <div style={{ marginBottom:20, padding:"16px 18px", background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.25)", borderRadius:T.radius.chip }}>
              <div style={{ fontSize:T.size.caption, fontWeight:700, color:T.gold, letterSpacing:"0.14em", marginBottom:8, fontFamily:T.font.body }}>ASSESSMENT LOCKED</div>
              <p style={{ fontSize:T.size.small, color:T.text.tertiary, lineHeight:1.7, margin:"0 0 14px" }}>
                You completed the VALU Index for this identity. Retake is available on <strong style={{color:T.gold}}>{expiryDateFormatted}</strong>.
              </p>
              {prevError && (
                <p style={{ fontSize:T.size.small, color:T.coral, margin:"0 0 10px", lineHeight:1.6 }}>{prevError}</p>
              )}
              <button
                onClick={handleViewPrevious}
                disabled={prevLoading}
                style={{...pillBtn(prevLoading ? "disabled" : "gold-ghost"), padding:"10px 20px", fontSize:T.size.caption}}>
                {prevLoading ? "RETRIEVING..." : "VIEW MY PREVIOUS REPORT →"}
              </button>
            </div>
          )}

          <div style={{ background:"rgba(22,22,36,0.7)", border:"1px solid rgba(201,168,76,0.12)", borderRadius:T.radius.card, padding:"clamp(24px,6vw,32px)", animation:"fadeUp 0.8s ease 0.35s both" }}>
            <div style={{ fontSize:T.size.caption, fontWeight:600, color:T.text.muted, letterSpacing:"0.14em", marginBottom:20, fontFamily:T.font.label }}>BEFORE YOU BEGIN</div>
            <div style={{ marginBottom:16 }}>
              <label style={labelBase}>Your Full Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" autoComplete="name" style={fieldStyle(name.trim())} />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={labelBase}>Your Current Role</label>
              <input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Director of Strategy" autoComplete="organization-title" style={fieldStyle(role.trim())} />
            </div>
            <button
              onClick={() => { if (canBegin) onBegin({ name, role, resume: false }); }}
              disabled={!canBegin}
              style={{ ...pillBtn(canBegin ? "primary" : "disabled"), width:"100%", padding:"18px 24px" }}
              onMouseEnter={e => { if (canBegin) e.currentTarget.style.background="#E2C97E"; }}
              onMouseLeave={e => { if (canBegin) e.currentTarget.style.background=T.gold; }}
            >
              BEGIN THE VALU INDEX
            </button>
            {!canBegin && (
              <p style={{ textAlign:"center", fontSize:T.size.caption, color:T.text.ghost, marginTop:12, lineHeight:1.5, fontFamily:T.font.body }}>
                {assessmentIsLocked ? "Assessment locked for 12 months for this identity." : "Enter your name and role to continue."}
              </p>
            )}
          </div>

          <div style={{ marginTop:16, padding:"14px 18px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:T.radius.chip, animation:"fadeUp 0.8s ease 0.45s both" }}>
            <div style={{ fontSize:T.size.small, color:T.text.muted, lineHeight:1.75, fontFamily:T.font.body }}>
              Answer based on what you <em style={{color:T.text.tertiary}}>actually do</em> — not what you aim to do. Consistent honest responses produce a more accurate result.
            </div>
          </div>

          {!isDesktop && (
            <div style={{ marginTop:28, animation:"fadeUp 0.8s ease 0.55s both" }}>
              <div style={{ fontSize:T.size.micro, color:"rgba(201,168,76,0.35)", letterSpacing:"0.18em", marginBottom:12, fontFamily:T.font.label }}>WHAT IS ASSESSED</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {CLUSTERS.map(c=>(
                  <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"rgba(255,255,255,0.02)", border:`1px solid ${c.color}20`, borderRadius:T.radius.chip }}>
                    <div style={{ width:32, height:32, borderRadius:T.radius.chip, background:`${c.color}15`, border:`1px solid ${c.color}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:c.color, flexShrink:0, fontFamily:T.font.body }}>{c.id}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:T.size.small, color:T.parchment, fontWeight:500, fontFamily:T.font.body }}>{c.name}</div>
                      <div style={{ fontSize:T.size.caption, color:T.text.muted, fontStyle:"italic", fontFamily:T.font.body }}>{c.theme}</div>
                    </div>
                    <div style={{ fontSize:T.size.caption, color:`${c.color}70`, letterSpacing:"0.06em", flexShrink:0, fontFamily:T.font.mono }}>{Math.round(c.weight*100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop:32, paddingTop:24, borderTop:"1px solid rgba(201,168,76,0.08)", display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center" }}>
            {["Always free","18–28 minutes","NDPA 2023 compliant"].map(t=>(
              <div key={t} style={{ display:"flex", alignItems:"center", gap:6, fontSize:T.size.caption, color:T.text.ghost, fontFamily:T.font.body }}>
                <div style={{ width:3, height:3, borderRadius:"50%", background:"rgba(201,168,76,0.4)" }}/>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN: ASSESSMENT
// ════════════════════════════════════════════════════════════════════════════
function AssessmentScreen({ name, role, initialAnswers, initialTimings, initialQ, sessionSeed, onComplete }) {
  const [currentQ, setCurrentQ]     = useState(initialQ || 0);
  const [answers, setAnswers]       = useState(initialAnswers || {});
  const [selected, setSelected]     = useState(null);
  const [timings, setTimings]       = useState(initialTimings || Array(TOTAL).fill(0));
  const [qStartTime, setQStartTime] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [shuffleMap, setShuffleMap] = useState(() => {
    const q = QUESTIONS[initialQ || 0];
    if (!q || q.type === "anchor") return {};
    return { [initialQ || 0]: seededShuffle(q.options, sessionSeed + (initialQ || 0)) };
  });

  const question = QUESTIONS[currentQ];
  const cluster  = CLUSTERS.find(c => c.id === question?.cluster);
  const progress = Math.round((currentQ / TOTAL) * 100);

  // Single source of truth: displayedOptions reads from shuffleMap only.
  const displayedOptions = useMemo(() => {
    if (!question) return [];
    if (question.type === "anchor") return question.options;
    return shuffleMap[currentQ] || [];
  }, [currentQ, question, shuffleMap]);

  // Populate shuffleMap entry for currentQ (and prefetch next) in useEffect.
  // This is the only place seededShuffle is called — no parallel calls in useMemo.
  useEffect(() => {
    if (!question) return;
    setShuffleMap(prev => {
      const next = { ...prev };
      if (question.type !== "anchor" && !next[currentQ]) {
        next[currentQ] = seededShuffle(question.options, sessionSeed + currentQ);
      }
      const nextQ = QUESTIONS[currentQ + 1];
      if (nextQ && nextQ.type !== "anchor" && !next[currentQ + 1]) {
        next[currentQ + 1] = seededShuffle(nextQ.options, sessionSeed + currentQ + 1);
      }
      return next;
    });
  }, [currentQ, question, sessionSeed]);

  useEffect(() => { setQStartTime(Date.now()); }, [currentQ]);

  // FIX: complete deps array — name, role, sessionSeed added
  useEffect(() => {
    saveCheckpoint({ name, role, answers, timings, currentQ, sessionSeed });
  }, [answers, currentQ, name, role, sessionSeed]);

  // Live cluster scores for radar
  const liveScores = {};
  CLUSTERS.forEach(c => {
    const qs = QUESTIONS.filter((q, i) => q.cluster === c.id && answers[i] !== undefined);
    const raw = qs.reduce((s, q) => {
      const idx = QUESTIONS.indexOf(q);
      const opt = shuffleMap[idx] ? shuffleMap[idx][answers[idx]] : q.options[answers[idx]];
      return s + (opt?.score || 0);
    }, 0);
    liveScores[c.id] = Math.round((raw / c.maxRaw) * 100);
  });

  function handleSelect(optIdx) {
    if (transitioning) return;
    setSelected(optIdx);
  }

  function handleContinue() {
    if (selected === null || transitioning) return;
    const elapsed = qStartTime ? Date.now() - qStartTime : 0;
    const newTimings = [...timings];
    newTimings[currentQ] = elapsed;
    const newAnswers = { ...answers, [currentQ]: selected };
    setAnswers(newAnswers);
    setTimings(newTimings);
    setTransitioning(true);
    setTimeout(() => {
      if (currentQ + 1 < TOTAL) {
        setCurrentQ(currentQ + 1);
        setSelected(null);
        setTransitioning(false);
      } else {
        const r = computeResults(newAnswers, newTimings, shuffleMap);
        clearCheckpoint();
        onComplete({ name, role, results: r, shuffleMap });
      }
    }, 220);
  }

  function handleBack() {
    if (currentQ === 0) return;
    setSelected(answers[currentQ - 1] ?? null);
    setCurrentQ(currentQ - 1);
  }

  const pageNum = currentQ + 1;

  return (
    <div style={{ minHeight:"100vh", background:T.dark, display:"flex", flexDirection:"column", fontFamily:T.font.body }}>
      {/* No <ClusterStripe /> here — owned by ValoriaNav in the platform shell */}
      <Grain />
      <AmbientGlow color="rgba(201,168,76,0.06)" />

      {/* Nav bar */}
      <div style={{
        position:"fixed", top:59, left:0, right:0,
        padding:"14px 24px 12px",
        background:"rgba(26,26,46,0.97)",
        borderBottom:"1px solid rgba(201,168,76,0.1)",
        backdropFilter:"blur(12px)",
        zIndex:40,
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <div style={{ fontFamily:T.font.label, fontSize:T.size.caption, color:"rgba(201,168,76,0.6)", letterSpacing:"0.15em" }}>VALU INDEX</div>
        {cluster && (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:18, height:18, borderRadius: T.radius.chip, background:`${cluster.color}20`, border:`1px solid ${cluster.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:T.size.micro, fontWeight:700, color:cluster.color, fontFamily:T.font.body }}>{cluster.id}</div>
            <div style={{ fontSize:T.size.caption, color:cluster.color, letterSpacing:"0.08em", fontFamily:T.font.label }}>{cluster.name.toUpperCase()}</div>
          </div>
        )}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:2, background:"rgba(255,255,255,0.06)" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:T.gold, transition:"width 0.4s ease", borderRadius: T.radius.chip }} />
        </div>
      </div>

      {/* Question area — top padding accounts for platform nav (59px) + assessment nav (~48px) */}
      <div style={{ flex:1, display:"flex", padding:"120px 20px 140px", maxWidth:700, margin:"0 auto", width:"100%", flexDirection:"column", justifyContent:"center" }}>
        {question.skill && question.cluster !== "VA" && (
          <div style={{ fontSize:T.size.caption, color:"rgba(201,168,76,0.4)", letterSpacing:"0.18em", marginBottom:16, textTransform:"uppercase", fontFamily:T.font.body }}>
            {question.skill} · {question.type}
          </div>
        )}
        <div style={{
          fontFamily: T.font.display,
          fontSize:"clamp(17px,2.5vw,22px)",
          fontWeight:300,
          color: T.parchment,
          lineHeight:1.55,
          marginBottom:28,
          opacity: transitioning ? 0 : 1,
          transition:"opacity 0.2s",
        }}>
          {question.q}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, opacity:transitioning?0:1, transition:"opacity 0.2s" }}>
          {displayedOptions.map((opt, displayIdx) => {
            const isSelected = selected === displayIdx;
            return (
              <button key={displayIdx} onClick={() => handleSelect(displayIdx)}
                style={{
                  padding:"16px 20px",
                  background: isSelected ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${isSelected ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: T.radius.chip,
                  textAlign:"left",
                  cursor:"pointer",
                  color: isSelected ? T.parchment : T.text.secondary,
                  fontSize: T.size.body,
                  lineHeight:1.55,
                  fontFamily: T.font.body,
                  transition:"all 0.2s cubic-bezier(0.22,1,0.36,1)",
                  outline:"none",
                  boxShadow: isSelected ? "0 4px 20px rgba(201,168,76,0.15)" : "none",
                  display:"flex",
                  alignItems:"flex-start",
                  gap:12,
                  animation: isSelected ? "optionSelect 0.25s ease" : "none",
                }}
                onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background="rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor="rgba(201,168,76,0.25)"; e.currentTarget.style.color=T.parchment; }}}
                onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background="rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; e.currentTarget.style.color=T.text.secondary; }}}
                onTouchStart={e => { e.currentTarget.style.transform="scale(0.98)"; }}
                onTouchEnd={e => { e.currentTarget.style.transform="scale(1)"; }}
              >
                <div style={{
                  width:18, height:18, borderRadius:"50%", flexShrink:0, marginTop:2,
                  border: `1.5px solid ${isSelected ? T.gold : "rgba(247,244,238,0.2)"}`,
                  background: isSelected ? T.gold : "transparent",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all 0.2s",
                }}>
                  {isSelected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" style={{animation:"checkIn 0.2s ease"}}>
                      <path d="M1 4L3.5 6.5L9 1" stroke={T.dark} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span>{opt.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        padding:"14px 24px",
        background:"rgba(26,26,46,0.97)",
        borderTop:"1px solid rgba(201,168,76,0.08)",
        backdropFilter:"blur(12px)",
        display:"flex", gap:10, alignItems:"center", justifyContent:"space-between",
        zIndex:40,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:100 }}>
          <PageNumber current={pageNum} total={TOTAL} />
          {currentQ > 0 && (
            <button onClick={handleBack}
              style={{ ...pillBtn("ghost"), padding:"10px 18px", fontSize:T.size.caption }}>
              BACK
            </button>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={selected === null}
          style={{ ...pillBtn(selected !== null ? "primary" : "disabled"), padding:"13px 32px", minWidth:160 }}
          onMouseEnter={e => { if (selected !== null) e.currentTarget.style.background="#E2C97E"; }}
          onMouseLeave={e => { if (selected !== null) e.currentTarget.style.background=T.gold; }}
        >
          {currentQ + 1 === TOTAL ? "SEE MY RESULTS" : "CONTINUE →"}
        </button>

        {/* FIX: 100px as per spec */}
        <div style={{ flexShrink:0 }}>
          <Radar scores={liveScores} size={100} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN: RESULTS
// ════════════════════════════════════════════════════════════════════════════
function ResultsScreen({ name, role, results, onRetake, onSignupDone }) {
  const [signupEmail, setSignupEmail]       = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError]       = useState("");
  const [signupLoading, setSignupLoading]   = useState(false);
  const [signupDone, setSignupDone]         = useState(false);
  const [saveError, setSaveError]           = useState(null);
  const [retakeModal, setRetakeModal]       = useState(null);

  const { valuIndex, clusterScores, skillScores, desig, futureReadyScore, listed } = results;

  // Save scores to Supabase immediately on completion.
  // Email is not available yet — it is added in handleSignup below.
  // Uses upsert-style: if the same identity_hash already exists this
  // will create a duplicate row; the uniqueness constraint on the DB
  // should be set to identity_hash with ON CONFLICT DO NOTHING.
  useEffect(() => {
    const fp = computeFingerprint(name, role);
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    saveToSupabase({
      total_score: valuIndex,
      designation: desig?.name || "",
      completed_at: new Date().toISOString(),
      ai_report: null,
      name, role,
      identity_hash: fp,
      expires_at: expiresAt,
      cluster_scores: clusterScores,
      skill_scores: skillScores,
    }).catch(err => setSaveError(err.message));
  }, []);

  async function handleSignup() {
    if (!signupEmail.trim() || !signupPassword) {
      setSignupError("A valid email address and password are required.");
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError("Your password must be at least 8 characters.");
      return;
    }
    setSignupLoading(true);
    setSignupError("");
    try {
      // 1. Create Supabase Auth account — sends confirmation email automatically.
      await signUpWithSupabase(signupEmail.trim(), signupPassword, name, role);

      // 2. Store pending report payload so the hash-return flow can resume.
      setPendingReport({ name, role, email: signupEmail.trim(), results });

      // 3. Update the assessment row with the confirmed email address.
      const fp = computeFingerprint(name, role);
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      await saveToSupabase({
        total_score: valuIndex,
        designation: desig?.name || "",
        completed_at: new Date().toISOString(),
        ai_report: null,
        name, role,
        identity_hash: fp,
        expires_at: expiresAt,
        cluster_scores: clusterScores,
        skill_scores: skillScores,
        email: signupEmail.trim(),
      }).catch(() => {});

      // 4. Add to waitlist table (idempotent — 409 is silently swallowed).
      await joinWaitlist({ name, email: signupEmail.trim(), role }).catch(() => {});

      setSignupDone(true);
      if (onSignupDone) onSignupDone(signupEmail.trim());
    } catch (e) {
      setSignupError(e.message || "Something prevented this from completing. Try again shortly.");
    } finally {
      setSignupLoading(false);
    }
  }

  const pageNum = TOTAL + 1;
  const sortedSkills = Object.entries(skillScores || {})
    .filter(([s]) => s !== "Validity")
    .sort(([,a],[,b]) => b - a);
  const topSkills    = sortedSkills.slice(0, 3);
  const bottomSkills = sortedSkills.slice(-3).reverse();

  return (
    <div style={{ minHeight:"100vh", background:T.dark, fontFamily:T.font.body }}>
      {/* No <ClusterStripe /> — owned by ValoriaNav */}
      <Grain />
      <AmbientGlow />

      <ScoreHeader
        name={name} role={role}
        valuIndex={valuIndex} clusterScores={clusterScores}
        skillScores={skillScores} desig={desig}
        futureReadyScore={futureReadyScore}
        sticky={false}
      />

      <div style={{ maxWidth:720, margin:"0 auto", padding:"32px 24px 80px" }}>

        {saveError && (
          <div style={{ marginBottom:16, padding:"12px 16px", background:"rgba(216,90,48,0.08)", border:"1px solid rgba(216,90,48,0.3)", borderRadius:T.radius.chip, fontSize:T.size.small, color:T.coral, fontFamily:T.font.body }}>
            Score could not be saved: {saveError}. Contact info@valoriainstitute.com with your result ({valuIndex}/100).
          </div>
        )}

        <div style={{ marginBottom:24, padding:"24px", background:"rgba(22,22,36,0.6)", border:"1px solid rgba(201,168,76,0.1)", borderRadius:T.radius.card }}>
          <div style={{ fontSize:T.size.caption, fontWeight:700, color:T.gold, letterSpacing:"0.16em", marginBottom:12, fontFamily:T.font.label }}>YOUR RESULT SUMMARY</div>

          <div style={{ padding:"16px", background: desig.bg, border:`1px solid ${desig.color}30`, borderRadius:T.radius.chip, marginBottom:16 }}>
            <div style={{ fontSize:T.size.small, fontWeight:700, color:desig.color, letterSpacing:"0.1em", marginBottom:6, fontFamily:T.font.body }}>{desig.name.toUpperCase()}</div>
            <p style={{ fontSize:T.size.body, color:T.text.secondary, lineHeight:1.7, margin:0, fontFamily:T.font.body }}>{desig.desc}</p>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap", marginBottom:16 }}>
            <Radar scores={clusterScores} size={160} />
            <div style={{ flex:1, minWidth:200 }}>
              {CLUSTERS.map(c => (
                <div key={c.id} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:T.size.small, color:c.color, fontFamily:T.font.body }}>{c.name}</span>
                    <span style={{ fontSize:T.size.small, color:c.color, fontWeight:600, fontFamily:T.font.mono }}>{clusterScores[c.id]}</span>
                  </div>
                  <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius: T.radius.chip, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${clusterScores[c.id]}%`, background:c.color, borderRadius: T.radius.chip, transition:"width 0.8s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <div style={{ fontSize:T.size.micro, color:"rgba(29,158,117,0.6)", letterSpacing:"0.14em", marginBottom:8, fontFamily:T.font.label }}>YOUR STRENGTHS</div>
              {topSkills.map(([s, sc]) => (
                <div key={s} style={{ display:"flex", justifyContent:"space-between", marginBottom:5, alignItems:"center" }}>
                  <span style={{ fontSize:T.size.small, color:T.text.secondary, fontFamily:T.font.body }}>{s}</span>
                  <span style={{ fontSize:T.size.caption, color:"#1D9E75", fontFamily:T.font.mono }}>{sc}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:T.size.micro, color:"rgba(216,90,48,0.6)", letterSpacing:"0.14em", marginBottom:8, fontFamily:T.font.label }}>DEVELOPMENT AREAS</div>
              {bottomSkills.map(([s, sc]) => (
                <div key={s} style={{ display:"flex", justifyContent:"space-between", marginBottom:5, alignItems:"center" }}>
                  <span style={{ fontSize:T.size.small, color:T.text.secondary, fontFamily:T.font.body }}>{s}</span>
                  <span style={{ fontSize:T.size.caption, color:T.coral, fontFamily:T.font.mono }}>{sc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Signup / email confirmation card */}
        {signupDone ? (
          <div style={{ background:"rgba(29,158,117,0.05)", border:"1px solid rgba(29,158,117,0.25)", borderRadius:T.radius.card, padding:"32px 28px" }}>
            <div style={{ fontSize:T.size.caption, fontWeight:700, color:"#1D9E75", letterSpacing:"0.16em", marginBottom:12, fontFamily:T.font.label }}>CHECK YOUR EMAIL</div>
            <p style={{ fontSize:T.size.body, color:T.text.secondary, lineHeight:1.8, margin:"0 0 12px", fontFamily:T.font.body }}>
              A confirmation link has been sent to <strong style={{color:T.parchment}}>{signupEmail}</strong>.
            </p>
            <p style={{ fontSize:T.size.small, color:T.text.muted, lineHeight:1.7, margin:0, fontFamily:T.font.body }}>
              Confirm your email to unlock your full AI report. Your VALU Index of {valuIndex} is saved. Check your spam folder if you don't see it within a minute.
            </p>
          </div>
        ) : (
          <div style={{ background:"rgba(22,22,36,0.7)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:T.radius.card, padding:"32px 28px" }}>
            <div style={{ fontSize:T.size.caption, fontWeight:700, color:T.gold, letterSpacing:"0.16em", marginBottom:8, fontFamily:T.font.label }}>UNLOCK YOUR FULL AI REPORT</div>
            <p style={{ fontSize:T.size.body, color:T.text.tertiary, lineHeight:1.7, marginBottom:16, fontFamily:T.font.body }}>
              Your personalised development report — gap analysis, 12-month cost of inaction, recommended programme, and one immediate action — generates the moment you confirm your email.
            </p>
            <div style={{ fontSize:T.size.small, color:T.text.muted, marginBottom:20, fontFamily:T.font.body }}>
              Continuing as <strong style={{color:T.parchment}}>{name}</strong> · {role}
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={labelBase} htmlFor="signup-email">Email Address</label>
              <input id="signup-email" type="email" placeholder="you@example.com" value={signupEmail}
                onChange={e=>setSignupEmail(e.target.value)} style={inputBase}
                onFocus={e=>e.target.style.borderColor="rgba(201,168,76,0.4)"}
                onBlur={e=>e.target.style.borderColor="rgba(247,244,238,0.1)"} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={labelBase} htmlFor="signup-password">Create Password</label>
              <input id="signup-password" type="password" placeholder="Minimum 8 characters" value={signupPassword}
                onChange={e=>setSignupPassword(e.target.value)} style={inputBase}
                onFocus={e=>e.target.style.borderColor="rgba(201,168,76,0.4)"}
                onBlur={e=>e.target.style.borderColor="rgba(247,244,238,0.1)"} />
            </div>
            {signupError && (
              <div style={{ fontSize:T.size.small, color:T.coral, marginBottom:14, padding:"10px 14px", background:"rgba(216,90,48,0.06)", borderLeft:`2px solid rgba(216,90,48,0.6)`, borderRadius:`0 ${T.radius.chip}px ${T.radius.chip}px 0`, fontFamily:T.font.body }}>
                {signupError}
              </div>
            )}
            <button onClick={handleSignup} disabled={signupLoading}
              style={{ ...pillBtn(signupLoading ? "disabled" : "primary"), width:"100%", padding:"16px" }}
              onMouseEnter={e=>{ if(!signupLoading) e.currentTarget.style.background="#E2C97E"; }}
              onMouseLeave={e=>{ if(!signupLoading) e.currentTarget.style.background=T.gold; }}>
              {signupLoading ? "CREATING YOUR ACCOUNT..." : "CONFIRM EMAIL & UNLOCK REPORT"}
            </button>
            <p style={{ fontSize:T.size.caption, color:T.text.ghost, lineHeight:1.7, marginTop:12, fontFamily:T.font.body }}>
              Your AI report generates only after email confirmation — this ensures it reaches the right inbox.
            </p>
          </div>
        )}

        <div style={{ marginTop:24, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <PageNumber current={pageNum} total={TOTAL + 2} />
          <button onClick={() => setRetakeModal("confirm")}
            style={{ ...pillBtn("ghost"), padding:"13px 24px", fontSize:T.size.caption }}>
            RETAKE ASSESSMENT
          </button>
        </div>
      </div>

      <div style={{ textAlign:"center", padding:"24px", fontSize:T.size.caption, color:T.text.ghost, letterSpacing:"0.1em", fontFamily:T.font.body }}>
        VALU INDEX v4.0 · PRIME FRAMEWORK · VALORIA INSTITUTE · © 2026
      </div>

      <RetakeModal mode={retakeModal} onClose={() => setRetakeModal(null)} onConfirm={onRetake} expiryDateFormatted={null} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN: REPORT
// ════════════════════════════════════════════════════════════════════════════
function ReportScreen({ name, role, results, confirmedEmail, onRetake, initialReportText }) {
  const [reportText, setReportText]           = useState(initialReportText || "");
  const [reportStatus, setReportStatus]       = useState(initialReportText ? "complete" : "idle");
  const [reportError, setReportError]         = useState(null);
  const [saveReportError, setSaveReportError] = useState(null);
  const [emailStatus, setEmailStatus]         = useState("idle");
  const [retakeModal, setRetakeModal]         = useState(null);
  const reportRef  = useRef(null);
  const abortRef   = useRef(null);
  const bufferRef  = useRef("");
  const flushTimer = useRef(null);

  const { valuIndex, clusterScores, skillScores, desig, futureReadyScore, listed } = results;

  useEffect(() => {
    if (initialReportText) return;
    generateAIReport();
    return () => {
      abortRef.current?.abort();
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, []);

  async function persistWithReport(fullText) {
    const fp = computeFingerprint(name, role);
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await saveToSupabase({
      total_score: valuIndex,
      designation: desig?.name || "",
      completed_at: new Date().toISOString(),
      ai_report: fullText,
      name, role,
      identity_hash: fp,
      expires_at: expiresAt,
      cluster_scores: clusterScores,
      skill_scores: skillScores,
      ...(confirmedEmail ? { email: confirmedEmail } : {}),
    });
  }

  async function emailFullReport(fullText) {
    if (!confirmedEmail) return;
    setEmailStatus("sending");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: confirmedEmail,
          name,
          role,
          score: valuIndex,
          designation: desig?.name || "",
          reportText: fullText,
          // welcome: true signals the endpoint to prepend a welcome section
          // to the email before the report body.
          welcome: true,
        }),
      });
      setEmailStatus(res.ok ? "sent" : "failed");
    } catch {
      setEmailStatus("failed");
    }
  }

  async function generateAIReport() {
    setReportStatus("generating");
    setReportText("");
    bufferRef.current = "";
    const controller = new AbortController();
    abortRef.current = controller;

    flushTimer.current = setInterval(() => {
      if (bufferRef.current) {
        setReportText(prev => {
          const next = prev + bufferRef.current;
          bufferRef.current = "";
          return next;
        });
        if (reportRef.current) reportRef.current.scrollTop = reportRef.current.scrollHeight;
      }
    }, 80);

    try {
      const scoreProfile = { name, role, ...results };
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildReportPrompt(scoreProfile) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "API request failed");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split("\n");
        streamBuffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              fullText += parsed.delta.text;
              bufferRef.current += parsed.delta.text;
            }
          } catch {}
        }
      }
      // Clear interval BEFORE final state set — prevents double-flush race.
      clearInterval(flushTimer.current);
      flushTimer.current = null;
      setReportText(fullText);
      setReportStatus("complete");
      // Persist report (with retry built into saveToSupabase).
      persistWithReport(fullText).catch(err => setSaveReportError(err.message));
      // Email report + welcome message.
      await emailFullReport(fullText);
      clearPendingReport();
    } catch (err) {
      clearInterval(flushTimer.current);
      flushTimer.current = null;
      if (err.name === "AbortError") return;
      console.error("Report generation failed:", err);
      setReportError(err.message);
      setReportStatus("error");
    }
  }

  function renderReport(text) {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return (
        <div key={i} style={{ marginTop:32, marginBottom:12 }}>
          <div style={{ fontSize:T.size.caption, color:T.gold, letterSpacing:"0.2em", marginBottom:6, fontFamily:T.font.label }}>
            {line.replace("## ", "").toUpperCase()}
          </div>
          <div style={{ height:1, background:"rgba(201,168,76,0.15)" }} />
        </div>
      );
      if (line.startsWith("*") && line.endsWith("*") && line.length > 2) return (
        <div key={i} style={{ padding:"20px 24px", background:"rgba(201,168,76,0.05)", borderLeft:`3px solid ${T.gold}`, borderRadius:`0 ${T.radius.chip}px ${T.radius.chip}px 0`, margin:"16px 0" }}>
          <p style={{ fontFamily:T.font.display, fontSize:"clamp(15px,2.2vw,20px)", fontWeight:300, color:T.parchment, lineHeight:1.55, margin:0, fontStyle:"italic" }}>
            {line.slice(1,-1)}
          </p>
        </div>
      );
      if (line.trim() && !line.startsWith("#")) {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} style={{ fontSize:T.size.body, color:T.text.secondary, lineHeight:1.85, margin:"0 0 14px", fontFamily:T.font.body }}>
            {parts.map((part, pi) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={pi} style={{color:T.parchment, fontWeight:600}}>{part.slice(2,-2)}</strong>
                : part
            )}
          </p>
        );
      }
      return null;
    });
  }

  const pageNum = TOTAL + 2;

  return (
    <div style={{ minHeight:"100vh", background:T.dark, fontFamily:T.font.body }}>
      {/* No <ClusterStripe /> — owned by ValoriaNav */}
      <Grain />
      <AmbientGlow color="rgba(216,90,48,0.07)" />

      <ScoreHeader
        name={name} role={role}
        valuIndex={valuIndex} clusterScores={clusterScores}
        skillScores={skillScores} desig={desig}
        futureReadyScore={futureReadyScore}
        sticky={true}
      />

      <div ref={reportRef} style={{ maxWidth:720, margin:"0 auto", padding:"32px 24px 80px" }}>

        {reportStatus === "generating" && (
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28, padding:"14px 18px", background:"rgba(201,168,76,0.06)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:T.radius.chip }}>
            <div style={{ display:"flex", gap:4 }}>
              {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:T.gold, animation:`pulse 1.4s ease-in-out ${i*0.2}s infinite` }}/>)}
            </div>
            <div style={{ fontSize:T.size.small, color:"rgba(201,168,76,0.7)", letterSpacing:"0.08em", fontFamily:T.font.body }}>
              {reportText.length === 0 ? "Analysing your profile..." : "Writing your report..."}
            </div>
          </div>
        )}

        {reportStatus === "error" && (
          <div style={{ padding:"20px 24px", background:"rgba(216,90,48,0.08)", border:"1px solid rgba(216,90,48,0.3)", borderRadius:T.radius.chip, marginBottom:24 }}>
            <div style={{ fontSize:T.size.caption, fontWeight:700, color:T.coral, letterSpacing:"0.1em", marginBottom:8, fontFamily:T.font.label }}>REPORT GENERATION FAILED</div>
            <p style={{ fontSize:T.size.small, color:T.text.tertiary, lineHeight:1.7, marginBottom:12, fontFamily:T.font.body }}>
              {reportError || "An error occurred. Your score has been saved."}
            </p>
            <p style={{ fontSize:T.size.small, color:T.text.muted, lineHeight:1.7, margin:0, fontFamily:T.font.body }}>
              Your VALU Index is <strong style={{color:T.gold}}>{valuIndex}/100</strong> — <strong style={{color:desig.color}}>{desig.name}</strong>. Contact info@valoriainstitute.com for your full report.
            </p>
            <button onClick={generateAIReport} style={{...pillBtn("gold-ghost"), marginTop:16, padding:"11px 24px", fontSize:T.size.caption}}>
              TRY AGAIN
            </button>
          </div>
        )}

        {reportText && <div style={{ lineHeight:1 }}>{renderReport(reportText)}</div>}

        {reportStatus === "generating" && reportText.length > 0 && (
          <span style={{ display:"inline-block", width:2, height:16, background:T.gold, marginLeft:2, animation:"blink 1s step-end infinite", verticalAlign:"text-bottom" }}/>
        )}

        {reportStatus === "complete" && (
          <>
            {saveReportError && (
              <div style={{ marginBottom:16, padding:"12px 16px", background:"rgba(216,90,48,0.08)", border:"1px solid rgba(216,90,48,0.3)", borderRadius:T.radius.chip, fontSize:T.size.small, color:T.coral, fontFamily:T.font.body }}>
                Your report could not be saved to the server: {saveReportError}. Your score is intact. Contact info@valoriainstitute.com if you need this resolved.
              </div>
            )}

            <div style={{ marginTop:32, padding:"20px 24px", background: listed ? "rgba(29,158,117,0.08)" : "rgba(136,136,136,0.08)", border:`1px solid ${listed ? "rgba(29,158,117,0.3)" : "rgba(136,136,136,0.25)"}`, borderRadius:T.radius.chip }}>
              <div style={{ fontSize:T.size.caption, fontWeight:700, color: listed ? "#1D9E75" : "#888888", letterSpacing:"0.12em", marginBottom:8, fontFamily:T.font.label }}>
                {listed ? "LISTED — YOUR PROFILE IS SEARCHABLE" : "NOT YET LISTED — SCORE BELOW 35"}
              </div>
              <p style={{ fontSize:T.size.small, color:T.text.tertiary, lineHeight:1.75, margin:0, fontFamily:T.font.body }}>
                {listed
                  ? `Your VALU Index of ${valuIndex} qualifies you for listing. Complete your profile to become searchable by employers and event organisers.`
                  : `A score of ${valuIndex} does not yet qualify for listing. The minimum is 35. A PRIME Sprint is designed to move your score into the listed range.`}
              </p>
            </div>

            {confirmedEmail && (
              <div style={{ marginTop:14, padding:"14px 18px", background:"rgba(201,168,76,0.05)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:T.radius.chip }}>
                <p style={{ fontSize:T.size.small, color:T.text.tertiary, lineHeight:1.7, margin:0, fontFamily:T.font.body }}>
                  {emailStatus === "sent" && <>A copy of this report was sent to <strong style={{color:T.gold}}>{confirmedEmail}</strong>.</>}
                  {emailStatus === "sending" && "Sending your report and welcome email..."}
                  {emailStatus === "failed" && <>The report could not be emailed. Contact <span style={{color:T.gold}}>info@valoriainstitute.com</span> for a copy.</>}
                </p>
              </div>
            )}

            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:22 }}>
              <a href="https://valoriainstitute.com/profile-page"
                style={{ display:"block", padding:"20px 28px", background:T.gold, borderRadius:T.radius.pill, textAlign:"center", cursor:"pointer", textDecoration:"none" }}
                onMouseEnter={e=>e.currentTarget.style.background="#E2C97E"}
                onMouseLeave={e=>e.currentTarget.style.background=T.gold}>
                <div style={{ fontSize:T.size.small, fontWeight:700, color:T.dark, letterSpacing:"0.16em", marginBottom:3, fontFamily:T.font.body }}>COMPLETE YOUR PROFILE</div>
                <div style={{ fontSize:T.size.small, color:"rgba(26,26,46,0.6)", fontFamily:T.font.body }}>Your account is confirmed — finish your profile on the platform</div>
              </a>
            </div>
          </>
        )}

        <div style={{ marginTop:28, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <PageNumber current={pageNum} total={TOTAL + 2} />
          <button onClick={() => setRetakeModal("confirm")}
            style={{ ...pillBtn("ghost"), padding:"13px 24px", fontSize:T.size.caption }}>
            RETAKE ASSESSMENT
          </button>
        </div>
      </div>

      <div style={{ textAlign:"center", padding:"24px", fontSize:T.size.caption, color:T.text.ghost, letterSpacing:"0.1em", fontFamily:T.font.body }}>
        VALU INDEX v4.0 · PRIME FRAMEWORK · VALORIA INSTITUTE · © 2026
      </div>

      <RetakeModal mode={retakeModal} onClose={() => setRetakeModal(null)} onConfirm={onRetake} expiryDateFormatted={null} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT ORCHESTRATOR
// ════════════════════════════════════════════════════════════════════════════
export default function PRIMEAssessment({
  onComplete,
  onAssessmentSubmitted,
  onIdentityChange,
  onPhaseChange,
  assessmentLockRecord,
}) {
  const [phase, setPhase]                   = useState("intro");
  const [sessionData, setSessionData]       = useState(null);
  const [confirmedEmail, setConfirmedEmail] = useState(null);
  const [initialReportText, setInitialReportText] = useState(null);
  const [sessionSeed]                       = useState(() => Math.floor(Math.random() * 99999));

  // ── FIX: derive fingerprint from the lock record directly so isLockActive
  // always receives both required arguments. assessmentLockRecord.fingerprint
  // is set by persistLock in ValoriaPlatform and by resolveLockForIdentity.
  const assessmentIsLocked = assessmentLockRecord
    ? isLockActive(assessmentLockRecord, assessmentLockRecord.fingerprint)
    : false;

  const lockExpiresAt = assessmentLockRecord?.expiresAt ?? null;
  const expiryDateFormatted = lockExpiresAt
    ? new Date(lockExpiresAt).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })
    : null;

  const checkpoint = loadCheckpoint();

  // Notify platform shell of phase changes so nav can switch to minimal mode.
  function goToPhase(p) {
    setPhase(p);
    if (onPhaseChange) onPhaseChange(p);
  }

  // Handle email confirmation return (hash in URL).
  useEffect(() => {
    const auth = parseAuthHash();
    if (!auth) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (auth.error) return;
    const email = auth.email;
    const pending = getPendingReport();
    if (pending?.results) {
      setSessionData({ name: pending.name, role: pending.role, results: pending.results });
      setConfirmedEmail(email || pending.email);
      goToPhase("report");
    } else if (email) {
      fetchAssessmentByEmail(email).then(profile => {
        if (profile) {
          setSessionData({ name: profile.name, role: profile.role, results: profile.results });
          setConfirmedEmail(email);
          goToPhase("report");
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!onIdentityChange || !sessionData) return;
    const t = setTimeout(() => onIdentityChange(sessionData.name, sessionData.role), 400);
    return () => clearTimeout(t);
  }, [sessionData?.name, sessionData?.role]);

  function handleBegin({ name, role, resume, previousProfile }) {
    // "View Previous Report" path — locked user viewing their stored report.
    if (previousProfile) {
      setSessionData({ name: previousProfile.name, role: previousProfile.role, results: previousProfile.results });
      setInitialReportText(previousProfile.aiReport || null);
      goToPhase("report");
      return;
    }
    if (resume && checkpoint) {
      // FIX: use checkpoint data directly — no name-match guard.
      setSessionData({ name: checkpoint.name, role: checkpoint.role, results: null, shuffleMap: {} });
      goToPhase("assessing");
    } else {
      setSessionData({ name, role, results: null, shuffleMap: {} });
      goToPhase("assessing");
    }
  }

  function handleAssessmentComplete({ name, role, results, shuffleMap }) {
    const sd = { name, role, results, shuffleMap };
    setSessionData(sd);
    goToPhase("results");
    // Notify platform to persist the local lock immediately.
    if (onAssessmentSubmitted) onAssessmentSubmitted({ name, role, completedAt: new Date().toISOString(), ...results });
  }

  function handleRetake() {
    clearCheckpoint();
    clearPendingReport();
    setSessionData(null);
    setConfirmedEmail(null);
    setInitialReportText(null);
    goToPhase("intro");
  }

  if (phase === "intro") {
    return (
      <IntroScreen
        onBegin={handleBegin}
        assessmentIsLocked={assessmentIsLocked}
        expiryDateFormatted={expiryDateFormatted}
        checkpoint={checkpoint}
        lockRecord={assessmentLockRecord}
      />
    );
  }

  if (phase === "assessing") {
    // FIX: resuming keyed on checkpoint existence and progress, not name match.
    const resuming = !!(checkpoint && checkpoint.currentQ > 0);
    return (
      <AssessmentScreen
        name={resuming ? checkpoint.name : (sessionData?.name || "")}
        role={resuming ? checkpoint.role : (sessionData?.role || "")}
        initialAnswers={resuming ? checkpoint.answers : {}}
        initialTimings={resuming ? checkpoint.timings : Array(TOTAL).fill(0)}
        initialQ={resuming ? checkpoint.currentQ : 0}
        sessionSeed={resuming ? (checkpoint.sessionSeed || sessionSeed) : sessionSeed}
        onComplete={handleAssessmentComplete}
      />
    );
  }

  if (phase === "results" && sessionData?.results) {
    return (
      <ResultsScreen
        name={sessionData.name}
        role={sessionData.role}
        results={sessionData.results}
        onRetake={handleRetake}
        onSignupDone={(email) => setConfirmedEmail(email)}
      />
    );
  }

  if (phase === "report" && sessionData?.results) {
    return (
      <ReportScreen
        name={sessionData.name}
        role={sessionData.role}
        results={sessionData.results}
        confirmedEmail={confirmedEmail}
        onRetake={handleRetake}
        initialReportText={initialReportText}
      />
    );
  }

  return null;
}
