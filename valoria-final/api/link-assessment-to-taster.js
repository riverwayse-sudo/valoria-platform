const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(res, 500, { error: 'Server misconfigured.' });

  const { taster_id: tasterId, identity_hash: identityHash } = req.body || {};
  if (typeof tasterId !== 'string' || !tasterId || typeof identityHash !== 'string' || !/^fp_[a-z0-9]{1,128}$/i.test(identityHash)) {
    return json(res, 400, { error: 'Valid taster_id and identity_hash are required.' });
  }

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const tasterParams = new URLSearchParams({ id: `eq.${tasterId}`, select: 'id,user_id,name,role', limit: '1' });
  const tasterRes = await fetch(`${SUPABASE_URL}/rest/v1/taster_sessions?${tasterParams}`, { headers });
  if (!tasterRes.ok) return json(res, 502, { error: 'Could not verify teaser result.' });
  const taster = (await tasterRes.json())?.[0];
  if (!taster?.user_id) return json(res, 409, { error: 'The teaser is not linked to a Valoria account yet.' });

  const assessmentParams = new URLSearchParams({ identity_hash: `eq.${identityHash}`, select: 'id,user_id,email,name,role,total_score,completed_at', limit: '1' });
  const assessmentRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${assessmentParams}`, { headers });
  if (!assessmentRes.ok) return json(res, 502, { error: 'Could not find the completed assessment.' });
  const assessment = (await assessmentRes.json())?.[0];
  if (!assessment) return json(res, 404, { error: 'Completed assessment not found.' });
  if (assessment.user_id && assessment.user_id !== taster.user_id) return json(res, 409, { error: 'Assessment is already linked to another account.' });
  if (String(assessment.name || '').trim().toLowerCase() !== String(taster.name || '').trim().toLowerCase() || String(assessment.role || '').trim().toLowerCase() !== String(taster.role || '').trim().toLowerCase()) return json(res, 403, { error: 'Assessment identity does not match the teaser identity.' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${taster.user_id}`, { headers });
  if (!userRes.ok) return json(res, 502, { error: 'Could not verify the Valoria account.' });
  const user = await userRes.json();
  const patchParams = new URLSearchParams({ id: `eq.${assessment.id}` });
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${patchParams}`, { method:'PATCH', headers:{...headers,Prefer:'return=minimal'}, body:JSON.stringify({user_id:taster.user_id,email:user.email||null}) });
  if (!patchRes.ok) return json(res, 502, { error: 'Could not attach the official score to the profile.' });

  const completedAt = assessment.completed_at || new Date().toISOString();
  const profileParams = new URLSearchParams({ id:`eq.${taster.user_id}` });
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/professional_profiles?${profileParams}`, { method:'PATCH', headers:{...headers,Prefer:'return=minimal'}, body:JSON.stringify({ assessment_completed_at:completedAt, valu_index:assessment.total_score }) });
  if (!profileRes.ok) return json(res, 502, { error: 'The score was saved but profile completion status could not be updated.' });

  return json(res, 200, { ok:true, user_id:taster.user_id, total_score:assessment.total_score, assessment_completed_at:completedAt });
}
