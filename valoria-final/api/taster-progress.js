import { createHash } from 'node:crypto';
import { enforceRateLimit } from './_rateLimit.js';
import { applyCors, handlePreflight } from './_cors.js';
import { EXPERIENCE_BANDS, TASTER_QUESTIONS, VALU_VERSION } from '../src/valuTaster.js';
import { LEGACY_TASTER_QUESTIONS, LEGACY_TASTER_VERSION } from '../src/valuTasterLegacy.js';

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
function validSignupKey(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function consumeRegistrationRateLimit(req) {
  const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_rate_limit`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ p_rate_key: `valu-taster-registration:${ip}`, p_limit: 12, p_window_seconds: 3600 }),
  });
  if (!response.ok) throw new Error(`registration-rate-limit:${response.status}`);
  const result = await response.json();
  return Array.isArray(result) ? result[0] : result;
}
function questionBankForVersion(version) {
  if (version === VALU_VERSION) return TASTER_QUESTIONS;
  if (version === LEGACY_TASTER_VERSION) return LEGACY_TASTER_QUESTIONS;
  return null;
}

function validPartialAnswers(value, questionBank) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !questionBank) return false;
  return Object.entries(value).every(([key, answer]) => {
    const index = Number(key);
    if (!Number.isInteger(index) || String(index) !== key) return false;
    return index >= 0 && index < questionBank.length
      && Number.isInteger(answer) && answer >= 0 && answer < questionBank[index].options.length;
  });
}
async function getProgress(tokenHash) {
  const params = new URLSearchParams({
    resume_token_hash: `eq.${tokenHash}`,
    status: 'eq.in_progress',
    expires_at: `gt.${new Date().toISOString()}`,
    select: 'id,name,role,experience,email,current_question,answers,submission_key,status,expires_at,lead_capture_id,taster_version,total_questions',
    limit: '1',
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/taster_progress?${params}`, { headers: headers() });
  if (!response.ok) throw new Error(`progress-read:${response.status}`);
  return (await response.json())?.[0] || null;
}

