import { normalizeCvText } from './cvNormalizer.js';
import { assessCv } from './cvAssessmentEngine.js';

/**
 * Native Valoria CV assessment pipeline.
 *
 * This module intentionally accepts extracted plain text rather than a browser File
 * or remote URL. File extraction is an infrastructure concern; keeping it separate
 * makes the assessment deterministic and testable and prevents documents from being
 * sent to an AI provider.
 */
export function processExtractedCvText(extractedText) {
  if (typeof extractedText !== 'string' || extractedText.trim().length < 80) {
    return {
      status: 'REVIEW_REQUIRED',
      error: 'CV text is missing or too short for reliable assessment.',
      normalized: null,
      assessment: null,
    };
  }

  try {
    const normalized = normalizeCvText(extractedText);
    const assessment = assessCv(normalized);

    const status = assessment.score >= 60 ? 'ASSESSED' : 'REVIEW_REQUIRED';

    return {
      status,
      normalized,
      assessment,
      error: null,
    };
  } catch (error) {
    return {
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'CV assessment failed.',
      normalized: null,
      assessment: null,
    };
  }
}
