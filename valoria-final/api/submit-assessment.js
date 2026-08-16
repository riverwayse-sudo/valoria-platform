// api/submit-assessment.js
//
// Server-authoritative assessment submission. The browser may submit answers
// and presentation mappings, but it may not invent score-bearing options.
// The canonical question bank remains the source of truth for scoring.

import { computeResults } from '../src/scoringEngine.js';
import { QUESTIONS } from '../src/questions.js';
import { computeFingerprint } from '../src/lockEngine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_NAME_LENGTH = 200;
const MAX_ROLE_LENGTH = 160;
const MAX_TIMINGS_LENGTH = QUESTIONS.length;
const MAX_SHUFFLE_KEYS = QUESTIONS.length;

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionKey(option) {
  if (!option || typeof option !== 'object') return null;
  // Include all score-bearing/display fields that define a canonical option.
  return JSON.stringify({
    text: option.text ?? option.label ?? null,
    score: option.score ?? null,
  });
}

function validateShuffleMap(shuffleMap) {
  if (!isPlainObject(shuffleMap)) return false;

  for (let idx = 0; idx < QUESTIONS.length; idx += 1) {
    const question = QUESTIONS[idx];
    const mapped = shuffleMap[idx];
    if (mapped === undefined) continue;
    if (!Array.isArray(mapped) || mapped.length !== question.options.length) return false;

    const canonical = question.options.map(optionKey).sort();
    const submitted = mapped.map(optionKey).sort();
    if (canonical.length !== submitted.length) return false;
    for (let i = 0; i < canonical.length; i += 1) {
      if (canonical[i] !== submitted[i]) return false;
    }
  }
  return true;
}

function validateAnswers(answers) {
  if (!isPlainObject(answers)) return false;
  if (Object.keys(answers).length !== QUESTIONS.length) return false;

  return QUESTIONS.every((question, idx) => {
    const value = answers[idx];
    return Number.isInteger(value) && value >= 0 && value < question.options.length;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    console.error('submit-assessment: missing Supabase server configuration');
    return json(res, 500, { error: 'Server misconfigured.' });
  }

  const { name, role, answers, timings, shuffleMap } = req.body || {};

  if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NAME_LENGTH) {
    return json(res, 400, { error: 'Name is required and must be 200 characters or fewer.' });
  }
  if (typeof role !== 'string' || !role.trim() || role.trim().length > MAX_ROLE_LENGTH) {
    return json(res, 400, { error: 'Role is required and must be 160 characters or fewer.' });
  }
  if (!validateAnswers(answers)) {
    return json(res, 400, { error: 'Assessment answers are incomplete or invalid.' });
  }
  if (!Array.isArray(timings) || timings.length !== QUESTIONS.length) {
    return json(res, 400, { error: 'Invalid assessment timings.' });
  }
  if (timings.some(value => !Number.isFinite(value) || value < 0 || value > 86_400_000)) {
    return json(res, 400, { error: 'Invalid assessment timings.' });
  }
  if (!validateShuffleMap(shuffleMap)) {
    return json(res, 400, { error: 'Invalid assessment presentation mapping.' });
  }
  if (Object.keys(shuffleMap).length > MAX_SHUFFLE_KEYS) {
    return json(res, 400, { error: 'Invalid assessment presentation mapping.' });
  }

  let results;
  try {
    results = computeResults(answers, timings, shuffleMap, QUESTIONS);
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
