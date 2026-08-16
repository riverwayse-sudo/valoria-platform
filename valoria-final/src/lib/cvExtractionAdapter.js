// Extraction adapter boundary for Valoria CV processing.
// This module intentionally does NOT call an AI service. It accepts extracted text
// from a local/runtime-specific parser and applies common safety checks before the
// text enters the assessment pipeline.

const MIN_TEXT_LENGTH = 120;
const MAX_TEXT_LENGTH = 200_000;

export function validateExtractedText(text) {
  const value = String(text || '').replace(/\u0000/g, '').trim();
  if (!value) return { valid: false, reason: 'NO_TEXT_EXTRACTED', text: '' };
  if (value.length < MIN_TEXT_LENGTH) return { valid: false, reason: 'INSUFFICIENT_TEXT', text: value };
  if (value.length > MAX_TEXT_LENGTH) return { valid: false, reason: 'TEXT_TOO_LARGE', text: value.slice(0, MAX_TEXT_LENGTH) };
  return { valid: true, reason: null, text: value };
}

export async function extractCvText({ text } = {}) {
  // Parser adapters for PDF/DOCX can supply `text` here. Keeping this contract
  // separate means a local parser can be added without changing the Valoria engine.
  const result = validateExtractedText(text);
  if (!result.valid) {
    return { status: 'REVIEW_REQUIRED', ...result };
  }
  return { status: 'READY', ...result };
}

export { MIN_TEXT_LENGTH, MAX_TEXT_LENGTH };
