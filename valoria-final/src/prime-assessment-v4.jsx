import { useState, useEffect, useRef } from "react";

const GOLD = "#C9A84C";
const DARK = "#1A1A2E";
const MID  = "#2E2E4A";
const PARCHMENT = "#F7F4EE";
const ACCENT = "#EDE8DC";
const AMBER = "#E8A020";
const BODY = "#2C2C2C";

// ── CLUSTER CONFIG ──────────────────────────────────────────────────────────
const CLUSTERS = [
  { id:"P", name:"Presence",      theme:"How you show up",  color:"#1D9E75", weight:0.20, maxRaw:12 },
  { id:"R", name:"Relationships", theme:"How you connect",  color:"#378ADD", weight:0.25, maxRaw:16 },
  { id:"I", name:"Intelligence",  theme:"How you think",    color:"#7F77DD", weight:0.25, maxRaw:20 },
  { id:"M", name:"Mastery",       theme:"How you deliver",  color:"#BA7517", weight:0.20, maxRaw:12 },
  { id:"E", name:"Enterprise",    theme:"How you create",   color:"#D85A30", weight:0.10, maxRaw:12 },
];

const DESIGNATIONS = [
  { min:80, name:"Force to Align With",    color:GOLD,     bg:"rgba(201,168,76,0.12)",  desc:"Operating at the highest expression of professional capability. You are recognised on the platform as a priority professional." },
  { min:65, name:"Emerging Force",         color:"#378ADD",bg:"rgba(55,138,221,0.10)",  desc:"Strong foundations with clear areas of excellence. You are on the trajectory — deliberate development will complete the picture." },
  { min:50, name:"Developing Professional",color:"#1D9E75",bg:"rgba(29,158,117,0.10)",  desc:"Genuine capability with uneven development. Your PRIME pathway is shown on your profile." },
  { min:35, name:"Building Foundations",   color:"#BA7517",bg:"rgba(186,117,23,0.10)",  desc:"Early-stage professional architecture. A PRIME Sprint is your recommended next step." },
  { min:0,  name:"At the Starting Point",  color:"#888888",bg:"rgba(136,136,136,0.10)", desc:"Not yet listed on the candidate platform. Complete a PRIME Sprint to qualify for listing." },
];

const EXPERIENCE_BANDS = [
  { id:"0-3",  label:"0 – 3 years",   desc:"Early career" },
  { id:"4-8",  label:"4 – 8 years",   desc:"Mid career" },
  { id:"9-15", label:"9 – 15 years",  desc:"Senior" },
  { id:"15+",  label:"15+ years",     desc:"Executive / Director" },
];

// ── TASTER QUESTIONS (9 — one per key skill, chosen for maximum resonance) ─
const TASTER_QUESTIONS = [
  // P — Communication: the leadership room question
  { id:"P1b", cluster:"P", skill:"Communication", tasterInsight:"how you communicate under pressure",
    q:"You are presenting a recommendation to leadership. Halfway through, you sense they have already made up their minds differently. What do you do?",
    options:[
      {text:"Finish the presentation as planned — the information needs to be heard.", score:1},
      {text:"Speed up and land the key points before you lose the room entirely.", score:2},
      {text:"Stop, name what you are sensing, and ask what their current thinking is before continuing.", score:3},
      {text:"Pivot immediately to the one thing that could shift their position, then invite the disagreement directly.", score:4},
    ]},
  // R — Emotional Intelligence: the disengaged colleague
  { id:"R1a", cluster:"R", skill:"Emotional Intelligence", tasterInsight:"how you read and respond to people",
    q:"You are in a high-pressure meeting and someone says something that genuinely irritates you. What actually happens next?",
    options:[
      {text:"I respond directly — suppressing a genuine reaction makes things worse, not better.", score:1},
      {text:"I stay quiet and address it after the meeting when things are calmer.", score:2},
      {text:"I notice the irritation, make a conscious decision not to act on it in the moment, and decide later whether it needs addressing.", score:3},
      {text:"I notice it, name — internally — what triggered it, regulate before responding, and make a deliberate choice about whether and how to address it based on what is actually useful.", score:4},
    ]},
  // R — Stakeholder Management: the initiative question
  { id:"R4a", cluster:"R", skill:"Stakeholder Management", tasterInsight:"how you manage relationships across power structures",
    q:"You are about to lead a significant new initiative that will require the support of people across multiple functions. Where do you start?",
    options:[
      {text:"Start the work and bring stakeholders in as they become relevant.", score:1},
      {text:"Brief the key stakeholders and make sure they know what is happening.", score:2},
      {text:"Map who needs to be involved, understand what each person cares about, and sequence conversations accordingly before work begins.", score:3},
      {text:"Build a stakeholder influence map — interests, concerns, level of support needed — then create a deliberate alignment sequence that builds momentum before I need it.", score:4},
    ]},
  // I — Strategic Thinking: the task question
  { id:"I2a", cluster:"I", skill:"Strategic Thinking", tasterInsight:"how you connect your work to the bigger picture",
    q:"You are given a task that is clearly important to your manager. Before starting, what goes through your mind?",
    options:[
      {text:"How to do it well and on time.", score:1},
      {text:"How this connects to the team's current priorities.", score:2},
      {text:"How this fits into the broader goal, who will use the output, and what success actually looks like beyond task completion.", score:3},
      {text:"How this task connects to the longer-term direction, what decisions it will enable or constrain, what the second-order consequences are, and whether this is actually the right task to be doing.", score:4},
    ]},
  // I — Business Acumen: the commercial case question
  { id:"I3b", cluster:"I", skill:"Business Acumen", tasterInsight:"how commercially fluent you are",
    q:"You are proposing a new initiative that will require investment. A finance leader asks you to walk them through the commercial case. How prepared are you?",
    options:[
      {text:"I can explain what the initiative does and why it is important.", score:1},
      {text:"I can explain the cost and the expected benefit at a high level.", score:2},
      {text:"I can present the cost, projected return, key assumptions, and the timeline to value.", score:3},
      {text:"I can present a fully worked commercial case — cost, return, assumptions with ranges, downside scenarios, payback period, and the metrics I would use to track whether it is working.", score:4},
    ]},
  // M — Execution & Accountability: the deadline question
  { id:"M1b", cluster:"M", skill:"Execution & Accountability", tasterInsight:"how you handle pressure and accountability",
    q:"A deadline you committed to is at serious risk — partly because of factors outside your control, partly because of your own planning. What do you do?",
    options:[
      {text:"Focus everything on delivery and explain what happened afterwards.", score:1},
      {text:"Flag the risk early, explain the external factors, and ask for an extension.", score:2},
      {text:"Flag the risk early, take ownership of your part in it, propose a specific revised plan, and deliver against the new commitment.", score:3},
      {text:"Flag the risk at the earliest signal — not when it is certain — own your contribution without defensiveness, present options with trade-offs, get alignment on the path forward, and build the lesson into how you plan next time.", score:4},
    ]},
  // M — Resilience: the public failure question
  { id:"M2b", cluster:"M", skill:"Resilience & Self-Leadership", tasterInsight:"how you respond to setbacks",
    q:"A project you led publicly failed — the outcome was visible, the impact was real, and people noticed. How do you respond?",
    options:[
      {text:"I focus on moving forward — dwelling on failure is not useful.", score:1},
      {text:"I do a debrief, understand what went wrong, and try not to repeat it.", score:2},
      {text:"I do a thorough analysis of what failed and why, take clear accountability for my role in it, and make specific changes to how I work.", score:3},
      {text:"I treat it as signal-rich data — rigorous analysis of what happened and why, clear accountability for what was mine, specific changes to practice, and deliberate use of the experience to build credibility by showing how I handle failure.", score:4},
    ]},
  // E — Influence Without Authority: the cooperation question
  { id:"E2a", cluster:"E", skill:"Influence Without Authority", tasterInsight:"how you lead without formal power",
    q:"You need the cooperation of someone who does not report to you — and they are currently not prioritising what you need. How do you approach it?",
    options:[
      {text:"Escalate to someone with authority over them.", score:1},
      {text:"Make the request clearly and explain why it matters.", score:2},
      {text:"Take time to understand what they are prioritising and find a way to connect my need to something they care about.", score:3},
      {text:"Invest in the relationship before I need something, understand their priorities and pressures, frame my request in terms of their interests, and make it easy for them to say yes.", score:4},
    ]},
  // E — Commercial Creativity: the less-with-more question
  { id:"E1a", cluster:"E", skill:"Commercial Creativity", tasterInsight:"how creatively you approach constraints",
    q:"You are asked to achieve the same outcome with significantly fewer resources than last time. What is your instinct?",
    options:[
      {text:"Push back — the ask is not realistic and delivering poorly serves nobody.", score:1},
      {text:"Accept the constraint and find ways to reduce scope to match the budget.", score:2},
      {text:"Accept the constraint and look for ways to redesign the approach so it delivers more value with less resource.", score:3},
      {text:"Treat the constraint as a design brief — use it to challenge every assumption about how the outcome is achieved, and look for approaches that the original resourcing level actually prevented.", score:4},
    ]},
];

