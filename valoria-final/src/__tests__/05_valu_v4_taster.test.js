import { computeTasterResult, TASTER_QUESTIONS, EXPERIENCE_BANDS, VALU_VERSION } from '../valuTaster.js';

describe('VALU v4 taster', () => {
  test('contains exactly 9 questions spanning all five PRIME clusters', () => {
    expect(VALU_VERSION).toBe('4.0');
    expect(TASTER_QUESTIONS).toHaveLength(9);
    expect(new Set(TASTER_QUESTIONS.map(q => q.cluster))).toEqual(new Set(['P','R','I','M','E']));
  });

  test('keeps every question and answer option as a complete sentence', () => {
    for (const question of TASTER_QUESTIONS) {
      expect(question.q.trim()).toMatch(/[.!?]$/);
      for (const option of question.options) {
        expect(option.text.trim().endsWith('.')).toBe(true);
      }
    }
  });

  test('uses the declared experience bands as metadata options', () => {
    expect(EXPERIENCE_BANDS.map(b => b.id)).toEqual(['0-3','4-8','9-15','15+']);
  });

  test('normalises each cluster independently and uses canonical PRIME order for ties', () => {
    const answers = Object.fromEntries(TASTER_QUESTIONS.map((q, i) => [i, i === 0 ? 3 : 0]));
    const result = computeTasterResult(answers);
    expect(result.completedQuestions).toBe(9);
    expect(result.normalisedScores.P).toBe(100);
    expect(result.normalisedScores.R).toBe(25);
    expect(result.normalisedScores.I).toBe(25);
    expect(result.normalisedScores.M).toBe(25);
    expect(result.normalisedScores.E).toBe(25);
    expect(result.strongest.id).toBe('P');
    expect(result.weakest.id).toBe('R');
  });

  test('does not mutate the answers object', () => {
    const answers = Object.fromEntries(TASTER_QUESTIONS.map((_, i) => [i, 1]));
    const before = JSON.stringify(answers);
    computeTasterResult(answers);
    expect(JSON.stringify(answers)).toBe(before);
  });
});
