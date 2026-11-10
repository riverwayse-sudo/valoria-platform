"use strict";

const { TASTER_QUESTIONS, VALU_VERSION } = require("../valuTaster");
const { LEGACY_TASTER_QUESTIONS, LEGACY_TASTER_VERSION } = require("../valuTasterLegacy");
const { validPartialAnswers } = require("../../api/taster-progress.js");

describe("taster progress answer-key validation", () => {
  test("accepts numeric answer indexes for the new Intelligence-only bank", () => {
    expect(validPartialAnswers({ "0": 2 }, TASTER_QUESTIONS)).toBe(true);
    expect(validPartialAnswers({ "0": 2, "1": 1, "2": 3 }, TASTER_QUESTIONS)).toBe(true);
    expect(VALU_VERSION).toBe("4.2");
  });

  test("accepts numeric answer indexes for preserved v4.1 sessions", () => {
    expect(validPartialAnswers({ "0": 1, "8": 2 }, LEGACY_TASTER_QUESTIONS)).toBe(true);
    expect(LEGACY_TASTER_VERSION).toBe("4.1");
  });

  test("rejects non-numeric answer indexes", () => {
    expect(validPartialAnswers({ "question-zero": 2 }, TASTER_QUESTIONS)).toBe(false);
    expect(validPartialAnswers({ "-1": 2 }, TASTER_QUESTIONS)).toBe(false);
    expect(validPartialAnswers({ "1.5": 2 }, TASTER_QUESTIONS)).toBe(false);
  });

  test("rejects out-of-range question indexes and answer choices", () => {
    expect(validPartialAnswers({ "9": 0 }, TASTER_QUESTIONS)).toBe(false);
    expect(validPartialAnswers({ "0": TASTER_QUESTIONS[0].options.length }, TASTER_QUESTIONS)).toBe(false);
  });

  test("rejects malformed answer maps and missing question banks", () => {
    expect(validPartialAnswers(null, TASTER_QUESTIONS)).toBe(false);
    expect(validPartialAnswers([], TASTER_QUESTIONS)).toBe(false);
    expect(validPartialAnswers({ "0": 1 }, null)).toBe(false);
  });
});
