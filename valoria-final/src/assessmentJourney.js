// assessmentJourney.js — the canonical two-session shape of the ONE VALU assessment.
//
// There is a single 58-question assessment with one intentional account-confirmation bridge:
//   Opening (questions 1–9)   — the approved nine-question opening set.
//   Bridge                    — account creation and email confirmation.
//   Completion (questions 10–58) — the remaining 49 questions.
//
// The approved nine are a curated subset of the same canonical bank, chosen to
// span all five PRIME clusters. They are NOT a separate assessment: every answer
// is stored against its canonical bank position and all 58 answers are scored by
// the one scoring engine.
//
// Presentation order is the approved nine first, then the remaining questions in
// canonical bank order. This changes neither the question bank nor the scoring
// definition — it only decides the order the participant meets the questions.

import { QUESTIONS } from "./questions.js";
import { TASTER_QUESTIONS } from "./valuTaster.js";

export const TOTAL_QUESTIONS = QUESTIONS.length; // 58

const positionById = new Map(QUESTIONS.map((question, index) => [question.id, index]));

// Bank positions of the approved nine opening questions, in their approved order.
export const OPENING_POSITIONS = TASTER_QUESTIONS.map(question => {
  const index = positionById.get(question.id);
  if (index === undefined) throw new Error(`Approved opening question missing from the canonical bank: ${question.id}`);
  return index;
});

const openingSet = new Set(OPENING_POSITIONS);

// The remaining bank positions, in canonical bank order.
export const REMAINING_POSITIONS = QUESTIONS
  .map((_, index) => index)
  .filter(index => !openingSet.has(index));

// The full completion order: approved nine first, then the remaining 49.
export const ASSESSMENT_ORDER = [...OPENING_POSITIONS, ...REMAINING_POSITIONS];

export const OPENING_SESSION_LENGTH = OPENING_POSITIONS.length; // 9
export const REMAINING_SESSION_LENGTH = REMAINING_POSITIONS.length; // 49

// Map from bank position to its 1-based place in the completion order.
const placeByPosition = new Map(ASSESSMENT_ORDER.map((position, place) => [position, place]));

/** 1-based position in the completion order (1..58) for a canonical bank position. */
export function placeForPosition(position) {
  const place = placeByPosition.get(position);
  if (place === undefined) throw new Error(`Unknown assessment position: ${position}`);
  return place + 1;
}

/** The bank positions belonging to the opening (first) session, in order. */
export function openingPositions() {
  return [...OPENING_POSITIONS];
}

/** The bank positions belonging to the second session, in order. */
export function remainingPositions() {
  return [...REMAINING_POSITIONS];
}

/**
 * Seed a full 58-slot answer map from the nine saved opening answers.
 * `openingAnswers` is keyed 0..8 in the approved order (as the snapshot stores it).
 */
export function seedAnswersFromOpening(openingAnswers = {}) {
  const seeded = {};
  OPENING_POSITIONS.forEach((position, openingIndex) => {
    const choice = openingAnswers[openingIndex];
    if (Number.isInteger(choice)) seeded[position] = choice;
  });
  return seeded;
}

/**
 * The next question to present, walking the completion order from `fromPlace`
 * (1-based) and skipping any position already answered.
 * Returns the 1-based place (1..TOTAL_QUESTIONS) or null when all are answered.
 */
export function nextPlaceToAnswer(answers = {}, fromPlace = 1) {
  for (let place = Math.max(1, fromPlace); place <= ASSESSMENT_ORDER.length; place += 1) {
    const position = ASSESSMENT_ORDER[place - 1];
    if (!Object.prototype.hasOwnProperty.call(answers, position)) return place;
  }
  return null;
}

/** How many of the 58 questions have been answered. */
export function answeredCount(answers = {}) {
  return ASSESSMENT_ORDER.reduce(
    (count, position) => (Object.prototype.hasOwnProperty.call(answers, position) ? count + 1 : count),
    0,
  );
}
