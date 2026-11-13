// VALU Index v4.2 — separate nine-question Intelligence taster.
// The taster is its own instrument and answer set. It is not part of,
// and does not reduce or seed, the formal 58-question VALU assessment.

export const TASTER_VERSION_V42 = "4.2";

export const TASTER_SKILLS = [
  {
    key: "Critical Thinking",
    label: "Critical Thinking",
    description: "The ability to question assumptions, interrogate data, and resist the pull of group consensus when something does not add up.",
  },
  {
    key: "Strategic Thinking",
    label: "Strategic Thinking",
    description: "The ability to see beyond the task — to understand what is actually worth doing, what consequences follow from each choice, and when to trade off speed for direction.",
  },
  {
    key: "Business Acumen",
    label: "Business Acumen",
    description: "Commercial fluency — the ability to understand how value is created, how decisions connect to outcomes, and how to make a case that a finance leader will take seriously.",
  },
  {
    key: "AI Fluency ★",
    label: "AI Fluency ★",
    description: "The ability to work deliberately with AI — knowing what to delegate, what to protect, and how the human-AI boundary in your work is changing what excellent looks like.",
  },
];

// These nine questions are a dedicated taster bank. T-prefixed identifiers
// prevent collisions with the separate formal question bank's identifiers.
export const TASTER_QUESTIONS = [
  // Critical Thinking — 3 questions
  {
    id: "T-I1a",
    cluster: "I",
    skill: "Critical Thinking",
    type: "behavioural",
    q: "Your most respected colleague presents data that strongly supports a decision the team is excited about. You notice something in the analysis that does not add up. What do you actually do?",
    options: [
      { text: "Trust the analysis — they are more experienced than me and the team is aligned.", score: 1 },
      { text: "Mention it quietly to the colleague after the meeting.", score: 2 },
      { text: "Raise it in the room — the decision should not be made on flawed data regardless of who produced it.", score: 3 },
      { text: "Raise it specifically and constructively — naming what I noticed, why it matters to the decision, and asking the question that forces the analysis to be interrogated properly.", score: 4 },
    ],
  },
  {
    id: "T-I1b",
    cluster: "I",
    skill: "Critical Thinking",
    type: "situational",
    q: "You are asked to validate a business case that has already been signed off by leadership. You find assumptions that seem optimistic. What do you do?",
    options: [
      { text: "Validate it — it has already been approved and raising issues now will cause problems.", score: 1 },
      { text: "Flag the assumptions informally to the person who asked me to validate it.", score: 2 },
      { text: "Document the specific assumptions, stress-test them, and present a clear view of the risk they create — even though the case is already approved.", score: 3 },
      { text: "Treat the validation as genuinely independent — stress-test every assumption, model the downside scenarios, and present a complete picture including what the decision looks like if the optimistic assumptions are wrong.", score: 4 },
    ],
  },
  {
    id: "T-I1c",
    cluster: "I",
    skill: "Critical Thinking",
    type: "reflective",
    q: "When did you last genuinely change your mind about something important at work — not just update a detail, but shift your position entirely? What caused it?",
    options: [
      { text: "I generally land in the right place from the start, so complete reversals are rare.", score: 1 },
      { text: "I can think of something. Someone made a strong argument and I updated my view.", score: 2 },
      { text: "I have a clear example. I encountered evidence that contradicted my position and I worked through it seriously before updating my view.", score: 3 },
      { text: "I have a specific example. I had a position I held confidently, encountered disconfirming evidence I initially resisted, worked through what was actually true, and updated my position — and I can trace the specific reasoning that moved me.", score: 4 },
    ],
  },
  // Strategic Thinking — 3 questions
  {
    id: "T-I2a",
    cluster: "I",
    skill: "Strategic Thinking",
    type: "behavioural",
    q: "You are given a task that is clearly important to your manager. Before starting, what goes through your mind?",
    options: [
      { text: "How to do it well and on time.", score: 1 },
      { text: "How this connects to the team's current priorities.", score: 2 },
      { text: "How this fits into the broader goal, who will use the output, and what success actually looks like beyond task completion.", score: 3 },
      { text: "How this task connects to the longer-term direction, what decisions it will enable or constrain, what the second-order consequences are, and whether this is actually the right task to be doing.", score: 4 },
    ],
  },
  {
    id: "T-I2b",
    cluster: "I",
    skill: "Strategic Thinking",
    type: "situational",
    q: "Your organisation is about to launch a new product. You are not in the leadership team but you can see a market dynamic that makes the timing risky. What do you do?",
    options: [
      { text: "Trust that leadership has thought through the timing — they have more context than I do.", score: 1 },
      { text: "Mention my concern to my manager and leave it with them.", score: 2 },
      { text: "Prepare a clear, evidence-based view of the risk and find the right channel to get it into the decision.", score: 3 },
      { text: "Prepare a structured analysis — what I am seeing, why it matters, what the alternatives are, and what I would recommend — and proactively find the decision-maker it needs to reach.", score: 4 },
    ],
  },
  {
    id: "T-I2c",
    cluster: "I",
    skill: "Strategic Thinking",
    type: "reflective",
    q: "Describe a decision you made that looked correct in the short term but created a problem further down the line. What did you not see at the time?",
    options: [
      { text: "Most of my decisions hold up well over time — I cannot think of a clear example.", score: 1 },
      { text: "Something comes to mind. I focused on the immediate problem and did not think far enough ahead.", score: 2 },
      { text: "I have a clear example. I optimised for the near term and did not trace the downstream consequences.", score: 3 },
      { text: "I have a specific example with a clear analysis of the second-order consequence I missed, why I missed it, and the thinking practice I now use to systematically surface those consequences before deciding.", score: 4 },
    ],
  },
  // Business Acumen — 2 questions
  {
    id: "T-I3a",
    cluster: "I",
    skill: "Business Acumen",
    type: "behavioural",
    q: "If someone asked you to explain how your current or most recent organisation actually makes money — the mechanics of it — how confident are you in your answer?",
    options: [
      { text: "I know what we do and roughly what we charge — beyond that I am not certain.", score: 1 },
      { text: "I understand our core revenue model and the main things we spend money on.", score: 2 },
      { text: "I can walk through the revenue model, the key cost drivers, and where the margin is actually made.", score: 3 },
      { text: "I can explain the unit economics, the key metrics, where value is created and where it is destroyed, how my role connects to commercial outcomes, and what the strategic levers are.", score: 4 },
    ],
  },
  {
    id: "T-I3b",
    cluster: "I",
    skill: "Business Acumen",
    type: "situational",
    q: "You are proposing a new initiative that will require investment. A finance leader asks you to walk them through the commercial case. How prepared are you?",
    options: [
      { text: "I can explain what the initiative does and why it is important.", score: 1 },
      { text: "I can explain the cost and the expected benefit at a high level.", score: 2 },
      { text: "I can present the cost, projected return, key assumptions, and the timeline to value.", score: 3 },
      { text: "I can present a fully worked commercial case — cost, return, assumptions with ranges, downside scenarios, payback period, and the metrics I would use to track whether it is working.", score: 4 },
    ],
  },
  // AI Fluency — 1 question
  {
    id: "T-I4a",
    cluster: "I",
    skill: "AI Fluency ★",
    type: "behavioural",
    q: "How have you actually changed how you work because of AI — not in theory, but in practice?",
    options: [
      { text: "I have not made significant changes yet — I am still figuring out where AI fits.", score: 1 },
      { text: "I have added AI to some tasks at the edges of my work but my core workflow is the same.", score: 2 },
      { text: "I have deliberately redesigned parts of my workflow around AI — deciding what to delegate and what to keep — and I have seen a real change in what I can produce.", score: 3 },
      { text: "I have comprehensively redesigned how I work around the human-AI boundary. I can name precisely which tasks I have moved to AI, what I have protected as human, and how that has changed the nature and quality of my output.", score: 4 },
    ],
  },
];

