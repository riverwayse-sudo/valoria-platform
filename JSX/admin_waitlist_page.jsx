'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import { ADMIN_EMAILS } from '@/lib/adminEmails'

const GOLD  = '#C9A84C'
const DARK  = '#0F0F1A'
const MID   = '#1A1A2E'
const PARCH = '#F7F4EE'
const DIM   = 'rgba(247,244,238,.5)'
const GLINE = 'rgba(201,168,76,.12)'

const SOURCE_LABELS = {
  site_gate:     'Gate popup',
  homepage_form: 'Homepage form',
  waitlist_page: 'Waitlist page',
  standalone:    'Standalone page',
}

// Kept in sync with the actual <select> options in WaitlistForm.jsx /
// WaitlistModal.jsx: professional, speaker, employer, event_planner, other.
// 'facilitator' is intentionally not an option there, so it's never
// submitted — don't build summary cards/filters around it.
const INTEREST_LABELS = {
  professional: 'Professional / Talent',
  speaker:      'Speaker',
  employer:     'Employer',
  event_planner:'Event Organiser',
  other:        'Other',
}

export default function AdminWaitlistPage() {
  const [entries,  setEntries]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [authed,   setAuthed]   = useState(false)
  const [checking, setChecking] = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('')

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && ADMIN_EMAILS.includes(user.email)) {
        setAuthed(true)
        fetchEntries()
      }
      setChecking(false)
    })
  }, [])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const filtered = entries.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (e.full_name || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.role || '').toLowerCase().includes(q)
    const matchFilter = !filter || e.interest === filter || e.role === filter
    return matchSearch && matchFilter
  })

  // Group by interest/role
  const counts = entries.reduce((acc, e) => {
    const key = e.interest || e.role || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  if (checking) return (
    <div style={{ minHeight:'100vh', background: DARK, display:'flex', alignItems:'center', justifyContent:'center', color: DIM, fontFamily:'var(--font,Raleway,sans-serif)', fontSize:'13px' }}>
      Checking access…
    </div>
  )

  if (!authed) return (
    <>
      <Nav />
      <div style={{ minHeight:'100vh', background: DARK, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', fontFamily:'var(--font,Raleway,sans-serif)', paddingTop:'80px' }}>
        <div style={{ fontSize:'32px', color: GOLD }}>◈</div>
        <p style={{ fontSize:'14px', color: DIM }}>Admin access only. Please sign in with an admin account.</p>
        <a href="/login" style={{ padding:'12px 24px', background: GOLD, color: DARK, fontSize:'11px', fontWeight:700, letterSpacing:'.12em', textDecoration:'none' }}>
          SIGN IN
        </a>
      </div>
    </>
  )

  return (
    <>
      <Nav />
      <div style={{ minHeight:'100vh', background: DARK, color: PARCH, fontFamily:'var(--font,Raleway,sans-serif)', padding:'100px clamp(20px,4vw,48px) 80px' }}>

        {/* Header */}
        <div style={{ marginBottom:'40px' }}>
          <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.2em', color:'rgba(201,168,76,.45)', marginBottom:'10px' }}>ADMIN — WAITLIST</div>
          <h1 style={{ fontSize:'clamp(28px,3vw,40px)', fontWeight:200, letterSpacing:'-.02em', marginBottom:'8px' }}>Waitlist Signups</h1>
          <p style={{ fontSize:'13px', fontWeight:300, color: DIM }}>{entries.length} total registrations</p>
        </div>

        {/* Summary cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:'12px', marginBottom:'40px' }}>
          {[
            { label:'Total', value: entries.length, color: GOLD },
            { label:'Professionals', value: (counts.professional || 0), color:'#378ADD' },
            { label:'Speakers', value: (counts.speaker || 0), color: GOLD },
            { label:'Employers', value: (counts.employer || 0), color:'#1D9E75' },
            { label:'Event Organisers', value: (counts.event_planner || 0), color:'#7F77DD' },
            { label:'Other', value: (counts.other || 0), color:'#BA7517' },
          ].map(s => (
            <div key={s.label} style={{ background: MID, border:`1px solid ${GLINE}`, padding:'18px' }}>
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.16em', textTransform:'uppercase', color:'rgba(201,168,76,.4)', marginBottom:'8px' }}>{s.label}</div>
              <div style={{ fontSize:'32px', fontWeight:700, color: s.color, lineHeight:1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:'12px', marginBottom:'24px', flexWrap:'wrap' }}>
          <input
            type="search"
            placeholder="Search name, email, role…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding:'10px 14px', background:'rgba(255,255,255,.04)', border:`1px solid ${GLINE}`, color: PARCH, fontSize:'13px', fontFamily:'var(--font,Raleway,sans-serif)', outline:'none', width:'280px' }}
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ padding:'10px 14px', background: MID, border:`1px solid ${GLINE}`, color: PARCH, fontSize:'13px', fontFamily:'var(--font,Raleway,sans-serif)', outline:'none' }}>
            <option value="">All types</option>
            <option value="professional">Professionals</option>
            <option value="speaker">Speakers</option>
            <option value="employer">Employers</option>
            <option value="event_planner">Event Organisers</option>
            <option value="other">Other</option>
          </select>
          <button onClick={fetchEntries}
            style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${GLINE}`, color: DIM, fontSize:'11px', fontWeight:700, letterSpacing:'.1em', cursor:'pointer', fontFamily:'var(--font,Raleway,sans-serif)' }}>
            REFRESH
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ color: DIM, fontSize:'13px', padding:'40px 0' }}>Loading…</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${GLINE}` }}>
                  {['#', 'Name', 'Email', 'Joining as', 'Role / Title', 'Source', 'Date'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:'9px', fontWeight:700, letterSpacing:'.14em', color:'rgba(201,168,76,.4)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom:`1px solid rgba(201,168,76,.06)` }}
                    onMouseEnter={ev => ev.currentTarget.style.background='rgba(201,168,76,.03)'}
                    onMouseLeave={ev => ev.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'12px', color: DIM, fontVariantNumeric:'tabular-nums' }}>{filtered.length - i}</td>
                    <td style={{ padding:'12px', fontWeight:500, color: PARCH }}>{e.full_name || '—'}</td>
                    <td style={{ padding:'12px', color: DIM }}>
                      <a href={`mailto:${e.email}`} style={{ color: GOLD, textDecoration:'none' }}>{e.email}</a>
                    </td>
                    <td style={{ padding:'12px' }}>
                      <span style={{ padding:'3px 10px', background:'rgba(201,168,76,.08)', border:`1px solid ${GLINE}`, fontSize:'11px', color: GOLD, letterSpacing:'.06em' }}>
                        {INTEREST_LABELS[e.interest] || INTEREST_LABELS[e.role] || e.interest || e.role || '—'}
                      </span>
                    </td>
                    <td style={{ padding:'12px', color: DIM }}>{e.role && !INTEREST_LABELS[e.role] ? e.role : '—'}</td>
                    <td style={{ padding:'12px', color: DIM, fontSize:'11px' }}>
                      {SOURCE_LABELS[e.source] || e.source || '—'}
                    </td>
                    <td style={{ padding:'12px', color: DIM, fontSize:'11px', whiteSpace:'nowrap' }}>
                      {e.created_at ? new Date(e.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding:'40px', textAlign:'center', color: DIM, fontSize:'13px' }}>
                No results found.
              </div>
            )}
          </div>
        )}

      </div>
    </>
  )
}
