// api/send-profile-reminder.js
// Internal scheduled job: remind completed VALU users who have not finished
// their professional profile. This endpoint is never a browser capability.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BREVO_KEY = process.env.BREVO_API_KEY;
const VALORIA_SITE_URL = process.env.VALORIA_SITE_URL || 'https://valoriainstitute.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function getHeader(req, name) {
  const headers = req?.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : String(value || '');
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = getHeader(req, 'authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) return json({ error: 'Unauthorized' }, 401);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('send-profile-reminder: missing server environment');
    return json({ error: 'Server misconfigured.' }, 500);
  }

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Invalid request body.' }, 400); }
  const identityHash = String(payload?.identity_hash || '').trim();
  if (!/^fp_[a-f0-9]{16,128}$/i.test(identityHash)) return json({ error: 'Invalid identity_hash.' }, 400);

  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const encodedHash = encodeURIComponent(identityHash);

  try {
    const assessRes = await fetch(
      `${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${encodedHash}&select=name,email,identity_hash,designation,total_score&limit=1`,
      { headers }
    );
    if (!assessRes.ok) {
      console.error('send-profile-reminder: assessment lookup failed', assessRes.status);
      return json({ error: 'Could not look up assessment.' }, 502);
    }
    const [assessment] = await assessRes.json();
    if (!assessment?.email) return json({ error: 'No assessment/email found.' }, 404);

    const email = String(assessment.email).trim().toLowerCase();
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/professional_profiles?email=eq.${encodeURIComponent(email)}&select=profile_complete&limit=1`,
      { headers }
    );
    if (!profRes.ok) {
      console.error('send-profile-reminder: profile lookup failed', profRes.status);
      return json({ error: 'Could not verify profile status.' }, 502);
    }
    const [profile] = await profRes.json();
    const alreadyComplete = !!profile?.profile_complete;

    if (!alreadyComplete && BREVO_KEY) {
      const firstName = assessment.name?.trim()?.split(' ')[0] || 'there';
      const designation = String(assessment.designation || '').replace(/[<>]/g, '');
      const html = `
        <div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#1A1A2E;max-width:520px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:.14em;color:#C9A84C;text-transform:uppercase;margin:0 0 16px;">VALORIA INSTITUTE</p>
          <p style="font-size:20px;font-weight:300;margin:0 0 16px;">Almost there, ${firstName}.</p>
          <p>You completed your VALU Index${designation ? ` and scored as <strong>${designation}</strong>` : ''} — but your profile isn't finished yet, so you're not visible to employers, event organisers, or training buyers searching the marketplace.</p>
          <p>It only takes a few minutes to finish.</p>
          <p style="margin:28px 0;"><a href="${VALORIA_SITE_URL}/profile/setup" style="display:inline-block;padding:12px 24px;background:#C9A84C;color:#1A1A2E;font-size:12px;font-weight:700;letter-spacing:.1em;text-decoration:none;">FINISH YOUR PROFILE</a></p>
          <p style="color:#888;font-size:12px;">Valoria Institute &middot; African Talent Bureau Ltd &middot; Lagos, Nigeria</p>
        </div>`;

      const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Valoria Institute', email: 'info@valoriainstitute.com' },
          to: [{ email, name: assessment.name || undefined }],
          subject: 'Finish your Valoria profile to go live',
          htmlContent: html,
          tags: ['profile-reminder'],
        }),
      });
      if (!sendRes.ok) console.error('send-profile-reminder: Brevo send failed', sendRes.status);
    }

    const markRes = await fetch(
      `${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${encodedHash}`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ profile_reminder_sent_at: new Date().toISOString() }),
      }
    );
    if (!markRes.ok) {
      console.error('send-profile-reminder: mark handled failed', markRes.status);
      return json({ error: 'Could not finalize reminder state.' }, 502);
    }

    return json({ reminded: !alreadyComplete, alreadyComplete });
  } catch (err) {
    console.error('send-profile-reminder error:', err);
    return json({ error: 'Server error.' }, 500);
  }
}
