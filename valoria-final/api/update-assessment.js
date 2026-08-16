// api/update-assessment.js
// Controlled updates to a valu_assessments row. Account-linking requires a
// verified Supabase Auth user whose email matches the assessment. Internal
// report/email fields require CRON_SECRET.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const USER_FIELDS = ['email', 'user_id'];
const INTERNAL_FIELDS = ['ai_report', 'report_email_sent_at', 'confirmation_email_sent_at'];
const IDENTITY_RE = /^fp_[a-z0-9]{1,128}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(data);
}

async function getVerifiedUser(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${match[1]}` },
    });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

function hasCronSecret(req) {
  if (!CRON_SECRET) return false;
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  return header === `Bearer ${CRON_SECRET}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) return json(res, 500, { error: 'Server misconfigured.' });

  const { identity_hash, fields } = req.body || {};
  if (typeof identity_hash !== 'string' || !IDENTITY_RE.test(identity_hash.trim())) {
    return json(res, 400, { error: 'Valid identity_hash is required.' });
  }
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return json(res, 400, { error: 'fields is required.' });
  }

  const requested = Object.keys(fields);
  const hasUserFields = requested.some((key) => USER_FIELDS.includes(key));
  const hasInternalFields = requested.some((key) => INTERNAL_FIELDS.includes(key));
  const unknownFields = requested.filter((key) => !USER_FIELDS.includes(key) && !INTERNAL_FIELDS.includes(key));
  if (unknownFields.length) return json(res, 400, { error: 'Unsupported update field.' });

  let verifiedUser = null;
  if (hasUserFields) verifiedUser = await getVerifiedUser(req);
  if (hasUserFields && !verifiedUser) return json(res, 401, { error: 'Authentication required.' });
  if (hasInternalFields && !hasCronSecret(req)) return json(res, 401, { error: 'Internal authorization required.' });

  const lookup = new URLSearchParams({ identity_hash: `eq.${identity_hash.trim()}`, select: 'id,email,user_id', limit: '1' });
  let lookupRes;
  try {
    lookupRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${lookup}`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
  } catch {
    return json(res, 502, { error: 'Assessment lookup failed.' });
  }
  if (!lookupRes.ok) return json(res, 502, { error: 'Assessment lookup failed.' });

  const rows = await lookupRes.json();
  const assessment = rows?.[0];
  if (!assessment) return json(res, 404, { error: 'Assessment not found.' });

  const patch = {};
  const verifiedEmail = String(verifiedUser?.email || '').trim().toLowerCase();
  const assessmentEmail = String(assessment.email || '').trim().toLowerCase();

  if (Object.prototype.hasOwnProperty.call(fields, 'user_id')) {
    if (fields.user_id !== verifiedUser.id) return json(res, 403, { error: 'user_id must match the authenticated account.' });
    if (assessmentEmail !== verifiedEmail) return json(res, 403, { error: 'Assessment email does not match the authenticated account.' });
    if (assessment.user_id && assessment.user_id !== verifiedUser.id) return json(res, 403, { error: 'Assessment already belongs to another account.' });
    patch.user_id = verifiedUser.id;
  }

  if (Object.prototype.hasOwnProperty.call(fields, 'email')) {
    if (typeof fields.email !== 'string' || !EMAIL_RE.test(fields.email)) return json(res, 400, { error: 'Invalid email.' });
    if (fields.email.trim().toLowerCase() !== verifiedEmail) return json(res, 403, { error: 'Email must match the authenticated account.' });
    patch.email = verifiedUser.email;
  }

  for (const key of INTERNAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) patch[key] = fields[key];
  }

  if (!Object.keys(patch).length) return json(res, 400, { error: 'No updatable fields supplied.' });

  const patchParams = new URLSearchParams({ id: `eq.${assessment.id}` });
  let patchRes;
  try {
    patchRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${patchParams}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });
  } catch {
    return json(res, 502, { error: 'Update failed.' });
  }
  if (!patchRes.ok) {
    console.error('update-assessment: patch failed', patchRes.status);
    return json(res, 502, { error: 'Update failed.' });
  }

  return json(res, 200, { ok: true });
}
