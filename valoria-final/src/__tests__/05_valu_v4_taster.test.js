import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeTasterResult, TASTER_QUESTIONS, EXPERIENCE_BANDS, VALU_VERSION } from '../valuTaster.js';

describe('VALU v4 taster', () => {
  test('contains exactly 9 approved canonical questions spanning all five PRIME clusters', () => {
    expect(VALU_VERSION).toBe('4.1');
    expect(TASTER_QUESTIONS).toHaveLength(9);
    expect(new Set(TASTER_QUESTIONS.map(q => q.cluster))).toEqual(new Set(['P','R','I','M','E']));
    expect(TASTER_QUESTIONS.map(q => q.id)).toEqual([
      'P1b','R1a','R4a',
      'I2a','I3b','M1b',
      'M2b','E2a','E1a',
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

  test('reports earned points against each cluster maximum and preserves the strongest cluster', () => {
    const answers = Object.fromEntries(TASTER_QUESTIONS.map((q, i) => {
      const choice = i === 0
        ? q.options.reduce((best, option, index, options) => option.score > options[best].score ? index : best, 0)
        : q.options.reduce((best, option, index, options) => option.score < options[best].score ? index : best, 0);
      return [i, choice];
    }));
    const result = computeTasterResult(answers);
    expect(result.completedQuestions).toBe(9);
    expect(result.points.P).toBeGreaterThanOrEqual(0);
    expect(result.maxPoints.P).toBeGreaterThan(0);
    expect(result.strongest.id).toBe('P');
    for (const cluster of ['P','R','I','M','E']) {
      expect(result.points[cluster]).toBeGreaterThanOrEqual(0);
      expect(result.points[cluster]).toBeLessThanOrEqual(result.maxPoints[cluster]);
      expect(result.maxPoints[cluster]).toBeGreaterThan(0);
    }
  });

  test('breaks equal-score strongest and weakest ties in canonical PRIME order', () => {
    const result = computeTasterResult({});
    expect(result.completedQuestions).toBe(0);
    expect(result.strongest.id).toBe('P');
    expect(result.weakest.id).toBe('P');
    expect(Object.values(result.maxPoints).every(value => value > 0)).toBe(true);
  });

  test('does not mutate the answers object', () => {
    const answers = Object.fromEntries(TASTER_QUESTIONS.map((_, i) => [i, 1]));
    const before = JSON.stringify(answers);
    computeTasterResult(answers);
    expect(JSON.stringify(answers)).toBe(before);
  });
  test('runs the taster before account creation and carries the exact result into professional signup', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/VALUIndexV4App.jsx'), 'utf8');
    const gate = readFileSync(resolve(process.cwd(), 'src/VALUIndexV4Gate.jsx'), 'utf8');
    expect(app).toContain('import VALUIndexV4Gate from "./VALUIndexV4Gate.jsx"');
    expect(app).toContain('<VALUIndexV4Gate onComplete={continueToSignup} />');
    expect(app).toContain('https://valoriainstitute.com/professional-signup?');
    expect(gate).toContain('localStorage.setItem("pending_taster_id",payload.taster_id)');
    expect(gate).toContain('localStorage.setItem("pending_taster_name",name.trim())');
    expect(gate).toContain('localStorage.setItem("pending_taster_role",role.trim())');
  });

});
