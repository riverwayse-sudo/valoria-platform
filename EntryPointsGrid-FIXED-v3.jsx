'use client'
import { useState, useEffect } from 'react'
import { useLaunchStatus } from '@/lib/useLaunchStatus'
import { supabase } from '@/lib/supabase'

// Canonical "three entry points" card grid — the exact visual standard shown
// on the homepage. Import and render this anywhere the same three-way
// Connect/Spotlight/Develop concept needs to appear, instead of re-hardcoding
// a variant of it — that's what caused the drift between pages.

const POINTS = [
  {
    key: 'ep-1', color: '#378ADD',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" stroke="#378ADD" strokeWidth="1.5" />
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="#378ADD" strokeWidth="1.5" />
        <circle cx="12" cy="14" r="2" stroke="#378ADD" strokeWidth="1.5" />
      </svg>
    ),
    name: <>ATB<br/>Connect</>,
    buyer: 'For Employers & Recruiters',
    desc: 'Search pre-assessed candidates by VALU Index score, cluster strength, sector, and designation. Every profile backed by one independently assessed standard.',
    modality: 'CANDIDATE',
    liveHref: '/atb-connect',
  },
  {
    key: 'ep-2', color: '#C9A84C',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="4" stroke="#C9A84C" strokeWidth="1.5" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17 4l2 2-2 2M19 6h-3" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    name: <>ATB<br/>Spotlight</>,
    buyer: 'For Event Planners & Organisers',
    desc: 'Discover and book speakers by expertise, PRIME cluster strength, tier designation, and VALU Index score. Every speaker assessed. No guesswork.',
    modality: 'SPEAKER',
    liveHref: '/spotlight',
  },
  {
    key: 'ep-3', color: '#1D9E75',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    name: <>ATB<br/>Develop</>,
    buyer: 'For L&D & HR Leaders',
    desc: 'Commission PRIME-certified facilitators to run development programmes. Every facilitator carries an assessed track record you can verify before you sign.',
    modality: 'FACILITATOR',
    liveHref: '/facilitators',
  },
]

// Pre-launch: every card scrolls to the waitlist form (ctaHref prop, same
// as before). Post-launch: each card routes to its own real marketplace
// page instead — live via useLaunchStatus, so this flips correctly the
// moment the gate lifts, even for a tab already open when it happens, with
// no redeploy and no manual refresh needed.
export default function EntryPointsGrid({ ctaHref = '#waitlist' }) {
  const launchedByDate = useLaunchStatus()
  // An authenticated session should see these as live too — same bypass
  // middleware.js already grants (a logged-in visitor can navigate straight
  // to /atb-connect etc. regardless of the date), and the same fix applied
  // to Nav.jsx and HeroSlider.jsx. Without this, a signed-in visitor still
  // sees "Get Early Access" cards pointing at the waitlist instead of the
  // real destination they're already allowed to reach.
  const [user, setUser] = useState(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null)
    })
    return () => listener?.subscription?.unsubscribe()
  }, [])
  const launched = launchedByDate || !!user

  return (
    <>
      {POINTS.map(p => (
        <div key={p.key} className={`ep-card ${p.key}`} style={{ '--ep-color': p.color }}>
          <style>{`.${p.key}::before { background: ${p.color}; }`}</style>
          <div className="ep-icon" style={{ background: `${p.color}1a`, border: `1px solid ${p.color}40` }}>
            {p.icon}
          </div>
          <h3 className="ep-name" style={{ color: p.color }}>{p.name}</h3>
          <div className="ep-buyer" style={{ color: p.color }}>{p.buyer}</div>
          <p className="ep-desc-text">{p.desc}</p>
          <div className="ep-modality" style={{ background: `${p.color}1a`, color: p.color, border: `1px solid ${p.color}33` }}>{p.modality}</div>
          <a href={launched ? p.liveHref : ctaHref} className="ep-link" style={{ color: p.color }}>
            {launched ? 'Explore' : 'Get Early Access'} <span aria-hidden="true">→</span>
          </a>
        </div>
      ))}
    </>
  )
}