// ── FULL QUESTION BANK (unchanged from v2) ──────────────────────────────────
const ALL_QUESTIONS = [
  // ─ PRESENCE ────────────────────────────────────────────────────────────────
  { id:"P1a",cluster:"P",skill:"Communication",type:"behavioural",
    q:"You need to explain a complex decision to a mixed audience — some technical, some not. What do you do?",
    options:[
      {text:"Present the full detail so everyone has the same information to work with.",score:1},
      {text:"Simplify the technical parts and offer to go deeper with anyone who wants it.",score:2},
      {text:"Lead with the decision and its implications, then layer in detail based on who is in the room.",score:3},
      {text:"Prepare two versions before walking in — one for each audience — and read the room to decide which to lead with.",score:4},
    ]},
  { id:"P1b",cluster:"P",skill:"Communication",type:"situational",
    q:"You are presenting a recommendation to leadership. Halfway through, you sense they have already made up their minds differently. What do you do?",
    options:[
      {text:"Finish the presentation as planned — the information needs to be heard.",score:1},
      {text:"Speed up and land the key points before you lose the room entirely.",score:2},
      {text:"Stop, name what you are sensing, and ask what their current thinking is before continuing.",score:3},
      {text:"Pivot immediately to the one thing that could shift their position, then invite the disagreement directly.",score:4},
    ]},
  { id:"P1c",cluster:"P",skill:"Communication",type:"reflective",
    q:"Think of the last time someone told you they did not understand something you explained. What was your honest reaction?",
    options:[
      {text:"Frustration — I had explained it clearly and they were not following.",score:1},
      {text:"I tried again using simpler words.",score:2},
      {text:"I stopped and asked what specifically was unclear, then rebuilt from there.",score:3},
      {text:"I treated it as a signal that my explanation was the problem, not their understanding — and redesigned it.",score:4},
    ]},
  { id:"P2a",cluster:"P",skill:"Negotiation",type:"behavioural",
    q:"Before entering a significant negotiation — salary, contract, or partnership — what do you actually do to prepare?",
    options:[
      {text:"I know what I want and I go in ready to ask for it.",score:1},
      {text:"I research what is reasonable and prepare to justify my position.",score:2},
      {text:"I research both sides — what I need and what they likely care about — before deciding my opening.",score:3},
      {text:"I map the full negotiation landscape: their interests, my interests, what I will trade, what I will not, and what my walk-away position is — before the conversation starts.",score:4},
    ]},
  { id:"P2b",cluster:"P",skill:"Negotiation",type:"situational",
    q:"You are negotiating a contract and the other party comes in significantly below what you expected. What is your move?",
    options:[
      {text:"Tell them it is too low and state what you actually need.",score:1},
      {text:"Counter with your number and explain why it is justified.",score:2},
      {text:"Ask what is driving their number before responding — there may be a constraint you can work around.",score:3},
      {text:"Acknowledge the gap, probe for the interest behind their position, then explore whether there are variables other than price that could close it.",score:4},
    ]},
  { id:"P2c",cluster:"P",skill:"Negotiation",type:"reflective",
    q:"Describe a negotiation you lost or where you settled for less than you wanted. What actually went wrong?",
    options:[
      {text:"The other side was more prepared or had more leverage than I did.",score:1},
      {text:"I did not anchor high enough at the start.",score:2},
      {text:"I did not fully understand what they valued most, so I could not find the trade that would have worked for both of us.",score:3},
      {text:"I had not clearly defined my walk-away position before going in, which meant I did not recognise the moment I should have walked.",score:4},
    ]},
  { id:"P3a",cluster:"P",skill:"Personal Brand & Executive Presence",type:"behavioural",
    q:"How would someone who does not know you professionally — but can see your digital presence — describe what you stand for?",
    options:[
      {text:"They would see my job title and where I work, not much more.",score:1},
      {text:"They would get a general sense of my industry and some of what I think.",score:2},
      {text:"They would have a clear picture of my expertise and the kind of professional I am.",score:3},
      {text:"They would know exactly what I stand for, what I have done, and why they should want me in a room — before they have ever met me.",score:4},
    ]},
  { id:"P3b",cluster:"P",skill:"Personal Brand & Executive Presence",type:"situational",
    q:"You walk into a room where you know nobody and the stakes are high — a client pitch, a senior leadership meeting, a major conference. How do you show up?",
    options:[
      {text:"I wait to be introduced and let the conversation come to me.",score:1},
      {text:"I introduce myself and make sure people know my role.",score:2},
      {text:"I research who will be in the room beforehand and arrive with a clear sense of who I want to connect with and how.",score:3},
      {text:"I walk in knowing exactly what impression I want to leave and how I will create it — through how I enter, who I approach first, what I say, and how I listen.",score:4},
    ]},
  { id:"P3c",cluster:"P",skill:"Personal Brand & Executive Presence",type:"reflective",
    q:"When did you last receive feedback about how you come across in a professional setting — and what did you do with it?",
    options:[
      {text:"I cannot recall specific feedback about this.",score:1},
      {text:"I have received some feedback and I keep it in mind.",score:2},
      {text:"I actively seek this kind of feedback and have made specific changes based on it.",score:3},
      {text:"I treat how I come across as a skill I deliberately practise and refine — I seek feedback regularly and track whether my changes are landing.",score:4},
    ]},
  // ─ RELATIONSHIPS ───────────────────────────────────────────────────────────
  { id:"R1a",cluster:"R",skill:"Emotional Intelligence",type:"behavioural",
    q:"You are in a high-pressure meeting and someone says something that genuinely irritates you. What actually happens next?",
    options:[
      {text:"I respond directly — suppressing a genuine reaction makes things worse, not better.",score:1},
      {text:"I stay quiet and address it after the meeting when things are calmer.",score:2},
      {text:"I notice the irritation, make a conscious decision not to act on it in the moment, and decide later whether it needs addressing.",score:3},
      {text:"I notice it, name — internally — what triggered it, regulate before responding, and make a deliberate choice about whether and how to address it based on what is actually useful.",score:4},
    ]},
  { id:"R1b",cluster:"R",skill:"Emotional Intelligence",type:"situational",
    q:"A colleague who is usually high-performing has become visibly disengaged over the past two weeks. Nobody else seems to have noticed. What do you do?",
    options:[
      {text:"Wait — they will address it if it becomes a problem.",score:1},
      {text:"Mention it to their manager so someone is aware.",score:2},
      {text:"Find a quiet moment to check in with them directly without making it feel like a performance conversation.",score:3},
      {text:"Check in privately, create genuine space for them to share what is happening, and think carefully about whether what they need is support, space, or something I can actually do.",score:4},
    ]},
  { id:"R1c",cluster:"R",skill:"Emotional Intelligence",type:"reflective",
    q:"Think of a time you handled a difficult emotion badly at work. What actually happened and what do you understand now that you did not then?",
    options:[
      {text:"I am not sure I have handled emotions badly — I generally keep things professional.",score:1},
      {text:"I can think of a time I reacted poorly. I would handle it differently now but I am not entirely sure how.",score:2},
      {text:"I can name the situation clearly. I now understand what triggered me and how I would regulate it earlier in the process.",score:3},
      {text:"I have a specific example and a clear analysis of what the trigger was, what the impact was, and the specific practice I have built since then to catch it earlier.",score:4},
    ]},
  { id:"R2a",cluster:"R",skill:"Conflict Resolution",type:"behavioural",
    q:"You are aware of unspoken tension between two members of your team that is starting to affect the group's performance. What do you do?",
    options:[
      {text:"Give it time — most tensions resolve themselves if you do not make them worse by interfering.",score:1},
      {text:"Mention it to each of them separately and hope it helps.",score:2},
      {text:"Speak to each person individually to understand what is happening, then create a structure for them to address it.",score:3},
      {text:"Have a deliberate sequence — understand each perspective privately, identify whether the root issue is relational or task-based, and design a specific conversation that surfaces it and moves toward resolution.",score:4},
    ]},
  { id:"R2b",cluster:"R",skill:"Conflict Resolution",type:"situational",
    q:"You are in a meeting where two senior people are in open disagreement and the conversation is starting to break down. You are not the most senior person in the room. What do you do?",
    options:[
      {text:"Stay quiet — it is not my place to intervene.",score:1},
      {text:"Try to redirect the conversation to the agenda to move things forward.",score:2},
      {text:"Name what is happening — that the conversation has broken down — and suggest a short pause or a reframe.",score:3},
      {text:"Find a moment to name the dynamic respectfully, separate the positions from the underlying interests, and redirect toward what both parties actually need from the outcome.",score:4},
    ]},
  { id:"R2c",cluster:"R",skill:"Conflict Resolution",type:"reflective",
    q:"Think of a workplace conflict you were involved in — directly or as a mediator. What made it difficult and what would you do differently now?",
    options:[
      {text:"Conflicts I have been in were mostly the other person's fault — I am generally reasonable.",score:1},
      {text:"I can think of one. It was difficult because emotions were high and I focused on being right rather than resolving it.",score:2},
      {text:"I understand clearly what made it difficult and what I would do differently — specifically, I would have gone to understand their position earlier and with more genuine curiosity.",score:3},
      {text:"I have a specific example with a clear analysis of what each party actually needed, where the conversation went wrong, and the precise intervention that would have resolved it sooner — which I have since used successfully in similar situations.",score:4},
    ]},
  { id:"R3a",cluster:"R",skill:"People Development",type:"behavioural",
    q:"Someone on your team makes a significant mistake on a piece of work that matters. What is your first move?",
    options:[
      {text:"Fix it — the priority is the outcome, not the learning moment.",score:1},
      {text:"Correct it and explain what they should have done differently.",score:2},
      {text:"Ask them to walk you through their thinking, then help them identify where it went wrong and what they would change.",score:3},
      {text:"Use it as a deliberate development moment — diagnosis of what happened, structured reflection, a specific action they take to close the gap, and a check-in to confirm the learning has landed.",score:4},
    ]},
  { id:"R3b",cluster:"R",skill:"People Development",type:"situational",
    q:"You have a team member who is highly capable but consistently underdelivering. Their potential is clear but something is blocking it. How do you approach this?",
    options:[
      {text:"Have a direct conversation about the performance gap and what needs to change.",score:1},
      {text:"Give them clearer direction and more structure to help them succeed.",score:2},
      {text:"Have a conversation that starts with genuine curiosity about what is happening for them — capability issues often have context that is not visible.",score:3},
      {text:"Treat it as a diagnostic challenge — separate capability from motivation from context, identify which is actually the blocker, and design a specific intervention for that root cause.",score:4},
    ]},
  { id:"R3c",cluster:"R",skill:"People Development",type:"reflective",
    q:"Who is the person whose professional growth you are most proud to have contributed to? What specifically did you do?",
    options:[
      {text:"I have supported people but I am not sure I can point to specific growth I caused.",score:1},
      {text:"I can name someone. I gave them opportunities and encouragement.",score:2},
      {text:"I can name someone and describe specific things I did — feedback I gave, decisions I made — that I can trace to their growth.",score:3},
      {text:"I can name someone, describe the specific capability gaps I identified, the deliberate interventions I designed for them, and the measurable difference in their performance and trajectory.",score:4},
    ]},
  { id:"R4a",cluster:"R",skill:"Stakeholder Management",type:"behavioural",
    q:"You are about to lead a significant new initiative that will require the support of people across multiple functions. Where do you start?",
    options:[
      {text:"Start the work and bring stakeholders in as they become relevant.",score:1},
      {text:"Brief the key stakeholders and make sure they know what is happening.",score:2},
      {text:"Map who needs to be involved, understand what each person cares about, and sequence conversations accordingly before work begins.",score:3},
      {text:"Build a stakeholder influence map — interests, concerns, level of support needed — then create a deliberate alignment sequence that builds momentum before I need it.",score:4},
    ]},
  { id:"R4b",cluster:"R",skill:"Stakeholder Management",type:"situational",
    q:"You are mid-way through a project when a senior stakeholder who was supportive at the start suddenly becomes resistant. What do you do?",
    options:[
      {text:"Continue and hope their position changes when they see progress.",score:1},
      {text:"Escalate to your manager to help manage the relationship.",score:2},
      {text:"Request a direct conversation to understand what has shifted and address it.",score:3},
      {text:"Request a conversation, go in with genuine curiosity about what has changed for them, and work to understand whether the issue is about the project itself, how it is being run, or something external that has shifted their priorities.",score:4},
    ]},
  { id:"R4c",cluster:"R",skill:"Stakeholder Management",type:"reflective",
    q:"Tell me about a time a project you were leading stalled or failed because of a relationship or political dynamic you did not manage well enough. What did you miss?",
    options:[
      {text:"I cannot think of a project that failed for this reason.",score:1},
      {text:"Something comes to mind. I did not communicate enough with a key person and lost their support.",score:2},
      {text:"I have a clear example. I underestimated someone's concerns, did not address them early enough, and paid for it later.",score:3},
      {text:"I have a specific example with a precise analysis of what I misread — whose influence I underestimated, what they actually needed that I failed to deliver, and the specific mapping practice I now use to prevent it recurring.",score:4},
    ]},
  // ─ INTELLIGENCE ────────────────────────────────────────────────────────────
  { id:"I1a",cluster:"I",skill:"Critical Thinking",type:"behavioural",
    q:"Your most respected colleague presents data that strongly supports a decision the team is excited about. You notice something in the analysis that does not add up. What do you actually do?",
    options:[
      {text:"Trust the analysis — they are more experienced than me and the team is aligned.",score:1},
      {text:"Mention it quietly to the colleague after the meeting.",score:2},
      {text:"Raise it in the room — the decision should not be made on flawed data regardless of who produced it.",score:3},
      {text:"Raise it specifically and constructively — naming what I noticed, why it matters to the decision, and asking the question that forces the analysis to be interrogated properly.",score:4},
    ]},
  { id:"I1b",cluster:"I",skill:"Critical Thinking",type:"situational",
    q:"You are asked to validate a business case that has already been signed off by leadership. You find assumptions that seem optimistic. What do you do?",
    options:[
      {text:"Validate it — it has already been approved and raising issues now will cause problems.",score:1},
      {text:"Flag the assumptions informally to the person who asked me to validate it.",score:2},
      {text:"Document the specific assumptions, stress-test them, and present a clear view of the risk they create — even though the case is already approved.",score:3},
      {text:"Treat the validation as genuinely independent — stress-test every assumption, model the downside scenarios, and present a complete picture including what the decision looks like if the optimistic assumptions are wrong.",score:4},
    ]},
  { id:"I1c",cluster:"I",skill:"Critical Thinking",type:"reflective",
    q:"When did you last genuinely change your mind about something important at work — not just update a detail, but shift your position entirely? What caused it?",
    options:[
      {text:"I generally land in the right place from the start, so complete reversals are rare.",score:1},
      {text:"I can think of something. Someone made a strong argument and I updated my view.",score:2},
      {text:"I have a clear example. I encountered evidence that contradicted my position and I worked through it seriously before updating my view.",score:3},
      {text:"I have a specific example. I had a position I held confidently, encountered disconfirming evidence I initially resisted, worked through what was actually true, and updated my position — and I can trace the specific reasoning that moved me.",score:4},
    ]},
  { id:"I2a",cluster:"I",skill:"Strategic Thinking",type:"behavioural",
    q:"You are given a task that is clearly important to your manager. Before starting, what goes through your mind?",
    options:[
      {text:"How to do it well and on time.",score:1},
      {text:"How this connects to the team's current priorities.",score:2},
      {text:"How this fits into the broader goal, who will use the output, and what success actually looks like beyond task completion.",score:3},
      {text:"How this task connects to the longer-term direction, what decisions it will enable or constrain, what the second-order consequences are, and whether this is actually the right task to be doing.",score:4},
    ]},
  { id:"I2b",cluster:"I",skill:"Strategic Thinking",type:"situational",
    q:"Your organisation is about to launch a new product. You are not in the leadership team but you can see a market dynamic that makes the timing risky. What do you do?",
    options:[
      {text:"Trust that leadership has thought through the timing — they have more context than I do.",score:1},
      {text:"Mention my concern to my manager and leave it with them.",score:2},
      {text:"Prepare a clear, evidence-based view of the risk and find the right channel to get it into the decision.",score:3},
      {text:"Prepare a structured analysis — what I am seeing, why it matters, what the alternatives are, and what I would recommend — and proactively find the decision-maker it needs to reach.",score:4},
    ]},
  { id:"I2c",cluster:"I",skill:"Strategic Thinking",type:"reflective",
    q:"Describe a decision you made that looked correct in the short term but created a problem further down the line. What did you not see at the time?",
    options:[
      {text:"Most of my decisions hold up well over time — I cannot think of a clear example.",score:1},
      {text:"Something comes to mind. I focused on the immediate problem and did not think far enough ahead.",score:2},
      {text:"I have a clear example. I optimised for the near term and did not trace the downstream consequences.",score:3},
      {text:"I have a specific example with a clear analysis of the second-order consequence I missed, why I missed it, and the thinking practice I now use to systematically surface those consequences before deciding.",score:4},
    ]},
  { id:"I3a",cluster:"I",skill:"Business Acumen",type:"behavioural",
    q:"If someone asked you to explain how your current or most recent organisation actually makes money — the mechanics of it — how confident are you in your answer?",
    options:[
      {text:"I know what we do and roughly what we charge — beyond that I am not certain.",score:1},
      {text:"I understand our core revenue model and the main things we spend money on.",score:2},
      {text:"I can walk through the revenue model, the key cost drivers, and where the margin is actually made.",score:3},
      {text:"I can explain the unit economics, the key metrics, where value is created and where it is destroyed, how my role connects to commercial outcomes, and what the strategic levers are.",score:4},
    ]},
  { id:"I3b",cluster:"I",skill:"Business Acumen",type:"situational",
    q:"You are proposing a new initiative that will require investment. A finance leader asks you to walk them through the commercial case. How prepared are you?",
    options:[
      {text:"I can explain what the initiative does and why it is important.",score:1},
      {text:"I can explain the cost and the expected benefit at a high level.",score:2},
      {text:"I can present the cost, projected return, key assumptions, and the timeline to value.",score:3},
      {text:"I can present a fully worked commercial case — cost, return, assumptions with ranges, downside scenarios, payback period, and the metrics I would use to track whether it is working.",score:4},
    ]},
  { id:"I3c",cluster:"I",skill:"Business Acumen",type:"reflective",
    q:"Describe a decision you made — or contributed to — that had a meaningful commercial impact. How did you think about it at the time?",
    options:[
      {text:"Most of my decisions are not directly commercial — I focus on my functional area.",score:1},
      {text:"I can think of something. I made a call that saved costs or generated value, though I did not formally model it.",score:2},
      {text:"I have a clear example where I thought through the commercial implications deliberately before deciding.",score:3},
      {text:"I have a specific example where I built the commercial case, modelled the options, and made a recommendation based on financial reasoning — and I can trace what the outcome was against what I projected.",score:4},
    ]},
  { id:"I4a",cluster:"I",skill:"AI Fluency",type:"behavioural",futureReady:true,
    q:"How have you actually changed how you work because of AI — not in theory, but in practice?",
    options:[
      {text:"I have not made significant changes yet — I am still figuring out where AI fits.",score:1},
      {text:"I have added AI to some tasks at the edges of my work but my core workflow is the same.",score:2},
      {text:"I have deliberately redesigned parts of my workflow around AI — deciding what to delegate and what to keep — and I have seen a real change in what I can produce.",score:3},
      {text:"I have comprehensively redesigned how I work around the human-AI boundary. I can name precisely which tasks I have moved to AI, what I have protected as human, and how that has changed the nature and quality of my output.",score:4},
    ]},
  { id:"I4b",cluster:"I",skill:"AI Fluency",type:"situational",futureReady:true,
    q:"Your organisation is considering using AI to replace a process your team currently owns. Some colleagues are alarmed. What is your response?",
    options:[
      {text:"Agree with colleagues — AI should not replace human judgment in this area.",score:1},
      {text:"Stay neutral and wait for leadership to decide how to handle it.",score:2},
      {text:"Think through what AI can genuinely do well in the process versus what requires human judgment — and make a reasoned case for which parts should and should not change.",score:3},
      {text:"Map the process in detail, evaluate AI capability against each component, identify what is genuinely automatable versus what requires human capability, develop a position on the right human-AI split, and present it — with the change management considerations — before the decision is made without that analysis.",score:4},
    ]},
  { id:"I4c",cluster:"I",skill:"AI Fluency",type:"reflective",futureReady:true,
    q:"What is your honest assessment of how AI-ready you are as a professional right now?",
    options:[
      {text:"I am still catching up — I know AI is important but I have not prioritised developing real fluency.",score:1},
      {text:"I use AI tools and I am broadly aware of what they can do, but I would not call myself genuinely fluent.",score:2},
      {text:"I have developed real working fluency — I know what AI can and cannot do in my field, and I have redesigned meaningful parts of how I work around it.",score:3},
      {text:"I am ahead of most of my peers. I have deep working fluency, a clear model of the human-AI boundary in my domain, and I am actively building the capabilities that will matter most as AI changes what my role requires.",score:4},
    ]},
  // ─ MASTERY ─────────────────────────────────────────────────────────────────
  { id:"M1a",cluster:"M",skill:"Execution & Accountability",type:"behavioural",
    q:"You take on a commitment and then realise it is going to be harder than you thought. What do you do?",
    options:[
      {text:"Push through — I do not like to go back on a commitment.",score:1},
      {text:"Flag early that it may be harder than expected, then push through.",score:2},
      {text:"Re-scope immediately — flag the constraint, propose an adjusted plan, and get alignment before it becomes a problem.",score:3},
      {text:"Treat it as a systems question — what changed between when I committed and now, what does that mean for the delivery, what are the options, and what do I need from others to either deliver as committed or renegotiate intelligently.",score:4},
    ]},
  { id:"M1b",cluster:"M",skill:"Execution & Accountability",type:"situational",
    q:"A deadline you committed to is at serious risk — partly because of factors outside your control, partly because of your own planning. What do you do?",
    options:[
      {text:"Focus everything on delivery and explain what happened afterwards.",score:1},
      {text:"Flag the risk early, explain the external factors, and ask for an extension.",score:2},
      {text:"Flag the risk early, take ownership of your part in it, propose a specific revised plan, and deliver against the new commitment.",score:3},
      {text:"Flag the risk at the earliest signal — not when it is certain — own your contribution without defensiveness, present options with trade-offs, get alignment on the path forward, and build the lesson into how you plan next time.",score:4},
    ]},
  { id:"M1c",cluster:"M",skill:"Execution & Accountability",type:"reflective",
    q:"Tell me about a time you let someone down professionally — you missed something, dropped a ball, or did not deliver what you committed to. How did you handle it?",
    options:[
      {text:"It was difficult. I explained what happened and apologised.",score:1},
      {text:"I acknowledged it, took responsibility, and focused on fixing the situation as quickly as possible.",score:2},
      {text:"I took clear accountability — no deflection — fixed what I could, and had an honest conversation about what happened and what I was changing to prevent it.",score:3},
      {text:"I took immediate accountability without defensiveness, fixed the situation, had a specific conversation about what went wrong and what would be different, and have since treated this as one of the more formative professional moments I can point to.",score:4},
    ]},
  { id:"M2a",cluster:"M",skill:"Resilience & Self-Leadership",type:"behavioural",
    q:"You receive significant criticism on work you were proud of — from someone whose judgment you respect. How do you respond?",
    options:[
      {text:"It is hard not to feel defensive, but I listen and take notes.",score:1},
      {text:"I try to separate the emotional response from the content and focus on what is useful.",score:2},
      {text:"I manage the immediate emotional response, engage seriously with the content of the criticism, and identify what is genuinely useful versus what may reflect the critic's own context.",score:3},
      {text:"I have a practised approach — notice the emotional response without acting on it, engage with the criticism rigorously, distinguish between what is accurate and what is not, take what is useful without internalising the rest, and use it to produce something better.",score:4},
    ]},
  { id:"M2b",cluster:"M",skill:"Resilience & Self-Leadership",type:"situational",
    q:"A project you led publicly failed — the outcome was visible, the impact was real, and people noticed. How do you respond?",
    options:[
      {text:"I focus on moving forward — dwelling on failure is not useful.",score:1},
      {text:"I do a debrief, understand what went wrong, and try not to repeat it.",score:2},
      {text:"I do a thorough analysis of what failed and why, take clear accountability for my role in it, and make specific changes to how I work.",score:3},
      {text:"I treat it as signal-rich data — rigorous analysis of what happened and why, clear accountability for what was mine, specific changes to practice, and deliberate use of the experience to build credibility by showing how I handle failure.",score:4},
    ]},
  { id:"M2c",cluster:"M",skill:"Resilience & Self-Leadership",type:"reflective",
    q:"When have you felt closest to burnout or genuinely overwhelmed at work — and what did you actually do about it?",
    options:[
      {text:"I push through — stopping is not an option when things need to get done.",score:1},
      {text:"I have felt it. I tried to manage by working smarter but mostly just pushed through.",score:2},
      {text:"I have a clear example. I recognised the warning signs, made deliberate changes to my load and my recovery, and learned something about my own limits from it.",score:3},
      {text:"I have a specific example and a clear model of my own sustainability — the conditions under which I can sustain high performance and the signals that tell me I am approaching the limit. I manage proactively now rather than waiting for the crisis.",score:4},
    ]},
  { id:"M3a",cluster:"M",skill:"Adaptability",type:"behavioural",
    q:"A significant change is announced at work — restructure, new leadership, major strategic pivot. What is your typical response in the first 48 hours?",
    options:[
      {text:"I try to understand how it affects me and what I need to do differently.",score:1},
      {text:"I focus on what is stable and try not to overreact while things settle.",score:2},
      {text:"I process the change quickly, identify what it means for my work and my team, and move into useful action rather than waiting for clarity that may not come.",score:3},
      {text:"I move fast into sense-making — what has changed, what has not, what it means for priorities, what it means for relationships — and I try to be a stabilising presence for others while moving productively myself.",score:4},
    ]},
  { id:"M3b",cluster:"M",skill:"Adaptability",type:"situational",
    q:"You are three months into a new role and realise the job is significantly different from what was described. The gap is real and the environment is harder than expected. What do you do?",
    options:[
      {text:"Give it more time — adjusting takes longer than three months.",score:1},
      {text:"Have an honest conversation with your manager about the gap between what was described and what the role actually is.",score:2},
      {text:"Audit what is working and what is not, have a frank conversation with your manager, and design a specific plan to either close the gap or renegotiate the scope.",score:3},
      {text:"Treat the gap as a design problem — map what the role requires versus what you brought in expecting, identify where you can close the gap through learning, where you need support, and where the role design itself may need to change — and have a structured conversation that addresses all three.",score:4},
    ]},
  { id:"M3c",cluster:"M",skill:"Adaptability",type:"reflective",
    q:"Describe a time when the rules changed significantly in the middle of something you were doing — the context shifted, the goalposts moved, the priorities changed. What happened?",
    options:[
      {text:"I find mid-course changes genuinely disruptive — I do better with stability.",score:1},
      {text:"I adapted, though it was frustrating. I wish there had been better communication about the change.",score:2},
      {text:"I have a clear example. I processed the change quickly, adjusted my plan, and kept the team moving without losing too much momentum.",score:3},
      {text:"I have a specific example where the change was significant and the pressure was high. I can trace exactly how I processed it, what I protected, what I let go, how I kept others aligned, and what it demonstrated about how I work under ambiguity.",score:4},
    ]},
  // ─ ENTERPRISE ──────────────────────────────────────────────────────────────
  { id:"E1a",cluster:"E",skill:"Commercial Creativity",type:"behavioural",
    q:"You are asked to achieve the same outcome with significantly fewer resources than last time. What is your instinct?",
    options:[
      {text:"Push back — the ask is not realistic and delivering poorly serves nobody.",score:1},
      {text:"Accept the constraint and find ways to reduce scope to match the budget.",score:2},
      {text:"Accept the constraint and look for ways to redesign the approach so it delivers more value with less resource.",score:3},
      {text:"Treat the constraint as a design brief — use it to challenge every assumption about how the outcome is achieved, and look for approaches that the original resourcing level actually prevented.",score:4},
    ]},
  { id:"E1b",cluster:"E",skill:"Commercial Creativity",type:"situational",
    q:"Your team is stuck on a problem that has not moved in weeks. The conventional approaches have all been tried. What do you do?",
    options:[
      {text:"Escalate — if the team cannot solve it, someone with more authority needs to step in.",score:1},
      {text:"Bring in fresh eyes — someone from outside the team may see something we have missed.",score:2},
      {text:"Deliberately reframe the problem — challenge the assumptions underneath how the problem has been defined and see if there is a different version of it that is more solvable.",score:3},
      {text:"Run a structured reframe — surface every assumption embedded in how the problem has been framed, challenge each one, look for the version of the problem that the current framing is preventing us from seeing, and rebuild the solution approach from there.",score:4},
    ]},
  { id:"E1c",cluster:"E",skill:"Commercial Creativity",type:"reflective",
    q:"Tell me about an idea you originated, developed, and drove to implementation. What happened?",
    options:[
      {text:"I have contributed to ideas in teams but I find it hard to point to something that was mine from start to finish.",score:1},
      {text:"I have had ideas that were adopted, though I needed others to help drive them.",score:2},
      {text:"I have a clear example of an idea I originated, developed into a real proposal, and drove to implementation with measurable impact.",score:3},
      {text:"I have a specific example including where the insight came from, how I developed it into something compelling, who I had to persuade, how I navigated the resistance, and what the actual outcome was.",score:4},
    ]},
  { id:"E2a",cluster:"E",skill:"Influence Without Authority",type:"behavioural",
    q:"You need the cooperation of someone who does not report to you — and they are currently not prioritising what you need. How do you approach it?",
    options:[
      {text:"Escalate to someone with authority over them.",score:1},
      {text:"Make the request clearly and explain why it matters.",score:2},
      {text:"Take time to understand what they are prioritising and find a way to connect my need to something they care about.",score:3},
      {text:"Invest in the relationship before I need something, understand their priorities and pressures, frame my request in terms of their interests, and make it easy for them to say yes.",score:4},
    ]},
  { id:"E2b",cluster:"E",skill:"Influence Without Authority",type:"situational",
    q:"You have an idea you believe strongly in but it needs the support of three people who are currently indifferent or mildly resistant. How do you build the coalition?",
    options:[
      {text:"Present the idea to all three at once and make the strongest possible case.",score:1},
      {text:"Start with the most sympathetic person and use their support to help with the others.",score:2},
      {text:"Meet with each person separately first, understand their specific concerns, and tailor the conversation to what each person needs to hear before bringing them together.",score:3},
      {text:"Map each person's interests and concerns, sequence the conversations deliberately to build momentum, address each person's specific objection with something that genuinely resolves it, and bring them together only when alignment is already close.",score:4},
    ]},
  { id:"E2c",cluster:"E",skill:"Influence Without Authority",type:"reflective",
    q:"Tell me about a time you moved something forward — a decision, a project, an outcome — that you had no formal authority to push. What did you actually do?",
    options:[
      {text:"I generally work through the proper channels rather than trying to influence things outside my remit.",score:1},
      {text:"I can think of a time I pushed something forward. I made the case and eventually people came around.",score:2},
      {text:"I have a clear example. I mapped who mattered, had deliberate conversations, and built enough support to move it.",score:3},
      {text:"I have a specific example including the stakeholder map I built, how I sequenced the conversations, what I offered each person to secure their support, and how I maintained momentum through the resistance.",score:4},
    ]},
  { id:"E3a",cluster:"E",skill:"Human-AI Collaboration",type:"behavioural",futureReady:true,
    q:"How have you actually changed how you work because of AI — not in theory, but in practice?",
    options:[
      {text:"I have not made significant changes yet — I am still figuring out where AI fits.",score:1},
      {text:"I have added AI to some tasks at the edges of my work but my core workflow is the same.",score:2},
      {text:"I have deliberately redesigned parts of my workflow around AI — deciding what to delegate and what to keep — and I have seen a real change in what I can produce.",score:3},
      {text:"I have comprehensively redesigned how I work around the human-AI boundary. I can name precisely which tasks I have moved to AI, what I have protected as human, and how that has changed the nature and quality of my output.",score:4},
    ]},
  { id:"E3b",cluster:"E",skill:"Human-AI Collaboration",type:"situational",futureReady:true,
    q:"Your organisation is introducing AI tools across your function. Some colleagues are resisting, others are adopting everything uncritically. What is your position?",
    options:[
      {text:"I will wait to see how it settles before changing how I work.",score:1},
      {text:"I will adopt the tools that seem useful and avoid the ones that feel like they are replacing important work.",score:2},
      {text:"I will think through each tool systematically — what it does well, what risks it creates, what it should and should not be used for — and develop a clear position for myself and my team.",score:3},
      {text:"I will lead the thinking in my function — map specific decisions against AI capability, define clear principles for what stays human and why, help colleagues build genuine fluency, and establish governance that protects quality.",score:4},
    ]},
  { id:"E3c",cluster:"E",skill:"Human-AI Collaboration",type:"reflective",futureReady:true,
    q:"What do you think is genuinely irreplaceable about what you bring to your work — the thing AI cannot do, even in principle?",
    options:[
      {text:"Honestly, I am not certain what AI cannot eventually do that I currently do.",score:1},
      {text:"I think relationships and judgment are areas where humans will remain essential.",score:2},
      {text:"I have a clear view of where my value lies that AI cannot replicate — specific types of judgment, contextual knowledge, or relational work that requires genuine human presence.",score:3},
      {text:"I have a precise and reasoned answer — what I bring that AI cannot replicate structurally, why those things matter commercially, and how I am investing in deepening exactly those capabilities because they will become more valuable as AI commoditises the rest.",score:4},
    ]},
  // ─ VALIDITY ANCHORS ────────────────────────────────────────────────────────
  { id:"VA1",cluster:"VA",skill:"Validity",type:"anchor",
    q:"When you receive feedback from someone you respect, your first response is always to implement it immediately.",
    validAnchor:true, correctAnswer:3,
    options:[
      {text:"Yes — if someone I respect has taken the time to give feedback, the right response is to act on it.",score:1},
      {text:"Almost always — I occasionally push back if something seems wrong but I default to implementation.",score:2},
      {text:"Not always — I evaluate the feedback first, even from people I respect, because good feedback still needs to fit the context.",score:4},
      {text:"Rarely — feedback is one data point and I weigh it carefully against my own judgment.",score:2},
    ]},
  { id:"VA2",cluster:"VA",skill:"Validity",type:"anchor",
    q:"You always know exactly what is driving your emotions in a professional setting.",
    validAnchor:true, correctAnswer:3,
    options:[
      {text:"Yes — self-awareness is something I have worked hard to develop and I have strong insight into my emotional drivers.",score:1},
      {text:"Usually — I sometimes need time to understand what is driving a strong reaction.",score:2},
      {text:"Not always — emotions in complex situations are not always immediately legible even with strong self-awareness.",score:4},
      {text:"Rarely — I am not naturally introspective about this.",score:1},
    ]},
  { id:"VA3",cluster:"VA",skill:"Validity",type:"anchor",
    q:"In a negotiation, you always get the outcome you want when you prepare thoroughly.",
    validAnchor:true, correctAnswer:3,
    options:[
      {text:"Yes — thorough preparation is the difference between winning and losing a negotiation.",score:1},
      {text:"Usually — preparation significantly increases my success rate.",score:2},
      {text:"Often but not always — even excellent preparation cannot overcome every structural disadvantage.",score:3},
      {text:"Not always — preparation is essential but negotiation also depends on the other party's interests and constraints, which you cannot fully control.",score:4},
    ]},
  { id:"VA4",cluster:"VA",skill:"Validity",type:"anchor",
    q:"You always know in advance how long a task will take you.",
    validAnchor:true, correctAnswer:3,
    options:[
      {text:"Yes — I have good self-knowledge about my working pace and I plan accordingly.",score:1},
      {text:"Usually — I am generally accurate though complex tasks can run over.",score:2},
      {text:"Often but not always — novel or complex tasks are genuinely hard to estimate accurately even with experience.",score:3},
      {text:"No — task duration is too variable to predict reliably.",score:2},
    ]},
];

