// api/claim-listing.js
//
// Authenticated account-claim endpoint. `identity_hash` is an identifier,
// not an authorization credential. The caller must prove ownership of the
// assessment email through a verified Supabase Auth session before the
// service-role key is used.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const LISTING_THRESHOLD = 35;

function getBearerToken(req) {
  const value = req.headers?.authorization || req.headers?.Authorization || '';
  if (!value.startsWith('Bearer ')) return null;
  return value.slice(7).trim() || null;
}

async function getAuthenticatedUser(req) {
  const token = getBearerToken(req);
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('claim-listing: missing Supabase server configuration');
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  // Never trust user_id from the request body. Resolve the account from a
  // verified Supabase Auth token instead.
  let user;
  try {
    user = await getAuthenticatedUser(req);
  } catch (err) {
    console.error('claim-listing: auth verification failed', err);
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (!user?.id || !user?.email) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { identity_hash } = req.body || {};
  const identityHash = typeof identity_hash === 'string' ? identity_hash.trim() : '';
  if (!identityHash) {
    return res.status(400).json({ error: 'identity_hash is required.' });
  }

  const serviceHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  };

  // A claim is allowed only when the assessment email belongs to the
  // authenticated account and the assessment has not already been claimed
  // by a different account. Email ownership is established by Supabase Auth
  // (the project requires/should require email verification for production).
  let assessment;
  try {
    const params = new URLSearchParams({
      identity_hash: `eq.${identityHash}`,
      email: `eq.${user.email}`,
      select: 'id,user_id,name,email,role,total_score,cluster_scores,skill_scores,designation,completed_at,expires_at',
      order: 'completed_at.desc',
      limit: '1',
    });
    const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      headers: serviceHeaders,
    });
    if (!fetchRes.ok) {
      const err = await fetchRes.text();
      console.error('claim-listing: assessment lookup failed', fetchRes.status, err);
      return res.status(502).json({ error: 'Could not look up assessment result.' });
    }
    const rows = await fetchRes.json();
    if (!rows?.length) {
      return res.status(403).json({ error: 'This assessment cannot be claimed by the authenticated account.' });
    }
    assessment = rows[0];
  } catch (err) {
    console.error('claim-listing: assessment lookup network error', err);
    return res.status(502).json({ error: 'Could not look up assessment result.' });
  }

  if (assessment.user_id && assessment.user_id !== user.id) {
    return res.status(403).json({ error: 'This assessment is already linked to another account.' });
  }

  const listingStatus = (assessment.total_score ?? 0) >= LISTING_THRESHOLD ? 'listed' : 'pending';

  // Upsert using the verified Auth user ID, never a caller-supplied ID.
  try {
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/professional_profiles`, {
      method: 'POST',
      headers: {
        ...serviceHeaders,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: user.id,
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
      const err = await upsertRes.text();
      console.error('claim-listing: profile upsert failed', upsertRes.status, err);
      return res.status(502).json({ error: 'Could not create marketplace profile.' });
    }
  } catch (err) {
    console.error('claim-listing: profile upsert network error', err);
    return res.status(502).json({ error: 'Could not create marketplace profile.' });
  }

  // Link the assessment to the verified account. If it is already linked to
  // the same account, this remains idempotent.
  if (assessment.id) {
    try {
      const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?id=eq.${assessment.id}`, {
        method: 'PATCH',
        headers: { ...serviceHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: user.id }),
      });
      if (!linkRes.ok) {
        const err = await linkRes.text();
        console.error('claim-listing: linking valu_assessments.user_id failed', linkRes.status, err);
        return res.status(502).json({ error: 'Could not link the assessment to the account.' });
      }
    } catch (err) {
      console.error('claim-listing: linking valu_assessments.user_id network error', err);
      return res.status(502).json({ error: 'Could not link the assessment to the account.' });
    }
  }

  return res.status(200).json({ ok: true, listed: listingStatus === 'listed', valu_index: assessment.total_score });
}
