// src/app/api/waitlist/stats/route.js
// Read-only, public. Powers the live "X joined" counter + social-proof
// ticker on the waitlist hero. Real numbers only — never fabricate counts
// or activity here; that's what turns urgency messaging into a deceptive
// claim. If Supabase is unreachable or empty, return null/[] and let the
// component hide itself rather than fake data.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const INTEREST_LABELS = {
  professional:  'Professional',
  speaker:       'Speaker',
  employer:      'Employer',
  event_planner: 'Event Planner',
  facilitator:   'Facilitator',
  other:         'Professional',
}

// Cache at the edge for 30s — keeps the counter feeling live without
// hammering Supabase on every hero page load.
export const revalidate = 30

export async function GET() {
  try {
    const { count, error: countError } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true })

    if (countError) throw countError

    const { data: recentRows, error: recentError } = await supabase
      .from('waitlist')
      .select('full_name, interest, created_at')
      .order('created_at', { ascending: false })
      .limit(8)

    if (recentError) throw recentError

    // Anonymize: first name only, never last name or email, matching the
    // display_initials pattern already used for public profile listings.
    const recent = (recentRows || []).map(r => ({
      first_name: (r.full_name || '').trim().split(' ')[0] || 'Someone',
      interest_label: INTEREST_LABELS[r.interest] || 'Professional',
      created_at: r.created_at,
    }))

    return Response.json({ total: count ?? null, recent })
  } catch (err) {
    console.error('Waitlist stats error:', err)
    // Fail quiet — the ticker component treats this as "nothing to show"
    // rather than surfacing an error state on a marketing page.
    return Response.json({ total: null, recent: [] }, { status: 200 })
  }
}