// ── BUILD FULL QUESTION SEQUENCE (with validity anchors interleaved) ─────────
function buildQuestionSequence() {
  const scored = ALL_QUESTIONS.filter(q => q.cluster !== "VA");
  const anchors = ALL_QUESTIONS.filter(q => q.cluster === "VA");
  const seq = [...scored];
  const positions = [13, 27, 41, 55];
  anchors.forEach((a, i) => { seq.splice(positions[i], 0, a); });
  return seq;
}

const QUESTIONS = buildQuestionSequence();
const TOTAL = QUESTIONS.length;
const TASTER_TOTAL = TASTER_QUESTIONS.length;

// ── TASTER SCORING ──────────────────────────────────────────────────────────
function computeTasterResult(answers) {
  const clusterScores = { P:0, R:0, I:0, M:0, E:0 };
  const clusterCounts = { P:0, R:0, I:0, M:0, E:0 };

  TASTER_QUESTIONS.forEach((q, idx) => {
    const chosen = answers[idx];
    if (chosen === undefined) return;
    const score = q.options[chosen].score;
    clusterScores[q.cluster] += score;
    clusterCounts[q.cluster]++;
  });

  // Normalise: max per question = 4, so max per cluster with 1-2 questions varies
  const normalisedScores = {};
  CLUSTERS.forEach(c => {
    const count = clusterCounts[c.id] || 1;
    normalisedScores[c.id] = Math.round((clusterScores[c.id] / (count * 4)) * 100);
  });

  const sorted = [...CLUSTERS].sort((a,b) => normalisedScores[b.id] - normalisedScores[a.id]);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const secondWeakest = sorted[sorted.length - 2];

  // Build personalised insight per cluster
  const insights = {
    P: {
      high: "Your Presence score is strong — the way you communicate and show up in high-stakes moments is a genuine asset. This is what makes you hard to ignore when it counts.",
      low: "Your Presence cluster shows the most room to grow. How you show up in key moments — in a pitch, in a leadership meeting, in a negotiation — is shaping how others assess your capability before they see the substance."
    },
    R: {
      high: "Your Relationships cluster is your strongest signal — you understand people, manage dynamics well, and know how to build the alliances that make things move.",
      low: "Your Relationships cluster is your biggest development opportunity. The gap between talent and progression is often relational — who backs you, who knows you, who trusts you to lead."
    },
    I: {
      high: "Your Intelligence cluster is where you shine — you think in systems, question assumptions, and make commercially grounded decisions. That is rare.",
      low: "Your Intelligence cluster has the most room to grow. Strategic thinking and commercial acumen are the skills that move professionals from execution to leadership — and they are learnable."
    },
    M: {
      high: "Your Mastery cluster is strong — you deliver, you hold yourself accountable, and you adapt when things change. That reliability is the foundation everything else is built on.",
      low: "Your Mastery cluster is your highest-leverage development area. Delivery, accountability, and resilience under pressure are what separate professionals who are trusted with bigger mandates from those who are not."
    },
    E: {
      high: "Your Enterprise cluster stands out — you influence without authority, you think creatively about constraints, and you are comfortable in the ambiguous space where new things get made.",
      low: "Your Enterprise cluster shows real development potential. The ability to move things without formal authority and to find creative paths through constraints is what distinguishes professionals who lead change from those who execute it."
    },
  };

  return { normalisedScores, strongest, weakest, secondWeakest, insights };
}

