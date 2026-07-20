// api/update-assessment.js
//
// The only two things the app needs to update on an existing valu_assessments
// row after initial scoring: linking the account (email/user_id) once the
// person confirms signup, and attaching the generated ai_report text. Both
// go through here, with the service-role key, so the anon key never needs
// UPDATE privileges on this table at all.
//
// Field whitelist is intentional and should not be widened casually — this
// is the one place that could silently become a "let the client set any
// column" endpoint if someone spreads req.body into the update payload later.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_FIELDS = ['email', 'user_id', 'ai_report', 'report_email_sent_at', 'confirmation_email_sent_at'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    console.error('update-assessment: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  const { identity_hash, fields } = req.body || {};
  if (!identity_hash?.trim()) {
    return res.status(400).json({ error: 'identity_hash is required.' });
  }
  if (!fields || typeof fields !== 'object') {
    return res.status(400).json({ error: 'fields is required.' });
  }

  const patch = {};
  for (const key of Object.keys(fields)) {
    if (ALLOWED_FIELDS.includes(key)) patch[key] = fields[key];
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No updatable fields supplied.' });
  }
  if (typeof patch.email === 'string') {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(patch.email)) {
      return res.status(400).json({ error: 'Invalid email.' });
    }
  }

  try {
    const params = new URLSearchParams({ identity_hash: `eq.${identity_hash.trim()}` });
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    });
    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error('update-assessment: patch failed', patchRes.status, err);
      return res.status(502).json({ error: 'Update failed.' });
    }
  } catch (err) {
    console.error('update-assessment: network error', err);
    return res.status(502).json({ error: 'Update failed.' });
  }

  return res.status(200).json({ ok: true });
}
