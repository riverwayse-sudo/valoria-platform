const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

function headers(key = SERVICE_ROLE_KEY) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function rest(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) return json(res, 500, { error: 'Server misconfigured.' });

  const authorization = String(req.headers?.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return json(res, 401, { error: 'Sign in to claim your previous VALU snapshot.' });

  let user;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${match[1]}` },
    });
    if (!response.ok) return json(res, 401, { error: 'Your session is invalid or has expired.' });
    user = await response.json();
  } catch {
    return json(res, 502, { error: 'Could not verify your account.' });
  }

  const userId = user?.id;
  const email = String(user?.email || '').trim().toLowerCase();
  if (!userId || !email) return json(res, 403, { error: 'Your account must have a verified email address.' });
  if (!user.email_confirmed_at) return json(res, 403, { error: 'Verify your email address before claiming a previous snapshot.' });

  const params = new URLSearchParams({
    candidate_email: `eq.${email}`,
    identity_status: 'eq.contact_candidate',
    linked_user_id: 'is.null',
    select: 'taster_id,candidate_name,candidate_role,candidate_email,identity_status,linked_user_id',
    limit: '50',
  });
  let candidates;
  try {
    const response = await rest(`taster_identity_candidates?${params}`);
    if (!response.ok) return json(res, 502, { error: 'Could not retrieve your snapshot recovery records.' });
    candidates = await response.json();
  } catch {
    return json(res, 502, { error: 'Could not retrieve your snapshot recovery records.' });
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return json(res, 200, { ok: true, linked: 0, message: 'No unclaimed snapshot was found for this verified email. If you expected one, contact Valoria support for a manual evidence review.' });
  }

  const linkedIds = [];
  const conflicts = [];
  for (const candidate of candidates) {
    const tasterId = candidate.taster_id;
    const tasterParams = new URLSearchParams({ id: `eq.${tasterId}`, select: 'id,user_id,name,role', limit: '1' });
    const tasterRes = await rest(`taster_sessions?${tasterParams}`);
    if (!tasterRes.ok) return json(res, 502, { error: 'Could not verify a snapshot ownership record.' });
    const taster = (await tasterRes.json())?.[0];
    if (!taster) continue;

    if (taster.user_id && taster.user_id !== userId) {
      conflicts.push(tasterId);
      continue;
    }
    if (String(taster.name || '').trim().toLowerCase() !== String(candidate.candidate_name || '').trim().toLowerCase()
      || String(taster.role || '').trim().toLowerCase() !== String(candidate.candidate_role || '').trim().toLowerCase()) {
      conflicts.push(tasterId);
      continue;
    }

    if (!taster.user_id) {
      const patchParams = new URLSearchParams({ id: `eq.${tasterId}`, user_id: 'is.null', select: 'id,user_id' });
      const patchRes = await rest(`taster_sessions?${patchParams}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!patchRes.ok) return json(res, 502, { error: 'Could not safely link a snapshot to your account.' });
      const patched = (await patchRes.json())?.[0];
      if (!patched || patched.user_id !== userId) {
        conflicts.push(tasterId);
        continue;
      }
    }

    const candidatePatch = await rest(`taster_identity_candidates?taster_id=eq.${tasterId}&linked_user_id=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        identity_status: 'account_linked',
        linked_user_id: userId,
        resolution_notes: 'Claimed by authenticated account whose confirmed email exactly matches the stored contact candidate; original taster record and answers preserved.',
        last_reconciled_at: new Date().toISOString(),
      }),
    });
    if (!candidatePatch.ok) return json(res, 502, { error: 'Snapshot linked, but the reconciliation record could not be updated. Contact Valoria support.' });

    const auditParams = new URLSearchParams({
      source_record_type: 'eq.taster',
      source_record_id: `eq.${tasterId}`,
      decision: 'eq.unmatched',
    });
    const auditPatch = await rest(`identity_reconciliation_reviews?${auditParams}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        candidate_record_type: 'account',
        candidate_record_id: userId,
        decision: 'verified_match',
        evidence_type: 'authenticated_account',
        evidence_reference: 'Confirmed auth email exactly matched the stored contact candidate; original taster name and role revalidated.',
        notes: 'Self-service identity claim completed after confirmed-email authentication. Original taster answers, score, timestamps, and version provenance were not modified.',
        review_actor_type: 'system',
        reviewed_by: null,
        reviewed_at: new Date().toISOString(),
      }),
    });
    if (!auditPatch.ok) return json(res, 502, { error: 'Snapshot linked, but its reconciliation audit could not be finalized.' });

    linkedIds.push(tasterId);
  }

  // The existing database trigger creates/updates the one profile per authenticated account.
  // Refresh the canonical journey and marketplace readiness without bypassing governance.
  const journeyRes = await rest('rpc/refresh_professional_journey', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!journeyRes.ok) return json(res, 502, { error: 'Snapshot claim succeeded, but journey state needs a retry.' });

  const readinessRes = await rest('rpc/sync_professional_listing_status', {
    method: 'POST',
    body: JSON.stringify({ p_professional_id: userId }),
  });
  if (!readinessRes.ok) return json(res, 502, { error: 'Snapshot claim succeeded, but marketplace readiness needs a retry.' });

  return json(res, 200, {
    ok: true,
    linked: linkedIds.length,
    taster_ids: linkedIds,
    conflicts: conflicts.length,
    message: linkedIds.length
      ? 'Your previous snapshot has been connected to your Valoria account. Marketplace visibility remains governed by the normal readiness and listing rules.'
      : 'No snapshot was linked automatically. Valoria support must review the conflicting ownership evidence.',
  });
}
