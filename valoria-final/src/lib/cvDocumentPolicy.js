// CV document processing policy. No external AI or document intelligence service.
// Extraction itself is deliberately isolated behind an adapter so a parser can be
// swapped in later without changing the Valoria assessment methodology.

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const MAX_BYTES = 10 * 1024 * 1024;

export function validateCvDocument({ mimeType, size, fileName = '' } = {}) {
  const errors = [];
  if (!ALLOWED_TYPES.has(String(mimeType || '').toLowerCase())) {
    errors.push('Unsupported CV format. Upload PDF, DOCX, or DOC.');
  }
  if (!Number.isFinite(size) || size <= 0) {
    errors.push('CV file is empty or its size could not be determined.');
  } else if (size > MAX_BYTES) {
    errors.push('CV exceeds the 10 MB size limit.');
  }
  if (!String(fileName).trim()) errors.push('CV filename is required.');
  return { valid: errors.length === 0, errors, maxBytes: MAX_BYTES };
}

export function createExtractionJob(document) {
  const validation = validateCvDocument(document);
  if (!validation.valid) {
    return { status: 'FAILED', errors: validation.errors };
  }
  return {
    status: 'PROCESSING',
    documentId: document.id || null,
    parserVersion: 'adapter-v1',
    startedAt: new Date().toISOString(),
  };
}

export { ALLOWED_TYPES, MAX_BYTES };
