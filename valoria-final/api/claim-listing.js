// api/claim-listing.js
//
// Claims the completed assessment for the currently authenticated user and
// creates/updates the corresponding professional profile.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LISTING_THRESHOLD = 35;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    console.error('claim-listing: missing server environment');
    return json({ error: 'Server misconfigured.' }, 500);
  }

  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return json({ error: 'Authentication required.' }, 401);
  const accessToken = match[1];

  // Verify the caller with Supabase Auth. Never trust a client-supplied
  // user_id as proof of ownership.
  let authUser;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SERVICE_ROLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!userRes.ok) return json({ error: 'Invalid or expired session.' }, 401);
    authUser = await userRes.json();
  } catch (err) {
    console.error('claim-listing: auth verification failed', err);
    return json({ error: 'Could not verify authentication.' }, 502);
  }

  const userId = authUser?.id;
  const authEmail = String(authUser?.email || '').trim().toLowerCase();
  if (!userId || !authEmail) return json({ error: 'Authenticated account is incomplete.' }, 403);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const identityHash = String(payload?.identity_hash || '').trim();
  if (!identityHash || identityHash.length > 200) {
    return json({ error: 'A valid identity_hash is required.' }, 400);
  }

  const serviceHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  };

  // Pull the authoritative assessment. The client cannot supply a score,
  // name, email, or user_id for the profile.
  let assessment;
  try {
    const params = new URLSearchParams({
      identity_hash: `eq.${identityHash}`,
      select: 'id,name,role,email,total_score,cluster_scores,skill_scores,designation,completed_at,expires_at,user_id',
      order: 'completed_at.desc',
      limit: '1',
    });
    const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      headers: serviceHeaders,
    });
    if (!fetchRes.ok) {
      console.error('claim-listing: assessment lookup failed', fetchRes.status);
      return json({ error: 'Could not look up assessment result.' }, 502);
    }
    const rows = await fetchRes.json();
    if (!rows?.length) return json({ error: 'No assessment found for this identity_hash.' }, 404);
    assessment = rows[0];
  } catch (err) {
    console.error('claim-listing: assessment lookup failed', err);
    return json({ error: 'Could not look up assessment result.' }, 502);
  }

  // The assessment must belong to the same email/account being claimed.
  const assessmentEmail = String(assessment.email || '').trim().toLowerCase();
  if (!assessmentEmail || assessmentEmail !== authEmail) {
    return json({ error: 'This assessment cannot be claimed by this account.' }, 403);
  }

  // An assessment already linked to a different account cannot be claimed.
  if (assessment.user_id && assessment.user_id !== userId) {
    return json({ error: 'This assessment is already linked to another account.' }, 409);
  }

  const listingStatus = (assessment.total_score ?? 0) >= LISTING_THRESHOLD ? 'listed' : 'pending';

  try {
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/professional_profiles`, {
      method: 'POST',
      headers: {
        ...serviceHeaders,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: userId,
        display_name: assessment.name,
        headline: assessment.role,
        valu_index: assessment.total_score,
        cluster_scores: assessment.cluster_scores,
        skill_scores: assessment.skill_scores,
        designation: assessment.designation,
        assessment_completed_at: assessment.completed_at,
        assessment_expires_at: assessment.expires_at,
        listing_status: listingStatus,
        active_tracks: [],
      }),
    });
    if (!upsertRes.ok) {
      console.error('claim-listing: profile upsert failed', upsertRes.status);
      return json({ error: 'Could not create marketplace profile.' }, 502);
    }
  } catch (err) {
    console.error('claim-listing: profile upsert failed', err);
    return json({ error: 'Could not create marketplace profile.' }, 502);
  }

  if (assessment.id) {
    try {
      const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?id=eq.${encodeURIComponent(assessment.id)}`, {
        method: 'PATCH',
        headers: { ...serviceHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!linkRes.ok) {
        console.error('claim-listing: assessment ownership link failed', linkRes.status);
        return json({ error: 'Profile created, but assessment ownership could not be finalized.' }, 502);
      }
    } catch (err) {
      console.error('claim-listing: assessment ownership link failed', err);
      return json({ error: 'Profile created, but assessment ownership could not be finalized.' }, 502);
    }
  }

  return json({ ok: true, listed: listingStatus === 'listed', valu_index: assessment.total_score });
}
