// api/submit-assessment.js
// Server-authoritative assessment submission. The browser may submit answers
// and presentation mappings, but it may not invent score-bearing options.
// The canonical question bank remains the source of truth for scoring.

import { computeResults } from '../src/scoringEngine.js';
import { QUESTIONS } from '../src/questions.js';
import { computeFingerprint } from '../src/lockEngine.js';
import { verifyValuHandoffToken } from '../lib/valu-handoff-token.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_NAME_LENGTH = 200;
const MAX_ROLE_LENGTH = 160;
const MAX_TIMINGS_LENGTH = QUESTIONS.length;
const MAX_SHUFFLE_KEYS = QUESTIONS.length;
const EXPERIENCE_BANDS = new Set(['0-3', '4-8', '9-15', '15+']);
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60 * 60;

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(data);
}
function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function optionKey(option) {
  if (!option || typeof option !== 'object') return null;
  return JSON.stringify({ text: option.text ?? option.label ?? null, score: option.score ?? null });
}
function validateShuffleMap(shuffleMap) {
  if (!isPlainObject(shuffleMap)) return false;
  for (let idx = 0; idx < QUESTIONS.length; idx += 1) {
    const question = QUESTIONS[idx], mapped = shuffleMap[idx];
    if (mapped === undefined) continue;
    if (!Array.isArray(mapped) || mapped.length !== question.options.length) return false;
    const canonical = question.options.map(optionKey).sort();
    const submitted = mapped.map(optionKey).sort();
    if (canonical.length !== submitted.length) return false;
    for (let i = 0; i < canonical.length; i += 1) if (canonical[i] !== submitted[i]) return false;
  }
  return true;
}
function validateAnswers(answers) {
  if (!isPlainObject(answers) || Object.keys(answers).length !== QUESTIONS.length) return false;
  return QUESTIONS.every((question, idx) => {
    const value = answers[idx];
    return Number.isInteger(value) && value >= 0 && value < question.options.length;
  });
}
async function consumeRateLimit(ip) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_rate_limit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ p_rate_key: `assessment-submit:${ip}`, p_limit: RATE_LIMIT, p_window_seconds: RATE_WINDOW_SECONDS }),
  });
  if (!response.ok) throw new Error(`rate-limit:${response.status}`);
  const result = await response.json();
  return Array.isArray(result) ? result[0] : result;
}

