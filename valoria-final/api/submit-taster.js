import { createHash } from 'node:crypto';
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

  const { resume_token, submission_key } = req.body || {};
  if (typeof resume_token !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(resume_token)) return json(res, 401, { error: 'A valid snapshot resume token is required.' });
  if (typeof submission_key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submission_key)) return json(res, 400, { error: 'A valid submission reference is required. Please retry the final step.' });
  const tokenHash = createHash('sha256').update(resume_token).digest('hex');
  const progressParams = new URLSearchParams({
    resume_token_hash: `eq.${tokenHash}`,
    status: 'eq.in_progress',
    expires_at: `gt.${new Date().toISOString()}`,
    select: 'name,role,experience,email,current_question,answers,submission_key',
    limit: '1',
  });
  const progressRes = await fetch(`${SUPABASE_URL}/rest/v1/taster_progress?${progressParams}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!progressRes.ok) return json(res, 502, { error: 'Could not verify your saved snapshot progress.' });
  const progress = (await progressRes.json())?.[0];
  if (!progress) return json(res, 404, { error: 'Your snapshot progress has expired or cannot be resumed.' });
  if (progress.submission_key !== submission_key) return json(res, 409, { error: 'The submission reference does not match your saved progress.' });
  const { name, role, experience, email, answers } = progress;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return json(res, 400, { error: 'The saved contact email is invalid. Contact Valoria support.' });
  if (progress.current_question !== TASTER_QUESTIONS.length || !validAnswers(answers)) return json(res, 400, { error: 'Finish and save all snapshot answers before submitting.' });





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
        // Must be the points object. computeTasterResult() returns
        // { points, maxPoints, strongest, weakest }. Commit 7458831
        // ("Replace VALU snapshot percentages with points") renamed
        // normalisedScores to points in valuTaster.js but did not update this
        // handler, so `results.normalisedScores` was undefined; JSON.stringify
        // then dropped the key and the RPC rejected the whole submission with
        // 'cluster scores must be an object' (22023) — a 502 that lost all 15
        // answers. Points are the canonical display and storage unit for a
        // snapshot; do not substitute a percentage or an empty object.
        p_cluster_scores: results.points,
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