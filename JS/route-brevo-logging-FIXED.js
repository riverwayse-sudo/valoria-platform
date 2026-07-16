// src/app/api/waitlist/route.js
// Saves signup to Supabase + sends welcome email via Brevo

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const BREVO_KEY = process.env.BREVO_API_KEY
const BREVO_LIST_ID = process.env.BREVO_LIST_ID
// Separate list for webinar registrants — create this list in Brevo and put
// its numeric ID here. Keeping it separate (rather than just an attribute)
// is what lets a Brevo automation workflow trigger cleanly off list
// membership: "contact added to list X" → send invite → wait → reminder.
const BREVO_WEBINAR_LIST_ID = process.env.BREVO_WEBINAR_LIST_ID
const WEBINAR_SOURCES = new Set(['webinar_july18'])
const FROM_EMAIL = 'info@valoriainstitute.com'
const FROM_NAME  = 'Valoria Institute'

const INTEREST_LABELS = {
  professional:  'Professional / Talent',
  speaker:       'Speaker / Facilitator',
  employer:      'Employer / Recruiter',
  event_planner: 'Event Planner / Organiser',
  facilitator:   'Facilitator',
  other:         'Professional',
}

async function sendWelcomeEmail(email, fullName, interest, role) {
  if (!BREVO_KEY) return

  const firstName = fullName?.split(' ')[0] || 'there'
  const typeLabel = INTEREST_LABELS[interest] || 'Professional'

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>You're on the Valoria waitlist</title>
</head>
<body style="margin:0;padding:0;background:#0F0F1A;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0F0F1A;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

        <!-- PRIME stripe -->
        <tr>
          <td height="3" style="background:linear-gradient(90deg,#1D9E75 20%,#378ADD 25%,#7F77DD 25%,#BA7517 20%,#D85A30 10%);border-radius:2px 2px 0 0;">&nbsp;</td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#1A1A2E;border:1px solid rgba(201,168,76,0.15);border-top:none;padding:40px 40px 36px;">

            <!-- Logo -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
              <tr>
                <td>
                  <span style="font-size:16px;font-weight:700;letter-spacing:0.12em;color:#C9A84C;">VALORIA</span>
                  <span style="font-size:10px;font-weight:400;letter-spacing:0.12em;color:rgba(247,244,238,0.35);margin-left:8px;">INSTITUTE</span>
                </td>
              </tr>
            </table>

            <!-- Headline -->
            <p style="font-size:10px;font-weight:700;letter-spacing:0.2em;color:rgba(201,168,76,0.5);text-transform:uppercase;margin:0 0 12px;">FOUNDING COHORT</p>
            <h1 style="font-size:28px;font-weight:200;color:#F7F4EE;line-height:1.15;letter-spacing:-0.02em;margin:0 0 16px;">
              You're on the list,<br/><em style="font-style:italic;color:#C9A84C;">${firstName}.</em>
            </h1>
            <p style="font-size:14px;font-weight:300;color:rgba(247,244,238,0.5);line-height:1.75;margin:0 0 32px;">
              Something is being built that Africa has never had before.${role ? ` We've noted your role as <strong style="color:rgba(247,244,238,0.75);">${role}</strong>.` : ''} You've joined as a <strong style="color:rgba(247,244,238,0.75);">${typeLabel}</strong>.
            </p>

            <!-- Divider -->
            <hr style="border:none;border-top:1px solid rgba(201,168,76,0.12);margin:0 0 28px;"/>

            <!-- The Problem -->
            <p style="font-size:9px;font-weight:700;letter-spacing:0.2em;color:rgba(201,168,76,0.45);text-transform:uppercase;margin:0 0 8px;">THE PROBLEM</p>
            <p style="font-size:13px;font-weight:300;color:rgba(247,244,238,0.55);line-height:1.8;margin:0 0 24px;">
              Every day, exceptional African professionals are passed over — not because they lack capability, but because no one can prove it. The same names circulate. The same networks win. Everyone else waits.
            </p>

            <!-- The Shift -->
            <p style="font-size:9px;font-weight:700;letter-spacing:0.2em;color:rgba(201,168,76,0.45);text-transform:uppercase;margin:0 0 8px;">THE SHIFT</p>
            <p style="font-size:13px;font-weight:300;color:rgba(247,244,238,0.55);line-height:1.8;margin:0 0 24px;">
              Valoria changes the question employers and organisers ask. Not <em style="color:#F7F4EE;">"who do I already know?"</em> — but <em style="color:#C9A84C;">"who is genuinely the best for this?"</em> One assessed standard. No guesswork. No gatekeeping.
            </p>

            <!-- What's Coming -->
            <p style="font-size:9px;font-weight:700;letter-spacing:0.2em;color:rgba(201,168,76,0.45);text-transform:uppercase;margin:0 0 8px;">WHAT'S COMING</p>
            <p style="font-size:13px;font-weight:300;color:rgba(247,244,238,0.55);line-height:1.8;margin:0 0 28px;">
              A marketplace where every profile is verified by the VALU Index. Where employers search by capability, not connection. Where speakers get booked on merit. Where facilitators earn trust before they walk into the room.
            </p>

            <!-- Three Ways In -->
            <hr style="border:none;border-top:1px solid rgba(201,168,76,0.1);margin:0 0 24px;"/>
            <p style="font-size:9px;font-weight:700;letter-spacing:0.2em;color:rgba(201,168,76,0.45);text-transform:uppercase;margin:0 0 20px;">THREE WAYS IN</p>

            <!-- ATB Connect -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
              <tr>
                <td width="3" style="background:#378ADD;border-radius:2px;">&nbsp;</td>
                <td style="padding-left:14px;">
                  <p style="font-size:10px;font-weight:700;letter-spacing:0.14em;color:#378ADD;margin:0 0 3px;">ATB CONNECT</p>
                  <p style="font-size:12px;color:rgba(247,244,238,0.4);line-height:1.6;margin:0;">For employers and recruiters — search pre-assessed candidates by score, strength, and sector.</p>
                </td>
              </tr>
            </table>

            <!-- ATB Spotlight -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
              <tr>
                <td width="3" style="background:#C9A84C;border-radius:2px;">&nbsp;</td>
                <td style="padding-left:14px;">
                  <p style="font-size:10px;font-weight:700;letter-spacing:0.14em;color:#C9A84C;margin:0 0 3px;">ATB SPOTLIGHT</p>
                  <p style="font-size:12px;color:rgba(247,244,238,0.4);line-height:1.6;margin:0;">For event planners — discover and book speakers whose capability you can actually verify.</p>
                </td>
              </tr>
            </table>

            <!-- ATB Develop -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
              <tr>
                <td width="3" style="background:#1D9E75;border-radius:2px;">&nbsp;</td>
                <td style="padding-left:14px;">
                  <p style="font-size:10px;font-weight:700;letter-spacing:0.14em;color:#1D9E75;margin:0 0 3px;">ATB DEVELOP</p>
                  <p style="font-size:12px;color:rgba(247,244,238,0.4);line-height:1.6;margin:0;">For L&amp;D leaders — commission PRIME-certified facilitators with an assessed track record.</p>
                </td>
              </tr>
            </table>

            <!-- Closing -->
            <hr style="border:none;border-top:1px solid rgba(201,168,76,0.1);margin:0 0 24px;"/>
            <p style="font-size:13px;font-weight:300;color:rgba(247,244,238,0.35);line-height:1.8;font-style:italic;text-align:center;margin:0 0 8px;">
              You're early. That matters more than you think.
            </p>
            <p style="font-size:10px;font-weight:700;letter-spacing:0.14em;color:rgba(201,168,76,0.5);text-align:center;margin:0 0 32px;">WE'LL BE IN TOUCH.</p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center">
                  <a href="https://valoriainstitute.com" style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#0F0F1A;font-size:11px;font-weight:700;letter-spacing:0.14em;text-decoration:none;">
                    VISIT VALORIA
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 0;text-align:center;">
            <p style="font-size:11px;color:rgba(247,244,238,0.2);margin:0 0 6px;">
              Valoria Institute · African Talent Bureau Ltd · Lagos, Nigeria
            </p>
            <p style="font-size:11px;color:rgba(247,244,238,0.15);margin:0;">
              You're receiving this because you joined the Valoria waitlist.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender:  { name: FROM_NAME, email: FROM_EMAIL },
      to:      [{ email, name: fullName || firstName }],
      replyTo: { email: FROM_EMAIL, name: FROM_NAME },
      subject: `You're on the Valoria waitlist, ${firstName}.`,
      htmlContent: htmlBody,
      tags: ['waitlist', 'welcome', interest || 'general'],
    }),
  })
  // fetch() only rejects on a network failure — a 400/401/403 from Brevo
  // resolves normally and would previously slip past silently. Surface it.
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('Brevo welcome email failed:', res.status, body)
  }
}