// ── FULL SCORING ENGINE (unchanged from v2) ──────────────────────────────────
function computeResults(answers, timings) {
  const clusterRaw = { P:0, R:0, I:0, M:0, E:0 };
  const clusterCounts = { P:0, R:0, I:0, M:0, E:0 };
  const clusterAllScores = { P:[], R:[], I:[], M:[], E:[] };

  QUESTIONS.forEach((q, idx) => {
    if (q.cluster === "VA") return;
    const chosen = answers[idx];
    if (chosen === undefined) return;
    const score = q.options[chosen].score;
    clusterRaw[q.cluster] += score;
    clusterCounts[q.cluster]++;
    clusterAllScores[q.cluster].push(score);
  });

  const clusterScores = {};
  CLUSTERS.forEach(c => {
    const raw = clusterRaw[c.id];
    clusterScores[c.id] = Math.round((raw / c.maxRaw) * 100);
  });

  let valudRaw = 0;
  CLUSTERS.forEach(c => { valudRaw += clusterScores[c.id] * c.weight; });
  let valuIndex = Math.round(valudRaw);

  const consistencyFlags = {};
  CLUSTERS.forEach(c => {
    const scores = clusterAllScores[c.id];
    if (scores.length < 2) return;
    const mean = scores.reduce((a,b) => a+b, 0) / scores.length;
    const sd = Math.sqrt(scores.reduce((a,b) => a + (b-mean)**2, 0) / scores.length);
    if (sd > 1.2) {
      consistencyFlags[c.id] = true;
      clusterScores[c.id] = Math.round(clusterScores[c.id] * 0.85);
    }
  });

  let valudRaw2 = 0;
  CLUSTERS.forEach(c => { valudRaw2 += clusterScores[c.id] * c.weight; });
  valuIndex = Math.round(valudRaw2);

  let anchorFlags = 0;
  QUESTIONS.forEach((q, idx) => {
    if (!q.validAnchor) return;
    const chosen = answers[idx];
    if (chosen === undefined) return;
    if (chosen === q.options.length - 1) anchorFlags++;
  });
  const gamingDetected = anchorFlags >= 3;
  if (gamingDetected) valuIndex = Math.round(valuIndex * 0.80);

  const answeredTimings = timings.filter(t => t > 0);
  const totalTime = answeredTimings.reduce((a,b) => a+b, 0);
  const fastAnswers = timings.filter(t => t > 0 && t < 8000).length;
  const speedFlag = totalTime < 720000 || fastAnswers >= 3;

  const desig = DESIGNATIONS.find(d => valuIndex >= d.min) || DESIGNATIONS[DESIGNATIONS.length-1];

  const frI = clusterAllScores.I.slice(-3);
  const frE = clusterAllScores.E.slice(-3);
  const frRaw = [...frI, ...frE].reduce((a,b) => a+b, 0);
  const futureReadyScore = Math.round((frRaw / 24) * 100);

  const sorted = [...CLUSTERS].sort((a,b) => clusterScores[b.id] - clusterScores[a.id]);

  return {
    valuIndex, clusterScores, desig, futureReadyScore,
    strongest: sorted[0], weakest: sorted[sorted.length-1],
    consistencyFlags, gamingDetected, anchorFlags, speedFlag,
    listed: valuIndex >= 35,
    pathway: valuIndex >= 80 ? "PCP Certification" : valuIndex >= 65 ? "PRIME Programme" : valuIndex >= 50 ? "PRIME Cluster" : "PRIME Sprint",
  };
}

