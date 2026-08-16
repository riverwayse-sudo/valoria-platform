import { processExtractedCvText } from './cvAssessmentPipeline.js';

describe('Valoria CV assessment pipeline', () => {
  test('rejects insufficient extracted text for manual review', () => {
    const result = processExtractedCvText('John Doe');
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.assessment).toBeNull();
  });

  test('produces a deterministic assessment from extracted CV text', () => {
    const text = `
      John Doe
      Senior Product Manager
      john@example.com
      Professional Summary
      Product leader with extensive experience delivering digital products and business growth.
      Experience
      Senior Product Manager - Acme Bank - 2018 to 2024
      Product Manager - Example Ltd - 2015 to 2018
      Education
      MBA, Business Administration
      Skills
      Product Strategy, Leadership, Analytics, Operations, Agile
      Certifications
      PMP
      Achievements
      Increased revenue by 25% through product optimisation
      Reduced processing time by 30% through automation
    `;

    const first = processExtractedCvText(text);
    const second = processExtractedCvText(text);

    expect(first.status).toBe('ASSESSED');
    expect(first.assessment.score).toBe(second.assessment.score);
    expect(first.assessment.dimensions).toEqual(second.assessment.dimensions);
    expect(first.normalized.email).toBe('john@example.com');
  });
});
