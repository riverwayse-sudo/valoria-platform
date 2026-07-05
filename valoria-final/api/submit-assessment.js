// api/submit-assessment.js
//
// This is the ONLY thing allowed to write total_score / cluster_scores /
// skill_scores / designation to valu_assessments. The client sends raw
// answers + timings + shuffleMap; this endpoint recomputes the result with
// the exact same scoringEngine + question bank the client uses, then writes
// the result using the service-role key.
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    console.error('submit-assessment: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  const { name, role, answers, timings, shuffleMap } = req.body || {};

  if (!name?.trim() || !role?.trim()) {
    return res.status(400).json({ error: 'Name and role are required.' });
  }
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Missing answers.' });
  }
  if (!Array.isArray(timings)) {
    return res.status(400).json({ error: 'Missing timings.' });
  }

  // Basic completeness check — reject anything that isn't a full submission.
  const answeredCount = Object.keys(answers).length;
  if (answeredCount < QUESTIONS.length) {
    return res.status(400).json({ error: 'Assessment is incomplete.' });
  }

  let results;
  try {
    // Server recomputes from scratch. The client's own `results` value, if it
    // sent one, is ignored entirely — it is never read here.
    results = computeResults(answers, timings, shuffleMap || {}, QUESTIONS);
  } catch (err) {
    console.error('submit-assessment: scoring failed', err);
    return res.status(400).json({ error: 'Could not score this submission.' });
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
      return res.status(502).json({ error: 'Could not save your result. Please try again.' });
    }
  } catch (err) {
    console.error('submit-assessment: network error', err);
    return res.status(502).json({ error: 'Could not save your result. Please try again.' });
  }

  // Return the authoritative, server-computed result so the client can
  // reconcile its optimistic UI if it ever drifts.
  return res.status(200).json({ identity_hash: fingerprint, results });
}