// ── RADAR CHART ─────────────────────────────────────────────────────────────
function Radar({ scores, size = 200 }) {
  const cx = size/2, cy = size/2, r = size * 0.37, n = 5;
  const angle = i => (Math.PI*2*i/n) - Math.PI/2;
  const pt = (i, frac) => ({ x: cx + r*frac*Math.cos(angle(i)), y: cy + r*frac*Math.sin(angle(i)) });
  const gridPoly = frac => CLUSTERS.map((_,i) => { const p=pt(i,frac); return `${p.x},${p.y}`; }).join(" ");
  const dataPts = CLUSTERS.map((c,i) => pt(i, (scores[c.id]||0)/100));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible"}}>
      {[0.25,0.5,0.75,1].map(f => <polygon key={f} points={gridPoly(f)} fill="none" stroke={f===1?"rgba(201,168,76,0.4)":"rgba(201,168,76,0.15)"} strokeWidth={f===1?0.8:0.5}/>)}
      {CLUSTERS.map((_,i) => { const p=pt(i,1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(201,168,76,0.2)" strokeWidth={0.5}/>; })}
      <polygon points={dataPts.map(p=>`${p.x},${p.y}`).join(" ")} fill="rgba(201,168,76,0.15)" stroke={GOLD} strokeWidth={1.5} style={{transition:"all 0.5s"}}/>
      {dataPts.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={CLUSTERS[i].color} style={{transition:"all 0.5s"}}/>)}
      {CLUSTERS.map((c,i) => { const lp=pt(i,1.22); return <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central" style={{fontSize:10,fontWeight:600,fill:c.color}}>{c.id}</text>; })}
    </svg>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PRIMEAssessment() {
  // phase: "intro" | "taster" | "taster_results" | "assessing" | "results"
  const [phase, setPhase] = useState("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [tasterAnswers, setTasterAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [timings, setTimings] = useState(Array(TOTAL).fill(0));
  const [qStartTime, setQStartTime] = useState(null);
  const [results, setResults] = useState(null);
  const [tasterResults, setTasterResults] = useState(null);
  const [transitioning, setTransitioning] = useState(false);

  const isTaster = phase === "taster";
  const question = isTaster ? TASTER_QUESTIONS[currentQ] : QUESTIONS[currentQ];
  const total = isTaster ? TASTER_TOTAL : TOTAL;
  const progress = Math.round((currentQ / total) * 100);
  const cluster = CLUSTERS.find(c => c.id === question?.cluster);

  useEffect(() => {
    if (phase === "assessing" || phase === "taster") setQStartTime(Date.now());
  }, [currentQ, phase]);

  const liveScores = {};
  CLUSTERS.forEach(c => {
    const qs = QUESTIONS.filter((q,i) => q.cluster === c.id && answers[i] !== undefined);
    const raw = qs.reduce((s, q) => {
      const idx = QUESTIONS.indexOf(q);
      return s + (q.options[answers[idx]]?.score || 0);
    }, 0);
    liveScores[c.id] = Math.round((raw / c.maxRaw) * 100);
  });

  function handleSelect(optIdx) {
    if (transitioning) return;
    setSelected(optIdx);
  }

  function handleNext() {
    if (selected === null) return;
    const elapsed = qStartTime ? Date.now() - qStartTime : 0;

    if (isTaster) {
      const newAnswers = { ...tasterAnswers, [currentQ]: selected };
      setTasterAnswers(newAnswers);
      setTransitioning(true);
      setTimeout(() => {
        if (currentQ + 1 < TASTER_TOTAL) {
          setCurrentQ(currentQ + 1);
          setSelected(null);
          setTransitioning(false);
        } else {
          const r = computeTasterResult(newAnswers);
          setTasterResults(r);
          setPhase("taster_results");
          setCurrentQ(0);
          setSelected(null);
          setTransitioning(false);
        }
      }, 280);
    } else {
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
          const r = computeResults(newAnswers, newTimings);
          setResults(r);
          setPhase("results");
          setTransitioning(false);
        }
      }, 280);
    }
  }

  function handleBack() {
    if (currentQ === 0) return;
    const prevAnswers = isTaster ? tasterAnswers : answers;
    setSelected(prevAnswers[currentQ - 1] ?? null);
    setCurrentQ(currentQ - 1);
  }

  function restart() {
    setPhase("intro"); setCurrentQ(0);
    setAnswers({}); setTasterAnswers({});
    setSelected(null); setResults(null); setTasterResults(null);
    setName(""); setRole(""); setExperience("");
    setTimings(Array(TOTAL).fill(0));
  }

  function startFullAssessment() {
    setCurrentQ(0);
    setSelected(null);
    setAnswers({});
    setTimings(Array(TOTAL).fill(0));
    setPhase("assessing");
  }

  const base = { minHeight:"100vh", background:DARK, color:PARCHMENT, fontFamily:"'Georgia', serif", position:"relative", overflow:"hidden" };
  const grain = { position:"fixed", inset:0, pointerEvents:"none", zIndex:0, opacity:0.03,
    backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` };

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (phase === "intro") return (
    <div style={base}>
      <div style={grain}/>
      <div style={{position:"relative",zIndex:1,maxWidth:640,margin:"0 auto",padding:"48px 24px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{display:"inline-block",padding:"6px 18px",border:`1px solid rgba(201,168,76,0.3)`,borderRadius:2,marginBottom:28}}>
            <span style={{fontSize:11,letterSpacing:"0.2em",color:GOLD,fontFamily:"sans-serif"}}>VALORIA INSTITUTE  ·  AFRICAN TALENT BUREAU</span>
          </div>
          <h1 style={{fontSize:"clamp(40px,8vw,64px)",fontWeight:300,color:PARCHMENT,lineHeight:1.05,margin:"0 0 16px",letterSpacing:"-0.02em"}}>
            The <span style={{color:GOLD,fontStyle:"italic"}}>VALU</span> Index
          </h1>
          <p style={{fontSize:15,color:"rgba(247,244,238,0.55)",fontStyle:"italic",lineHeight:1.65,maxWidth:420,margin:"0 auto 12px"}}>
            Find out exactly where you stand — across five professional capability clusters — in under 5 minutes.
          </p>
          <p style={{fontSize:13,color:"rgba(247,244,238,0.35)",lineHeight:1.6,maxWidth:420,margin:"0 auto"}}>
            Start with a free 9-question taster. Get an instant insight into your strongest cluster and your biggest opportunity. Then take the full assessment for your complete VALU Index score and marketplace listing.
          </p>
        </div>

        {/* Two-path stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:32}}>
          <div style={{padding:"18px 16px",border:`1px solid rgba(201,168,76,0.2)`,borderRadius:4,background:"rgba(201,168,76,0.04)",textAlign:"center"}}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:"0.15em",fontFamily:"sans-serif",marginBottom:10,fontWeight:700}}>TASTER</div>
            {[["9","Questions"],["~5","Minutes"],["Free","Always"]].map(([n,l])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid rgba(201,168,76,0.08)"}}>
                <span style={{fontSize:12,color:"rgba(247,244,238,0.45)",fontFamily:"sans-serif"}}>{l}</span>
                <span style={{fontSize:16,color:GOLD,fontWeight:300}}>{n}</span>
              </div>
            ))}
            <div style={{marginTop:10,fontSize:11,color:"rgba(247,244,238,0.3)",fontFamily:"sans-serif",fontStyle:"italic"}}>Instant directional insight</div>
          </div>
          <div style={{padding:"18px 16px",border:`1px solid ${GOLD}`,borderRadius:4,background:"rgba(201,168,76,0.06)",textAlign:"center"}}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:"0.15em",fontFamily:"sans-serif",marginBottom:10,fontWeight:700}}>FULL VALU INDEX</div>
            {[["54","Questions"],["18–28","Minutes"],["12mo","Valid"]].map(([n,l])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid rgba(201,168,76,0.08)"}}>
                <span style={{fontSize:12,color:"rgba(247,244,238,0.45)",fontFamily:"sans-serif"}}>{l}</span>
                <span style={{fontSize:16,color:GOLD,fontWeight:300}}>{n}</span>
              </div>
            ))}
            <div style={{marginTop:10,fontSize:11,color:"rgba(247,244,238,0.3)",fontFamily:"sans-serif",fontStyle:"italic"}}>Full score + marketplace listing</div>
          </div>
        </div>

        {/* Details form */}
        <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid rgba(201,168,76,0.15)`,borderRadius:6,padding:28,marginBottom:28}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:"0.15em",fontFamily:"sans-serif",marginBottom:20}}>YOUR DETAILS</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={{fontSize:11,color:"rgba(247,244,238,0.4)",letterSpacing:"0.1em",display:"block",marginBottom:8,fontFamily:"sans-serif"}}>FULL NAME *</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"
                style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`1px solid rgba(201,168,76,0.2)`,borderRadius:3,padding:"12px 16px",color:PARCHMENT,fontSize:15,fontFamily:"Georgia,serif",outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"rgba(247,244,238,0.4)",letterSpacing:"0.1em",display:"block",marginBottom:8,fontFamily:"sans-serif"}}>CURRENT ROLE</label>
              <input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Senior Marketing Manager"
                style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`1px solid rgba(201,168,76,0.2)`,borderRadius:3,padding:"12px 16px",color:PARCHMENT,fontSize:15,fontFamily:"Georgia,serif",outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"rgba(247,244,238,0.4)",letterSpacing:"0.1em",display:"block",marginBottom:8,fontFamily:"sans-serif"}}>YEARS OF EXPERIENCE</label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                {EXPERIENCE_BANDS.map(b => (
                  <button key={b.id} onClick={()=>setExperience(b.id)}
                    style={{padding:"10px 14px",background:experience===b.id?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.03)",border:`1px solid ${experience===b.id?GOLD:"rgba(201,168,76,0.2)"}`,borderRadius:3,cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}>
                    <div style={{fontSize:13,color:experience===b.id?GOLD:PARCHMENT,fontFamily:"sans-serif",marginBottom:2}}>{b.label}</div>
                    <div style={{fontSize:10,color:"rgba(247,244,238,0.35)",fontFamily:"sans-serif"}}>{b.desc}</div>
                  </button>
                ))}
              </div>
              <p style={{fontSize:11,color:"rgba(247,244,238,0.25)",marginTop:8,fontFamily:"sans-serif",fontStyle:"italic"}}>
                This does not affect your score — it adds professional context to your profile for employers and organisers.
              </p>
            </div>
          </div>
        </div>

        <button onClick={()=>{ if(name.trim()) { setPhase("taster"); setCurrentQ(0); setSelected(null); } }}
          style={{width:"100%",padding:"18px 32px",background:name.trim()?GOLD:"rgba(201,168,76,0.25)",border:"none",borderRadius:3,color:DARK,fontSize:13,fontFamily:"sans-serif",fontWeight:700,letterSpacing:"0.15em",cursor:name.trim()?"pointer":"not-allowed",marginBottom:12}}>
          START THE TASTER — 5 MINUTES
        </button>
        <button onClick={()=>{ if(name.trim()) { startFullAssessment(); } }}
          style={{width:"100%",padding:"14px 32px",background:"transparent",border:`1px solid ${name.trim()?"rgba(201,168,76,0.4)":"rgba(201,168,76,0.15)"}`,borderRadius:3,color:name.trim()?"rgba(247,244,238,0.6)":"rgba(247,244,238,0.2)",fontSize:12,fontFamily:"sans-serif",letterSpacing:"0.12em",cursor:name.trim()?"pointer":"not-allowed"}}>
          SKIP TO FULL VALU INDEX (54 QUESTIONS)
        </button>
        {!name.trim() && <p style={{textAlign:"center",fontSize:12,color:"rgba(201,168,76,0.4)",marginTop:8,fontFamily:"sans-serif"}}>Enter your name to begin</p>}
      </div>
    </div>
  );

  // ── QUESTION SCREEN (shared for taster and full) ───────────────────────────
  if (phase === "taster" || phase === "assessing") {
    const isAnchor = question?.validAnchor;
    const clusterColor = cluster?.color || GOLD;
    const isTasterPhase = phase === "taster";

    return (
      <div style={base}>
        <div style={grain}/>
        <div style={{position:"relative",zIndex:1,maxWidth:660,margin:"0 auto",padding:"0 24px"}}>
          {/* Progress bar */}
          <div style={{position:"sticky",top:0,background:DARK,paddingTop:20,paddingBottom:12,borderBottom:`1px solid rgba(201,168,76,0.1)`,marginBottom:32,zIndex:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,fontFamily:"sans-serif"}}>
              <span style={{fontSize:11,color:"rgba(247,244,238,0.35)",letterSpacing:"0.12em"}}>
                {isTasterPhase ? "VALU INDEX  ·  TASTER" : "PRIME FRAMEWORK  ·  VALU INDEX"}
              </span>
              <span style={{fontSize:11,color:GOLD,letterSpacing:"0.08em"}}>{currentQ+1} / {total}</span>
            </div>
            {isTasterPhase && (
              <div style={{fontSize:10,color:"rgba(247,244,238,0.2)",fontFamily:"sans-serif",marginBottom:6}}>
                9 questions · ~5 minutes · instant result
              </div>
            )}
            <div style={{height:2,background:"rgba(255,255,255,0.06)",borderRadius:1,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${progress}%`,background:isTasterPhase?"rgba(201,168,76,0.7)":GOLD,borderRadius:1,transition:"width 0.4s ease"}}/>
            </div>
          </div>

          {/* Cluster badge */}
          {!isAnchor && cluster && (
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
              <div style={{width:34,height:34,background:"rgba(255,255,255,0.06)",border:`1px solid ${clusterColor}40`,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:clusterColor,fontFamily:"sans-serif"}}>
                {cluster.id}
              </div>
              <div>
                <div style={{fontSize:11,color:clusterColor,letterSpacing:"0.15em",marginBottom:2,fontFamily:"sans-serif"}}>{cluster.name.toUpperCase()}</div>
                <div style={{fontSize:12,color:"rgba(247,244,238,0.4)",fontStyle:"italic",fontFamily:"sans-serif"}}>{cluster.theme}</div>
              </div>
              {question?.futureReady && (
                <div style={{marginLeft:"auto",padding:"3px 10px",background:`${AMBER}18`,border:`1px solid ${AMBER}50`,borderRadius:2,fontSize:10,color:AMBER,letterSpacing:"0.1em",fontWeight:700,fontFamily:"sans-serif"}}>FUTURE-READY</div>
              )}
              {!isTasterPhase && (
                <div style={{marginLeft:question?.futureReady?"8px":"auto",fontSize:11,color:"rgba(247,244,238,0.25)",fontFamily:"sans-serif",fontStyle:"italic"}}>
                  {question?.type === "behavioural" ? "Behavioural" : question?.type === "situational" ? "Situational" : "Reflective"}
                </div>
              )}
            </div>
          )}

          {/* Question */}
          <div style={{opacity:transitioning?0:1,transform:transitioning?"translateY(-8px)":"translateY(0)",transition:"all 0.28s ease"}}>
            <h2 style={{fontSize:"clamp(18px,3.2vw,24px)",fontWeight:300,color:PARCHMENT,lineHeight:1.45,marginBottom:32,letterSpacing:"-0.01em"}}>
              {question?.q}
            </h2>

            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
              {question?.options.map((opt,i) => {
                const isSel = selected === i;
                return (
                  <button key={i} onClick={()=>handleSelect(i)}
                    style={{textAlign:"left",padding:"16px 20px",background:isSel?"rgba(201,168,76,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${isSel?GOLD:"rgba(201,168,76,0.15)"}`,borderRadius:3,cursor:"pointer",transition:"all 0.2s",position:"relative"}}>
                    {isSel && <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:GOLD,borderRadius:"3px 0 0 3px"}}/>}
                    <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                      <div style={{width:20,height:20,borderRadius:"50%",flexShrink:0,border:`1.5px solid ${isSel?GOLD:"rgba(201,168,76,0.3)"}`,background:isSel?GOLD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",marginTop:1}}>
                        {isSel && <div style={{width:7,height:7,borderRadius:"50%",background:DARK}}/>}
                      </div>
                      <span style={{fontSize:14,color:isSel?PARCHMENT:"rgba(247,244,238,0.65)",lineHeight:1.55,fontFamily:"sans-serif",fontWeight:isSel?400:300}}>
                        {opt.text}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{display:"flex",gap:10,marginBottom:36}}>
              {currentQ > 0 && (
                <button onClick={handleBack} style={{padding:"12px 22px",background:"transparent",border:`1px solid rgba(201,168,76,0.2)`,borderRadius:3,color:"rgba(247,244,238,0.45)",fontSize:12,fontFamily:"sans-serif",cursor:"pointer",letterSpacing:"0.1em"}}>
                  BACK
                </button>
              )}
              <button onClick={handleNext} disabled={selected===null}
                style={{flex:1,padding:"14px 24px",background:selected!==null?GOLD:"rgba(201,168,76,0.15)",border:"none",borderRadius:3,color:selected!==null?DARK:"rgba(201,168,76,0.4)",fontSize:12,fontFamily:"sans-serif",fontWeight:700,letterSpacing:"0.15em",cursor:selected!==null?"pointer":"not-allowed",transition:"all 0.25s"}}>
                {isTasterPhase
                  ? (currentQ + 1 === TASTER_TOTAL ? "SEE MY RESULT" : "NEXT")
                  : (currentQ + 1 === TOTAL ? "COMPLETE ASSESSMENT" : "NEXT")}
              </button>
            </div>
          </div>

          {/* Live radar for full assessment only */}
          {!isTasterPhase && (
            <div style={{display:"flex",justifyContent:"center",paddingBottom:40,opacity:0.6}}>
              <Radar scores={liveScores} size={150}/>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── TASTER RESULTS ─────────────────────────────────────────────────────────
  if (phase === "taster_results" && tasterResults) {
    const { normalisedScores, strongest, weakest, insights } = tasterResults;

    return (
      <div style={base}>
        <div style={grain}/>
        <div style={{position:"relative",zIndex:1,maxWidth:640,margin:"0 auto",padding:"48px 24px 80px"}}>
          {/* Header */}
          <div style={{marginBottom:32}}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:"0.2em",marginBottom:12,fontFamily:"sans-serif"}}>VALU INDEX  ·  TASTER COMPLETE</div>
            <h1 style={{fontSize:"clamp(24px,5vw,38px)",fontWeight:300,lineHeight:1.15,marginBottom:8,letterSpacing:"-0.02em"}}>
              {name}, here is your <span style={{color:GOLD,fontStyle:"italic"}}>directional read.</span>
            </h1>
            <p style={{fontSize:14,color:"rgba(247,244,238,0.45)",fontStyle:"italic",fontFamily:"sans-serif"}}>
              Based on 9 questions across all five PRIME clusters.
              {experience && ` ${EXPERIENCE_BANDS.find(b=>b.id===experience)?.label} professional.`}
            </p>
          </div>

          {/* Cluster bar chart */}
          <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid rgba(201,168,76,0.15)`,borderRadius:6,padding:24,marginBottom:24}}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:"0.2em",marginBottom:20,fontFamily:"sans-serif"}}>YOUR FIVE CLUSTERS</div>
            {CLUSTERS.map(c => {
              const score = normalisedScores[c.id];
              const isStrongest = c.id === strongest.id;
              const isWeakest = c.id === weakest.id;
              return (
                <div key={c.id} style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:c.color,fontFamily:"sans-serif",width:16}}>{c.id}</span>
                      <span style={{fontSize:13,color:PARCHMENT,fontFamily:"sans-serif"}}>{c.name}</span>
                      <span style={{fontSize:10,color:"rgba(247,244,238,0.3)",fontStyle:"italic",fontFamily:"sans-serif"}}>{c.theme}</span>
                      {isStrongest && <span style={{fontSize:9,color:GOLD,border:`1px solid ${GOLD}40`,padding:"1px 6px",borderRadius:99,fontFamily:"sans-serif",letterSpacing:"0.1em"}}>STRONGEST</span>}
                      {isWeakest && <span style={{fontSize:9,color:"rgba(247,244,238,0.4)",border:"1px solid rgba(247,244,238,0.15)",padding:"1px 6px",borderRadius:99,fontFamily:"sans-serif",letterSpacing:"0.1em"}}>OPPORTUNITY</span>}
                    </div>
                    <span style={{fontSize:16,fontWeight:300,color:c.color,fontFamily:"sans-serif"}}>{score}</span>
                  </div>
                  <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${score}%`,background:c.color,borderRadius:3,transition:"width 1s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Strongest insight */}
          <div style={{padding:"20px 24px",background:`${strongest.color}12`,border:`1px solid ${strongest.color}40`,borderRadius:6,marginBottom:16}}>
            <div style={{fontSize:10,color:strongest.color,letterSpacing:"0.2em",marginBottom:8,fontFamily:"sans-serif",fontWeight:700}}>YOUR STRONGEST CLUSTER — {strongest.name.toUpperCase()}</div>
            <p style={{fontSize:14,color:PARCHMENT,lineHeight:1.65,margin:0,fontFamily:"sans-serif"}}>
              {insights[strongest.id].high}
            </p>
          </div>

          {/* Development opportunity */}
          <div style={{padding:"20px 24px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:6,marginBottom:28}}>
            <div style={{fontSize:10,color:GOLD,letterSpacing:"0.2em",marginBottom:8,fontFamily:"sans-serif",fontWeight:700}}>YOUR BIGGEST OPPORTUNITY — {weakest.name.toUpperCase()}</div>
            <p style={{fontSize:14,color:PARCHMENT,lineHeight:1.65,margin:0,fontFamily:"sans-serif"}}>
              {insights[weakest.id].low}
            </p>
          </div>

          {/* CTA to full assessment */}
          <div style={{padding:"28px 24px",background:MID,border:`1px solid ${GOLD}`,borderRadius:6,marginBottom:16,textAlign:"center"}}>
            <div style={{fontSize:12,color:GOLD,letterSpacing:"0.15em",marginBottom:12,fontFamily:"sans-serif"}}>THIS IS YOUR DIRECTION. YOUR SCORE IS NEXT.</div>
            <p style={{fontSize:14,color:"rgba(247,244,238,0.65)",lineHeight:1.65,marginBottom:24,fontFamily:"sans-serif"}}>
              The full VALU Index gives you your score out of 100, your professional designation — from <em style={{color:GOLD}}>Force to Align With</em> to <em>At the Starting Point</em> — a detailed radar chart across all five clusters, and your marketplace listing if your score qualifies. It takes 18 to 28 minutes.
            </p>
            <button onClick={startFullAssessment}
              style={{width:"100%",padding:"18px 32px",background:GOLD,border:"none",borderRadius:3,color:DARK,fontSize:13,fontFamily:"sans-serif",fontWeight:700,letterSpacing:"0.15em",cursor:"pointer",marginBottom:10}}>
              TAKE THE FULL VALU INDEX →
            </button>
            <p style={{fontSize:11,color:"rgba(247,244,238,0.3)",margin:0,fontFamily:"sans-serif"}}>
              Free · Valid for 12 months · Listed on platform if score ≥ 35
            </p>
          </div>

          <button onClick={restart}
            style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid rgba(201,168,76,0.15)",borderRadius:3,color:"rgba(247,244,238,0.3)",fontSize:12,fontFamily:"sans-serif",cursor:"pointer",letterSpacing:"0.1em"}}>
            START OVER
          </button>

          <div style={{textAlign:"center",paddingTop:28,marginTop:28,borderTop:"1px solid rgba(201,168,76,0.1)",fontSize:11,color:"rgba(247,244,238,0.2)",letterSpacing:"0.1em",fontFamily:"sans-serif",lineHeight:1.8}}>
            VALU INDEX TASTER  ·  PRIME FRAMEWORK  ·  VALORIA INSTITUTE  ·  (c) 2026<br/>
            AFRICAN TALENT BUREAU LTD
          </div>
        </div>
      </div>
    );
  }

  // ── FULL RESULTS (unchanged from v2 with experience context added) ──────────
  if (phase === "results" && results) {
    const { valuIndex, clusterScores, desig, futureReadyScore, strongest, weakest, listed, pathway, speedFlag, gamingDetected, consistencyFlags } = results;
    const anyFlag = speedFlag || gamingDetected || Object.keys(consistencyFlags).length > 0;
    const expBand = EXPERIENCE_BANDS.find(b => b.id === experience);

    return (
      <div style={base}>
        <div style={grain}/>
        <div style={{position:"relative",zIndex:1,maxWidth:660,margin:"0 auto",padding:"48px 24px 80px"}}>

          <div style={{marginBottom:36}}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:"0.2em",marginBottom:12,fontFamily:"sans-serif"}}>VALU INDEX  ·  ASSESSMENT COMPLETE</div>
            <h1 style={{fontSize:"clamp(26px,5vw,42px)",fontWeight:300,lineHeight:1.1,marginBottom:8,letterSpacing:"-0.02em"}}>
              {name || "Your"} <span style={{color:GOLD,fontStyle:"italic"}}>PRIME Profile</span>
            </h1>
            {role && <p style={{fontSize:14,color:"rgba(247,244,238,0.4)",fontStyle:"italic",fontFamily:"sans-serif",margin:"0 0 4px"}}>{role}</p>}
            {expBand && <p style={{fontSize:12,color:"rgba(247,244,238,0.25)",fontFamily:"sans-serif",margin:0}}>{expBand.label} · {expBand.desc}</p>}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:28}}>
            <div style={{padding:"24px 20px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(201,168,76,0.2)`,borderRadius:6}}>
              <div style={{fontSize:10,color:"rgba(247,244,238,0.4)",letterSpacing:"0.15em",marginBottom:10,fontFamily:"sans-serif"}}>VALU INDEX SCORE</div>
              <div style={{fontSize:72,fontWeight:300,color:GOLD,lineHeight:1,letterSpacing:"-0.04em"}}>{valuIndex}</div>
              <div style={{fontSize:11,color:"rgba(247,244,238,0.3)",letterSpacing:"0.1em",marginBottom:16,fontFamily:"sans-serif"}}>OUT OF 100</div>
              <div style={{padding:"10px 14px",background:desig.bg,border:`1px solid ${desig.color}40`,borderRadius:3,marginBottom:10}}>
                <div style={{fontSize:11,color:desig.color,fontWeight:700,letterSpacing:"0.1em",marginBottom:4,fontFamily:"sans-serif"}}>{desig.name.toUpperCase()}</div>
              </div>
              <p style={{fontSize:13,color:"rgba(247,244,238,0.5)",lineHeight:1.6,fontStyle:"italic",margin:0,fontFamily:"sans-serif"}}>{desig.desc}</p>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Radar scores={clusterScores} size={190}/>
            </div>
          </div>

          <div style={{padding:"14px 20px",background:listed?"rgba(29,158,117,0.1)":"rgba(136,136,136,0.1)",border:`1px solid ${listed?"#1D9E75":"#888888"}40`,borderRadius:6,marginBottom:20,fontFamily:"sans-serif"}}>
            <div style={{fontSize:11,fontWeight:700,color:listed?"#1D9E75":"#888888",letterSpacing:"0.1em",marginBottom:4}}>
              {listed ? "LISTED ON PLATFORM — EMPLOYER SEARCHABLE" : "NOT YET LISTED — MINIMUM SCORE 35"}
            </div>
            <div style={{fontSize:12,color:"rgba(247,244,238,0.5)"}}>
              {listed ? `You are listed as an active professional on the Valoria Institute platform. Employers and recruiters can find and shortlist you.`
                : `Complete a PRIME Sprint to build your score to 35 and qualify for listing.`}
            </div>
          </div>

          {anyFlag && (
            <div style={{padding:"14px 20px",background:"rgba(232,160,32,0.08)",border:`1px solid ${AMBER}40`,borderRadius:6,marginBottom:20,fontFamily:"sans-serif"}}>
              <div style={{fontSize:11,fontWeight:700,color:AMBER,letterSpacing:"0.1em",marginBottom:4}}>ASSESSMENT NOTES</div>
              <div style={{fontSize:12,color:"rgba(247,244,238,0.5)",lineHeight:1.6}}>
                {gamingDetected && "Validity pattern detected — score adjusted. "}
                {speedFlag && "Completion speed was noted. "}
                {Object.keys(consistencyFlags).length > 0 && `Consistency adjustment applied to: ${Object.keys(consistencyFlags).map(id => CLUSTERS.find(c=>c.id===id)?.name).join(", ")}.`}
                {" Your score reflects your most accurate profile based on your responses."}
              </div>
            </div>
          )}

          <div style={{marginBottom:24}}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:"0.2em",marginBottom:16,fontFamily:"sans-serif"}}>CLUSTER BREAKDOWN</div>
            {CLUSTERS.map(c => {
              const score = clusterScores[c.id];
              const flagged = consistencyFlags[c.id];
              return (
                <div key={c.id} style={{padding:"16px 20px",background:"rgba(255,255,255,0.025)",border:`1px solid rgba(201,168,76,0.1)`,borderRadius:6,marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{width:26,height:26,background:`${c.color}18`,border:`1px solid ${c.color}40`,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:c.color,fontFamily:"sans-serif"}}>{c.id}</div>
                      <div>
                        <div style={{fontSize:13,color:PARCHMENT,marginBottom:1,fontFamily:"sans-serif"}}>{c.name}</div>
                        <div style={{fontSize:11,color:"rgba(247,244,238,0.35)",fontStyle:"italic",fontFamily:"sans-serif"}}>{c.theme}</div>
                      </div>
                      {flagged && <div style={{fontSize:10,color:AMBER,border:`1px solid ${AMBER}40`,padding:"2px 7px",borderRadius:99,fontFamily:"sans-serif"}}>adjusted</div>}
                    </div>
                    <div>
                      <span style={{fontSize:22,fontWeight:300,color:c.color}}>{score}</span>
                      <span style={{fontSize:11,color:"rgba(247,244,238,0.3)",fontFamily:"sans-serif"}}>/100</span>
                    </div>
                  </div>
                  <div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${score}%`,background:c.color,borderRadius:3,transition:"width 1s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{padding:"20px 24px",background:`${AMBER}08`,border:`1px solid ${AMBER}35`,borderRadius:6,marginBottom:24}}>
            <div style={{fontSize:11,color:AMBER,letterSpacing:"0.15em",marginBottom:12,fontWeight:700,fontFamily:"sans-serif"}}>FUTURE-READY SKILLS</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {[{name:"AI Fluency",score:futureReadyScore},{name:"Human-AI Collaboration",score:Math.round(futureReadyScore*0.95)}].map(fr=>(
                <div key={fr.name} style={{padding:"12px 16px",background:`${AMBER}08`,borderRadius:4,border:`1px solid ${AMBER}25`}}>
                  <div style={{fontSize:12,color:AMBER,marginBottom:6,fontFamily:"sans-serif"}}>{fr.name}</div>
                  <div style={{fontSize:20,fontWeight:300,color:PARCHMENT,marginBottom:4}}>{fr.score}</div>
                  <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${fr.score}%`,background:AMBER,borderRadius:2}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{padding:"24px",background:MID,border:`1px solid rgba(201,168,76,0.2)`,borderRadius:6,marginBottom:28}}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:"0.15em",marginBottom:12,fontFamily:"sans-serif"}}>YOUR RECOMMENDED PRIME PATHWAY</div>
            <p style={{fontSize:13,color:"rgba(247,244,238,0.65)",lineHeight:1.7,marginBottom:16,fontFamily:"sans-serif"}}>
              Your strongest cluster is <span style={{color:strongest.color,fontWeight:500}}>{strongest.name}</span> — your foundation to build from.
              Your highest-leverage development priority is <span style={{color:weakest.color,fontWeight:500}}>{weakest.name}</span>.
              Your recommended starting point is the <span style={{color:GOLD,fontWeight:500}}>{pathway}</span>.
            </p>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:40}}>
            <div style={{padding:"18px 24px",background:GOLD,borderRadius:3,textAlign:"center",cursor:"pointer"}}>
              <div style={{fontSize:13,fontWeight:700,color:DARK,letterSpacing:"0.15em",marginBottom:3,fontFamily:"sans-serif"}}>SPEAK TO A VALORIA ADVISER</div>
              <div style={{fontSize:12,color:"rgba(26,26,46,0.65)",fontFamily:"sans-serif"}}>Get a personalised development plan based on your VALU Index profile</div>
            </div>
            <button onClick={restart} style={{padding:"14px 24px",background:"transparent",border:`1px solid rgba(201,168,76,0.25)`,borderRadius:3,color:"rgba(247,244,238,0.5)",fontSize:12,fontFamily:"sans-serif",letterSpacing:"0.12em",cursor:"pointer"}}>
              RETAKE ASSESSMENT
            </button>
          </div>

          <div style={{textAlign:"center",paddingTop:20,borderTop:"1px solid rgba(201,168,76,0.1)",fontSize:11,color:"rgba(247,244,238,0.2)",letterSpacing:"0.1em",fontFamily:"sans-serif",lineHeight:1.8}}>
            VALU INDEX v3.0  ·  PRIME FRAMEWORK  ·  VALORIA INSTITUTE  ·  (c) 2026<br/>
            CONFIDENTIAL  ·  AFRICAN TALENT BUREAU LTD
          </div>
        </div>
      </div>
    );
  }

  return null;
}
