import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../assessmentLock.js';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function sessionAccessToken() {
  // Supabase stores the auth session under a project-specific localStorage key.
  // We deliberately do not persist or invent credentials here.
  if (typeof localStorage === 'undefined') return null;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) || '';
    if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value?.access_token) return value.access_token;
    } catch { /* ignore malformed/stale session keys */ }
  }
  return null;
}

export function validateCvFile(file) {
  if (!(file instanceof File)) return { valid: false, error: 'CV_FILE_REQUIRED' };
  if (!['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type.toLowerCase())) {
    return { valid: false, error: 'UNSUPPORTED_CV_FORMAT' };
  }
  if (file.size <= 0 || file.size > MAX_BYTES) return { valid: false, error: 'CV_SIZE_INVALID' };
  return { valid: true };
}

export async function uploadCvForAssessment(file) {
  const check = validateCvFile(file);
  if (!check.valid) throw new Error(check.error);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('SUPABASE_CONFIG_MISSING');

  const token = sessionAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const form = new FormData();
  form.append('file', file, file.name);
  const response = await fetch(`${SUPABASE_URL}/functions/v1/upload-cv-assessment`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'CV_UPLOAD_FAILED');

  // The upload endpoint only creates the immutable document + assessment job.
  // Processing is a separate authenticated action so the worker retains the
  // caller's identity boundary.
  const processResponse = await fetch(`${SUPABASE_URL}/functions/v1/process-cv-assessment`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ assessment_id: data.assessment.id }),
  });
  const processed = await processResponse.json().catch(() => ({}));
  if (!processResponse.ok) throw new Error(processed.error || 'CV_PROCESSING_FAILED');
  return { ...data, processing: processed };
}

export { ACCEPT, MAX_BYTES };
