// api/send-profile-reminder.js
//
// Per Femi's request (11 Aug): once someone finishes the VALU Index but
// hasn't completed their profile, send a reminder nudging them to finish
// it — an incomplete profile never becomes eligible for marketplace
// listing, and there was previously no re-engagement for this at all (see
// the 2 Aug audit: "No re-engagement for assessment-only users").
//
// Called per-row from the daily sweep (see sweep-unsent-reports.js, phase
// 4) the same way report-sending already is. Safe to call more than once
// for the same identity_hash — it no-ops once profile_reminder_sent_at is
// set, exactly like generate-and-send-report already does for reports.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BREVO_KEY = process.env.BREVO_API_KEY;
const VALORIA_SITE_URL = process.env.VALORIA_SITE_URL || 'https://valoriainstitute.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Fails closed, same reasoning as generate-and-send-report's CRON_SECRET
  // check — but written so an unset secret does NOT silently disable the
  // check (that was a real bug fixed elsewhere in this app on 22 Jul).
  const auth = req.headers.authorization;
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('send-profile-reminder: missing SUPABASE_URL or SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  const { identity_hash } = req.body || {};
  if (!identity_hash) return res.status(400).json({ error: 'identity_hash is required.' });

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

  try {
    const assessRes = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identity_hash}&select=name,email,identity_hash,designation,total_score`, { headers });
    const [assessment] = await assessRes.json();
    if (!assessment?.email) return res.status(404).json({ error: 'No assessment/email found for this identity_hash.' });

    // The whole point of the check: is there a real, complete profile for
    // this email yet? If yes, nothing to nudge them about — just mark the
    // reminder as handled so the sweep stops picking this row up.
    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/professional_profiles?email=eq.${encodeURIComponent(assessment.email)}&select=profile_complete`, { headers });
    const [profile] = await profRes.json();
    const alreadyComplete = !!profile?.profile_complete;

    if (!alreadyComplete && BREVO_KEY) {
      const firstName = assessment.name?.trim()?.split(' ')[0] || 'there';
      const html = `
        <div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#1A1A2E;max-width:520px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:.14em;color:#C9A84C;text-transform:uppercase;margin:0 0 16px;">VALORIA INSTITUTE</p>
          <p style="font-size:20px;font-weight:300;margin:0 0 16px;">Almost there, ${firstName}.</p>
          <p>You completed your VALU Index${assessment.designation ? ` and scored as <strong>${assessment.designation}</strong>` : ''} — but your profile isn't finished yet, so you're not visible to employers, event organisers, or training buyers searching the marketplace.</p>
          <p>It only takes a few minutes to finish.</p>
          <p style="margin:28px 0;">
            <a href="${VALORIA_SITE_URL}/profile/setup" style="display:inline-block;padding:12px 24px;background:#C9A84C;color:#1A1A2E;font-size:12px;font-weight:700;letter-spacing:.1em;text-decoration:none;">FINISH YOUR PROFILE</a>
          </p>
          <p style="color:#888;font-size:12px;">Valoria Institute &middot; African Talent Bureau Ltd &middot; Lagos, Nigeria</p>
        </div>`;

      const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Valoria Institute', email: 'info@valoriainstitute.com' },
          to: [{ email: assessment.email, name: assessment.name || undefined }],
          subject: 'Finish your Valoria profile to go live',
          htmlContent: html,
          tags: ['profile-reminder'],
        }),
      });
      if (!sendRes.ok) console.error('send-profile-reminder: Brevo send failed', sendRes.status, await sendRes.text().catch(() => ''));
    }

    // Mark handled either way — complete already, or reminder just sent —
    // so this row doesn't get picked up by the sweep again tomorrow.
    await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?identity_hash=eq.${identity_hash}`, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ profile_reminder_sent_at: new Date().toISOString() }),
    });

    return res.status(200).json({ reminded: !alreadyComplete, alreadyComplete });
  } catch (err) {
    console.error('send-profile-reminder error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
