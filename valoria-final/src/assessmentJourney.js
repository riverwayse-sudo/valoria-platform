// assessmentJourney.js — canonical full VALU Index sequence.
// The 9-question taster is a separate assessment and never seeds this answer map.
import { QUESTIONS } from "./questions.js";

export const TOTAL_QUESTIONS = QUESTIONS.length; // 58
export const ASSESSMENT_ORDER = QUESTIONS.map((_, index) => index);

export function placeForPosition(position) {
  if (!Number.isInteger(position) || position < 0 || position >= TOTAL_QUESTIONS) {
    throw new Error(`Unknown assessment position: ${position}`);
  }
  return position + 1;
}

export function fullAssessmentPositions() {
  return [...ASSESSMENT_ORDER];
}

export function nextPlaceToAnswer(answers = {}, fromPlace = 1) {
  for (let place = Math.max(1, fromPlace); place <= TOTAL_QUESTIONS; place += 1) {
    const position = ASSESSMENT_ORDER[place - 1];
    if (!Object.prototype.hasOwnProperty.call(answers, position)) return place;
  }
  return null;
}

export function answeredCount(answers = {}) {
  return ASSESSMENT_ORDER.reduce(
    (count, position) => (Object.prototype.hasOwnProperty.call(answers, position) ? count + 1 : count),
    0,
  );
}
