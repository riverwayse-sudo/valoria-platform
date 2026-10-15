import { TASTER_QUESTIONS, computeTasterResult, EXPERIENCE_BANDS, VALU_VERSION } from '../src/valuTaster.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60 * 60;

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

function validAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
  const keys = Object.keys(answers);
  if (keys.length !== TASTER_QUESTIONS.length || keys.some(k => !/^\d+$/.test(k))) return false;
  return TASTER_QUESTIONS.every((q, idx) => Number.isInteger(answers[idx]) && answers[idx] >= 0 && answers[idx] < q.options.length);
}

async function consumeRateLimit(ip) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_rate_limit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_rate_key: `taster-submit:${ip}`,
      p_limit: RATE_LIMIT,
      p_window_seconds: RATE_WINDOW_SECONDS,
    }),
  });
  if (!response.ok) throw new Error(`rate-limit:${response.status}`);
  const result = await response.json();
  return Array.isArray(result) ? result[0] : result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(res, 500, { error: 'Server misconfigured.' });

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  try {
    const limit = await consumeRateLimit(ip);
    if (!limit?.allowed) {
      if (limit?.retry_after_seconds) res.setHeader('Retry-After', String(limit.retry_after_seconds));
      return json(res, 429, { error: 'Too many taster submissions. Please try again later.' });
    }
  } catch (err) {
    console.error('submit-taster: shared rate limiter failed', err?.message || err);
    return json(res, 503, { error: 'The assessment service is temporarily unavailable. Please try again shortly.' });
  }

  const { name, role, experience, answers, email, submission_key } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''; 
  if (!normalizedEmail || normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return json(res, 400, { error: 'A valid email address is required before starting a VALU snapshot.' });
  if (typeof submission_key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submission_key)) return json(res, 400, { error: 'A valid submission reference is required. Please retry the final step.' });
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 200) return json(res, 400, { error: 'Name is required and must be 200 characters or fewer.' });
  if (typeof role !== 'string' || !role.trim() || role.trim().length > 160) return json(res, 400, { error: 'Role is required and must be 160 characters or fewer.' });
  if (!EXPERIENCE_BANDS.some(b => b.id === experience)) return json(res, 400, { error: 'Select a valid experience band.' });
  if (!validAnswers(answers)) return json(res, 400, { error: 'Taster answers are incomplete or invalid.' });

  const results = computeTasterResult(answers);
  try {
    const submitRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_taster_with_identity_candidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        p_submission_key: submission_key,
        p_name: name.trim(),
        p_role: role.trim(),
        p_experience: experience,
        p_email: normalizedEmail,
        p_answers: answers,
        p_cluster_scores: results.normalisedScores,
        p_strongest_cluster: results.strongest.id,
        p_weakest_cluster: results.weakest.id,
        p_taster_version: String(VALU_VERSION),
      }),
    });
    if (!submitRes.ok) {
      console.error('submit-taster: atomic submission failed', submitRes.status);
      return json(res, 502, { error: 'We could not securely save your snapshot and recovery record together. Please retry.' });
    }
    const payload = await submitRes.json();
    const record = Array.isArray(payload) ? payload[0] : payload;
    if (!record?.taster_id) return json(res, 502, { error: 'The snapshot save could not be confirmed. Please retry.' });
    return json(res, 200, { results, taster_id: record.taster_id, created: record.created !== false });
  } catch (err) {
    console.error('submit-taster: atomic submission network error', err?.message || 'unknown');
    return json(res, 502, { error: 'The snapshot save could not be confirmed. Please retry.' });
  }
}