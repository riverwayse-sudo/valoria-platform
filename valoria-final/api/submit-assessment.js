// api/submit-assessment.js
//
// This is the ONLY thing allowed to write total_score / cluster_scores /
// skill_scores / designation to valu_assessments. The client sends raw
// answers + timings + shuffleMap; this endpoint recomputes the result with
// the exact same scoringEngine + question bank the client uses, then writes
// the result using the service-role key.
//
// IMPORTANT: identity_hash is an identifier only, not authorization. It is
// currently derived by the shared lock engine for backwards compatibility.
// Authorization is enforced separately by authenticated account linking and
// internal-only report endpoints. A future protocol migration should replace
// this deterministic identifier with a server-issued assessment token.
//
// RLS on valu_assessments MUST deny INSERT/UPDATE to anon/authenticated for
// this to actually mean anything — see supabase/rls-lockdown.sql. Without
// that, a client can still bypass this file entirely by POSTing straight to
// PostgREST with the anon key, exactly like before.

import { computeResults } from '../src/scoringEngine.js';
import { QUESTIONS } from '../src/questions.js';
import { computeFingerprint } from '../src/lockEngine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_NAME_LENGTH = 200;
const MAX_ROLE_LENGTH = 160;
const MAX_TIMINGS_LENGTH = QUESTIONS.length;
const MAX_SHUFFLE_KEYS = QUESTIONS.length * 2;

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    console.error('submit-assessment: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
    return json(res, 500, { error: 'Server misconfigured.' });
  }

  const { name, role, answers, timings, shuffleMap } = req.body || {};

  if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NAME_LENGTH) {
    return json(res, 400, { error: 'Name is required and must be 200 characters or fewer.' });
  }
  if (typeof role !== 'string' || !role.trim() || role.trim().length > MAX_ROLE_LENGTH) {
    return json(res, 400, { error: 'Role is required and must be 160 characters or fewer.' });
  }
  if (!isPlainObject(answers)) {
    return json(res, 400, { error: 'Missing answers.' });
  }
  if (!Array.isArray(timings) || timings.length > MAX_TIMINGS_LENGTH) {
    return json(res, 400, { error: 'Invalid assessment timings.' });
  }
  if (shuffleMap !== undefined && !isPlainObject(shuffleMap)) {
    return json(res, 400, { error: 'Invalid shuffle map.' });
  }
  if (shuffleMap && Object.keys(shuffleMap).length > MAX_SHUFFLE_KEYS) {
    return json(res, 400, { error: 'Invalid shuffle map.' });
  }

  const answerKeys = Object.keys(answers);
  if (answerKeys.length !== QUESTIONS.length) {
    return json(res, 400, { error: 'Assessment is incomplete or invalid.' });
  }

  if (timings.some(value => !Number.isFinite(value) || value < 0 || value > 86_400_000)) {
    return json(res, 400, { error: 'Invalid assessment timings.' });
  }

  let results;
  try {
    // Server recomputes from scratch. The client's own `results` value, if it
    // sent one, is ignored entirely — it is never read here.
    results = computeResults(answers, timings, shuffleMap || {}, QUESTIONS);
  } catch (err) {
    console.error('submit-assessment: scoring failed', err);
    return json(res, 400, { error: 'Could not score this submission.' });
  }

  const fingerprint = computeFingerprint(name, role);
  const completedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const row = {
    name: name.trim(),
    role: role.trim(),
    identity_hash: fingerprint,
    total_score: results.valuIndex,
    designation: results.desig?.name || '',
    cluster_scores: results.clusterScores,
    skill_scores: results.skillScores,
    completed_at: completedAt,
    expires_at: expiresAt,
    ai_report: null,
  };

  try {
    // Do NOT upsert on identity_hash. A predictable identifier must never be
    // allowed to overwrite an existing assessment. If the same identity is
    // submitted again, the unique constraint should reject it instead.
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('submit-assessment: insert failed', insertRes.status, err);
      if (insertRes.status === 409) {
        return json(res, 409, { error: 'An assessment already exists for this identity.' });
      }
      return json(res, 502, { error: 'Could not save your result. Please try again.' });
    }
  } catch (err) {
    console.error('submit-assessment: network error', err);
    return json(res, 502, { error: 'Could not save your result. Please try again.' });
  }

  return json(res, 200, { identity_hash: fingerprint, results });
}
