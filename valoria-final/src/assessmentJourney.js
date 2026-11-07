// assessmentJourney.js — formal VALU assessment lifecycle.
//
// The nine-question taster is a separate directional experience. It is not
// part of the formal instrument, does not seed answers, and is never scored
// into the official VALU Index.
//
// The formal VALU assessment always consists of all 58 canonical questions,
// starts at Question 1, and records its own independent answer map.

import { QUESTIONS } from "./questions.js";

export const TOTAL_QUESTIONS = QUESTIONS.length;
export const ASSESSMENT_ORDER = QUESTIONS.map((_, index) => index);

// Compatibility exports for older callers. There is no opening/continuation
// split in the formal assessment: every formal question belongs to the same
// 58-question instrument.
export const OPENING_POSITIONS = [];
export const REMAINING_POSITIONS = [...ASSESSMENT_ORDER];
export const OPENING_SESSION_LENGTH = 0;
export const REMAINING_SESSION_LENGTH = TOTAL_QUESTIONS;

const placeByPosition = new Map(ASSESSMENT_ORDER.map((position, place) => [position, place]));

/** 1-based position in the formal 58-question assessment. */
export function placeForPosition(position) {
  const place = placeByPosition.get(position);
  if (place === undefined) throw new Error(`Unknown assessment position: ${position}`);
  return place + 1;
}

/** No formal assessment questions are borrowed from the separate taster. */
export function openingPositions() {
  return [];
}

/** All 58 canonical bank positions belong to the formal assessment. */
export function remainingPositions() {
  return [...REMAINING_POSITIONS];
}

/**
 * Legacy compatibility helper. Taster answers must never seed the formal
 * assessment, so this function intentionally returns an empty answer map.
 */
export function seedAnswersFromOpening() {
  return {};
}

/**
 * Return the 1-based position of the next unanswered formal question, or null
 * when all 58 formal questions have been answered.
 */
export function nextPlaceToAnswer(answers = {}, fromPlace = 1) {
  for (let place = Math.max(1, fromPlace); place <= ASSESSMENT_ORDER.length; place += 1) {
    const position = ASSESSMENT_ORDER[place - 1];
    if (!Object.prototype.hasOwnProperty.call(answers, position)) return place;
  }
  return null;
}

/** Number of formal questions answered; taster answers are never included. */
export function answeredCount(answers = {}) {
  return ASSESSMENT_ORDER.reduce(
    (count, position) => (Object.prototype.hasOwnProperty.call(answers, position) ? count + 1 : count),
    0,
  );
}
