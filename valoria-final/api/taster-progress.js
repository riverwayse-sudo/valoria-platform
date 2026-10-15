import { createHash, randomBytes } from 'node:crypto';
import { enforceRateLimit } from './_rateLimit.js';
import { EXPERIENCE_BANDS, TASTER_QUESTIONS } from '../src/valuTaster.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(data);
}
function headers() {
  return { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
}
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
function validEmail(value) {
  return typeof value === 'string' && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
function validToken(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{40,64}$/.test(value);
}
function validPartialAnswers(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, answer]) => {
    if (!/^\d+$/.test(key)) return false;
    const index = Number(key);
    return index >= 0 && index < TASTER_QUESTIONS.length
      && Number.isInteger(answer) && answer >= 0 && answer < TASTER_QUESTIONS[index].options.length;
  });
}
async function getProgress(tokenHash) {
  const params = new URLSearchParams({
    resume_token_hash: `eq.${tokenHash}`,
    status: 'eq.in_progress',
    expires_at: `gt.${new Date().toISOString()}`,
    select: 'id,name,role,experience,email,current_question,answers,submission_key,status,expires_at',
    limit: '1',
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/taster_progress?${params}`, { headers: headers() });
  if (!response.ok) throw new Error(`progress-read:${response.status}`);
  return (await response.json())?.[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(res, 500, { error: 'Server misconfigured.' });
  if (!await enforceRateLimit(req, res, { namespace: 'taster-progress', limit: 180, windowSeconds: 3600 })) return;

  const body = req.body || {};
  const action = body.action;
  if (!['init', 'load', 'save', 'complete'].includes(action)) return json(res, 400, { error: 'Unsupported progress action.' });

  if (action === 'init') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const experience = body.experience;
    if (!name || name.length > 200 || !role || role.length > 160 || !validEmail(email)
      || !EXPERIENCE_BANDS.some(item => item.id === experience)) {
      return json(res, 400, { error: 'Provide a valid name, role, email, and experience band before saving snapshot progress.' });
    }
    const resumeToken = randomBytes(32).toString('base64url');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/taster_progress`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=representation' },
      body: JSON.stringify({
        resume_token_hash: hashToken(resumeToken), name, role, experience, email,
        current_question: 0, answers: {}, status: 'in_progress',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    if (!response.ok) {
      console.error('taster-progress: init failed', response.status);
      return json(res, 502, { error: 'We could not establish a resumable snapshot session. Please retry.' });
    }
    const row = (await response.json())?.[0];
    if (!row?.id) return json(res, 502, { error: 'The resumable snapshot session could not be confirmed.' });
    return json(res, 200, { resume_token: resumeToken, progress: { current_question: 0, answers: {}, submission_key: null } });
  }

  if (!validToken(body.resume_token)) return json(res, 401, { error: 'This snapshot resume link is invalid. Start a new session or contact Valoria support.' });
  const tokenHash = hashToken(body.resume_token);

  try {
    const progress = await getProgress(tokenHash);
    if (!progress) return json(res, 404, { error: 'This snapshot session has expired or is no longer resumable.' });

    if (action === 'load') {
      return json(res, 200, { progress: { current_question: progress.current_question, answers: progress.answers || {}, submission_key: progress.submission_key || null } });
    }

    if (action === 'save') {
      const answers = body.answers;
      const currentQuestion = body.current_question;
      const submissionKey = body.submission_key || null;
      if (!validPartialAnswers(answers) || !Number.isInteger(currentQuestion) || currentQuestion < 0 || currentQuestion > TASTER_QUESTIONS.length
        || Object.keys(answers).some(key => Number(key) >= currentQuestion)) {
        return json(res, 400, { error: 'Snapshot progress is incomplete or invalid.' });
      }
      if (submissionKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionKey)) {
        return json(res, 400, { error: 'Invalid submission reference.' });
      }
      if (progress.submission_key && submissionKey && progress.submission_key !== submissionKey) {
        return json(res, 409, { error: 'This snapshot already has a different submission reference. Reload your saved progress.' });
      }
      const patch = {
        answers,
        current_question: currentQuestion,
        updated_at: new Date().toISOString(),
      };
      if (!progress.submission_key && submissionKey) patch.submission_key = submissionKey;
      const params = new URLSearchParams({ id: `eq.${progress.id}`, status: 'eq.in_progress', select: 'id' });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/taster_progress?${params}`, {
        method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' }, body: JSON.stringify(patch),
      });
      if (!response.ok) return json(res, 502, { error: 'Your latest answer could not be saved. Please retry before continuing.' });
      if (!(await response.json())?.[0]?.id) return json(res, 409, { error: 'This snapshot is no longer editable.' });
      return json(res, 200, { saved: true, submission_key: progress.submission_key || submissionKey || null });
    }

    const tasterId = body.taster_id;
    if (typeof tasterId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tasterId)) {
      return json(res, 400, { error: 'A valid saved snapshot reference is required.' });
    }
    if (!progress.submission_key || (body.submission_key && body.submission_key !== progress.submission_key)) {
      return json(res, 409, { error: 'The saved submission reference does not match this progress session.' });
    }
    const params = new URLSearchParams({ id: `eq.${progress.id}`, status: 'eq.in_progress', select: 'id' });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/taster_progress?${params}`, {
      method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'completed', taster_id: tasterId, current_question: TASTER_QUESTIONS.length, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) return json(res, 502, { error: 'Snapshot saved, but recovery status needs a retry.' });
    return json(res, 200, { completed: Boolean((await response.json())?.[0]?.id) });
  } catch (error) {
    console.error('taster-progress: operation failed', error?.message || error);
    return json(res, 502, { error: 'We could not retrieve or save snapshot progress. Please retry.' });
  }
}
