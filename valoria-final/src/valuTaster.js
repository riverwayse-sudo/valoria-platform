// VALU Index v4 — canonical 9-question taster.
// The taster is directional only. Its answers NEVER enter the full VALU score.

export const VALU_VERSION = "4.0";

export const TASTER_QUESTIONS = [
  { id:"P1b", cluster:"P", skill:"Communication", tasterInsight:"how you communicate under pressure", q:"You are presenting a recommendation to leadership. Halfway through, you sense they have already made up their minds differently. What do you do?", options:[
    {text:"Finish the presentation as planned — the information needs to be heard.",score:1},
    {text:"Speed up and land the key points before you lose the room entirely.",score:2},
    {text:"Stop, name what you are sensing, and ask what their current thinking is before continuing.",score:3},
    {text:"Pivot immediately to the one thing that could shift their position, then invite the disagreement directly.",score:4},
  ]},
  { id:"R1a", cluster:"R", skill:"Emotional Intelligence", tasterInsight:"how you read and respond to people", q:"You are in a high-pressure meeting and someone says something that genuinely irritates you. What actually happens next?", options:[
    {text:"I respond directly — suppressing a genuine reaction makes things worse, not better.",score:1},
    {text:"I stay quiet and address it after the meeting when things are calmer.",score:2},
    {text:"I notice the irritation, make a conscious decision not to act on it in the moment, and decide later whether it needs addressing.",score:3},
    {text:"I notice it, name — internally — what triggered it, regulate before responding, and make a deliberate choice about whether and how to address it based on what is actually useful.",score:4},
  ]},
  { id:"R4a", cluster:"R", skill:"Stakeholder Management", tasterInsight:"how you manage relationships across power structures", q:"You are about to lead a significant new initiative that will require the support of people across multiple functions. Where do you start?", options:[
    {text:"Start the work and bring stakeholders in as they become relevant.",score:1},
    {text:"Brief the key stakeholders and make sure they know what is happening.",score:2},
    {text:"Map who needs to be involved, understand what each person cares about, and sequence conversations accordingly before work begins.",score:3},
    {text:"Build a stakeholder influence map — interests, concerns, level of support needed — then create a deliberate alignment sequence that builds momentum before I need it.",score:4},
  ]},
  { id:"I2a", cluster:"I", skill:"Strategic Thinking", tasterInsight:"how you connect your work to the bigger picture", q:"You are given a task that is clearly important to your manager. Before starting, what goes through your mind?", options:[
    {text:"How to do it well and on time.",score:1},
    {text:"How this connects to the team's current priorities.",score:2},
    {text:"How this fits into the broader goal, who will use the output, and what success actually looks like beyond task completion.",score:3},
    {text:"How this task connects to the longer-term direction, what decisions it will enable or constrain, what the second-order consequences are, and whether this is actually the right task to be doing.",score:4},
  ]},
  { id:"I3b", cluster:"I", skill:"Business Acumen", tasterInsight:"how commercially fluent you are", q:"You are proposing a new initiative that will require investment. A finance leader asks you to walk them through the commercial case. How prepared are you?", options:[
    {text:"I can explain what the initiative does and why it is important.",score:1},
    {text:"I can explain the cost and the expected benefit at a high level.",score:2},
    {text:"I can present the cost, projected return, key assumptions, and the timeline to value.",score:3},
    {text:"I can present a fully worked commercial case — cost, return, assumptions with ranges, downside scenarios, payback period, and the metrics I would use to track whether it is working.",score:4},
  ]},
  { id:"M1b", cluster:"M", skill:"Execution & Accountability", tasterInsight:"how you handle pressure and accountability", q:"A deadline you committed to is at serious risk — partly because of factors outside your control, partly because of your own planning. What do you do?", options:[
    {text:"Focus everything on delivery and explain what happened afterwards.",score:1},
    {text:"Flag the risk early, explain the external factors, and ask for an extension.",score:2},
    {text:"Flag the risk early, take ownership of your part in it, propose a specific revised plan, and deliver against the new commitment.",score:3},
    {text:"Flag the risk at the earliest signal — not when it is certain — own your contribution without defensiveness, present options with trade-offs, get alignment on the path forward, and build the lesson into how you plan next time.",score:4},
  ]},
  { id:"M2b", cluster:"M", skill:"Resilience & Self-Leadership", tasterInsight:"how you respond to setbacks", q:"A project you led publicly failed — the outcome was visible, the impact was real, and people noticed. How do you respond?", options:[
    {text:"I focus on moving forward — dwelling on failure is not useful.",score:1},
    {text:"I do a debrief, understand what went wrong, and try not to repeat it.",score:2},
    {text:"I do a thorough analysis of what failed and why, take clear accountability for my role in it, and make specific changes to how I work.",score:3},
    {text:"I treat it as signal-rich data — rigorous analysis of what happened and why, clear accountability for what was mine, specific changes to practice, and deliberate use of the experience to build credibility by showing how I handle failure.",score:4},
  ]},
  { id:"E2a", cluster:"E", skill:"Influence Without Authority", tasterInsight:"how you lead without formal power", q:"You need the cooperation of someone who does not report to you — and they are currently not prioritising what you need. How do you approach it?", options:[
    {text:"Escalate to someone with authority over them.",score:1},
    {text:"Make the request clearly and explain why it matters.",score:2},
    {text:"Take time to understand what they are prioritising and find a way to connect my need to something they care about.",score:3},
    {text:"Invest in the relationship before I need something, understand their priorities and pressures, frame my request in terms of their interests, and make it easy for them to say yes.",score:4},
  ]},
  { id:"E1a", cluster:"E", skill:"Commercial Creativity", tasterInsight:"how creatively you approach constraints", q:"You are asked to achieve the same outcome with significantly fewer resources than last time. What is your instinct?", options:[
    {text:"Push back — the ask is not realistic and delivering poorly serves nobody.",score:1},
    {text:"Accept the constraint and find ways to reduce scope to match the budget.",score:2},
    {text:"Accept the constraint and look for ways to redesign the approach so it delivers more value with less resource.",score:3},
    {text:"Treat the constraint as a design brief — use it to challenge every assumption about how the outcome is achieved, and look for approaches that the original resourcing level actually prevented.",score:4},
  ]},
];

