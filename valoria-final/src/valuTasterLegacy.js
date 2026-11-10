// Compatibility only for already-started v4.1 sessions.
// Kept as a small, versioned copy so resuming old sessions does not import
// or bundle the formal 58-question bank into the new taster entry point.
export const LEGACY_TASTER_VERSION = "4.1";

export const LEGACY_TASTER_QUESTIONS = [
  {
    id: "P1b", cluster: "P", skill: "Communication", type: "situational",
    q: "You are presenting a recommendation to leadership when you sense they have already decided differently. What do you do?",
    options: [
      { text: "Finish the presentation — they should hear everything before I adjust.", score: 1 },
      { text: "Name what I am sensing and ask what their current thinking is before continuing.", score: 3 },
      { text: "Pivot to the one point most likely to shift their position and invite the disagreement.", score: 4 },
      { text: "Accelerate through the key points before I lose the room entirely.", score: 2 },
    ],
  },
  {
    id: "R1a", cluster: "R", skill: "Emotional Intelligence", type: "behavioural",
    q: "You are in a high-pressure meeting and someone says something that genuinely irritates you. What actually happens next?",
    options: [
      { text: "I notice the reaction, give myself a beat, and choose my response rather than react.", score: 3 },
      { text: "I address it in the moment — it is better than letting it sit.", score: 1 },
      { text: "I hold back but the irritation probably shapes how I engage for the rest of the meeting.", score: 2 },
      { text: "I name the emotion to myself, regulate it in real time, and decide whether to address it now or later.", score: 4 },
    ],
  },
  {
    id: "R4a", cluster: "R", skill: "Stakeholder Management", type: "behavioural",
    q: "You are about to lead a significant initiative requiring support from people across multiple functions. Where do you start?",
    options: [
      { text: "Build a stakeholder influence map — interests, concerns, level of support needed — and create a deliberate alignment sequence before I need it.", score: 4 },
      { text: "Start the work and bring stakeholders in as they become relevant to their area.", score: 1 },
      { text: "Brief all key stakeholders early so they are aware of what is coming.", score: 2 },
      { text: "Map who needs to be involved, understand what each person cares about, and sequence conversations before work begins.", score: 3 },
    ],
  },
  {
    id: "I2a", cluster: "I", skill: "Strategic Thinking", type: "behavioural",
    q: "Your manager gives you a task that is clearly important. Before starting, what goes through your mind?",
    options: [
      { text: "How to do it well and deliver it on time.", score: 1 },
      { text: "How this task connects to longer-term direction, what it enables or constrains, and whether this is the right task to be doing at all.", score: 4 },
      { text: "How this connects to the team's current priorities and where it sits in the queue.", score: 2 },
      { text: "How it fits the broader goal, who will use the output, and what success looks like beyond task completion.", score: 3 },
    ],
  },
  {
    id: "I3b", cluster: "I", skill: "Business Acumen", type: "situational",
    q: "You are proposing a new initiative that needs investment. A finance leader asks you to walk through the commercial case. How prepared are you?",
    options: [
      { text: "I can present a fully worked commercial case — cost, return, assumption ranges, downside scenarios, payback period, and the metrics I would use to track it.", score: 4 },
      { text: "I can explain what the initiative does and why it matters to the organisation.", score: 1 },
      { text: "I can explain the cost and the expected benefit at a high level.", score: 2 },
      { text: "I can present the cost, projected return, key assumptions, and the timeline to value.", score: 3 },
    ],
  },
  {
    id: "M1b", cluster: "M", skill: "Execution & Accountability", type: "situational",
    q: "A colleague who was supposed to deliver a key input has not delivered and is now unreachable. Your deadline is tomorrow. What do you do?",
    options: [
      { text: "Miss the deadline and make clear that the dependency was not delivered.", score: 1 },
      { text: "Make every reasonable attempt to resolve the dependency, deliver the best version possible, document what was missing, and escalate the dependency separately — never using it as cover for my own accountability.", score: 4 },
      { text: "Do what I can without the input and flag the gap clearly in what I deliver.", score: 2 },
      { text: "Find a way to deliver with what I have, escalate the dependency failure clearly, and keep my accountability separate from theirs.", score: 3 },
    ],
  },
  {
    id: "M2b", cluster: "M", skill: "Resilience & Self-Leadership", type: "situational",
    q: "You are in a sustained period of high pressure — competing demands, insufficient resources, no clear end in sight. How do you manage yourself?",
    options: [
      { text: "I push through — it is temporary and the work needs to get done.", score: 1 },
      { text: "I have a clear framework for sustained pressure — how I manage cognitive, emotional, and physical energy, what signals I watch for, and when I escalate.", score: 4 },
      { text: "I try to manage my time better and accept that some things will have to slip.", score: 2 },
      { text: "I actively manage my energy — not just my time — and make deliberate choices about what to protect and what to let go.", score: 3 },
    ],
  },
  {
    id: "E2a", cluster: "E", skill: "Influence Without Authority", type: "behavioural",
    q: "You need cooperation from someone who does not report to you — and they are currently not prioritising what you need. How do you approach it?",
    options: [
      { text: "Escalate to someone who has authority over them.", score: 1 },
      { text: "Invest in the relationship before I need something, understand their pressures, frame my request in terms of their interests, and make it easy for them to say yes.", score: 4 },
      { text: "Make the request clearly and explain why it matters to the organisation.", score: 2 },
      { text: "Take time to understand what they are prioritising and find a way to connect my need to something they already care about.", score: 3 },
    ],
  },
  {
    id: "E1a", cluster: "E", skill: "Commercial Creativity", type: "behavioural",
    q: "You are facing a significant constraint — budget cut, resource reduction, policy restriction — that threatens something you are trying to deliver. How do you respond?",
    options: [
      { text: "Deliver what is possible within the constraint and communicate clearly about what is not.", score: 1 },
      { text: "Treat the constraint as potentially generative — some of the best solutions come from working around limitations you never would have encountered otherwise.", score: 4 },
      { text: "Push back and make the case for more resource or greater flexibility.", score: 2 },
      { text: "Treat the constraint as a design problem — look for a different way to achieve the same outcome.", score: 3 },
    ],
  },
];

