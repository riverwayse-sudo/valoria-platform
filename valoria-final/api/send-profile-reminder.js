// api/send-profile-reminder.js
// Internal scheduled job: remind completed VALU users who have not finished
// their professional profile. This endpoint is never a browser capability.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BREVO_KEY = process.env.BREVO_API_KEY;
const VALORIA_SITE_URL = process.env.VALORIA_SITE_URL || 'https://valoriainstitute.com';

function send(res, status, data) {
  if (res && typeof res.status === 'function' && typeof res.json === 'function') return res.status(status).setHeader('Cache-Control', 'no-store').json(data);
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
async function parseBody(req) {
  if (req?.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (Buffer.isBuffer(req?.body)) { try { return JSON.parse(req.body.toString('utf8')); } catch { return null; } }
  if (typeof req?.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
  if (typeof req?.json === 'function') { try { return await req.json(); } catch { return null; } }
  return null;
}
function getHeader(req, name) {
  const headers = req?.headers; if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  const value = headers[name] ?? headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] || '' : String(value || '');
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (getHeader(req, 'authorization') !== `Bearer ${CRON_SECRET}`) return send(res, 401, { error: 'Unauthorized' });
  if (!CRON_SECRET || !SUPABASE_URL || !SERVICE_ROLE_KEY) return send(res, 500, { error: 'Server misconfigured.' });
  const payload = await parseBody(req); if (!payload) return send(res, 400, { error: 'Invalid request body.' });
  const identityHash = String(payload?.identity_hash || '').trim();
  if (!/^fp_[a-f0-9]{16,128}$/i.test(identityHash)) return send(res, 400, { error: 'Invalid identity_hash.' });
  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const encodedHash = encodeURIComponent(identityHash);
  try {
    const assessRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${encodedHash}&select=user_id,name,email,designation,total_score&limit=1`, { headers });
    if (!assessRes.ok) return send(res, 502, { error: 'Could not look up assessment.' });
    const [assessment] = await assessRes.json(); if (!assessment?.email) return send(res, 404, { error: 'No assessment/email found.' });
    const email = String(assessment.email).trim().toLowerCase();
    const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`, { headers });
    if (!usersRes.ok) return send(res, 502, { error: 'Could not resolve professional account.' });
    const [user] = await usersRes.json(); if (!user?.id) return send(res, 404, { error: 'No professional account found.' });
    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/professional_profiles?id=eq.${encodeURIComponent(user.id)}&select=id,profile_complete,photo_url,display_name,bio&limit=1`, { headers });
    if (!profRes.ok) return send(res, 502, { error: 'Could not verify profile status.' });
    const [profile] = await profRes.json();
    const missingAvatar = !String(profile?.photo_url || '').trim();
    const missingProfile = !profile?.profile_complete || !String(profile?.display_name || '').trim() || !String(profile?.bio || '').trim();
    const incomplete = missingAvatar || missingProfile;
    if (incomplete && BREVO_KEY) {
      const firstName = assessment.name?.trim()?.split(' ')[0] || 'there';
      const designation = String(assessment.designation || '').replace(/[<>]/g, '');
      const items = `${missingAvatar ? '<li>Add a clear professional photo</li>' : ''}${missingProfile ? '<li>Complete the remaining professional profile information</li>' : ''}`;
      const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#1A1A2E;max-width:520px;"><p style="font-size:11px;font-weight:700;letter-spacing:.14em;color:#C9A84C;text-transform:uppercase;margin:0 0 16px;">VALORIA INSTITUTE</p><p style="font-size:20px;font-weight:300;margin:0 0 16px;">Almost there, ${firstName}.</p><p>You completed your VALU Index${designation ? ` and scored as <strong>${designation}</strong>` : ''}, but your professional profile is not complete yet.</p><p>Please complete the outstanding details:</p><ul>${items}</ul><p style="margin:28px 0;"><a href="${VALORIA_SITE_URL}/profile/setup" style="display:inline-block;padding:12px 24px;background:#C9A84C;color:#1A1A2E;font-size:12px;font-weight:700;letter-spacing:.1em;text-decoration:none;">COMPLETE YOUR PROFILE</a></p><p style="color:#888;font-size:12px;">Valoria Institute · African Talent Bureau Ltd · Lagos, Nigeria</p></div>`;
      const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: { name: 'Valoria Institute', email: 'info@valoriainstitute.com' }, to: [{ email, name: assessment.name || undefined }], subject: missingAvatar ? 'Add your photo to complete your Valoria profile' : 'Complete your Valoria profile to go live', htmlContent: html, tags: ['profile-reminder'] }) });
      if (!sendRes.ok) return send(res, 502, { error: 'Profile reminder email failed.' });
    }
    const markRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${encodedHash}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_reminder_sent_at: new Date().toISOString() }) });
    if (!markRes.ok) return send(res, 502, { error: 'Could not finalize reminder state.' });
    return send(res, 200, { reminded: incomplete && !!BREVO_KEY, incomplete, missingAvatar, missingProfile });
  } catch (err) { console.error('send-profile-reminder error:', err); return send(res, 500, { error: 'Server error.' }); }
}