export const EXPERIENCE_BANDS = [
  { id:"0-3", label:"0 – 3 years", desc:"Early career" },
  { id:"4-8", label:"4 – 8 years", desc:"Mid career" },
  { id:"9-15", label:"9 – 15 years", desc:"Senior" },
  { id:"15+", label:"15+ years", desc:"Executive / Director" },
];

export function computeTasterResult(answers = {}) {
  const clusterScores = { P:0, R:0, I:0, M:0, E:0 };
  const clusterCounts = { P:0, R:0, I:0, M:0, E:0 };
  TASTER_QUESTIONS.forEach((q, idx) => {
    const chosen = answers[idx];
    if (chosen === undefined || !q.options[chosen]) return;
    clusterScores[q.cluster] += q.options[chosen].score;
    clusterCounts[q.cluster]++;
  });
  const normalisedScores = {};
  Object.keys(clusterScores).forEach(id => {
    const count = clusterCounts[id] || 1;
    normalisedScores[id] = Math.round((clusterScores[id] / (count * 4)) * 100);
  });
  const clusters = [
    {id:"P",name:"Presence"},{id:"R",name:"Relationships"},{id:"I",name:"Intelligence"},{id:"M",name:"Mastery"},{id:"E",name:"Enterprise"}
  ];
  const order = Object.fromEntries(clusters.map((cluster, index) => [cluster.id, index]));
  const strongest = [...clusters].sort((a,b) => (normalisedScores[b.id] - normalisedScores[a.id]) || (order[a.id] - order[b.id]))[0];
  const weakest = [...clusters].sort((a,b) => (normalisedScores[a.id] - normalisedScores[b.id]) || (order[a.id] - order[b.id]))[0];
  return {
    normalisedScores,
    strongest,
    weakest,
    completedQuestions: Object.keys(answers).length,
  };
}
