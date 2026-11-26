import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { TASTER_QUESTIONS, computeTasterResult, VALU_VERSION, isValidExperienceBand } from '../src/valuTaster.js';
import { enforceRateLimit } from './_rateLimit.js';
import { applyCors, handlePreflight } from './_cors.js';

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
function validToken(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{40,64}$/.test(value);
}
function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function validAnswers(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, answer]) => {
    if (!/^\d+$/.test(key)) return false;
    const index = Number(key);
    return index >= 0 && index < TASTER_QUESTIONS.length
      && Number.isInteger(answer) && answer >= 0 && answer < TASTER_QUESTIONS[index].options.length;
  });
}
async function readSession(tokenHash) {
  const query = new URLSearchParams({
    resume_token_hash: `eq.${tokenHash}`,
    expires_at: `gt.${new Date().toISOString()}`,
    select: 'id,resume_token_hash,signup_key,name,role,experience,email,organisation,interest,marketing_consent,privacy_acknowledged,answers,current_question,submission_key,status,taster_id,lead_capture_id,taster_version',
    limit: '1',
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/valu_preaccount_taster_progress?${query}`, { headers: headers() });
  if (!response.ok) throw new Error(`preaccount-read:${response.status}`);
  return (await response.json())?.[0] || null;
}
async function rpc(name, payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: headers(), body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${name}:${response.status}:${detail.slice(0, 240)}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

export default async function handler(req, res) {
  const originAllowed = applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  if (!originAllowed && req.headers.origin) return json(res, 403, { error: 'Origin not allowed.' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(res, 500, { error: 'Server misconfigured.' });
  if (!await enforceRateLimit(req, res, { namespace: 'taster-first', limit: 90, windowSeconds: 3600 })) return;

  const body = req.body || {};
  const action = body.action;

  if (action === 'start') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const experience = body.experience;
    const organisation = typeof body.organisation === 'string' ? body.organisation.trim() : '';
    const interest = typeof body.interest === 'string' ? body.interest.trim() : '';
    if (!name || name.length > 200 || !role || role.length > 160 || !validEmail(email)
      || !isValidExperienceBand(experience)
      || organisation.length > 180 || interest.length > 120 || body.privacy_acknowledged !== true) {
      return json(res, 400, { error: 'Complete your details and acknowledge the Privacy Notice before starting.' });
    }
    if (!await enforceRateLimit(req, res, { namespace: 'taster-first-email', limit: 3, windowSeconds: 3600, subject: email })) return;
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const signupKey = randomUUID();
    const submissionKey = randomUUID();
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/valu_preaccount_taster_progress`, {
        method: 'POST',
        headers: { ...headers(), Prefer: 'return=representation' },
        body: JSON.stringify({
          resume_token_hash: tokenHash, signup_key: signupKey, name, role, experience, email,
          organisation: organisation || null, interest: interest || null,
          marketing_consent: body.marketing_consent === true, privacy_acknowledged: true,
          answers: {}, current_question: 0, submission_key: submissionKey,
          taster_version: VALU_VERSION,
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('taster-first:start failed', { status: response.status });
        return json(res, 502, { error: 'We could not securely start your Taster. Please retry.' });
      }
      return json(res, 201, { resume_token: token, submission_key: submissionKey, current_question: 0, answers: {} });
    } catch (error) {
      console.error('taster-first:start error', { name: error?.name || 'Error' });
      return json(res, 502, { error: 'We could not start your Taster. Please retry.' });
    }
  }

  if (!validToken(body.resume_token)) return json(res, 401, { error: 'A valid resume session is required.' });
  const tokenHash = hashToken(body.resume_token);
  try {
    const session = await readSession(tokenHash);
    if (!session) return json(res, 404, { error: 'This saved Taster has expired or cannot be resumed.' });

    if (action === 'load') {
      return json(res, 200, { progress: {
        name: session.name, role: session.role, experience: session.experience, email: session.email,
        answers: session.answers || {}, current_question: session.current_question,
        submission_key: session.submission_key, status: session.status,
        taster_id: session.taster_id || null,
      } });
    }

    if (action === 'save') {
      if (session.status !== 'in_progress') return json(res, 409, { error: 'This Taster is already complete and cannot be changed.' });
      const answers = body.answers;
      const currentQuestion = body.current_question;
      if (!validAnswers(answers) || !Number.isInteger(currentQuestion)
        || currentQuestion < 0 || currentQuestion > TASTER_QUESTIONS.length
        || Object.keys(answers).some(key => Number(key) >= currentQuestion)) {
        return json(res, 400, { error: 'Taster progress is incomplete or invalid.' });
      }
      const response = await fetch(`${SUPABASE_URL}/rest/v1/valu_preaccount_taster_progress?id=eq.${session.id}&status=eq.in_progress`, {
        method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' },
        body: JSON.stringify({ answers, current_question: currentQuestion, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) return json(res, 502, { error: 'Your latest answer could not be saved. Please retry.' });
      if (!(await response.json())?.[0]?.id) return json(res, 409, { error: 'This Taster session is no longer editable.' });
      return json(res, 200, { saved: true });
    }

    if (action === 'complete') {
      if (session.status === 'completed' && session.taster_id) {
        return json(res, 200, { completed: true, already_completed: true, taster_id: session.taster_id, results: computeTasterResult(session.answers) });
      }
      if (session.current_question !== TASTER_QUESTIONS.length || !validAnswers(session.answers)
        || Object.keys(session.answers).length !== TASTER_QUESTIONS.length) {
        return json(res, 400, { error: 'Finish and save all Taster responses before completing.' });
      }
      const results = computeTasterResult(session.answers);
      const lead = await rpc('begin_valu_taster_signup', {
        p_signup_key: session.signup_key,
        p_resume_token_hash: tokenHash,
        p_name: session.name,
        p_email: session.email,
        p_role: session.role,
        p_experience: session.experience,
        p_organisation: session.organisation,
        p_interest: session.interest,
        p_marketing_consent: session.marketing_consent,
        p_privacy_acknowledged: session.privacy_acknowledged,
      });
      if (!lead?.lead_capture_id || !lead?.progress_id) throw new Error('registration handoff did not return canonical IDs');

      const progressPatch = await fetch(`${SUPABASE_URL}/rest/v1/taster_progress?id=eq.${lead.progress_id}&lead_capture_id=eq.${lead.lead_capture_id}`, {
        method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' },
        body: JSON.stringify({
          answers: session.answers, current_question: TASTER_QUESTIONS.length,
          submission_key: session.submission_key, taster_version: VALU_VERSION,
          total_questions: TASTER_QUESTIONS.length, updated_at: new Date().toISOString(),
        }),
      });
      if (!progressPatch.ok) throw new Error(`canonical progress save failed:${progressPatch.status}`);

      const submitted = await rpc('submit_taster_first_with_identity_candidate', {
        p_submission_key: session.submission_key,
        p_name: session.name,
        p_role: session.role,
        p_experience: session.experience,
        p_email: session.email,
        p_answers: session.answers,
        p_cluster_scores: { P: null, R: null, I: results.intelligenceScore, M: null, E: null },
        p_strongest_cluster: 'I',
        p_weakest_cluster: 'I',
        p_taster_version: VALU_VERSION,
        p_lead_capture_id: lead.lead_capture_id,
      });
      if (!submitted?.taster_id) throw new Error('completed taster was not returned');

      const completeProgress = await fetch(`${SUPABASE_URL}/rest/v1/taster_progress?id=eq.${lead.progress_id}&lead_capture_id=eq.${lead.lead_capture_id}`, {
        method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'completed', taster_id: submitted.taster_id, current_question: TASTER_QUESTIONS.length, updated_at: new Date().toISOString() }),
      });
      if (!completeProgress.ok) throw new Error(`canonical completion marker failed:${completeProgress.status}`);

      const tempComplete = await fetch(`${SUPABASE_URL}/rest/v1/valu_preaccount_taster_progress?id=eq.${session.id}&status=eq.in_progress`, {
        method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'completed', taster_id: submitted.taster_id, lead_capture_id: lead.lead_capture_id, updated_at: new Date().toISOString() }),
      });
      if (!tempComplete.ok) throw new Error(`preaccount completion marker failed:${tempComplete.status}`);
      return json(res, 200, { completed: true, taster_id: submitted.taster_id, results });
    }

    return json(res, 400, { error: 'Unsupported Taster-first action.' });
  } catch (error) {
    console.error('taster-first operation failed', { action, name: error?.name || 'Error' });
    return json(res, 502, { error: 'We could not complete that step. Your saved answers remain available; please retry.' });
  }
}
