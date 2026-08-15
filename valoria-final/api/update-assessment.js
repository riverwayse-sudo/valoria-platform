// api/update-assessment.js
// Controlled updates to a valu_assessments row. Account-linking requires a
// verified Supabase Auth user. Internal report/email fields require CRON_SECRET.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const USER_FIELDS = ['email', 'user_id'];
const INTERNAL_FIELDS = ['ai_report', 'report_email_sent_at', 'confirmation_email_sent_at'];

async function getVerifiedUser(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${match[1]}` },
  });
  return response.ok ? response.json() : null;
}

function hasCronSecret(req) {
  if (!CRON_SECRET) return false;
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  return header === `Bearer ${CRON_SECRET}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Server misconfigured.' });

  const { identity_hash, fields } = req.body || {};
  if (!identity_hash?.trim()) return res.status(400).json({ error: 'identity_hash is required.' });
  if (!fields || typeof fields !== 'object') return res.status(400).json({ error: 'fields is required.' });

  const requested = Object.keys(fields);
  const hasUserFields = requested.some((key) => USER_FIELDS.includes(key));
  const hasInternalFields = requested.some((key) => INTERNAL_FIELDS.includes(key));
  const unknownFields = requested.filter((key) => !USER_FIELDS.includes(key) && !INTERNAL_FIELDS.includes(key));
  if (unknownFields.length) return res.status(400).json({ error: 'Unsupported update field.' });

  let verifiedUser = null;
  if (hasUserFields) verifiedUser = await getVerifiedUser(req);
  if (hasUserFields && !verifiedUser) return res.status(401).json({ error: 'Authentication required.' });
  if (hasInternalFields && !hasCronSecret(req)) return res.status(401).json({ error: 'Internal authorization required.' });

  const lookup = new URLSearchParams({ identity_hash: `eq.${identity_hash.trim()}`, select: 'id,email,user_id', limit: '1' });
  const lookupRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${lookup}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!lookupRes.ok) return res.status(502).json({ error: 'Assessment lookup failed.' });
  const rows = await lookupRes.json();
  const assessment = rows?.[0];
  if (!assessment) return res.status(404).json({ error: 'Assessment not found.' });

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(fields, 'user_id')) {
    if (fields.user_id !== verifiedUser.id) return res.status(403).json({ error: 'user_id must match the authenticated account.' });
    if (assessment.user_id && assessment.user_id !== verifiedUser.id) return res.status(403).json({ error: 'Assessment already belongs to another account.' });
    patch.user_id = verifiedUser.id;
  }

  if (Object.prototype.hasOwnProperty.call(fields, 'email')) {
    if (typeof fields.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return res.status(400).json({ error: 'Invalid email.' });
    if (fields.email.toLowerCase() !== String(verifiedUser.email || '').toLowerCase()) return res.status(403).json({ error: 'Email must match the authenticated account.' });
    patch.email = verifiedUser.email;
  }

  for (const key of INTERNAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) patch[key] = fields[key];
  }

  if (!Object.keys(patch).length) return res.status(400).json({ error: 'No updatable fields supplied.' });

  const patchParams = new URLSearchParams({ id: `eq.${assessment.id}` });
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${patchParams}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!patchRes.ok) {
    console.error('update-assessment: patch failed', patchRes.status, await patchRes.text());
    return res.status(502).json({ error: 'Update failed.' });
  }

  return res.status(200).json({ ok: true });
}
