const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
import { verifyValuHandoffToken } from './valu-handoff-token.js';

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(res, 500, { error: 'Server misconfigured.' });

  const { taster_id: tasterId, identity_hash: identityHash, handoff_token: handoffToken } = req.body || {};
  if (typeof tasterId !== 'string' || !tasterId || typeof identityHash !== 'string' || !/^fp_[a-z0-9]{1,128}$/i.test(identityHash)) {
    return json(res, 400, { error: 'Valid taster_id and identity_hash are required.' });
  }
  const handoff = verifyValuHandoffToken(handoffToken, tasterId);
  if (!handoff) return json(res, 401, { error: 'Your secure VALU handoff is missing or expired. Reopen the assessment from your Valoria account.' });

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const tasterParams = new URLSearchParams({ id: `eq.${tasterId}`, select: 'id,user_id,name,role', limit: '1' });
  const tasterRes = await fetch(`${SUPABASE_URL}/rest/v1/taster_sessions?${tasterParams}`, { headers });
  if (!tasterRes.ok) return json(res, 502, { error: 'Could not verify teaser result.' });
  const taster = (await tasterRes.json())?.[0];
  if (!taster?.user_id) return json(res, 409, { error: 'The teaser is not linked to a Valoria account yet.' });
  if (taster.user_id !== handoff.sub) return json(res, 403, { error: 'This secure assessment handoff does not belong to the linked account.' });

  const assessmentParams = new URLSearchParams({ taster_id: `eq.${tasterId}`, select: 'id,user_id,taster_id,email,name,role,total_score,completed_at,identity_hash', limit: '1' });
  const assessmentRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${assessmentParams}`, { headers });
  if (!assessmentRes.ok) return json(res, 502, { error: 'Could not find the completed assessment.' });
  const assessment = (await assessmentRes.json())?.[0];
  if (!assessment) return json(res, 404, { error: 'No completed assessment is linked to this exact teaser. Use the authenticated Valoria recovery flow for legacy records.' });
  if (assessment.identity_hash !== identityHash) return json(res, 409, { error: 'The assessment reference does not match this teaser handoff.' });
  if (!assessment.completed_at) return json(res, 409, { error: 'The full VALU assessment is not complete yet.' });
  if (assessment.user_id && assessment.user_id !== taster.user_id) return json(res, 409, { error: 'Assessment is already linked to another account.' });
  if (assessment.taster_id && assessment.taster_id !== tasterId) return json(res, 409, { error: 'This assessment is already attached to a different teaser. Valoria support must review the identity link.' });
  if (String(assessment.name || '').trim().toLowerCase() !== String(taster.name || '').trim().toLowerCase() || String(assessment.role || '').trim().toLowerCase() !== String(taster.role || '').trim().toLowerCase()) return json(res, 403, { error: 'Assessment identity does not match the teaser identity.' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${taster.user_id}`, { headers });
  if (!userRes.ok) return json(res, 502, { error: 'Could not verify the Valoria account.' });
  const user = await userRes.json();
  // Conditional ownership predicate prevents a concurrent claim from transferring
  // an assessment after the initial read.
  const patchParams = new URLSearchParams({
    id: `eq.${assessment.id}`,
    or: `(user_id.is.null,user_id.eq.${taster.user_id})`,
  });
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${patchParams}`, {
    method:'PATCH',
    headers:{...headers,Prefer:'return=representation'},
    body:JSON.stringify({user_id:taster.user_id,email:user.email||assessment.email||null,taster_id:tasterId}),
  });
  if (!patchRes.ok) return json(res, 502, { error: 'Could not attach the official score to the profile.' });
  const patchedRows = await patchRes.json().catch(() => []);
  const patched = Array.isArray(patchedRows) ? patchedRows[0] : null;
  if (!patched || patched.user_id !== taster.user_id || patched.taster_id !== tasterId) {
    return json(res, 409, { error: 'The assessment ownership changed during linking. No ownership transfer was made; please retry or contact Valoria support.' });
  }

  // Preserve a canonical audit link without overwriting a pre-existing owner.
  const identityParams = new URLSearchParams({ assessment_id: `eq.${assessment.id}`, select:'assessment_id,user_id', limit:'1' });
  const identityRes = await fetch(`${SUPABASE_URL}/rest/v1/assessment_identity_links?${identityParams}`, { headers });
  if (!identityRes.ok) return json(res, 502, { error: 'Assessment linked, but its identity audit record could not be checked.' });
  const existingIdentity = (await identityRes.json())?.[0];
  if (existingIdentity && existingIdentity.user_id !== taster.user_id) {
    return json(res, 409, { error: 'The assessment identity audit record belongs to another account. Valoria support must review it.' });
  }
  if (!existingIdentity) {
    const identityInsert = await fetch(`${SUPABASE_URL}/rest/v1/assessment_identity_links`, {
      method:'POST',
      headers:{...headers,Prefer:'resolution=ignore-duplicates,return=minimal'},
      body:JSON.stringify({assessment_id:assessment.id,user_id:taster.user_id,link_method:'taster_handoff',linked_by:taster.user_id}),
    });
    if (!identityInsert.ok) return json(res, 502, { error: 'Assessment linked, but its identity audit record could not be saved.' });
  }

  const completedAt = assessment.completed_at;
  const profileParams = new URLSearchParams({ id:`eq.${taster.user_id}` });
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/professional_profiles?${profileParams}`, {
    method:'PATCH',
    headers:{...headers,Prefer:'return=minimal'},
    body:JSON.stringify({ assessment_completed_at:completedAt, valu_index:assessment.total_score }),
  });
  if (!profileRes.ok) return json(res, 502, { error: 'The score is linked but profile assessment state could not be refreshed.' });

  const journeyRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/refresh_professional_journey`, {
    method:'POST',
    headers,
    body:JSON.stringify({p_user_id:taster.user_id}),
  });
  if (!journeyRes.ok) return json(res, 502, { error: 'The score is linked but the professional journey state could not be refreshed.' });

  return json(res, 200, { ok:true, total_score:assessment.total_score, assessment_completed_at:completedAt });
}