export function computeLegacyTasterResult(answers = {}) {
  const clusterScores = { P: 0, R: 0, I: 0, M: 0, E: 0 };
  const clusterCounts = { P: 0, R: 0, I: 0, M: 0, E: 0 };
  const clusterMaxPoints = { P: 0, R: 0, I: 0, M: 0, E: 0 };

  LEGACY_TASTER_QUESTIONS.forEach((question, index) => {
    const selected = answers[index];
    if (!Number.isInteger(selected) || !question.options[selected]) return;
    clusterScores[question.cluster] += question.options[selected].score;
    clusterCounts[question.cluster] += 1;
    clusterMaxPoints[question.cluster] += Math.max(
      ...question.options.map(option => Number(option.score) || 0),
    );
  });

  const points = { ...clusterScores };
  const maxPoints = { ...clusterMaxPoints };
  Object.keys(clusterScores).forEach(id => {
    if (!clusterCounts[id]) {
      points[id] = 0;
      maxPoints[id] = LEGACY_TASTER_QUESTIONS
        .filter(question => question.cluster === id)
        .reduce((sum, question) => sum + Math.max(
          ...question.options.map(option => Number(option.score) || 0),
        ), 0);
    }
  });

  const clusters = [
    { id: "P", name: "Presence" },
    { id: "R", name: "Relationships" },
    { id: "I", name: "Intelligence" },
    { id: "M", name: "Mastery" },
    { id: "E", name: "Enterprise" },
  ];
  const order = Object.fromEntries(clusters.map((cluster, index) => [cluster.id, index]));
  const strongest = [...clusters].sort(
    (a, b) => (points[b.id] - points[a.id]) || (order[a.id] - order[b.id]),
  )[0];
  const weakest = [...clusters].sort(
    (a, b) => (points[a.id] - points[b.id]) || (order[a.id] - order[b.id]),
  )[0];

  return {
    points,
    maxPoints,
    strongest,
    weakest,
    completedQuestions: Object.keys(answers).length,
  };
}
