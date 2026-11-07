// Canonical full VALU assessment order.
// The 9-question taster is a separate assessment record and never contributes
// answers, progress or scoring to this 58-question full assessment.

import { QUESTIONS } from "./questions.js";

export const TOTAL_QUESTIONS = QUESTIONS.length; // 58
export const ASSESSMENT_ORDER = QUESTIONS.map((_, index) => index);

const placeByPosition = new Map(ASSESSMENT_ORDER.map((position, place) => [position, place]));

/** 1-based position (1..58) for a canonical full-assessment bank position. */
export function placeForPosition(position) {
  const place = placeByPosition.get(position);
  if (place === undefined) throw new Error(`Unknown assessment position: ${position}`);
  return place + 1;
}

/** The next unanswered full-assessment question from a 1-based starting place. */
export function nextPlaceToAnswer(answers = {}, fromPlace = 1) {
  for (let place = Math.max(1, fromPlace); place <= ASSESSMENT_ORDER.length; place += 1) {
    const position = ASSESSMENT_ORDER[place - 1];
    if (!Object.prototype.hasOwnProperty.call(answers, position)) return place;
  }
  return null;
}

/** Number of answered questions in the separate 58-question full assessment. */
export function answeredCount(answers = {}) {
  return ASSESSMENT_ORDER.reduce(
    (count, position) => (Object.prototype.hasOwnProperty.call(answers, position) ? count + 1 : count),
    0,
  );
}
