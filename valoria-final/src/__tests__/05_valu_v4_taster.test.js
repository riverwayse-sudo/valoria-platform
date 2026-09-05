import { computeTasterResult, TASTER_QUESTIONS, EXPERIENCE_BANDS, VALU_VERSION } from '../valuTaster.js';

describe('VALU v4 taster', () => {
  test('contains exactly 15 canonical questions spanning all five PRIME clusters', () => {
    expect(VALU_VERSION).toBe('4.0');
    expect(TASTER_QUESTIONS).toHaveLength(15);
    expect(new Set(TASTER_QUESTIONS.map(q => q.cluster))).toEqual(new Set(['P','R','I','M','E']));
    expect(TASTER_QUESTIONS.map(q => q.id)).toEqual([
      'P1a','P1b','P2a',
      'R1a','R1b','R4a',
      'I1a','I2a','I3b',
      'M1a','M1b','M2b',
      'E1a','E1b','E2a',
    ]);
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

  test('normalises each cluster independently and preserves the strongest cluster', () => {
    const answers = Object.fromEntries(TASTER_QUESTIONS.map((q, i) => {
      const choice = i === 0
        ? q.options.reduce((best, option, index, options) => option.score > options[best].score ? index : best, 0)
        : q.options.reduce((best, option, index, options) => option.score < options[best].score ? index : best, 0);
      return [i, choice];
    }));
    const result = computeTasterResult(answers);
    expect(result.completedQuestions).toBe(15);
    expect(result.normalisedScores.P).toBe(50);
    expect(result.strongest.id).toBe('P');
    for (const cluster of ['P','R','I','M','E']) {
      expect(result.normalisedScores[cluster]).toBeGreaterThanOrEqual(0);
      expect(result.normalisedScores[cluster]).toBeLessThanOrEqual(100);
    }
  });

  test('breaks equal-score strongest and weakest ties in canonical PRIME order', () => {
    const result = computeTasterResult({});
    expect(result.completedQuestions).toBe(0);
    expect(result.strongest.id).toBe('P');
    expect(result.weakest.id).toBe('P');
  });

  test('does not mutate the answers object', () => {
    const answers = Object.fromEntries(TASTER_QUESTIONS.map((_, i) => [i, 1]));
    const before = JSON.stringify(answers);
    computeTasterResult(answers);
    expect(JSON.stringify(answers)).toBe(before);
  });
});