export default async function handler(req, res) {
  const originAllowed = applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!originAllowed && req.headers.origin) return json(res, 403, { error: 'Origin not allowed.' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(res, 500, { error: 'Server misconfigured.' });
  if (!await enforceRateLimit(req, res, { namespace: 'taster-progress', limit: 180, windowSeconds: 3600 })) return;

  const body = req.body || {};
  const action = body.action;
  if (!['register', 'load', 'save', 'complete'].includes(action)) return json(res, 400, { error: 'Unsupported progress action.' });

  // Registration is the only entry point for a new taster. It creates the
  // contact record and resumable progress in one database transaction.
  if (action === 'register') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const experience = body.experience;
    const organisation = typeof body.organisation === 'string' ? body.organisation.trim() : '';
    const interest = typeof body.interest === 'string' ? body.interest.trim() : '';
    if (!validToken(body.resume_token)) return json(res, 401, { error: 'A secure registration session could not be verified. Please retry.' });
    if (!validSignupKey(body.signup_key)) return json(res, 400, { error: 'Your registration reference is invalid. Please refresh and try again.' });
    if (!name || name.length > 200 || !role || role.length > 160 || !validEmail(email)
      || !EXPERIENCE_BANDS.some(item => item.id === experience)
      || organisation.length > 180 || interest.length > 120 || body.privacy_acknowledged !== true) {
      return json(res, 400, { error: 'Complete the required registration details and acknowledge the Privacy Notice before continuing.' });
    }
    try {
      const limit = await consumeRegistrationRateLimit(req);
      if (!limit?.allowed) {
        if (limit?.retry_after_seconds) res.setHeader('Retry-After', String(limit.retry_after_seconds));
        return json(res, 429, { error: 'Too many registration attempts. Please try again later.' });
      }
    } catch (err) {
      console.error('taster-progress: registration rate limiter failed', err?.message || err);
      return json(res, 503, { error: 'Registration is temporarily unavailable. Please try again shortly.' });
    }
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/begin_valu_taster_signup`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          p_signup_key: body.signup_key,
          p_resume_token_hash: hashToken(body.resume_token),
          p_name: name,
          p_email: email,
          p_role: role,
          p_experience: experience,
          p_organisation: organisation || null,
          p_interest: interest || null,
          p_marketing_consent: body.marketing_consent === true,
          p_privacy_acknowledged: body.privacy_acknowledged === true,
          p_utm_source: typeof body.utm_source === 'string' ? body.utm_source.slice(0, 200) : null,
          p_utm_medium: typeof body.utm_medium === 'string' ? body.utm_medium.slice(0, 200) : null,
          p_utm_campaign: typeof body.utm_campaign === 'string' ? body.utm_campaign.slice(0, 200) : null,
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('taster-progress: registration transaction failed', response.status, detail.slice(0, 500));
        return json(res, 502, { error: 'We could not securely save your registration. Your details have not been submitted; please retry.' });
      }
      const payload = await response.json();
      const record = Array.isArray(payload) ? payload[0] : payload;
      if (!record?.lead_capture_id || !record?.progress_id) return json(res, 502, { error: 'Your registration could not be confirmed. Please retry.' });
      return json(res, 200, { registered: true, lead_capture_id: record.lead_capture_id, progress_id: record.progress_id });
    } catch (err) {
      console.error('taster-progress: registration network error', err?.message || 'unknown');
      return json(res, 502, { error: 'Your registration could not be confirmed. Please retry.' });
    }
  }

  if (!validToken(body.resume_token)) return json(res, 401, { error: 'This resume link is invalid. Start a new session or contact Valoria support.' });
  const tokenHash = hashToken(body.resume_token);

  try {
    const progress = await getProgress(tokenHash);
    if (!progress) return json(res, 404, { error: 'This session has expired or is no longer resumable.' });

    if (action === 'load') {
      return json(res, 200, { progress: { name: progress.name, role: progress.role, experience: progress.experience, email: progress.email, lead_capture_id: progress.lead_capture_id || null, current_question: progress.current_question, answers: progress.answers || {}, submission_key: progress.submission_key || null, taster_version: progress.taster_version, total_questions: progress.total_questions } });
    }

    const questionBank = questionBankForVersion(progress.taster_version);
    if (!questionBank) {
      return json(res, 409, { error: 'This saved taster session uses a retired format and needs support before it can continue.' });
    }

    if (action === 'save') {
      const answers = body.answers;
      const currentQuestion = body.current_question;
      const submissionKey = body.submission_key || null;
      if (!validPartialAnswers(answers, questionBank) || !Number.isInteger(currentQuestion) || currentQuestion < 0 || currentQuestion > questionBank.length
        || Object.keys(answers).some(key => Number(key) >= currentQuestion)) {
        return json(res, 400, { error: 'Taster progress is incomplete or invalid.' });
      }
      if (submissionKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionKey)) {
        return json(res, 400, { error: 'Invalid submission reference.' });
      }
      if (progress.submission_key && submissionKey && progress.submission_key !== submissionKey) {
        return json(res, 409, { error: 'This taster already has a different submission reference. Reload your saved progress.' });
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
      if (!(await response.json())?.[0]?.id) return json(res, 409, { error: 'This taster is no longer editable.' });
      return json(res, 200, { saved: true, submission_key: progress.submission_key || submissionKey || null });
    }

    const tasterId = body.taster_id;
    if (typeof tasterId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tasterId)) {
      return json(res, 400, { error: 'A valid saved taster reference is required.' });
    }
    if (!progress.submission_key || (body.submission_key && body.submission_key !== progress.submission_key)) {
      return json(res, 409, { error: 'The saved submission reference does not match this progress session.' });
    }
    if (!progress.lead_capture_id) return json(res, 409, { error: 'Complete your registration before saving this taster.' });
    const tasterParams = new URLSearchParams({ id: `eq.${tasterId}`, submission_key: `eq.${progress.submission_key}`, lead_capture_id: `eq.${progress.lead_capture_id}`, select: 'id,lead_capture_id', limit: '1' });
    const tasterResponse = await fetch(`${SUPABASE_URL}/rest/v1/taster_sessions?${tasterParams}`, { headers: headers() });
    if (!tasterResponse.ok) return json(res, 502, { error: 'Could not verify the completed taster reference.' });
    if (!(await tasterResponse.json())?.[0]?.id) return json(res, 409, { error: 'The taster reference does not match this saved submission.' });
    const params = new URLSearchParams({ id: `eq.${progress.id}`, status: 'eq.in_progress', select: 'id' });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/taster_progress?${params}`, {
      method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'completed', taster_id: tasterId, current_question: questionBank.length, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) return json(res, 502, { error: 'Taster saved, but recovery status needs a retry.' });
    return json(res, 200, { completed: Boolean((await response.json())?.[0]?.id) });
  } catch (error) {
    console.error('taster-progress: operation failed', error?.message || error);
    return json(res, 502, { error: 'We could not retrieve or save taster progress. Please retry.' });
  }
}
