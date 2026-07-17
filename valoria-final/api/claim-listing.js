// api/claim-listing.js
//
// Creates/updates a person's professional_profiles row right after they sign
// up post-assessment. This replaces the old client-side POST straight to
// PostgREST with the anon key — that POST sent
// `Authorization: Bearer ${SUPABASE_ANON_KEY}` instead of the user's own
// session token, so auth.uid() was always null and RLS (auth.uid() = id)
// silently rejected every single insert. No real user has ever actually
// been listed through that path.
//
// Two things fixed here at once:
//   1. The auth problem — this runs server-side with the service-role key,
//      which legitimately bypasses RLS, instead of depending on a client
//      session token that may not even exist yet (Supabase often withholds
//      a usable session immediately after signup if email confirmation is
//      required on this project).
//   2. The score problem — listing_status is no longer hardcoded to
//      "listed". The score is re-read here from valu_assessments by
//      identity_hash (never trusted from the client) and the existing
//      35-point threshold used everywhere else in the app (PRIMEAssessment.jsx,
//      profile/setup, spotlight, atb-connect) is applied the same way here.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LISTING_THRESHOLD = 35;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    console.error('claim-listing: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  const { identity_hash, user_id } = req.body || {};
  if (!identity_hash?.trim()) {
    return res.status(400).json({ error: 'identity_hash is required.' });
  }
  if (!user_id?.trim()) {
    return res.status(400).json({ error: 'user_id is required.' });
  }

  const serviceHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  };

  // 1) Pull the authoritative assessment result. Never trust a score the
  //    client sends — same principle as submit-assessment.js.
  let assessment;
  try {
    const params = new URLSearchParams({
      identity_hash: `eq.${identity_hash.trim()}`,
      select: 'name,role,total_score,cluster_scores,skill_scores,designation,completed_at,expires_at',
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
      return res.status(404).json({ error: 'No assessment found for this identity_hash.' });
    }
    assessment = rows[0];
  } catch (err) {
    console.error('claim-listing: assessment lookup network error', err);
    return res.status(502).json({ error: 'Could not look up assessment result.' });
  }

  const listingStatus = (assessment.total_score ?? 0) >= LISTING_THRESHOLD ? 'listed' : 'pending';

  // 2) Upsert professional_profiles with the service-role key. merge-duplicates
  //    on id means this is safe to call again later (e.g. a retake) without
  //    creating a second row.
  try {
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/professional_profiles`, {
      method: 'POST',
      headers: {
        ...serviceHeaders,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: user_id.trim(),
        display_name: assessment.name,
        headline: assessment.role,
        valu_index: assessment.total_score,
        cluster_scores: assessment.cluster_scores,
        skill_scores: assessment.skill_scores,
        designation: assessment.designation,
        assessment_completed_at: assessment.completed_at,
        assessment_expires_at: assessment.expires_at,
        listing_status: listingStatus,
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

  return res.status(200).json({ ok: true, listed: listingStatus === 'listed', valu_index: assessment.total_score });
}
