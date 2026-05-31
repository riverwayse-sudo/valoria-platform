import { useState, useEffect, useRef, useMemo } from "react";
const SUPABASE_URL = "https://sbkgpisgkuhbalsxqkdr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2dwaXNna3VoYmFsc3hxa2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjI2NjEsImV4cCI6MjA5Mzg5ODY2MX0.iRPs_W6O6JkkHyVlH-9XkEgA1HNo8xtaMakoV5kwLEY";
async function saveToSupabase(data) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase save error:", err);
    }
  } catch(e) {
    console.error("Supabase save failed:", e);
  }
}
const GOLD = "#C9A84C";
const DARK = "#1A1A2E";
const MID  = "#2E2E4A";
const PARCHMENT = "#F7F4EE";
const ACCENT = "#EDE8DC";
const AMBER = "#E8A020";
const BODY = "#2C2C2C";
// ── CLUSTER CONFIG ─────────────────────────────────────────────────────────
const CLUSTERS = [
  { id:"P", name:"Presence",      theme:"How you show up",  color:"#1D9E75", weight:0.20, maxRaw:36 },
  { id:"R", name:"Relationships", theme:"How you connect",  color:"#378ADD", weight:0.25, maxRaw:48 },
  { id:"I", name:"Intelligence",  theme:"How you think",    color:"#7F77DD", weight:0.25, maxRaw:60 },
  { id:"M", name:"Mastery",       theme:"How you deliver",  color:"#BA7517", weight:0.20, maxRaw:36 },
  { id:"E", name:"Enterprise",    theme:"How you create",   color:"#D85A30", weight:0.10, maxRaw:36 },
];
const DESIGNATIONS = [
  { min:80, name:"Force to Align With",    color:GOLD,      bg:"rgba(201,168,76,0.12)",  desc:"Operating at the highest expression of professional capability. You are recognised on the platform as a priority professional." },
  { min:65, name:"Emerging Force",         color:"#378ADD", bg:"rgba(55,138,221,0.10)",  desc:"Strong foundations with clear areas of excellence. You are on the trajectory — deliberate development will complete the picture." },
  { min:50, name:"Developing Professional",color:"#1D9E75", bg:"rgba(29,158,117,0.10)",  desc:"Genuine capability with uneven development. Your PRIME pathway is shown on your profile." },
  { min:35, name:"Building Foundations",   color:"#BA7517", bg:"rgba(186,117,23,0.10)",  desc:"Early-stage professional architecture. A PRIME Sprint is your recommended next step." },
  { min:0,  name:"At the Starting Point",  color:"#888888", bg:"rgba(136,136,136,0.10)", desc:"Not yet listed on the candidate platform. Complete a PRIME Sprint to qualify for listing." },
];
// ── QUESTION BANK — VERSION 3 ──────────────────────────────────────────────
// ALL FIXES APPLIED:
// Fix 1: Options shuffled on render (see useMemo in component)
// Fix 2: Option language equalised — same register, same length, no gradient
// Fix 3: Distractor options embedded — high-sounding but lower-scoring choices
// Fix 4: Uniformity flag in computeResults — flags suspiciously low variance
//
// OPTION LANGUAGE PRINCIPLES:
// — All four options per question are within 10 words of each other in length
// — All options written in the same professional register
// — Score 2 options sometimes sound more sophisticated than score 3 (distractor)
// — No option uses vocabulary that signals "most advanced" by phrasing alone
// — Scores travel with options — shuffle does not affect scoring
const ALL_QUESTIONS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CLUSTER P — PRESENCE
  // ═══════════════════════════════════════════════════════════════════════════
  // P1 — Communication
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
      // DISTRACTOR: sounds decisive and confident — actually scores 2 because it prioritises speed over intelligence
      {text:"Accelerate through the key points before I lose the room entirely.",score:2},
    ]},
  { id:"P1c", cluster:"P", skill:"Communication", type:"reflective",
    q:"Think of the last time someone told you they did not understand your explanation. What was your honest reaction?",
    options:[
      {text:"I assumed the explanation was clear and wondered if they had followed it properly.",score:1},
      {text:"I treated it as a signal that my explanation was the problem and redesigned it.",score:4},
      // DISTRACTOR: sounds humble and responsive — scores 2 because it repeats rather than redesigns
      {text:"I went through it again using simpler language to make it clearer.",score:2},
      {text:"I stopped and asked what specifically was unclear before rebuilding the explanation.",score:3},
    ]},
  // P2 — Negotiation
  { id:"P2a", cluster:"P", skill:"Negotiation", type:"behavioural",
    q:"Before entering a significant negotiation — salary, contract, or partnership — what do you actually do to prepare?",
    options:[
      // DISTRACTOR: sounds thorough and research-based — scores 2 because it only prepares one side
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
      // DISTRACTOR: sounds strategic with anchoring rationale — scores 2 because it assumes price is the only variable
      {text:"Counter firmly with my number and a strong rationale for why it is justified.",score:2},
      {text:"Probe the interest behind their position, then explore whether non-price variables can close the gap.",score:4},
    ]},
  { id:"P2c", cluster:"P", skill:"Negotiation", type:"reflective",
    q:"Describe a negotiation where you settled for less than you wanted. What actually went wrong?",
    options:[
      {text:"I had not defined my walk-away position, so I did not recognise the moment to use it.",score:4},
      {text:"The other side had stronger leverage or was better prepared than I expected.",score:1},
      // DISTRACTOR: sounds analytically grounded — scores 2 because it focuses on tactics not structure
      {text:"I did not anchor high enough at the start, which limited the final range.",score:2},
      {text:"I did not fully understand what they valued, so I could not find a trade that worked for both sides.",score:3},
    ]},
  // P3 — Personal Brand & Executive Presence
  { id:"P3a", cluster:"P", skill:"Personal Brand & Executive Presence", type:"behavioural",
    q:"How would a professional who can only see your digital presence describe what you stand for?",
    options:[
      {text:"They would know my role and industry but probably not much more.",score:1},
      {text:"They would know precisely what I stand for and why I am worth a conversation.",score:4},
      // DISTRACTOR: sounds intentional and curated — scores 2 because it is general not specific
      {text:"They would get a clear sense of my expertise and the kind of professional I am.",score:3},
      {text:"They would see my field and some of my thinking, though not a complete picture.",score:2},
    ]},
  { id:"P3b", cluster:"P", skill:"Personal Brand & Executive Presence", type:"situational",
    q:"You walk into a high-stakes room where you know nobody — a client pitch, a leadership meeting, a major conference. How do you show up?",
    options:[
      {text:"I research who will be in the room and arrive knowing exactly who I want to reach.",score:3},
      {text:"I let the conversation come to me and wait for the right introduction.",score:1},
      {text:"I introduce myself and make sure key people know my role and organisation.",score:2},
      // This is score 4 — describes a fully deliberate presence architecture
      {text:"I know precisely what impression I want to leave and have planned how I will create it — entry, approach, conversation, and close.",score:4},
    ]},
  { id:"P3c", cluster:"P", skill:"Personal Brand & Executive Presence", type:"reflective",
    q:"When did you last receive feedback about how you come across professionally — and what did you do with it?",
    options:[
      {text:"I treat how I come across as a practised skill — I seek feedback and track whether changes are landing.",score:4},
      {text:"I do not recall specific feedback of this kind in recent memory.",score:1},
      // DISTRACTOR: sounds like growth mindset — scores 2 because it is passive not active
      {text:"I have received feedback and I keep it in mind when relevant situations come up.",score:2},
      {text:"I actively seek this type of feedback and have made specific, traceable changes based on it.",score:3},
    ]},
  // ═══════════════════════════════════════════════════════════════════════════
  // CLUSTER R — RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════════════════════
  // R1 — Emotional Intelligence
  { id:"R1a", cluster:"R", skill:"Emotional Intelligence", type:"behavioural",
    q:"You are in a high-pressure meeting and someone says something that genuinely irritates you. What actually happens next?",
    options:[
      {text:"I notice the reaction, give myself a beat, and choose my response rather than react.",score:3},
      {text:"I address it in the moment — it is better than letting it sit.",score:1},
      // DISTRACTOR: sounds controlled and professional — scores 2 because the emotion is still driving behaviour
      {text:"I hold back but the irritation probably shapes how I engage for the rest of the meeting.",score:2},
      {text:"I name the emotion to myself, regulate it in real time, and decide whether to address it now or later.",score:4},
    ]},
  { id:"R1b", cluster:"R", skill:"Emotional Intelligence", type:"situational",
    q:"A colleague who is usually high-performing has become visibly disengaged over the past two weeks. Nobody else has noticed. What do you do?",
    options:[
      {text:"Find a quiet moment to check in directly without framing it as a performance conversation.",score:3},
      {text:"Let it unfold — they will address it themselves if it becomes a real problem.",score:1},
      {text:"Check in privately, create genuine space for what they want to share, and think carefully about what they actually need.",score:4},
      // DISTRACTOR: sounds responsible and action-oriented — scores 2 because it removes the human relationship
      {text:"Mention it to their manager so someone with authority is aware of the change.",score:2},
    ]},
  { id:"R1c", cluster:"R", skill:"Emotional Intelligence", type:"reflective",
    q:"Think of a time you handled a difficult emotion badly at work. What happened and what do you understand now that you did not then?",
    options:[
      {text:"I generally keep things professional — I cannot think of a clear example of handling emotion badly.",score:1},
      {text:"I have a specific example, a clear analysis of the trigger, and a practice I have built since then to catch it earlier.",score:4},
      // DISTRACTOR: sounds self-aware and grown — scores 2 because it is hindsight without mechanism
      {text:"I can think of a time. I would handle it differently now, though I am not entirely sure how.",score:2},
      {text:"I can name the situation, what triggered me, and how I would regulate it earlier if it happened again.",score:3},
    ]},
  // R2 — Conflict Resolution
  { id:"R2a", cluster:"R", skill:"Conflict Resolution", type:"behavioural",
    q:"You are aware of unspoken tension between two team members that is starting to affect group performance. What do you do?",
    options:[
      {text:"Give it time — most tensions resolve without intervention if not made worse.",score:1},
      {text:"Have a deliberate sequence — understand each side privately, diagnose whether it is relational or task-based, then design a resolution conversation.",score:4},
      // DISTRACTOR: sounds balanced and procedural — scores 2 because it hopes not designs
      {text:"Mention it to each of them separately and see if that shifts things.",score:2},
      {text:"Speak to each person individually to understand what is happening, then create a structure to address it.",score:3},
    ]},
  { id:"R2b", cluster:"R", skill:"Conflict Resolution", type:"situational",
    q:"Two senior people are in open disagreement in a meeting and the conversation is breaking down. You are not the most senior person in the room. What do you do?",
    options:[
      {text:"Stay quiet — it is not my place to intervene when I am not the most senior.",score:1},
      // DISTRACTOR: sounds constructive and focused on outcomes — scores 2 because it avoids the conflict rather than resolving it
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
      // DISTRACTOR: sounds reflective and honest — scores 2 because it has no mechanism or learning
      {text:"I can think of one. Emotions were high and I was focused on being right rather than resolving it.",score:2},
    ]},
  // R3 — People Development
  { id:"R3a", cluster:"R", skill:"People Development", type:"behavioural",
    q:"Someone on your team makes a significant mistake on an important piece of work. What is your first move?",
    options:[
      {text:"Fix it — the outcome is the priority in the moment.",score:1},
      {text:"Use it as a deliberate development moment — diagnosis, structured reflection, a specific action, and a follow-up to confirm the learning has landed.",score:4},
      // DISTRACTOR: sounds coaching-oriented — scores 2 because it tells rather than develops
      {text:"Correct it and walk them through what they should have done differently.",score:2},
      {text:"Ask them to walk me through their thinking, then help them identify where it went wrong.",score:3},
    ]},
  { id:"R3b", cluster:"R", skill:"People Development", type:"situational",
    q:"You have a team member who is highly capable but consistently underdelivering. Their potential is obvious but something is blocking it. How do you approach this?",
    options:[
      {text:"Have a direct conversation about the performance gap and what needs to change.",score:1},
      // DISTRACTOR: sounds structured and developmental — scores 2 because structure without diagnosis misses the real blocker
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
      // DISTRACTOR: sounds generous and supportive — scores 2 because opportunity is not development
      {text:"I can name someone. I gave them opportunities and encouragement when they needed it.",score:2},
    ]},
  // R4 — Stakeholder Management
  { id:"R4a", cluster:"R", skill:"Stakeholder Management", type:"behavioural",
    q:"You are about to lead a significant initiative requiring support from people across multiple functions. Where do you start?",
    options:[
      {text:"Build a stakeholder influence map — interests, concerns, level of support needed — and create a deliberate alignment sequence before I need it.",score:4},
      {text:"Start the work and bring stakeholders in as they become relevant to their area.",score:1},
      // DISTRACTOR: sounds organised and communicative — scores 2 because informing is not aligning
      {text:"Brief all key stakeholders early so they are aware of what is coming.",score:2},
      {text:"Map who needs to be involved, understand what each person cares about, and sequence conversations before work begins.",score:3},
    ]},
  { id:"R4b", cluster:"R", skill:"Stakeholder Management", type:"situational",
    q:"You are mid-project when a senior stakeholder who was supportive at the start becomes resistant. What do you do?",
    options:[
      {text:"Continue and trust that progress will bring them back around.",score:1},
      {text:"Request a conversation and go in with genuine curiosity about what has changed for them.",score:4},
      // DISTRACTOR: sounds responsible and involves leadership — scores 2 because it avoids direct engagement
      {text:"Escalate to my manager to help manage the stakeholder relationship.",score:2},
      {text:"Request a direct conversation to understand what has shifted and address it.",score:3},
    ]},
  { id:"R4c", cluster:"R", skill:"Stakeholder Management", type:"reflective",
    q:"Tell me about a project that stalled or failed because of a relationship or political dynamic you did not manage well. What did you miss?",
    options:[
      // DISTRACTOR: sounds professionally confident — scores 1 because it avoids the question entirely
      {text:"I cannot think of a project that failed for this reason — I tend to manage relationships well.",score:1},
      {text:"I have a specific example with a precise analysis of what I misread, what they actually needed, and the mapping practice I now use to prevent it.",score:4},
      {text:"I have a clear example. I underestimated someone's concerns, did not address them early, and paid for it.",score:3},
      // DISTRACTOR: sounds accountable — scores 2 because it is general not analytical
      {text:"Something comes to mind. I did not communicate well enough with a key person and lost their support.",score:2},
    ]},
  // ═══════════════════════════════════════════════════════════════════════════
  // CLUSTER I — INTELLIGENCE
  // ═══════════════════════════════════════════════════════════════════════════
  // I1 — Critical Thinking
  { id:"I1a", cluster:"I", skill:"Critical Thinking", type:"behavioural",
    q:"A respected colleague presents data that strongly supports a decision the team is aligned on. You notice something in the analysis that does not add up. What do you actually do?",
    options:[
      {text:"Trust the analysis — they are experienced and the team is already aligned.",score:1},
      {text:"Raise it specifically — naming what I noticed, why it matters to the decision, and the question that forces it to be interrogated properly.",score:4},
      // DISTRACTOR: sounds diplomatic and collegial — scores 2 because it avoids the room where the decision is being made
      {text:"Mention it quietly to the colleague after the meeting rather than disrupting the group.",score:2},
      {text:"Raise it in the room — the decision should not move forward on flawed analysis regardless of who produced it.",score:3},
    ]},
  { id:"I1b", cluster:"I", skill:"Critical Thinking", type:"situational",
    q:"You are asked to validate a business case that has already been signed off by leadership. You find assumptions that seem optimistic. What do you do?",
    options:[
      {text:"Treat the validation as genuinely independent — stress-test every assumption and present a complete picture including downside scenarios.",score:4},
      {text:"Validate it as requested — raising issues on an approved case creates problems without solving them.",score:1},
      // DISTRACTOR: sounds responsible — scores 2 because informally flagging is not validation
      {text:"Flag the assumptions informally to the person who asked me to validate it.",score:2},
      {text:"Document the assumptions, stress-test them, and present the risk they create — even though the case is already approved.",score:3},
    ]},
  { id:"I1c", cluster:"I", skill:"Critical Thinking", type:"reflective",
    q:"When did you last genuinely change your mind about something important at work — not updating a detail, but shifting your position entirely? What caused it?",
    options:[
      {text:"I have a specific example — I can trace the disconfirming evidence I encountered, the resistance I initially had, and the reasoning that finally moved me.",score:4},
      {text:"I generally land in the right place from the start, so complete reversals are unusual for me.",score:1},
      // DISTRACTOR: sounds open-minded and confident — scores 2 because it describes compliance not reasoning
      {text:"I can think of something. Someone made a strong argument and I updated my position.",score:2},
      {text:"I have a clear example. I encountered evidence that contradicted my position and worked through it seriously before updating.",score:3},
    ]},
  // I2 — Strategic Thinking
  { id:"I2a", cluster:"I", skill:"Strategic Thinking", type:"behavioural",
    q:"Your manager gives you a task that is clearly important. Before starting, what goes through your mind?",
    options:[
      {text:"How to do it well and deliver it on time.",score:1},
      {text:"How this task connects to longer-term direction, what it enables or constrains, and whether this is the right task to be doing at all.",score:4},
      // DISTRACTOR: sounds strategically aware — scores 2 because it only looks one level up
      {text:"How this connects to the team's current priorities and where it sits in the queue.",score:2},
      {text:"How it fits the broader goal, who will use the output, and what success looks like beyond task completion.",score:3},
    ]},
  { id:"I2b", cluster:"I", skill:"Strategic Thinking", type:"situational",
    q:"Your organisation is about to launch a product. You are not on the leadership team but you can see a market dynamic that makes the timing risky. What do you do?",
    options:[
      {text:"Trust that leadership has thought through the timing — they have more context than I do.",score:1},
      {text:"Prepare a structured analysis — what I am seeing, why it matters, the alternatives, and my recommendation — and get it to the decision-maker.",score:4},
      // DISTRACTOR: sounds responsible — scores 2 because it delegates rather than leads the thinking
      {text:"Flag my concern to my manager and leave it with them to handle.",score:2},
      {text:"Build a clear, evidence-based view of the risk and find the right channel to get it into the decision.",score:3},
    ]},
  { id:"I2c", cluster:"I", skill:"Strategic Thinking", type:"reflective",
    q:"Describe a decision you made that looked right in the short term but created a problem further down the line. What did you not see?",
    options:[
      {text:"Most of my decisions hold up well over time — I struggle to think of a clear example.",score:1},
      {text:"I have a specific example — the second-order consequence I missed, why I missed it, and the thinking practice I now use to surface those consequences before deciding.",score:4},
      // DISTRACTOR: sounds reflective — scores 2 because it identifies the error without analysing it
      {text:"Something comes to mind. I focused on the immediate problem and did not think far enough ahead.",score:2},
      {text:"I have a clear example. I optimised for the near term and did not trace the downstream consequences.",score:3},
    ]},
  // I3 — Business Acumen
  { id:"I3a", cluster:"I", skill:"Business Acumen", type:"behavioural",
    q:"If someone asked you to explain how your current or most recent organisation actually makes money — the mechanics of it — how confident are you?",
    options:[
      {text:"I can explain unit economics, key metrics, where value is created and destroyed, and how my role connects to commercial outcomes.",score:4},
      {text:"I know what we do and roughly what we charge — beyond that I am less certain.",score:1},
      // DISTRACTOR: sounds commercially aware — scores 2 because knowing the model is not understanding it
      {text:"I understand the core revenue model and the main things we spend money on.",score:2},
      {text:"I can walk through the revenue model, the key cost drivers, and where the margin is actually made.",score:3},
    ]},
  { id:"I3b", cluster:"I", skill:"Business Acumen", type:"situational",
    q:"You are proposing a new initiative that needs investment. A finance leader asks you to walk through the commercial case. How prepared are you?",
    options:[
      {text:"I can present a fully worked commercial case — cost, return, assumption ranges, downside scenarios, payback period, and the metrics I would use to track it.",score:4},
      {text:"I can explain what the initiative does and why it matters to the organisation.",score:1},
      // DISTRACTOR: sounds commercially literate — scores 2 because it omits the assumptions and range
      {text:"I can explain the cost and the expected benefit at a high level.",score:2},
      {text:"I can present the cost, projected return, key assumptions, and the timeline to value.",score:3},
    ]},
  { id:"I3c", cluster:"I", skill:"Business Acumen", type:"reflective",
    q:"Describe a decision you made or contributed to that had a meaningful commercial impact. How did you think about it?",
    options:[
      {text:"I have a specific example — I built the commercial case, modelled the options, made a recommendation based on financial reasoning, and can trace what the outcome was against what I projected.",score:4},
      {text:"Most of my decisions are not directly commercial — my focus is functional rather than financial.",score:1},
      // DISTRACTOR: sounds commercially engaged — scores 2 because it is accidental not analytical
      {text:"I can think of something. I made a call that saved costs or generated value, though I did not formally model it.",score:2},
      {text:"I have a clear example where I thought through the commercial implications deliberately before deciding.",score:3},
    ]},
  // I4 — Managing Ambiguity
  { id:"I4a", cluster:"I", skill:"Managing Ambiguity", type:"behavioural",
    q:"You are asked to lead something where the goal is clear but the method is entirely undefined. How do you respond?",
    options:[
      {text:"Frame the ambiguity explicitly, make a directional move, communicate the uncertainty to stakeholders, and build in review points.",score:4},
      {text:"Ask for more direction before starting — I want to move in the right direction from the beginning.",score:1},
      // DISTRACTOR: sounds pragmatic and iterative — scores 2 because checking in without framing is not managing ambiguity
      {text:"Make a start and check in regularly to make sure I am not too far off course.",score:2},
      {text:"Define what I know, identify the smallest reversible step to generate new information, and move from there.",score:3},
    ]},
  { id:"I4b", cluster:"I", skill:"Managing Ambiguity", type:"situational",
    q:"Your organisation is going through significant change and nobody can tell you clearly how your role will be affected. Work still needs to get done. How do you operate?",
    options:[
      {text:"Treat the uncertainty as the operating context — define short-term priorities, communicate them upward, and stay curious rather than anxious about how things are unfolding.",score:4},
      {text:"I find it genuinely hard to commit fully until I know where things are going to land.",score:1},
      // DISTRACTOR: sounds resilient and professional — scores 2 because suppressing uncertainty is not managing it
      {text:"Focus on what I can control and try not to let the uncertainty affect my output.",score:2},
      {text:"Name the uncertainty to my manager, agree on what to prioritise in the short term, and operate with full commitment within that frame.",score:3},
    ]},
  { id:"I4c", cluster:"I", skill:"Managing Ambiguity", type:"reflective",
    q:"Tell me about a time you had to make a consequential decision with significantly less information than you wanted. What did you do?",
    options:[
      {text:"I have a specific example — what I knew, what I treated as an assumption, how I reduced reversibility risk, what happened, and what it taught me about the right threshold for action under uncertainty.",score:4},
      {text:"I generally try to gather enough information before making decisions with significant consequences.",score:1},
      // DISTRACTOR: sounds honest — scores 2 because luck is not a decision framework
      {text:"I can think of an example. I made a call with incomplete information — it either worked out or it did not.",score:2},
      {text:"I have a clear example where I defined the decision threshold — enough information to act responsibly — made the call, and owned the outcome.",score:3},
    ]},
  // I5 — AI Fluency (Future-Ready)
  { id:"I5a", cluster:"I", skill:"AI Fluency", type:"behavioural", futureReady:true,
    q:"How are you currently using AI in your professional work — not what you have tried once, but what is genuinely part of how you work?",
    options:[
      {text:"I have explored AI tools but they are not yet a consistent part of my regular workflow.",score:1},
      {text:"I have deliberately redesigned how I work around AI — I know which tasks I delegate to it, which I keep human, and I refine how I work with it regularly.",score:4},
      // DISTRACTOR: sounds integrated — scores 2 because using AI without evaluating its outputs is not AI fluency
      {text:"I use AI for specific tasks like drafting and summarising, though not in a systematic way.",score:2},
      {text:"I have integrated AI into several parts of my workflow and I evaluate its outputs critically before using them.",score:3},
    ]},
  { id:"I5b", cluster:"I", skill:"AI Fluency", type:"situational", futureReady:true,
    q:"An AI tool produces a confident-sounding output that is central to a piece of work you are delivering. You do not have time to fully verify it. What do you do?",
    options:[
      {text:"Use it — AI confidence is generally a reasonable signal of accuracy.",score:1},
      {text:"Identify exactly which parts are load-bearing, verify those specifically, and be explicit with the recipient about what was verified and what was not.",score:4},
      // DISTRACTOR: sounds responsible — scores 2 because disclosure without verification does not protect quality
      {text:"Add a note that the output was AI-generated so the recipient can evaluate accordingly.",score:2},
      {text:"Run a targeted spot-check on the specific claims most critical to the work before using it.",score:3},
    ]},
  { id:"I5c", cluster:"I", skill:"AI Fluency", type:"reflective", futureReady:true,
    q:"What is your honest assessment of what AI does better than you in your professional work right now — and what remains genuinely yours?",
    options:[
      {text:"I have mapped my work explicitly against AI capability — I know precisely which tasks AI does better, which require human judgment, and I have restructured my time accordingly.",score:4},
      {text:"I am not certain AI is yet better than me at the things that matter most in my work.",score:1},
      // DISTRACTOR: sounds balanced and grounded — scores 2 because it identifies the boundary without acting on it
      {text:"AI is better at some routine tasks but the work that really matters still requires human judgment.",score:2},
      {text:"I have a clear picture of where AI outperforms me on specific tasks and where human judgment is essential — and I have started reorganising my work around that boundary.",score:3},
    ]},
  // ═══════════════════════════════════════════════════════════════════════════
  // CLUSTER M — MASTERY
  // ═══════════════════════════════════════════════════════════════════════════
  // M1 — Execution & Accountability
  { id:"M1a", cluster:"M", skill:"Execution & Accountability", type:"behavioural",
    q:"You realise partway through a project that you are not going to meet a commitment you made. What do you do?",
    options:[
      {text:"Flag it immediately with a revised timeline, an impact assessment, a recovery plan, and an honest account of what I missed in the original commitment.",score:4},
      {text:"Deliver what I can and explain the situation when I submit.",score:1},
      // DISTRACTOR: sounds accountable — scores 2 because flagging certainty not risk is too late
      {text:"Let the relevant people know as soon as I am certain I will miss it.",score:2},
      {text:"Flag it the moment I see the risk — before certainty — and arrive with a revised plan and an impact assessment.",score:3},
    ]},
  { id:"M1b", cluster:"M", skill:"Execution & Accountability", type:"situational",
    q:"A colleague who was supposed to deliver a key input has not delivered and is now unreachable. Your deadline is tomorrow. What do you do?",
    options:[
      {text:"Miss the deadline and make clear that the dependency was not delivered.",score:1},
      {text:"Make every reasonable attempt to resolve the dependency, deliver the best version possible, document what was missing, and escalate the dependency separately — never using it as cover for my own accountability.",score:4},
      // DISTRACTOR: sounds practical and professional — scores 2 because it is passive and incomplete
      {text:"Do what I can without the input and flag the gap clearly in what I deliver.",score:2},
      {text:"Find a way to deliver with what I have, escalate the dependency failure clearly, and keep my accountability separate from theirs.",score:3},
    ]},
  { id:"M1c", cluster:"M", skill:"Execution & Accountability", type:"reflective",
    q:"Tell me about a commitment you made that you did not keep. What happened and what did you take from it?",
    options:[
      {text:"I have a specific example with a clear analysis of where my commitment-making process failed and the specific practices I have built since then.",score:4},
      {text:"I am generally reliable — I cannot think of a significant missed commitment.",score:1},
      // DISTRACTOR: sounds self-aware — scores 2 because it attributes the failure externally
      {text:"Something comes to mind. Circumstances changed and I was not able to deliver what I had committed to.",score:2},
      {text:"I have a clear example. I overcommitted and underdelivered — and now I think much more carefully about what I agree to.",score:3},
    ]},
  // M2 — Resilience & Self-Leadership
  { id:"M2a", cluster:"M", skill:"Resilience & Self-Leadership", type:"behavioural",
    q:"After a significant professional setback — a failed project, a difficult performance conversation, a lost opportunity — how do you actually recover?",
    options:[
      {text:"I take time and eventually return to normal, though it can take longer than I would like.",score:1},
      {text:"I have a structured recovery practice — specific steps to process the emotion, extract the learning, and rebuild momentum — and my recovery time has shortened because of it.",score:4},
      // DISTRACTOR: sounds contained and professional — scores 2 because suppressing is not recovering
      {text:"I process it privately and try not to let it affect my work for too long.",score:2},
      {text:"I have a deliberate process — feel the setback, extract the lesson, make a conscious decision to move forward.",score:3},
    ]},
  { id:"M2b", cluster:"M", skill:"Resilience & Self-Leadership", type:"situational",
    q:"You are in a sustained period of high pressure — competing demands, insufficient resources, no clear end in sight. How do you manage yourself?",
    options:[
      {text:"I push through — it is temporary and the work needs to get done.",score:1},
      {text:"I have a clear framework for sustained pressure — how I manage cognitive, emotional, and physical energy, what signals I watch for, and when I escalate.",score:4},
      // DISTRACTOR: sounds mature and pragmatic — scores 2 because time management under pressure is not self-leadership
      {text:"I try to manage my time better and accept that some things will have to slip.",score:2},
      {text:"I actively manage my energy — not just my time — and make deliberate choices about what to protect and what to let go.",score:3},
    ]},
  { id:"M2c", cluster:"M", skill:"Resilience & Self-Leadership", type:"reflective",
    q:"Have you ever come close to burnout or noticed your performance dropping significantly under sustained pressure? What did it teach you?",
    options:[
      {text:"I have a specific experience — what signals I missed, where my self-management failed, and the specific practices I have built since then to catch it earlier.",score:4},
      {text:"I handle pressure well — I have not experienced anything I would describe as close to burnout.",score:1},
      // DISTRACTOR: sounds resilient — scores 2 because surviving is not learning
      {text:"I have had difficult periods. I got through them, though I am not sure I handled them as well as I could have.",score:2},
      {text:"I have a clear experience. I now understand what my warning signs are and what I need to do when I see them.",score:3},
    ]},
  // M3 — Adaptability
  { id:"M3a", cluster:"M", skill:"Adaptability", type:"behavioural",
    q:"Your organisation announces a significant change that affects how you work — new structure, new process, new direction. What is your honest first reaction?",
    options:[
      {text:"Frustration — I had a system that worked and rebuilding it feels like wasted effort.",score:1},
      {text:"Opportunity — I move quickly to understand the new landscape and where I can add the most value within it.",score:4},
      // DISTRACTOR: sounds rational — scores 2 because waiting is not adapting
      {text:"Uncertainty — I tend to wait and see how things settle before committing to the new way.",score:2},
      {text:"Curiosity — I start thinking about how to position myself well within the new context.",score:3},
    ]},
  { id:"M3b", cluster:"M", skill:"Adaptability", type:"situational",
    q:"You are asked to take on a piece of work that is significantly outside your expertise. You have limited time to get up to speed. How do you approach it?",
    options:[
      {text:"Flag that this is outside my area and recommend someone who is better suited.",score:1},
      {text:"Take it on, map the specific knowledge gaps that matter most, fill them deliberately, and treat the unfamiliarity as a potential advantage.",score:4},
      // DISTRACTOR: sounds willing and honest — scores 2 because learning as you go without mapping gaps is not adaptability
      {text:"Take it on and learn as I go, being transparent when I reach the edges of my knowledge.",score:2},
      {text:"Take it on, identify the specific gaps that matter most, fill them deliberately, and be transparent about what I am learning as I go.",score:3},
    ]},
  { id:"M3c", cluster:"M", skill:"Adaptability", type:"reflective",
    q:"What is something you used to believe or do professionally that you have since completely changed? What caused the shift?",
    options:[
      {text:"My core professional approach has been consistent — I have refined it but not fundamentally reversed anything.",score:1},
      {text:"I have a specific example of a fundamental shift — what I believed, what challenged it, how I unlearned it, what replaced it, and why this kind of adaptability is one of the most important things I have built.",score:4},
      // DISTRACTOR: sounds honest and practical — scores 2 because updating without reasoning is not adaptability
      {text:"Something comes to mind. I changed my approach when I could see it was not producing the results I wanted.",score:2},
      {text:"I have a clear example of a significant belief I abandoned — I encountered clear evidence it was wrong and updated deliberately.",score:3},
    ]},
  // ═══════════════════════════════════════════════════════════════════════════
  // CLUSTER E — ENTERPRISE
  // ═══════════════════════════════════════════════════════════════════════════
  // E1 — Commercial Creativity
  { id:"E1a", cluster:"E", skill:"Commercial Creativity", type:"behavioural",
    q:"You are facing a significant constraint — budget cut, resource reduction, policy restriction — that threatens something you are trying to deliver. How do you respond?",
    options:[
      {text:"Deliver what is possible within the constraint and communicate clearly about what is not.",score:1},
      {text:"Treat the constraint as potentially generative — some of the best solutions come from working around limitations you never would have encountered otherwise.",score:4},
      // DISTRACTOR: sounds assertive and commercially minded — scores 2 because escalation is not creativity
      {text:"Push back and make the case for more resource or greater flexibility.",score:2},
      {text:"Treat the constraint as a design problem — look for a different way to achieve the same outcome.",score:3},
    ]},
  { id:"E1b", cluster:"E", skill:"Commercial Creativity", type:"situational",
    q:"You spot an opportunity your organisation has not seen — a new revenue line, a partnership, an untapped market. You are not in the role that would normally pursue it. What do you do?",
    options:[
      {text:"Note it and wait for the right person or moment to raise it.",score:1},
      {text:"Develop it enough to be taken seriously — what it is, why it is real, what it would take, and what it costs to ignore — and navigate it to the right decision-maker.",score:4},
      // DISTRACTOR: sounds responsible — scores 2 because delegating up is not commercial creativity
      {text:"Mention it to my manager and let them decide whether it is worth pursuing.",score:2},
      {text:"Build a basic case for the opportunity and find the right channel to put it in front of someone who can act on it.",score:3},
    ]},
  { id:"E1c", cluster:"E", skill:"Commercial Creativity", type:"reflective",
    q:"Tell me about an idea you had that created real value — commercial, operational, or strategic. Where did it come from and how did you turn it into something real?",
    options:[
      {text:"I have a specific example — where the insight came from, how I developed it into a proposal, who I had to persuade, how I navigated the resistance, and what the outcome actually was.",score:4},
      {text:"I tend to contribute to other people's ideas more than originate my own.",score:1},
      // DISTRACTOR: sounds creative and outcome-focused — scores 2 because fixing problems is not commercial creativity
      {text:"I can think of an idea that worked. It came from noticing a problem and suggesting a practical fix.",score:2},
      {text:"I have a clear example of an idea I originated, developed into a real proposal, and drove to implementation with measurable impact.",score:3},
    ]},
  // E2 — Influence Without Authority
  { id:"E2a", cluster:"E", skill:"Influence Without Authority", type:"behavioural",
    q:"You need cooperation from someone who does not report to you — and they are currently not prioritising what you need. How do you approach it?",
    options:[
      {text:"Escalate to someone who has authority over them.",score:1},
      {text:"Invest in the relationship before I need something, understand their pressures, frame my request in terms of their interests, and make it easy for them to say yes.",score:4},
      // DISTRACTOR: sounds clear and professional — scores 2 because explaining importance is not influence
      {text:"Make the request clearly and explain why it matters to the organisation.",score:2},
      {text:"Take time to understand what they are prioritising and find a way to connect my need to something they already care about.",score:3},
    ]},
  { id:"E2b", cluster:"E", skill:"Influence Without Authority", type:"situational",
    q:"You believe strongly in an idea that needs support from three people who are currently indifferent or mildly resistant. How do you build the coalition?",
    options:[
      {text:"Present the idea to all three together and make the strongest possible case.",score:1},
      {text:"Map each person's interests, sequence conversations to build momentum, address each objection with something that genuinely resolves it, and bring them together only when alignment is already close.",score:4},
      // DISTRACTOR: sounds strategic — scores 2 because social proof is not tailored influence
      {text:"Start with the most sympathetic person and use their support to help move the others.",score:2},
      {text:"Meet each person separately first, understand their specific concerns, and tailor each conversation before bringing them together.",score:3},
    ]},
  { id:"E2c", cluster:"E", skill:"Influence Without Authority", type:"reflective",
    q:"Tell me about a time you moved something forward — a decision, a project, an outcome — that you had no formal authority to push. What did you actually do?",
    options:[
      {text:"I have a specific example — the stakeholder map I built, how I sequenced conversations, what I offered each person, and how I maintained momentum through the resistance.",score:4},
      {text:"I generally work through the proper channels rather than trying to influence things outside my remit.",score:1},
      // DISTRACTOR: sounds persistent — scores 2 because persistence without strategy is not influence
      {text:"I can think of a time. I made the case clearly and kept making it until people came around.",score:2},
      {text:"I have a clear example. I mapped who mattered, had deliberate conversations, and built enough support to move it.",score:3},
    ]},
  // E3 — Human-AI Collaboration (Future-Ready)
  { id:"E3a", cluster:"E", skill:"Human-AI Collaboration", type:"behavioural", futureReady:true,
    q:"How have you actually changed how you work because of AI — not in theory, but in practice?",
    options:[
      {text:"I have not made significant changes yet — I am still working out where AI genuinely fits in my work.",score:1},
      {text:"I have comprehensively redesigned how I work around the human-AI boundary — I can name precisely which tasks I have moved to AI, what I have kept human, and how that has changed my output.",score:4},
      // DISTRACTOR: sounds engaged — scores 2 because using AI at the edges is not redesigning how you work
      {text:"I have added AI to tasks at the edges of my workflow but my core approach has not changed significantly.",score:2},
      {text:"I have deliberately redesigned parts of my workflow around AI — deciding what to delegate and what to keep — and I can see a real difference in what I produce.",score:3},
    ]},
  { id:"E3b", cluster:"E", skill:"Human-AI Collaboration", type:"situational", futureReady:true,
    q:"Your organisation is introducing AI tools across your function. Some colleagues are resisting, others are adopting everything uncritically. What is your position?",
    options:[
      {text:"Wait until the adoption settles before deciding how to change how I work.",score:1},
      {text:"Lead the thinking in my function — map decisions against AI capability, define what stays human and why, build genuine fluency in the team, and establish governance that protects quality.",score:4},
      // DISTRACTOR: sounds balanced — scores 2 because selective adoption without a framework is not collaboration
      {text:"Adopt the tools that seem useful and avoid the ones that feel like they are replacing work that matters.",score:2},
      {text:"Think through each tool systematically — what it does well, what risks it creates, what it should and should not be used for — and develop a clear position.",score:3},
    ]},
  { id:"E3c", cluster:"E", skill:"Human-AI Collaboration", type:"reflective", futureReady:true,
    q:"What is genuinely irreplaceable about what you bring to your work — the thing AI cannot do, even in principle?",
    options:[
      {text:"Honestly, I am not certain there are things AI cannot eventually do that I currently do.",score:1},
      {text:"I have a precise and reasoned answer — what I bring that AI cannot replicate structurally, why it matters commercially, and how I am investing in deepening exactly those capabilities.",score:4},
      // DISTRACTOR: sounds thoughtful — scores 2 because naming categories is not mapping your specific value
      {text:"Relationships and judgment are areas where I think human presence will remain essential.",score:2},
      {text:"I have a clear view of where my specific value lies that AI cannot replicate — particular types of judgment, contextual knowledge, or relational work that requires genuine human presence.",score:3},
    ]},
  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDITY ANCHORS — embedded at fixed positions in buildQuestionSequence()
  // These have no high-scoring option — selecting the most confident-sounding
  // answer always produces a lower score. Gaming detection triggers at 3+ flags.
  // ═══════════════════════════════════════════════════════════════════════════
  { id:"VA1", cluster:"VA", skill:"Validity", type:"anchor", validAnchor:true,
    q:"When you receive feedback from someone you genuinely respect, your first response is always to implement it.",
    options:[
      // BAIT: sounds confident in relationships — score 1
      {text:"Yes — if someone I respect has taken the time to give feedback, acting on it is the right response.",score:1},
      // BAIT: sounds diplomatically humble — score 2
      {text:"Almost always — I occasionally push back but my default is to implement.",score:2},
      // CORRECT: sounds like it might seem contrarian but reflects genuine critical thinking — score 4
      {text:"Not always — good feedback still needs to fit the context, even from people I respect.",score:4},
      // BAIT: sounds independent-minded — score 2
      {text:"Rarely — feedback is one input and I weigh it carefully against everything else I know.",score:2},
    ]},
  { id:"VA2", cluster:"VA", skill:"Validity", type:"anchor", validAnchor:true,
    q:"You always know exactly what is driving your emotions in a professional setting.",
    options:[
      // BAIT: sounds self-aware and developed — score 1
      {text:"Yes — self-awareness is something I have worked hard to build and I have strong insight into my emotional drivers.",score:1},
      // BAIT: sounds honestly qualified — score 2
      {text:"Usually — I sometimes need time to understand what is behind a strong reaction.",score:2},
      // CORRECT: sounds like it might undermine the self-awareness claim but actually reflects psychological sophistication — score 4
      {text:"Not always — even with strong self-awareness, emotions in complex situations are not always immediately legible.",score:4},
      // BAIT: sounds humbly honest — score 1
      {text:"Rarely — I am not naturally introspective about my emotional drivers.",score:1},
    ]},
  { id:"VA3", cluster:"VA", skill:"Validity", type:"anchor", validAnchor:true,
    q:"When you prepare thoroughly for a negotiation, you reliably get the outcome you are aiming for.",
    options:[
      // BAIT: sounds like a champion — score 1
      {text:"Yes — thorough preparation is the consistent differentiator between winning and losing.",score:1},
      // BAIT: sounds grounded and success-oriented — score 2
      {text:"Usually — preparation significantly increases my success rate.",score:2},
      // CORRECT: sounds modest but reflects genuine sophistication about negotiation dynamics — score 4
      {text:"Often, but not always — even excellent preparation cannot overcome every structural constraint or the other party's position.",score:4},
      // BAIT: sounds nuanced — score 3, but this is correct
      {text:"Not always — preparation is essential but the outcome also depends on variables outside my control.",score:3},
    ]},
  { id:"VA4", cluster:"VA", skill:"Validity", type:"anchor", validAnchor:true,
    q:"You have never made a significant people decision you later regretted.",
    options:[
      // BAIT: sounds like a strong leader — score 1
      {text:"Correct — I take people decisions seriously and my track record is strong.",score:1},
      // BAIT: sounds appropriately humble — score 2
      {text:"Almost — there are minor things I would do differently but nothing significant.",score:2},
      // CORRECT: sounds like an admission but reflects psychological honesty and learning — score 4
      {text:"No — people decisions are genuinely complex and some of my most important learning has come from the ones I got wrong.",score:4},
      // BAIT: sounds self-aware — score 3
      {text:"No — I have made people decisions I later regretted, and I have thought carefully about why.",score:3},
    ]},
];
// ── FIX 1: OPTION SHUFFLE UTILITY ─────────────────────────────────────────
// Shuffles options for display while preserving score values.
// Called per question render — seed based on question ID for consistency
// within a session but variation across test-takers.
function seededShuffle(arr, seed) {
  const a = arr.map((item, i) => ({ item, sort: Math.sin(seed * (i + 1)) * 10000 % 1 }));
  a.sort((x, y) => x.sort - y.sort);
  return a.map(({ item }) => item);
}
// ── QUESTION SEQUENCE — anchors at positions 13, 27, 41, 55 ───────────────
function buildQuestionSequence() {
  const scored  = ALL_QUESTIONS.filter(q => q.cluster !== "VA");
  const anchors = ALL_QUESTIONS.filter(q => q.cluster === "VA");
  const seq = [...scored];
  const positions = [13, 27, 41, 55];
  anchors.forEach((a, i) => { seq.splice(positions[i], 0, a); });
  return seq;
}
const QUESTIONS = buildQuestionSequence();
const TOTAL = QUESTIONS.length;
// ── SKILL → CLUSTER MAP ────────────────────────────────────────────────────
const SKILL_CLUSTER = {
  "Communication":                  "P",
  "Negotiation":                    "P",
  "Personal Brand & Executive Presence": "P",
  "Emotional Intelligence":         "R",
  "Conflict Resolution":            "R",
  "People Development":             "R",
  "Stakeholder Management":         "R",
  "Critical Thinking":              "I",
  "Strategic Thinking":             "I",
  "Business Acumen":                "I",
  "Managing Ambiguity":             "I",
  "AI Fluency":                     "I",
  "Execution & Accountability":     "M",
  "Resilience & Self-Leadership":   "M",
  "Adaptability":                   "M",
  "Commercial Creativity":          "E",
  "Influence Without Authority":    "E",
  "Human-AI Collaboration":         "E",
};
// Max raw per skill = 3 questions × 4 points = 12
const SKILL_MAX_RAW = 12;
// ── SCORING ENGINE — ALL FIXES APPLIED ────────────────────────────────────
function computeResults(answers, timings, shuffleMap) {
  const clusterRaw       = { P:0, R:0, I:0, M:0, E:0 };
  const clusterAllScores = { P:[], R:[], I:[], M:[], E:[] };
  const skillRaw         = {}; // skill name → raw sum
  // 1. Cluster + skill raw scores
  QUESTIONS.forEach((q, idx) => {
    if (q.cluster === "VA") return;
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return;
    const originalOption = shuffleMap[idx]
      ? shuffleMap[idx][displayedIdx]
      : q.options[displayedIdx];
    const score = originalOption?.score || 0;
    clusterRaw[q.cluster] += score;
    clusterAllScores[q.cluster].push(score);
    // Accumulate per-skill
    if (q.skill && q.skill !== "Validity") {
      skillRaw[q.skill] = (skillRaw[q.skill] || 0) + score;
    }
  });
  // Normalise skill scores to 0–100
  const skillScores = {};
  Object.entries(skillRaw).forEach(([skill, raw]) => {
    skillScores[skill] = Math.round((raw / SKILL_MAX_RAW) * 100);
  });
  // 2. Normalise to 0–100
  const clusterScores = {};
  CLUSTERS.forEach(c => {
    clusterScores[c.id] = Math.round((clusterRaw[c.id] / c.maxRaw) * 100);
  });
  // 3. Weighted VALU Index
  let valuRaw = 0;
  CLUSTERS.forEach(c => { valuRaw += clusterScores[c.id] * c.weight; });
  let valuIndex = Math.round(valuRaw);
  // 4. FIX: Consistency check — SD > 1.2 within any cluster → 15% penalty + flag
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
  // Recompute after consistency penalty
  let valuRaw2 = 0;
  CLUSTERS.forEach(c => { valuRaw2 += clusterScores[c.id] * c.weight; });
  valuIndex = Math.round(valuRaw2);
  // 5. Validity anchor check — 3+ highest-position picks on anchors → 20% penalty
  let anchorFlags = 0;
  QUESTIONS.forEach((q, idx) => {
    if (!q.validAnchor) return;
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return;
    // Check if chosen option has score 1 (the "bait" options that sound strongest)
    const originalOption = shuffleMap[idx]
      ? shuffleMap[idx][displayedIdx]
      : q.options[displayedIdx];
    if (originalOption?.score === 1) anchorFlags++;
  });
  const gamingDetected = anchorFlags >= 3;
  if (gamingDetected) valuIndex = Math.round(valuIndex * 0.80);
  // 6. Speed check — under 12 min total OR 3+ questions under 8 seconds → flag
  const answeredTimings = timings.filter(t => t > 0);
  const totalTime  = answeredTimings.reduce((a,b) => a+b, 0);
  const fastAnswers = timings.filter(t => t > 0 && t < 8000).length;
  const speedFlag  = totalTime < 720000 || fastAnswers >= 3;
  // 7. FIX 4: Uniformity check — global SD < 0.5 on a high score is suspicious
  const allScores = [];
  QUESTIONS.forEach((q, idx) => {
    if (q.cluster === "VA") return;
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return;
    const originalOption = shuffleMap[idx]
      ? shuffleMap[idx][displayedIdx]
      : q.options[displayedIdx];
    if (originalOption?.score) allScores.push(originalOption.score);
  });
  const globalMean = allScores.reduce((a,b) => a+b,0) / allScores.length;
  const globalSD   = Math.sqrt(allScores.reduce((a,b) => a+(b-globalMean)**2,0) / allScores.length);
  // Flag if high score AND suspiciously low variance — genuine high performers vary
  const uniformityFlag = valuIndex >= 65 && globalSD < 0.5;
  // 8. Designation
  const desig = DESIGNATIONS.find(d => valuIndex >= d.min) || DESIGNATIONS[DESIGNATIONS.length-1];
  // 9. Future-Ready score
  const frQuestions = QUESTIONS.filter(q => q.futureReady);
  const frRaw = frQuestions.reduce((sum, q) => {
    const idx = QUESTIONS.indexOf(q);
    const displayedIdx = answers[idx];
    if (displayedIdx === undefined) return sum;
    const originalOption = shuffleMap[idx]
      ? shuffleMap[idx][displayedIdx]
      : q.options[displayedIdx];
    return sum + (originalOption?.score || 0);
  }, 0);
  const futureReadyScore = Math.round((frRaw / (frQuestions.length * 4)) * 100);
  // 10. Strongest / weakest
  const sorted = [...CLUSTERS].sort((a,b) => clusterScores[b.id] - clusterScores[a.id]);
  const anyFlag = Object.keys(consistencyFlags).length > 0 || gamingDetected || speedFlag || uniformityFlag;
  return {
    valuIndex, clusterScores, skillScores, desig, futureReadyScore,
    strongest: sorted[0], weakest: sorted[sorted.length-1],
    consistencyFlags, gamingDetected, anchorFlags, speedFlag, uniformityFlag,
    listed: valuIndex >= 35 && !uniformityFlag,
    pathway: valuIndex >= 80 ? "PCP Certification"
           : valuIndex >= 65 ? "PRIME Programme"
           : valuIndex >= 50 ? "PRIME Cluster"
           : "PRIME Sprint",
    anyFlag,
    globalSD: Math.round(globalSD * 100) / 100,
  };
}
// ── RADAR CHART ────────────────────────────────────────────────────────────
function Radar({ scores, size = 200 }) {
  const cx = size/2, cy = size/2, r = size * 0.37, n = 5;
  const angle = i => (Math.PI*2*i/n) - Math.PI/2;
  const pt = (i, frac) => ({ x: cx + r*frac*Math.cos(angle(i)), y: cy + r*frac*Math.sin(angle(i)) });
  const gridPoly = frac => CLUSTERS.map((_,i) => { const p=pt(i,frac); return `${p.x},${p.y}`; }).join(" ");
  const dataPts  = CLUSTERS.map((c,i) => pt(i, (scores[c.id]||0)/100));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible"}}>
      {[0.25,0.5,0.75,1].map(f =>
        <polygon key={f} points={gridPoly(f)} fill="none"
          stroke={f===1?"rgba(201,168,76,0.4)":"rgba(201,168,76,0.15)"}
          strokeWidth={f===1?0.8:0.5}/>)}
      {CLUSTERS.map((_,i) => { const p=pt(i,1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(201,168,76,0.2)" strokeWidth={0.5}/>; })}
      <polygon points={dataPts.map(p=>`${p.x},${p.y}`).join(" ")}
        fill="rgba(201,168,76,0.15)" stroke={GOLD} strokeWidth={1.5}
        style={{transition:"all 0.5s"}}/>
      {dataPts.map((p,i) =>
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={CLUSTERS[i].color}
          style={{transition:"all 0.5s"}}/>)}
      {CLUSTERS.map((c,i) => {
        const lp=pt(i,1.22);
        return <text key={i} x={lp.x} y={lp.y} textAnchor="middle"
          dominantBaseline="central"
          style={{fontSize:10,fontWeight:600,fill:c.color}}>{c.id}</text>;
      })}
    </svg>
  );
}
// ── AI REPORT PROMPT BUILDER — v2.0 ───────────────────────────────────────
// Complete rebuild. Plain language. Skill-specific. Action-oriented.
// Names the exact skill gaps. Points to the exact programme. No fluff.
const PROMPT_VERSION = "v2.0";
// Programme definitions — used in prompt and in skill routing
const PRIME_PROGRAMMES = {
  sprint: {
    name: "PRIME Sprint",
    duration: "1 day",
    price: "₦150,000–₦300,000",
    best_for: "One urgent cluster. Fast score movement. Entry point to the platform.",
  },
  cluster: {
    name: "PRIME Cluster Programme",
    duration: "6 weeks",
    price: "₦500,000–₦1,200,000",
    best_for: "Deep work on one cluster. Corporate L&D investment. Measurable VALU delta.",
  },
  pcp: {
    name: "PRIME Certified Professional (PCP)",
    duration: "6 months",
    price: "₦200,000–₦400,000",
    best_for: "Full PRIME certification. All five clusters. Facilitator pathway opens.",
  },
  executive: {
    name: "Executive Immersion",
    duration: "3 days residential",
    price: "₦800,000–₦2,000,000",
    best_for: "C-suite and senior leaders. All five clusters. Time-compressed.",
  },
};
// Skill-specific development actions — what to do THIS WEEK
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
// Skill-to-programme routing — which programme addresses which skill most directly
const SKILL_PROGRAMME_MAP = {
  "Communication":                    "cluster", // P cluster
  "Negotiation":                      "cluster",
  "Personal Brand & Executive Presence": "cluster",
  "Emotional Intelligence":           "cluster", // R cluster
  "Conflict Resolution":              "cluster",
  "People Development":               "cluster",
  "Stakeholder Management":           "cluster",
  "Critical Thinking":                "cluster", // I cluster
  "Strategic Thinking":               "cluster",
  "Business Acumen":                  "cluster",
  "Managing Ambiguity":               "cluster",
  "AI Fluency":                       "sprint",  // future-ready — Sprint first
  "Execution & Accountability":       "cluster", // M cluster
  "Resilience & Self-Leadership":     "cluster",
  "Adaptability":                     "cluster",
  "Commercial Creativity":            "cluster", // E cluster
  "Influence Without Authority":      "cluster",
  "Human-AI Collaboration":           "sprint",  // future-ready — Sprint first
};
function buildReportPrompt(scoreProfile) {
  const {
    name, role, valuIndex, clusterScores, skillScores,
    desig, futureReadyScore, strongest, weakest,
    pathway, listed, globalSD,
    consistencyFlags, gamingDetected, speedFlag, uniformityFlag
  } = scoreProfile;
  // Sort skills by score to find top 3 and bottom 3
  const sortedSkills = Object.entries(skillScores || {})
    .filter(([s]) => s !== "Validity")
    .sort(([,a],[,b]) => b - a);
  const topSkills    = sortedSkills.slice(0, 3);
  const bottomSkills = sortedSkills.slice(-3).reverse(); // weakest first
  // Skills within the weakest cluster
  const weakestClusterSkills = sortedSkills
    .filter(([s]) => SKILL_CLUSTER[s] === weakest.id)
    .sort(([,a],[,b]) => a - b); // weakest first within that cluster
  const primaryGapSkill   = weakestClusterSkills[0]?.[0] || bottomSkills[0]?.[0];
  const secondaryGapSkill = weakestClusterSkills[1]?.[0] || bottomSkills[1]?.[0];
  // Recommended programme
  const primaryProgrammeKey = SKILL_PROGRAMME_MAP[primaryGapSkill] || "cluster";
  const primaryProgramme    = PRIME_PROGRAMMES[primaryProgrammeKey];
  // If score is too low for listing, Sprint is always first
  const immediateAction = !listed ? "PRIME Sprint" : primaryProgramme.name;
  const clusterSkillDetail = CLUSTERS.map(c => {
    const skills = sortedSkills.filter(([s]) => SKILL_CLUSTER[s] === c.id);
    return `${c.name} (${clusterScores[c.id]}/100):\n` +
      skills.map(([s,sc]) => `  - ${s}: ${sc}/100`).join("\n");
  }).join("\n\n");
  const gapSize = clusterScores[strongest.id] - clusterScores[weakest.id];
  return `You are writing a personalised professional development report for ${name}, a ${role} who just completed the VALU Index assessment.
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
VALU Index: ${valuIndex}/100 — ${desig.name}
Listed on platform: ${listed ? "Yes" : "No — needs score of 35+"}
Future-Ready score: ${futureReadyScore}/100
SKILL SCORES (this is the most important data — use it):
${clusterSkillDetail}
THEIR STRONGEST SKILLS: ${topSkills.map(([s,sc]) => `${s} (${sc}/100)`).join(", ")}
THEIR WEAKEST SKILLS: ${bottomSkills.map(([s,sc]) => `${s} (${sc}/100)`).join(", ")}
PRIMARY GAP SKILL: ${primaryGapSkill} (${skillScores?.[primaryGapSkill]}/100) — this is the single most important skill to name and address
SECONDARY GAP SKILL: ${secondaryGapSkill} (${skillScores?.[secondaryGapSkill]}/100)
RECOMMENDED PROGRAMME: ${primaryProgramme.name} (${primaryProgramme.duration}, ${primaryProgramme.price})
— This programme directly addresses: ${weakest.name} cluster, specifically ${primaryGapSkill}${secondaryGapSkill ? ` and ${secondaryGapSkill}` : ""}
IMMEDIATE WEEKLY ACTION for ${primaryGapSkill}:
"${SKILL_ACTIONS[primaryGapSkill] || "Start by naming the exact gap in your own words — what specifically do you not yet do well, and what does that cost you right now?"}"
VALORIA'S PROGRAMME MENU (reference the right one):
- PRIME Sprint: 1 day, ₦150K–₦300K — best for one urgent cluster, fastest path to listing
- PRIME Cluster Programme: 6 weeks, ₦500K–₦1.2M — deep work on one cluster
- PRIME Certified Professional (PCP): 6 months, ₦200K–₦400K — full certification, all clusters
- Executive Immersion: 3 days residential, ₦800K–₦2M — for C-suite, all clusters, time-compressed
${!listed ? `IMPORTANT: ${name} scored ${valuIndex}/100 which is below the 35-point listing minimum. The PRIME Sprint is the direct path to getting listed. Name this clearly.` : ""}
${gamingDetected ? "NOTE: Gaming pattern was detected and adjusted. Do not mention this in the report." : ""}
${uniformityFlag ? "NOTE: Unusual response uniformity detected. Write the report normally but do not make strong positive claims about score authenticity." : ""}
WRITE THE REPORT IN THESE EXACT SECTIONS:
---
## YOUR SCORE: ${valuIndex}/100 — ${desig.name.toUpperCase()}
One paragraph only. What this score means in plain language. What an employer sees when they find this profile. No jargon. Be direct about where ${name} stands.
## WHAT YOU ARE GOOD AT
Start with: "Your strongest skill is [name it]." Then name the top 2–3 skills with their scores and say specifically what that means in a work context. One sentence per skill. Make them feel seen — but do not be sycophantic.
## WHERE YOU ARE LOSING GROUND
This is the most important section. Start with: "Your biggest gap right now is [name the primary gap skill]." 
- Name the skill, name the score, name what it means in plain language
- Say exactly what this gap costs them in their current role as a ${role}
- Name the second gap skill and do the same
- Be direct. This is not the section to soften things.
- Maximum 150 words.
## WHAT THIS COSTS YOU IN THE NEXT 12 MONTHS
One paragraph. Be specific. Not "you may miss opportunities." Say exactly what happens: who overtakes them, what they fail to get, what they keep being passed over for. Make it real.
## YOUR ONE ACTION FOR THIS WEEK
Give them EXACTLY the pre-written action for ${primaryGapSkill}:
"${SKILL_ACTIONS[primaryGapSkill]}"
Then add one sentence of context connecting it to their score.
## THE PROGRAMME YOU NEED RIGHT NOW
Name: ${primaryProgramme.name}
Duration: ${primaryProgramme.duration}
Investment: ${primaryProgramme.price}
Write 3–4 sentences explaining EXACTLY why this programme fits their profile. Reference their specific skill scores. Name which skills in this cluster the programme will develop. Say what score movement they should expect.
${!listed ? `\n## HOW TO GET LISTED\nThey are not yet listed because their score is ${valuIndex} — below the 35-point minimum. Name this directly. Tell them the PRIME Sprint is the path. Tell them what score movement to expect from a Sprint.` : ""}
## THE QUESTION TO SIT WITH
A single question in italics. It must be about their weakest skill (${primaryGapSkill}) and specific to their role as a ${role}. Make it uncomfortable enough to be useful. No preamble. No explanation after it.
---
Write the complete report now. Start directly with ## YOUR SCORE. No introduction before it.`;
}
// ── MAIN COMPONENT — v4 AI-POWERED ────────────────────────────────────────
// Props:
//   onComplete(results)    — called when assessment finishes
//   assessmentExpiresAt    — ISO date string — if set and in the future,
//                            retake is blocked and the expiry date is shown.
//                            Pass from your auth/dashboard for hard launch.
//                            Omit for soft launch testing.
export default function PRIMEAssessment({ onComplete, assessmentExpiresAt }) {
  const [phase, setPhase]           = useState("intro");
  const [currentQ, setCurrentQ]     = useState(0);
  const [answers, setAnswers]       = useState({});
  const [selected, setSelected]     = useState(null);
  const [name, setName]             = useState("");
  const [role, setRole]             = useState("");
  const [timings, setTimings]       = useState(Array(TOTAL).fill(0));
  const [qStartTime, setQStartTime] = useState(null);
  const [results, setResults]       = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [shuffleMap, setShuffleMap] = useState({});
  const [sessionSeed]               = useState(() => Math.random() * 99999);
  // AI report state
  const [reportText, setReportText]     = useState("");
  const [reportStatus, setReportStatus] = useState("idle");
  const [reportError, setReportError]   = useState(null);
  const reportRef = useRef(null);
  // Retake modal state
  const [showRetakeModal, setShowRetakeModal] = useState(false);
  const [signupEmail, setSignupEmail]         = useState("");
  const [signupPassword, setSignupPassword]   = useState("");
  const [signupError, setSignupError]         = useState("");
  const [signupLoading, setSignupLoading]     = useState(false);
  const [signupDone, setSignupDone]           = useState(false);
  // Expiry check — is this assessment still valid?
  const assessmentIsLocked = assessmentExpiresAt
    ? new Date() < new Date(assessmentExpiresAt)
    : false;
  const expiryDateFormatted = assessmentExpiresAt
    ? new Date(assessmentExpiresAt).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })
    : null;
  const question = QUESTIONS[currentQ];
  const progress  = Math.round((currentQ / TOTAL) * 100);
  const cluster   = CLUSTERS.find(c => c.id === question?.cluster);
  // FIX 1: Shuffle options per question
  const displayedOptions = useMemo(() => {
    if (!question) return [];
    if (question.type === "anchor") return question.options;
    const seed = sessionSeed + currentQ;
    const shuffled = seededShuffle(question.options, seed);
    setShuffleMap(prev => ({ ...prev, [currentQ]: shuffled }));
    return shuffled;
  }, [currentQ, question, sessionSeed]);
  useEffect(() => {
    if (phase === "assessing") setQStartTime(Date.now());
  }, [currentQ, phase]);
  // Live radar scores
  const liveScores = {};
  CLUSTERS.forEach(c => {
    const qs = QUESTIONS.filter((q,i) => q.cluster === c.id && answers[i] !== undefined);
    const raw = qs.reduce((s, q) => {
      const idx = QUESTIONS.indexOf(q);
      const displayedIdx = answers[idx];
      const originalOption = shuffleMap[idx] ? shuffleMap[idx][displayedIdx] : q.options[displayedIdx];
      return s + (originalOption?.score || 0);
    }, 0);
    liveScores[c.id] = Math.round((raw / c.maxRaw) * 100);
  });
  // ── AI REPORT GENERATOR ────────────────────────────────────────────────
  async function generateAIReport(scoreProfile) {
    // AI report is generated server-side on signup and emailed — just show scores now
    setReportStatus("complete");
    if (onComplete) {
      onComplete({ name, role, ...scoreProfile, promptVersion: PROMPT_VERSION, completedAt: new Date().toISOString() });
    }
  }
  function handleSelect(optIdx) {
    if (transitioning) return;
    setSelected(optIdx);
    // Auto-advance after a brief moment so user can see their selection highlighted
    setTimeout(() => {
      handleNextWithAnswer(optIdx);
    }, 400);
  }

  function handleNextWithAnswer(optIdx) {
    const elapsed = qStartTime ? Date.now() - qStartTime : 0;
    const newTimings = [...timings];
    newTimings[currentQ] = elapsed;
    const newAnswers = { ...answers, [currentQ]: optIdx };
    setAnswers(newAnswers);
    setTransitioning(true);
    setTimeout(() => {
      if (currentQ + 1 < TOTAL) {
        setCurrentQ(currentQ + 1);
        setSelected(null);
        setTransitioning(false);
      } else {
        const r = computeResults(newAnswers, newTimings, shuffleMap);
        setResults(r);
        setPhase("generating");
        setTransitioning(false);
        generateAIReport({ name, role, ...r });
      }
    }, 280);
  }
  function handleNext() {
    if (selected === null) return;
    const elapsed = qStartTime ? Date.now() - qStartTime : 0;
    const newTimings = [...timings];
    newTimings[currentQ] = elapsed;
    setTimings(newTimings);
    const newAnswers = { ...answers, [currentQ]: selected };
    setAnswers(newAnswers);
    setTransitioning(true);
    setTimeout(() => {
      if (currentQ + 1 < TOTAL) {
        setCurrentQ(currentQ + 1);
        setSelected(null);
        setTransitioning(false);
      } else {
        const r = computeResults(newAnswers, newTimings, shuffleMap);
        setResults(r);
        setPhase("generating");
        setTransitioning(false);
        // Trigger AI report generation immediately
        generateAIReport({ name, role, ...r });
      }
    }, 280);
  }
  function handleBack() {
    if (currentQ === 0) return;
    setSelected(answers[currentQ - 1] ?? null);
    setCurrentQ(currentQ - 1);
  }
  // ── RETAKE LOGIC ──────────────────────────────────────────────────────
  // Called when the professional clicks "Retake Assessment"
  // If assessmentExpiresAt is set and still in the future — blocked entirely.
  // If no expiry is set (soft launch / testing) — shows confirmation modal.
  function requestRetake() {
    if (assessmentIsLocked) {
      // Show the locked modal — retake not available yet
      setShowRetakeModal("locked");
    } else {
      // Show the confirmation modal — are you sure?
      setShowRetakeModal("confirm");
    }
  }
  function confirmRetake() {
    setShowRetakeModal(false);
    setPhase("intro"); setCurrentQ(0); setAnswers({});
    setSelected(null); setResults(null); setName(""); setRole("");
    setTimings(Array(TOTAL).fill(0)); setShuffleMap({});
    setReportText(""); setReportStatus("idle"); setReportError(null);
  }
  // ── INTRO SCREEN ───────────────────────────────────────────────────────
  if (phase === "intro") {
    const canBegin = name.trim().length > 0 && role.trim().length > 0;
    return (
      <div style={{
        minHeight:"100vh", background:DARK,
        fontFamily:"'DM Sans',sans-serif",
        position:"relative", overflowX:"hidden",
        overflowY:"auto",
      }}>
        {/* Noise grain overlay */}
        <div style={{
          position:"fixed", inset:0, pointerEvents:"none", zIndex:0, opacity:0.035,
          backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize:"256px",
        }}/>
        {/* Ambient gold glow — positioned top-center */}
        <div style={{
          position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
          background:"radial-gradient(ellipse 100% 50% at 50% 0%, rgba(201,168,76,0.09) 0%, transparent 60%)",
        }}/>
        {/* PRIME cluster stripe — top */}
        <div style={{position:"fixed",top:0,left:0,right:0,height:3,display:"flex",zIndex:10}}>
          {[["#1D9E75",20],["#378ADD",25],["#7F77DD",25],["#BA7517",20],["#D85A30",10]].map(([color,pct],i)=>(
            <div key={i} style={{flex:pct,background:color,opacity:0.9}}/>
          ))}
        </div>

        {/* ── SINGLE COLUMN SCROLL LAYOUT ── */}
        <div style={{
          position:"relative", zIndex:1,
          maxWidth:520, margin:"0 auto",
          padding:"clamp(48px,10vw,72px) 20px clamp(40px,8vw,64px)",
          display:"flex", flexDirection:"column", gap:0,
        }}>

          {/* WORDMARK */}
          <div style={{marginBottom:32, animation:"fadeUp 0.7s ease 0.05s both"}}>
            <div style={{
              fontFamily:"'Cormorant Garamond',Georgia,serif",
              fontSize:28, fontWeight:600, color:GOLD,
              letterSpacing:"0.2em", lineHeight:1, marginBottom:3,
            }}>VALORIA</div>
            <div style={{
              fontSize:9, color:"rgba(201,168,76,0.4)",
              letterSpacing:"0.3em",
            }}>INSTITUTE</div>
          </div>

          {/* HERO HEADLINE */}
          <div style={{marginBottom:16, animation:"fadeUp 0.8s ease 0.15s both"}}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:8,
              padding:"5px 12px",
              background:"rgba(201,168,76,0.08)",
              border:"1px solid rgba(201,168,76,0.2)",
              borderRadius:100, marginBottom:18,
            }}>
              <div style={{width:6,height:6,borderRadius:"50%",background:GOLD,
                animation:"pulseGold 2.5s ease infinite"}}/>
              <span style={{fontSize:9,fontWeight:600,color:GOLD,letterSpacing:"0.2em"}}>FOUNDING COHORT — NOW OPEN</span>
            </div>
            <h1 style={{
              fontFamily:"'Cormorant Garamond',Georgia,serif",
              fontSize:"clamp(38px,9vw,56px)",
              fontWeight:300, lineHeight:0.97,
              letterSpacing:"-0.025em",
              color:PARCHMENT, margin:"0 0 16px",
            }}>
              Know exactly<br/>
              where you <em style={{fontStyle:"italic",color:GOLD}}>stand.</em>
            </h1>
            <p style={{
              fontSize:"clamp(14px,3.5vw,16px)", fontWeight:300,
              color:"rgba(247,244,238,0.5)", lineHeight:1.75,
              margin:0,
            }}>
              55 questions across five PRIME clusters. Designed to surface what you genuinely do — not what you aspire to do.
            </p>
          </div>

          {/* QUICK STATS ROW */}
          <div style={{
            display:"flex", gap:0,
            margin:"24px 0 32px",
            background:"rgba(255,255,255,0.025)",
            border:"1px solid rgba(255,255,255,0.06)",
            borderRadius:8, overflow:"hidden",
            animation:"fadeUp 0.8s ease 0.25s both",
          }}>
            {[
              {label:"Questions",val:"55"},
              {label:"Minutes",val:"18–28"},
              {label:"Always",val:"Free"},
            ].map((s,i) => (
              <div key={i} style={{
                flex:1, padding:"14px 8px", textAlign:"center",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <div style={{fontSize:18,fontWeight:700,color:GOLD,lineHeight:1,fontFamily:"'Cormorant Garamond',Georgia,serif"}}>{s.val}</div>
                <div style={{fontSize:10,color:"rgba(247,244,238,0.3)",marginTop:4,letterSpacing:"0.08em"}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* FORM CARD */}
          <div style={{
            background:"rgba(22,22,36,0.7)",
            border:"1px solid rgba(201,168,76,0.12)",
            borderRadius:12,
            padding:"clamp(24px,6vw,32px)",
            animation:"fadeUp 0.8s ease 0.35s both",
          }}>
            <div style={{
              fontSize:11, fontWeight:600, color:"rgba(247,244,238,0.4)",
              letterSpacing:"0.14em", marginBottom:20,
            }}>BEFORE YOU BEGIN</div>

            {/* Name field */}
            <div style={{marginBottom:16}}>
              <label style={{
                fontSize:9, fontWeight:700, color:"rgba(201,168,76,0.5)",
                letterSpacing:"0.22em", display:"block", marginBottom:8,
              }}>YOUR FULL NAME</label>
              <input
                value={name}
                onChange={e=>setName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                inputMode="text"
                enterKeyHint="next"
                style={{
                  width:"100%",
                  background:"rgba(255,255,255,0.04)",
                  border:`1.5px solid ${name.trim() ? "rgba(201,168,76,0.4)" : "rgba(247,244,238,0.1)"}`,
                  borderRadius:8,
                  padding:"16px 18px",
                  color:PARCHMENT,
                  fontSize:16,
                  outline:"none",
                  fontFamily:"'DM Sans',sans-serif",
                  transition:"border-color 0.2s",
                  boxSizing:"border-box",
                  WebkitAppearance:"none",
                  appearance:"none",
                }}
              />
            </div>

            {/* Role field */}
            <div style={{marginBottom:24}}>
              <label style={{
                fontSize:9, fontWeight:700, color:"rgba(201,168,76,0.5)",
                letterSpacing:"0.22em", display:"block", marginBottom:8,
              }}>YOUR CURRENT ROLE</label>
              <input
                value={role}
                onChange={e=>setRole(e.target.value)}
                placeholder="e.g. Director of Strategy"
                autoComplete="organization-title"
                inputMode="text"
                enterKeyHint="done"
                style={{
                  width:"100%",
                  background:"rgba(255,255,255,0.04)",
                  border:`1.5px solid ${role.trim() ? "rgba(201,168,76,0.4)" : "rgba(247,244,238,0.1)"}`,
                  borderRadius:8,
                  padding:"16px 18px",
                  color:PARCHMENT,
                  fontSize:16,
                  outline:"none",
                  fontFamily:"'DM Sans',sans-serif",
                  transition:"border-color 0.2s",
                  boxSizing:"border-box",
                  WebkitAppearance:"none",
                  appearance:"none",
                }}
              />
            </div>

            {/* CTA BUTTON */}
            <button
              onClick={() => { if (canBegin) setPhase("assessing"); }}
              disabled={!canBegin}
              style={{
                width:"100%",
                padding:"18px 24px",
                background: canBegin ? GOLD : "rgba(201,168,76,0.12)",
                color: canBegin ? DARK : "rgba(201,168,76,0.25)",
                border: canBegin ? "none" : "1px solid rgba(201,168,76,0.15)",
                borderRadius:8,
                fontSize:12, fontWeight:700, letterSpacing:"0.18em",
                cursor: canBegin ? "pointer" : "not-allowed",
                transition:"background 0.25s, transform 0.15s, box-shadow 0.2s",
                fontFamily:"'DM Sans',sans-serif",
                boxShadow: canBegin ? "0 4px 24px rgba(201,168,76,0.25)" : "none",
                WebkitTapHighlightColor:"transparent",
              }}
              onMouseEnter={e => { if (canBegin) e.currentTarget.style.background="#E2C97E"; }}
              onMouseLeave={e => { if (canBegin) e.currentTarget.style.background=GOLD; }}
              onTouchStart={e => { if (canBegin) e.currentTarget.style.transform="scale(0.98)"; }}
              onTouchEnd={e => { e.currentTarget.style.transform="scale(1)"; }}
            >
              BEGIN THE VALU INDEX
            </button>

            {/* Helper note */}
            {!canBegin && (
              <p style={{
                textAlign:"center", fontSize:11,
                color:"rgba(247,244,238,0.2)", marginTop:12,
                lineHeight:1.5, margin:"12px 0 0",
              }}>
                Enter your name and role to continue
              </p>
            )}
          </div>

          {/* INSTRUCTION NOTE */}
          <div style={{
            marginTop:16,
            padding:"14px 18px",
            background:"rgba(255,255,255,0.02)",
            border:"1px solid rgba(255,255,255,0.05)",
            borderRadius:8,
            animation:"fadeUp 0.8s ease 0.45s both",
          }}>
            <div style={{fontSize:12,color:"rgba(247,244,238,0.28)",lineHeight:1.75}}>
              Answer based on what you <em style={{color:"rgba(247,244,238,0.45)"}}>actually do</em> — not what you aim to do. Consistent honest responses produce a more accurate result.
            </div>
          </div>

          {/* PRIME CLUSTERS — collapsible on mobile */}
          <div style={{
            marginTop:28,
            animation:"fadeUp 0.8s ease 0.55s both",
          }}>
            <div style={{
              fontSize:9, color:"rgba(201,168,76,0.35)",
              letterSpacing:"0.18em", marginBottom:12,
            }}>WHAT IS ASSESSED</div>
            <div style={{display:"flex", flexDirection:"column", gap:8}}>
              {CLUSTERS.map((c,i) => (
                <div key={c.id} style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"10px 14px",
                  background:"rgba(255,255,255,0.02)",
                  border:`1px solid ${c.color}20`,
                  borderRadius:8,
                  animation:`fadeUp 0.6s ease ${0.6+i*0.06}s both`,
                }}>
                  <div style={{
                    width:32, height:32, borderRadius:6,
                    background:`${c.color}15`,
                    border:`1px solid ${c.color}35`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:12, fontWeight:700, color:c.color,
                    flexShrink:0,
                  }}>{c.id}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13,color:PARCHMENT,fontWeight:500}}>{c.name}</div>
                    <div style={{fontSize:11,color:"rgba(247,244,238,0.3)",fontStyle:"italic"}}>{c.theme}</div>
                  </div>
                  <div style={{
                    fontSize:10, color:`${c.color}70`,
                    letterSpacing:"0.06em", flexShrink:0,
                    fontFamily:"'DM Mono',monospace",
                  }}>{Math.round(c.weight*100)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* DESIGNATIONS */}
          <div style={{
            marginTop:28,
            animation:"fadeUp 0.8s ease 0.7s both",
          }}>
            <div style={{
              fontSize:9, color:"rgba(201,168,76,0.35)",
              letterSpacing:"0.18em", marginBottom:12,
            }}>POSSIBLE DESIGNATIONS</div>
            <div style={{display:"flex", flexDirection:"column", gap:0,
              border:"1px solid rgba(255,255,255,0.05)", borderRadius:8, overflow:"hidden"}}>
              {[
                {name:"Force to Align With", color:GOLD,      range:"80–100"},
                {name:"Emerging Force",       color:"#378ADD", range:"65–79"},
                {name:"Developing Professional",color:"#1D9E75",range:"50–64"},
                {name:"Building Foundations", color:"#BA7517", range:"35–49"},
              ].map((d,i) => (
                <div key={d.name} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"11px 14px",
                  borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  background:"rgba(255,255,255,0.015)",
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:d.color,opacity:0.7,flexShrink:0}}/>
                    <span style={{fontSize:12,color:d.color,fontWeight:500}}>{d.name}</span>
                  </div>
                  <span style={{fontSize:11,color:"rgba(247,244,238,0.2)",fontFamily:"'DM Mono',monospace",flexShrink:0}}>{d.range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER NOTE */}
          <div style={{
            marginTop:32, paddingTop:24,
            borderTop:"1px solid rgba(201,168,76,0.08)",
            display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center",
            animation:"fadeUp 0.8s ease 0.8s both",
          }}>
            {["Always free","18–28 minutes","NDPA 2023 compliant"].map(t => (
              <div key={t} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"rgba(247,244,238,0.2)"}}>
                <div style={{width:3,height:3,borderRadius:"50%",background:"rgba(201,168,76,0.4)"}}/>
                {t}
              </div>
            ))}
          </div>

        </div>

        {/* Animations */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap');
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulseGold {
            0%,100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.5); }
            50% { box-shadow: 0 0 0 5px rgba(201,168,76,0); }
          }
          input:focus {
            border-color: rgba(201,168,76,0.5) !important;
            box-shadow: 0 0 0 3px rgba(201,168,76,0.08);
          }
          input::placeholder { color: rgba(247,244,238,0.2) !important; }
          * { -webkit-tap-highlight-color: transparent; }
        `}</style>
      </div>
    );
  }
  // ── ASSESSMENT SCREEN ──────────────────────────────────────────────────
  if (phase === "assessing") {
    return (
      <div style={{minHeight:"100vh",background:DARK,display:"flex",flexDirection:"column",fontFamily:"sans-serif"}}>
        <div style={{position:"fixed",top:0,left:0,right:0,height:3,background:"rgba(255,255,255,0.06)",zIndex:50}}>
          <div style={{height:"100%",width:`${progress}%`,background:GOLD,transition:"width 0.4s ease"}}/>
        </div>
        <div style={{position:"fixed",top:0,left:0,right:0,padding:"16px 24px 12px",background:"rgba(26,26,46,0.97)",borderBottom:"1px solid rgba(201,168,76,0.1)",backdropFilter:"blur(12px)",zIndex:40,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:11,color:"rgba(201,168,76,0.6)",letterSpacing:"0.15em"}}>VALU INDEX</div>
          <div style={{fontSize:12,color:"rgba(247,244,238,0.35)"}}>{currentQ + 1} / {TOTAL}</div>
          {cluster && (
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:18,height:18,borderRadius:3,background:`${cluster.color}20`,border:`1px solid ${cluster.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:cluster.color}}>{cluster.id}</div>
              <div style={{fontSize:11,color:cluster.color,letterSpacing:"0.08em"}}>{cluster.name.toUpperCase()}</div>
            </div>
          )}
        </div>
        <div style={{flex:1,display:"flex",padding:"80px 20px 140px",maxWidth:700,margin:"0 auto",width:"100%",flexDirection:"column",justifyContent:"center"}}>
          {question.skill && question.cluster !== "VA" && (
            <div style={{fontSize:10,color:"rgba(201,168,76,0.4)",letterSpacing:"0.18em",marginBottom:16,textTransform:"uppercase"}}>
              {question.skill} · {question.type}
            </div>
          )}
          <div style={{fontFamily:"Georgia,serif",fontSize:"clamp(17px,2.5vw,22px)",fontWeight:300,color:PARCHMENT,lineHeight:1.55,marginBottom:32,opacity:transitioning?0:1,transition:"opacity 0.2s"}}>
            {question.q}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10,opacity:transitioning?0:1,transition:"opacity 0.2s"}}>
            {displayedOptions.map((opt, displayIdx) => {
              const isSelected = selected === displayIdx;
              return (
                <button key={displayIdx}
                  onClick={() => handleSelect(displayIdx)}
                  style={{
                    padding:"16px 20px",
                    background: isSelected ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)",
                    border:`1.5px solid ${isSelected ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius:8,
                    textAlign:"left",
                    cursor:"pointer",
                    color: isSelected ? PARCHMENT : "rgba(247,244,238,0.65)",
                    fontSize:14,
                    lineHeight:1.55,
                    fontFamily:"'DM Sans',sans-serif",
                    transition:"all 0.2s cubic-bezier(0.22,1,0.36,1)",
                    outline:"none",
                    boxShadow: isSelected ? "0 4px 20px rgba(201,168,76,0.15)" : "none",
                    transform:"scale(1)",
                    WebkitTapHighlightColor:"transparent",
                    display:"block", width:"100%",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.borderColor = "rgba(201,168,76,0.25)";
                      e.currentTarget.style.color = PARCHMENT;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.color = "rgba(247,244,238,0.65)";
                    }
                  }}
                  onTouchStart={e => { e.currentTarget.style.transform = "scale(0.98)"; }}
                  onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"16px 24px",background:"rgba(26,26,46,0.97)",borderTop:"1px solid rgba(201,168,76,0.08)",backdropFilter:"blur(12px)",display:"flex",gap:10,justifyContent:"center"}}>
          {currentQ > 0 && (
            <button onClick={handleBack}
              style={{padding:"12px 24px",background:"transparent",border:"1px solid rgba(201,168,76,0.2)",borderRadius:3,color:"rgba(247,244,238,0.4)",fontSize:12,letterSpacing:"0.1em",cursor:"pointer",fontFamily:"sans-serif"}}>
              BACK
            </button>
          )}
          <div style={{flex:1,maxWidth:320,padding:"14px",textAlign:"center",fontSize:11,color:"rgba(201,168,76,0.4)",letterSpacing:"0.12em",fontFamily:"sans-serif"}}>
            {selected === null ? "SELECT AN ANSWER TO CONTINUE" : "MOVING TO NEXT QUESTION..."}
          </div>
        </div>
        <div style={{position:"fixed",bottom:80,right:20,opacity:0.5}}>
          <Radar scores={liveScores} size={80}/>
        </div>
      </div>
    );
  }
  // ── GENERATING / REPORT SCREEN ─────────────────────────────────────────
  if ((phase === "generating" || phase === "report") && results) {
    const { valuIndex, clusterScores, skillScores, desig, futureReadyScore,
            strongest, weakest, listed } = results;
    const isGenerating = reportStatus === "generating";
    const isComplete   = reportStatus === "complete";
    const isError      = reportStatus === "error";
    // ── MARKDOWN RENDERER ──
    // Converts the streamed markdown into styled React elements
    function renderReport(text) {
      if (!text) return null;
      const lines = text.split("\n");
      const elements = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        // ## Section heading
        if (line.startsWith("## ")) {
          elements.push(
            <div key={i} style={{marginTop:32,marginBottom:12}}>
              <div style={{fontSize:10,color:GOLD,letterSpacing:"0.2em",marginBottom:6}}>
                {line.replace("## ", "").toUpperCase()}
              </div>
              <div style={{height:1,background:"rgba(201,168,76,0.15)"}}/>
            </div>
          );
          i++; continue;
        }
        // Italic line (question to sit with)
        if (line.startsWith("*") && line.endsWith("*") && line.length > 2) {
          elements.push(
            <div key={i} style={{padding:"20px 24px",background:"rgba(201,168,76,0.05)",borderLeft:`3px solid ${GOLD}`,borderRadius:"0 6px 6px 0",margin:"16px 0"}}>
              <p style={{fontFamily:"Georgia,serif",fontSize:"clamp(15px,2.2vw,20px)",fontWeight:300,color:PARCHMENT,lineHeight:1.55,margin:0,fontStyle:"italic"}}>
                {line.slice(1,-1)}
              </p>
            </div>
          );
          i++; continue;
        }
        // Bold inline — **text**
        if (line.trim() && !line.startsWith("#")) {
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          const rendered = parts.map((part, pi) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={pi} style={{color:PARCHMENT,fontWeight:600}}>{part.slice(2,-2)}</strong>;
            }
            return part;
          });
          elements.push(
            <p key={i} style={{fontSize:14,color:"rgba(247,244,238,0.65)",lineHeight:1.85,margin:"0 0 14px 0"}}>
              {rendered}
            </p>
          );
          i++; continue;
        }
        i++;
      }
      return elements;
    }
    return (
      <div style={{minHeight:"100vh",background:DARK,fontFamily:"sans-serif"}}>
        {/* ── SCORE HEADER — always visible ── */}
        <div style={{background:MID,borderBottom:"1px solid rgba(201,168,76,0.12)",padding:"32px 24px 28px",position:"sticky",top:0,zIndex:10}}>
          <div style={{maxWidth:680,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
              <div>
                <div style={{fontSize:10,color:"rgba(201,168,76,0.45)",letterSpacing:"0.2em",marginBottom:6}}>VALU INDEX REPORT · {name}</div>
                <div style={{fontSize:11,color:"rgba(247,244,238,0.35)"}}>{role}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:48,fontWeight:300,color:GOLD,lineHeight:1}}>{valuIndex}</div>
                  <div style={{fontSize:9,color:"rgba(247,244,238,0.25)",letterSpacing:"0.1em"}}>OUT OF 100</div>
                </div>
                <Radar scores={clusterScores} size={90}/>
              </div>
            </div>
            {/* Cluster + skill scores */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:16}}>
              {CLUSTERS.map(c => {
                // Get skills in this cluster sorted weakest first
                const clusterSkillList = Object.entries(skillScores || {})
                  .filter(([s]) => SKILL_CLUSTER[s] === c.id)
                  .sort(([,a],[,b]) => a - b);
                const weakestSkill = clusterSkillList[0];
                return (
                  <div key={c.id} style={{
                    padding:"8px 12px",
                    background:`${c.color}10`,
                    border:`1px solid ${c.color}30`,
                    borderRadius:4, minWidth:120,
                  }}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                      <div style={{width:14,height:14,borderRadius:2,background:`${c.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:c.color}}>{c.id}</div>
                      <span style={{fontSize:13,color:c.color,fontWeight:600}}>{clusterScores[c.id]}</span>
                      <span style={{fontSize:10,color:"rgba(247,244,238,0.25)"}}>/100</span>
                    </div>
                    {weakestSkill && (
                      <div style={{fontSize:10,color:"rgba(247,244,238,0.3)",lineHeight:1.4}}>
                        Gap: {weakestSkill[0].split(" ")[0]} ({weakestSkill[1]})
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:"rgba(232,160,32,0.08)",border:`1px solid rgba(232,160,32,0.2)`,borderRadius:4}}>
                <span style={{fontSize:10,color:AMBER,letterSpacing:"0.06em"}}>FUTURE-READY</span>
                <span style={{fontSize:13,color:AMBER,fontWeight:600}}>{futureReadyScore}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",padding:"8px 14px",background:desig.bg,border:`1px solid ${desig.color}40`,borderRadius:4}}>
                <span style={{fontSize:10,fontWeight:700,color:desig.color,letterSpacing:"0.1em"}}>{desig.name.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
        {/* ── REPORT BODY ── */}
        <div ref={reportRef} style={{maxWidth:680,margin:"0 auto",padding:"32px 24px 80px"}}>
          {/* Email report notice */}
          <div style={{padding:"20px 24px",background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:8,marginBottom:24}}>
            <div style={{fontSize:11,fontWeight:700,color:"rgba(201,168,76,0.8)",letterSpacing:"0.12em",marginBottom:8}}>✦ YOUR AI REPORT</div>
            <p style={{fontSize:13,color:"rgba(247,244,238,0.6)",lineHeight:1.75,margin:0}}>
              Your personalised AI report will be generated and sent to your email when you create your account below. It covers your strengths, gaps, and recommended next steps.
            </p>
          </div>
          {/* Platform status — shown after report completes */}
          {isComplete && (
            <>
              <div style={{marginTop:32,padding:"20px 24px",background:listed?"rgba(29,158,117,0.08)":"rgba(136,136,136,0.08)",
                border:`1px solid ${listed?"rgba(29,158,117,0.3)":"rgba(136,136,136,0.25)"}`,borderRadius:6}}>
                <div style={{fontSize:11,fontWeight:700,color:listed?"#1D9E75":"#888888",letterSpacing:"0.12em",marginBottom:8}}>
                  {listed ? "LISTED — YOUR PROFILE IS SEARCHABLE" : "NOT YET LISTED — SCORE BELOW 35"}
                </div>
                <p style={{fontSize:13,color:"rgba(247,244,238,0.55)",lineHeight:1.75,margin:0}}>
                  {listed
                    ? `Your VALU Index of ${valuIndex} qualifies you for listing on the Valoria platform. Complete your profile to become searchable by employers, event organisers, and training buyers.`
                    : `A score of ${valuIndex} does not yet qualify for listing. The minimum is 35. A PRIME Sprint is specifically designed to move your score into the listed range.`}
                </p>
              </div>
              {/* CTAs */}
              <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:24}}>
                {signupDone ? (
                  <div style={{padding:"24px",background:"rgba(29,158,117,0.08)",border:"1px solid rgba(29,158,117,0.3)",borderRadius:8,textAlign:"center"}}>
                    <div style={{fontSize:14,color:"#1D9E75",fontWeight:600,marginBottom:8}}>✓ Account Created</div>
                    <div style={{fontSize:13,color:"rgba(247,244,238,0.5)"}}>Your AI report has been sent to {signupEmail}</div>
                  </div>
                ) : (
                  <div style={{background:"rgba(22,22,36,0.7)",border:"1px solid rgba(201,168,76,0.12)",borderRadius:12,padding:"24px"}}>
                    <div style={{fontSize:11,fontWeight:600,color:"rgba(201,168,76,0.6)",letterSpacing:"0.14em",marginBottom:16}}>CREATE YOUR ACCOUNT</div>
                    <div style={{fontSize:12,color:"rgba(247,244,238,0.4)",marginBottom:20}}>Signed in as <strong style={{color:PARCHMENT}}>{name}</strong> · {role}</div>
                    <div style={{marginBottom:12}}>
                      <input
                        type="email"
                        placeholder="Email address"
                        value={signupEmail}
                        onChange={e=>setSignupEmail(e.target.value)}
                        style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1.5px solid rgba(247,244,238,0.1)",borderRadius:8,padding:"14px 16px",color:PARCHMENT,fontSize:15,outline:"none",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box"}}
                      />
                    </div>
                    <div style={{marginBottom:16}}>
                      <input
                        type="password"
                        placeholder="Create password"
                        value={signupPassword}
                        onChange={e=>setSignupPassword(e.target.value)}
                        style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1.5px solid rgba(247,244,238,0.1)",borderRadius:8,padding:"14px 16px",color:PARCHMENT,fontSize:15,outline:"none",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box"}}
                      />
                    </div>
                    {signupError && <div style={{fontSize:12,color:"#D85A30",marginBottom:12}}>{signupError}</div>}
                    <button
                      onClick={async () => {
                        if (!signupEmail || !signupPassword) { setSignupError("Please enter your email and password."); return; }
                        if (signupPassword.length < 6) { setSignupError("Password must be at least 6 characters."); return; }
                        setSignupLoading(true); setSignupError("");
                        try {
                          // 1. Create Supabase auth account
                          const authRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
                            method:"POST",
                            headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON_KEY},
                            body:JSON.stringify({email:signupEmail,password:signupPassword,data:{full_name:name,role}})
                          });
                          const authData = await authRes.json();
                          if (!authRes.ok) throw new Error(authData.msg || authData.error_description || "Signup failed");
                          // 2. Save assessment
                          await saveToSupabase({
                            total_score: results?.valuIndex ?? 0,
                            designation: results?.desig ?? "",
                            completed_at: new Date().toISOString(),
                            ai_report: reportText,
                            name, role,
                            email: signupEmail,
                            cluster_scores: results?.clusterScores ?? {},
                            skill_scores: results?.skillScores ?? {},
                          });
                          // 3. Generate AI report + send welcome email via API route
                          await fetch("/api/send-email", {
                            method:"POST",
                            headers:{"Content-Type":"application/json"},
                            body:JSON.stringify({
                              email:signupEmail,
                              name,
                              role,
                              score:results?.valuIndex,
                              designation:results?.desig,
                              clusterScores:results?.clusterScores,
                              skillScores:results?.skillScores,
                              listed:results?.listed,
                              futureReadyScore:results?.futureReadyScore,
                              strongest:results?.strongest,
                              weakest:results?.weakest,
                              prompt: buildReportPrompt({name, role, ...results})
                            })
                          });
                          setSignupDone(true);
                          if (onComplete) onComplete({name,role,...results,reportText,email:signupEmail});
                        } catch(e) {
                          setSignupError(e.message || "Something went wrong. Please try again.");
                        } finally { setSignupLoading(false); }
                      }}
                      style={{width:"100%",padding:"16px",background:signupLoading?"rgba(201,168,76,0.4)":GOLD,border:"none",borderRadius:8,color:DARK,fontSize:12,fontWeight:700,letterSpacing:"0.16em",cursor:signupLoading?"wait":"pointer",fontFamily:"'DM Sans',sans-serif"}}
                    >
                      {signupLoading ? "CREATING ACCOUNT..." : "SECURE MY PLACE →"}
                    </button>
                  </div>
                )}
                <button onClick={requestRetake}
                  style={{padding:"15px 28px",background:"transparent",border:"1px solid rgba(201,168,76,0.15)",
                    borderRadius:3,color:"rgba(247,244,238,0.3)",fontSize:11,letterSpacing:"0.14em",cursor:"pointer",fontFamily:"sans-serif"}}>
                  RETAKE ASSESSMENT
                </button>
              </div>
              {/* ── RETAKE MODAL ── */}
              {showRetakeModal && (
                <div style={{
                  position:"fixed",inset:0,zIndex:999,
                  background:"rgba(15,15,26,0.92)",
                  backdropFilter:"blur(12px)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  padding:"24px",
                }}>
                  <div style={{
                    background:"#1A1A2E",
                    border:"1px solid rgba(201,168,76,0.2)",
                    borderRadius:10,padding:"36px 32px",
                    maxWidth:460,width:"100%",
                    position:"relative",
                  }}>
                    {/* Close */}
                    <button
                      onClick={() => setShowRetakeModal(false)}
                      style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:"rgba(247,244,238,0.3)",fontSize:20,cursor:"pointer",lineHeight:1}}>
                      ×
                    </button>
                    {showRetakeModal === "locked" ? (
                      /* ── LOCKED STATE — score still valid ── */
                      <>
                        <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="11" width="18" height="11" rx="2" stroke="#C9A84C" strokeWidth="1.5"/>
                            <path d="M7 11V7a5 5 0 0110 0v4" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:26,fontWeight:300,color:"#F7F4EE",marginBottom:12,lineHeight:1.2}}>
                          Your VALU Index is still valid.
                        </div>
                        <p style={{fontSize:14,color:"rgba(247,244,238,0.5)",lineHeight:1.75,marginBottom:16}}>
                          You can retake the assessment on <strong style={{color:"#C9A84C"}}>{expiryDateFormatted}</strong>. Your score expires 12 months after your assessment date.
                        </p>
                        <p style={{fontSize:13,color:"rgba(247,244,238,0.35)",lineHeight:1.7,marginBottom:24}}>
                          If you believe there is an error in your result, contact <span style={{color:"#C9A84C"}}>hello@valoriainstituteafrica.com</span> and a Valoria adviser will review your session.
                        </p>
                        <button
                          onClick={() => setShowRetakeModal(false)}
                          style={{width:"100%",padding:"14px",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:3,color:"#C9A84C",fontSize:11,fontWeight:700,letterSpacing:"0.16em",cursor:"pointer",fontFamily:"sans-serif"}}>
                          CLOSE
                        </button>
                      </>
                    ) : (
                      /* ── CONFIRM STATE — are you sure? ── */
                      <>
                        <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(216,90,48,0.1)",border:"1px solid rgba(216,90,48,0.3)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#D85A30" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:26,fontWeight:300,color:"#F7F4EE",marginBottom:12,lineHeight:1.2}}>
                          Are you sure you want to retake?
                        </div>
                        <p style={{fontSize:14,color:"rgba(247,244,238,0.5)",lineHeight:1.75,marginBottom:8}}>
                          Retaking the assessment will permanently replace your current result. Your VALU Index, cluster scores, and AI report will all be overwritten.
                        </p>
                        <p style={{fontSize:13,color:"rgba(247,244,238,0.4)",lineHeight:1.7,marginBottom:24}}>
                          The assessment is designed to be taken once every 12 months. Retaking it immediately is unlikely to produce a meaningfully different result — and will not improve your score if your capability has not changed.
                        </p>
                        <div style={{display:"flex",gap:10}}>
                          <button
                            onClick={() => setShowRetakeModal(false)}
                            style={{flex:1,padding:"13px",background:"transparent",border:"1px solid rgba(247,244,238,0.15)",borderRadius:3,color:"rgba(247,244,238,0.5)",fontSize:11,letterSpacing:"0.12em",cursor:"pointer",fontFamily:"sans-serif"}}>
                            KEEP MY RESULT
                          </button>
                          <button
                            onClick={confirmRetake}
                            style={{flex:1,padding:"13px",background:"rgba(216,90,48,0.15)",border:"1px solid rgba(216,90,48,0.4)",borderRadius:3,color:"#D85A30",fontSize:11,fontWeight:700,letterSpacing:"0.12em",cursor:"pointer",fontFamily:"sans-serif"}}>
                            YES, RETAKE
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {/* Animations */}
        <style>{`
          @keyframes pulse {
            0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
        {/* Footer */}
        <div style={{textAlign:"center",padding:"24px",fontSize:10,color:"rgba(247,244,238,0.12)",letterSpacing:"0.1em"}}>
          VALU INDEX v4.0 · AI-POWERED REPORT · PRIME FRAMEWORK · VALORIA INSTITUTE · © 2026
        </div>
      </div>
    );
  }
  return null;
}