import { verifyValuHandoffToken } from './valu-handoff-token.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.json(data);
}
function norm(value) { return String(value || '').trim().toLowerCase(); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(res, 503, { ok: false, error: 'Service unavailable' });

  const { handoff_token: token, taster_id: tasterId, name, role } = req.body || {};
  if (typeof tasterId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tasterId)) {
    return json(res, 400, { ok: false, error: 'A valid snapshot reference is required.' });
  }
  const handoff = verifyValuHandoffToken(token, tasterId);
  if (!handoff) return json(res, 401, { ok: false, error: 'The secure assessment handoff is missing or expired.' });

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
  const params = new URLSearchParams({ id: `eq.${tasterId}`, select: 'id,user_id,name,role,completed_at', limit: '1' });
  const tasterRes = await fetch(`${SUPABASE_URL}/rest/v1/taster_sessions?${params}`, { headers });
  if (!tasterRes.ok) return json(res, 502, { ok: false, error: 'Could not verify the VALU snapshot.' });
  const taster = (await tasterRes.json())?.[0];
  if (!taster) return json(res, 404, { ok: false, error: 'VALU snapshot not found.' });
  if (!taster.completed_at) return json(res, 409, { ok: false, error: 'Complete your VALU snapshot first.' });
  if (taster.user_id !== handoff.sub) return json(res, 403, { ok: false, error: 'This handoff does not match the snapshot owner.' });
  if (norm(taster.name) !== norm(name) || norm(taster.role) !== norm(role)) {
    return json(res, 403, { ok: false, error: 'The assessment identity does not match the saved snapshot.' });
  }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${handoff.sub}`, { headers });
  if (!userRes.ok) return json(res, 502, { ok: false, error: 'Could not verify the Valoria account.' });
  const user = await userRes.json();
  if (!user.email_confirmed_at) return json(res, 403, { ok: false, error: 'Confirm your Valoria account email before continuing.' });

  return json(res, 200, { ok: true, expires_at: handoff.exp });
}