export const EXPERIENCE_BANDS = [
  { id: "0-3", label: "0 – 3 years", desc: "Early career" },
  { id: "4-8", label: "4 – 8 years", desc: "Mid career" },
  { id: "9-15", label: "9 – 15 years", desc: "Senior" },
  { id: "15+", label: "15+ years", desc: "Executive / Director" },
];

export function computeV42TasterResult(answers = {}) {
  const rawScores = Object.fromEntries(TASTER_SKILLS.map(skill => [skill.key, 0]));
  const skillCounts = Object.fromEntries(TASTER_SKILLS.map(skill => [skill.key, 0]));

  TASTER_QUESTIONS.forEach((question, index) => {
    const selected = answers[index];
    if (!Number.isInteger(selected) || !question.options[selected]) return;
    rawScores[question.skill] += question.options[selected].score;
    skillCounts[question.skill] += 1;
  });

  const normalisedSkills = Object.fromEntries(TASTER_SKILLS.map(skill => {
    const count = skillCounts[skill.key];
    const score = count ? Math.round((rawScores[skill.key] / (count * 4)) * 100) : 0;
    return [skill.key, score];
  }));

  const answeredSkills = TASTER_SKILLS.filter(skill => skillCounts[skill.key] > 0);
  const intelligenceScore = answeredSkills.length
    ? Math.round(answeredSkills.reduce((sum, skill) => sum + normalisedSkills[skill.key], 0) / answeredSkills.length)
    : 0;
  const ranked = [...TASTER_SKILLS].sort((a, b) => normalisedSkills[b.key] - normalisedSkills[a.key]);

  return {
    intelligenceScore,
    normalisedSkills,
    skillCounts,
    strongestSkill: ranked[0] || null,
    weakestSkill: ranked[ranked.length - 1] || null,
    completedQuestions: Object.keys(answers).length,
  };
}
