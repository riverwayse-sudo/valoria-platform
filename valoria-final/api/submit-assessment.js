// api/submit-assessment.js
//
// This is the ONLY thing allowed to write total_score / cluster_scores /
// skill_scores / designation to valu_assessments. The client sends raw
// answers + timings + shuffleMap; this endpoint recomputes the result with
// the exact same scoringEngine + question bank the client uses, then writes
// the result using the service-role key.
//
// IMPORTANT: identity_hash is a server-generated bearer identifier, NOT an
// authorization mechanism. It must never be derived from name/role because
// those values are guessable and would let one person predict another
// assessment's identifier and collide with the upsert key.
//
// RLS on valu_assessments MUST deny INSERT/UPDATE to anon/authenticated for
// this to actually mean anything — see supabase/rls-lockdown.sql. Without
// that, a client can still bypass this file entirely by POSTing straight to
// PostgREST with the anon key, exactly like before.

import { randomUUID } from 'node:crypto';
import { computeResults } from '../src/scoringEngine.js';
import { QUESTIONS } from '../src/questions.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

function createAssessmentToken() {
  // 128 bits of randomness, encoded as 32 hex characters. The fp_ prefix is
  // retained for compatibility with existing API validation and downstream
  // account/claim flows.
  return `fp_${randomUUID().replace(/-/g, '')}`;
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

  if (!name?.trim() || !role?.trim()) {
    return json(res, 400, { error: 'Name and role are required.' });
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return json(res, 400, { error: 'Missing answers.' });
  }
  if (!Array.isArray(timings)) {
    return json(res, 400, { error: 'Missing timings.' });
  }

  // Basic completeness check — reject anything that isn't a full submission.
  const answeredCount = Object.keys(answers).length;
  if (answeredCount < QUESTIONS.length) {
    return json(res, 400, { error: 'Assessment is incomplete.' });
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

  // Never derive the database identity from user-controlled, low-entropy
  // attributes such as name + role. A fresh random token prevents predictable
  // identifiers and prevents one person's submission from colliding with or
  // overwriting another person's assessment.
  const identityHash = createAssessmentToken();
  const completedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const row = {
    name: name.trim(),
    role: role.trim(),
    identity_hash: identityHash,
    total_score: results.valuIndex,
    designation: results.desig?.name || '',
    cluster_scores: results.clusterScores,
    skill_scores: results.skillScores,
    completed_at: completedAt,
    expires_at: expiresAt,
    ai_report: null,
  };

  try {
    // identity_hash remains unique for backwards-compatible schema use, but
    // is now unpredictable. No client-controlled value is used as the upsert
    // conflict key.
    const upsertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/valu_assessments?on_conflict=identity_hash`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Prefer: 'return=minimal,resolution=merge-duplicates',
        },
        body: JSON.stringify(row),
      }
    );
    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      console.error('submit-assessment: upsert failed', upsertRes.status, err);
      return json(res, 502, { error: 'Could not save your result. Please try again.' });
    }
  } catch (err) {
    console.error('submit-assessment: network error', err);
    return json(res, 502, { error: 'Could not save your result. Please try again.' });
  }

  // Return the authoritative, server-computed result so the client can
  // reconcile its optimistic UI if it ever drifts. The token is required by
  // downstream account/claim flows and is deliberately high-entropy.
  return json(res, 200, { identity_hash: identityHash, results });
}