async function findExistingAssessment(tasterId, fingerprint) {
  const params = new URLSearchParams({
    taster_id: `eq.${tasterId}`,
    identity_hash: `eq.${fingerprint}`,
    select: 'id,user_id,taster_id,total_score,designation,cluster_scores,skill_scores,completed_at,report_token',
    limit: '1',
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!response.ok) throw new Error('Could not verify an existing assessment.');
  return (await response.json())?.[0] || null;
}
function existingResults(assessment) {
  return {
    valuIndex: assessment.total_score,
    desig: { name: assessment.designation || '' },
    clusterScores: assessment.cluster_scores || {},
    skillScores: assessment.skill_scores || {},
  };
}
async function verifyHandoffRequest(body, res) {
  const tasterId = body?.taster_id;
  if (typeof tasterId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tasterId)) {
    return json(res, 400, { ok: false, error: 'A valid snapshot reference is required.' });
  }
  const handoff = verifyValuHandoffToken(body?.handoff_token, tasterId);
  if (!handoff) return json(res, 401, { ok: false, error: 'The secure assessment handoff is missing or expired.' });

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: \`Bearer \${SERVICE_ROLE_KEY}\` };
  const params = new URLSearchParams({ id: \`eq.\${tasterId}\`, select: 'id,user_id,name,role,completed_at', limit: '1' });
  const tasterRes = await fetch(\`\${SUPABASE_URL}/rest/v1/taster_sessions?\${params}\`, { headers });
  if (!tasterRes.ok) return json(res, 502, { ok: false, error: 'Could not verify the VALU snapshot.' });
  const taster = (await tasterRes.json())?.[0];
  if (!taster) return json(res, 404, { ok: false, error: 'VALU snapshot not found.' });
  if (!taster.completed_at) return json(res, 409, { ok: false, error: 'Complete your VALU snapshot first.' });
  if (taster.user_id !== handoff.sub) return json(res, 403, { ok: false, error: 'This handoff does not match the snapshot owner.' });
  const normalise = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalise(taster.name) !== normalise(body?.name) || normalise(taster.role) !== normalise(body?.role)) {
    return json(res, 403, { ok: false, error: 'The assessment identity does not match the saved snapshot.' });
  }

  const userRes = await fetch(\`\${SUPABASE_URL}/auth/v1/admin/users/\${handoff.sub}\`, { headers });
  if (!userRes.ok) return json(res, 502, { ok: false, error: 'Could not verify the Valoria account.' });
  const user = await userRes.json();
  if (!user.email_confirmed_at) return json(res, 403, { ok: false, error: 'Confirm your Valoria account email before continuing.' });
  return json(res, 200, { ok: true, expires_at: handoff.exp });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    console.error('submit-assessment: missing Supabase server configuration');
    return json(res, 500, { error: 'Server misconfigured.' });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  try {
    const limit = await consumeRateLimit(ip);
    if (!limit?.allowed) {
      if (limit?.retry_after_seconds) res.setHeader('Retry-After', String(limit.retry_after_seconds));
      return json(res, 429, { error: 'Too many assessment submissions. Please try again later.' });
    }
  } catch (err) {
    console.error('submit-assessment: shared rate limiter failed', err?.message || err);
    return json(res, 503, { error: 'The assessment service is temporarily unavailable. Please try again shortly.' });
  }

  const body = req.body || {};
  if (body.action === 'verify-handoff') return verifyHandoffRequest(body, res);
  const { name, role, experience, answers, timings, shuffleMap, taster_id: tasterId, handoff_token: handoffToken } = body;
  if (typeof tasterId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tasterId)) {
    return json(res, 400, { error: 'Open the full VALU assessment from your completed VALU snapshot. A valid snapshot reference is required.' });
  }
  const handoff = verifyValuHandoffToken(handoffToken, tasterId);
  if (!handoff) return json(res, 401, { error: 'Your secure VALU handoff is missing or expired. Return to your Valoria account and reopen the assessment.' });
  if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NAME_LENGTH) return json(res, 400, { error: 'Name is required and must be 200 characters or fewer.' });
  if (typeof role !== 'string' || !role.trim() || role.trim().length > MAX_ROLE_LENGTH) return json(res, 400, { error: 'Role is required and must be 160 characters or fewer.' });
  if (!EXPERIENCE_BANDS.has(experience)) return json(res, 400, { error: 'Select a valid experience band.' });
  if (!validateAnswers(answers)) return json(res, 400, { error: 'Assessment answers are incomplete or invalid.' });
  if (!Array.isArray(timings) || timings.length !== MAX_TIMINGS_LENGTH || timings.some(value => !Number.isFinite(value) || value < 0 || value > 86_400_000)) return json(res, 400, { error: 'Invalid assessment timings.' });
  if (!validateShuffleMap(shuffleMap) || Object.keys(shuffleMap).length > MAX_SHUFFLE_KEYS) return json(res, 400, { error: 'Invalid assessment presentation mapping.' });

  let results;
  try { results = computeResults(answers, timings, shuffleMap, QUESTIONS); }
  catch (err) { console.error('submit-assessment: scoring failed', err); return json(res, 400, { error: 'Could not score this submission.' }); }

  const fingerprint = computeFingerprint(name, role);
  const completedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  // Resolve the teaser/account server-side. The browser never supplies ownership
  // or email; this prevents a completed assessment from becoming an orphan.
  let taster = null;
  let resolvedUserId = null;
  let resolvedEmail = null;
  const tasterParams = new URLSearchParams({ id: `eq.${tasterId}`, select: 'id,user_id,name,role,completed_at', limit: '1' });
  const tasterRes = await fetch(`${SUPABASE_URL}/rest/v1/taster_sessions?${tasterParams}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!tasterRes.ok) return json(res, 502, { error: 'Could not verify the VALU journey.' });
  taster = (await tasterRes.json())?.[0];
  if (!taster) return json(res, 404, { error: 'VALU snapshot not found. Return to the VALU journey and complete your snapshot first.' });
  if (!taster.completed_at) return json(res, 409, { error: 'Complete your VALU snapshot before starting the full assessment.' });
  if (!taster.user_id) return json(res, 409, { error: 'Sign in to your Valoria account and link your VALU snapshot before starting the full assessment.' });
  if (taster.user_id !== handoff.sub) return json(res, 403, { error: 'This secure assessment handoff does not belong to the linked account.' });
  if (String(taster.name || '').trim().toLowerCase() !== name.trim().toLowerCase() ||
      String(taster.role || '').trim().toLowerCase() !== role.trim().toLowerCase()) {
    return json(res, 403, { error: 'Assessment identity does not match the VALU snapshot.' });
  }
  resolvedUserId = taster.user_id;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${resolvedUserId}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!userRes.ok) return json(res, 502, { error: 'Could not verify the Valoria account.' });
  const user = await userRes.json();
  if (!user.email_confirmed_at) return json(res, 403, { error: 'Confirm your Valoria account email before submitting the full VALU assessment.' });
  resolvedEmail = String(user.email || '').trim().toLowerCase() || null;

  const row = {
    name: name.trim(), role: role.trim(), experience,
    identity_hash: fingerprint, total_score: results.valuIndex,
    designation: results.desig?.name || '', cluster_scores: results.clusterScores,
    skill_scores: results.skillScores, completed_at: completedAt, expires_at: expiresAt, ai_report: null,
    taster_id: tasterId, user_id: resolvedUserId, email: resolvedEmail,
    answers, timings, shuffle_map: shuffleMap, assessment_version: 'FULL_VALU_V1',
  };

  try {
    const existing = await findExistingAssessment(tasterId, fingerprint);
    if (existing) {
      if (existing.user_id !== resolvedUserId || existing.taster_id !== tasterId || !existing.completed_at) {
        return json(res, 409, { error: 'An assessment record exists for this identity but its ownership/link state needs manual review.' });
      }
      return json(res, 200, { identity_hash: fingerprint, report_token: existing.report_token, results: existingResults(existing), alreadyCompleted: true });
    }
  } catch (err) {
    console.error('submit-assessment: existing assessment check failed', err?.message || err);
    return json(res, 502, { error: 'Could not verify whether this assessment was already submitted.' });
  }

  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?select=identity_hash,report_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('submit-assessment: insert failed', insertRes.status, err);
      if (insertRes.status === 409) {
        try {
          const existing = await findExistingAssessment(tasterId, fingerprint);
          if (existing && existing.user_id === resolvedUserId && existing.taster_id === tasterId && existing.completed_at) {
            return json(res, 200, { identity_hash: fingerprint, results: existingResults(existing), alreadyCompleted: true });
          }
        } catch (lookupError) {
          console.error('submit-assessment: duplicate recovery lookup failed', lookupError?.message || lookupError);
        }
        return json(res, 409, { error: 'An assessment already exists for this identity but could not be safely resumed. Contact Valoria support.' });
      }
      return json(res, 502, { error: 'Could not save your result. Please try again.' });
    }
  } catch (err) {
    console.error('submit-assessment: network error', err);
    return json(res, 502, { error: 'Could not save your result. Please try again.' });
  }

  const insertedRows = await insertRes.json().catch(() => []);
  const inserted = Array.isArray(insertedRows) ? insertedRows[0] : null;
  if (!inserted?.report_token) {
    console.error('submit-assessment: saved assessment did not return a report token');
    return json(res, 502, { error: 'Your result was saved, but report access could not be confirmed. Please retry or contact support.' });
  }
  return json(res, 200, { identity_hash: fingerprint, report_token: inserted.report_token, results });
}