// Adds/updates this signup as a contact in a Brevo list, so it can be used
// for real marketing campaigns (e.g. the webinar invite) from Brevo's own
// dashboard — rather than a one-off script here.
// Requires BREVO_LIST_ID (numeric ID from Brevo → Contacts → Lists), and
// the custom attributes ROLE/INTEREST/SOURCE created in Brevo's contact
// attribute settings — Brevo silently drops attributes it doesn't know.
async function syncToBrevoList(email, fullName, role, interest, source, utm = {}) {
  if (!BREVO_KEY || !BREVO_LIST_ID) return

  const [firstName, ...rest] = (fullName || '').trim().split(' ')
  const lastName = rest.join(' ') || ''
  const isWebinar = WEBINAR_SOURCES.has(source)

  const listIds = [Number(BREVO_LIST_ID)]
  if (isWebinar && BREVO_WEBINAR_LIST_ID) listIds.push(Number(BREVO_WEBINAR_LIST_ID))

  const attributes = {
    FIRSTNAME: firstName || '',
    LASTNAME:  lastName,
    ROLE:      role || '',
    INTEREST:  interest || '',
    SOURCE:    source || '',
  }
  // Only sent if utm_source/utm_medium/utm_campaign attributes exist in
  // Brevo → Contacts → Settings → Attributes; otherwise Brevo silently
  // drops them (same behavior as EVENT_NAME/EVENT_DATE below) — safe either way.
  if (utm.source)   attributes.UTM_SOURCE = utm.source
  if (utm.medium)   attributes.UTM_MEDIUM = utm.medium
  if (utm.campaign) attributes.UTM_CAMPAIGN = utm.campaign
  // Merge fields the Brevo automation's emails can reference (e.g.
  // {{ contact.EVENT_NAME }}, {{ contact.EVENT_DATE }}) — create these as
  // custom attributes in Brevo → Contacts → Settings → Attributes first,
  // same as ROLE/INTEREST/SOURCE above, or Brevo silently drops them.
  if (isWebinar) {
    attributes.EVENT_NAME = 'Why Being Good At Your Job Is No Longer Enough'
    attributes.EVENT_DATE = 'Saturday, July 18, 2026 — 10:00 AM to 1:00 PM WAT'
  }

  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      attributes,
      listIds,
      updateEnabled: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('Brevo contact sync failed:', res.status, body, { email, listIds })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { full_name, email, role, interest, type, source, utm_source, utm_medium, utm_campaign } = body

    if (!full_name?.trim() || !email?.trim()) {
      return Response.json({ error: 'Name and email are required.' }, { status: 400 })
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(email)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const baseSource = source || 'waitlist_page'
    // Fold UTM into the existing `source` text column instead of adding new
    // Supabase columns — avoids a schema migration while still keeping full
    // attribution readable in the admin dashboard / CSV export.
    const hasUtm = utm_source || utm_medium || utm_campaign
    const sourceForDb = hasUtm
      ? `${baseSource} [utm:${utm_source || '-'}/${utm_medium || '-'}/${utm_campaign || '-'}]`
      : baseSource

    const { error } = await supabase
      .from('waitlist')
      .insert([{
        full_name: full_name.trim(),
        email:     email.trim().toLowerCase(),
        role:      role?.trim() || null,
        interest:  interest || null,
        type:      type || 'standalone',
        source:    sourceForDb,
      }])

    if (error && error.code !== '23505') {
      console.error('Waitlist insert error:', error)
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }

    // Send welcome email (fire and forget — don't block the response)
    sendWelcomeEmail(email.trim().toLowerCase(), full_name.trim(), interest, role?.trim()).catch(
      err => console.error('Brevo email error:', err)
    )

    // Sync to Brevo marketing list (fire and forget — don't block the response)
    syncToBrevoList(
      email.trim().toLowerCase(), full_name.trim(), role?.trim(), interest, source || 'waitlist_page',
      { source: utm_source, medium: utm_medium, campaign: utm_campaign }
    ).catch(
      err => console.error('Brevo list sync error:', err)
    )

    return Response.json({ message: 'Joined successfully.' }, { status: 200 })
  } catch (err) {
    console.error('Waitlist API error:', err)
    return Response.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
