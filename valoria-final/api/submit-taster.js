import { TASTER_QUESTIONS, computeTasterResult, EXPERIENCE_BANDS } from '../src/valuTaster.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

function validAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
  if (Object.keys(answers).length !== TASTER_QUESTIONS.length) return false;
  return TASTER_QUESTIONS.every((q, idx) => Number.isInteger(answers[idx]) && answers[idx] >= 0 && answers[idx] < q.options.length);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(res, 500, { error: 'Server misconfigured.' });

  const { name, role, experience, answers } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 200) return json(res, 400, { error: 'Name is required and must be 200 characters or fewer.' });
  if (typeof role !== 'string' || !role.trim() || role.trim().length > 160) return json(res, 400, { error: 'Role is required and must be 160 characters or fewer.' });
  if (!EXPERIENCE_BANDS.some(b => b.id === experience)) return json(res, 400, { error: 'Select a valid experience band.' });
  if (!validAnswers(answers)) return json(res, 400, { error: 'Taster answers are incomplete or invalid.' });

  const results = computeTasterResult(answers);
  const row = {
    name: name.trim(),
    role: role.trim(),
    experience,
    taster_answers: answers,
    cluster_scores: results.normalisedScores,
    strongest_cluster: results.strongest.id,
    weakest_cluster: results.weakest.id,
  };

  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/taster_sessions`, {
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
      console.error('submit-taster: insert failed', insertRes.status, await insertRes.text());
      return json(res, 502, { error: 'Could not save your taster result.' });
    }
  } catch (err) {
    console.error('submit-taster: network error', err);
    return json(res, 502, { error: 'Could not save your taster result.' });
  }

  return json(res, 200, { results });
}
