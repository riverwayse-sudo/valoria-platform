'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ADMIN_EMAILS } from '@/lib/adminEmails'

const GOLD = '#C9A84C'
const MIDNIGHT = '#1A1A2E'
const PARCHMENT = '#F7F4EE'
const DARK = '#0F0F1A'
const DIM = 'rgba(247,244,238,.45)'
const FAINT = 'rgba(247,244,238,.2)'

const STATUS_OPTIONS = ['pending', 'reviewing', 'introduced', 'declined', 'completed']

const STATUS_COLORS = {
  pending:    { bg: 'rgba(186,117,23,.15)',  text: '#BA7517',  label: 'Pending' },
  reviewing:  { bg: 'rgba(55,138,221,.15)',  text: '#378ADD',  label: 'Under Review' },
  introduced: { bg: 'rgba(29,158,117,.15)',  text: '#1D9E75',  label: 'Introduced' },
  declined:   { bg: 'rgba(216,90,48,.15)',   text: '#D85A30',  label: 'Declined' },
  completed:  { bg: 'rgba(201,168,76,.15)',  text: GOLD,       label: 'Completed' },
}

export default function AdminPage() {
  const [user, setUser] = useState(null)
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('queue') // 'queue' | 'profiles' | 'stats'

  // Data
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [buyerProfiles, setBuyerProfiles] = useState([]) // employers/organisers — live in `profiles`, not `professional_profiles`
  const [updatingId, setUpdatingId] = useState(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('') // 'talent' | 'speaker'
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)

      if (!ADMIN_EMAILS.includes(user.email)) {
        setAuthorized(false)
        setLoading(false)
        return
      }
      setAuthorized(true)
      await Promise.all([fetchMessages(), fetchProfiles(), fetchBuyerProfiles()])
      setLoading(false)
    }
    load()
  }, [])

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        recipient:recipient_profile_id ( id, display_name, headline, active_tracks, photo_url )
      `)
      .order('created_at', { ascending: false })
    setMessages(data || [])
  }

  async function fetchProfiles() {
    const { data } = await supabase
      .from('professional_profiles')
      .select('id, display_name, headline, active_tracks, listing_status, industry, availability, created_at')
      .order('created_at', { ascending: false })
    setProfiles(data || [])
  }

  async function fetchBuyerProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('id, user_type')
    setBuyerProfiles(data || [])
  }

  async function updateMessageStatus(id, status) {
    setUpdatingId(id)
    await supabase.from('messages').update({ status }).eq('id', id)
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status } : m))
    setUpdatingId(null)
  }

  async function toggleVisibility(profileId, current) {
    const next = current === 'listed' ? 'unlisted' : 'listed'
    await supabase.from('professional_profiles').update({ listing_status: next }).eq('id', profileId)
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, listing_status: next } : p))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Raleway', color: GOLD, fontSize: '14px' }}>
      Loading admin panel…
    </div>
  )

  if (!authorized) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Raleway', color: PARCHMENT, gap: '16px', textAlign: 'center', padding: '40px' }}>
      <div style={{ fontSize: '28px', color: GOLD }}>◈</div>
      <h1 style={{ fontSize: '20px', fontWeight: 300 }}>Access restricted.</h1>
      <p style={{ fontSize: '13px', color: DIM }}>This panel is only accessible to Valoria Institute administrators.</p>
      <Link href="/" style={styles.btnGold}>Return Home</Link>
    </div>
  )

  // Filtered message queue
  const filteredMessages = messages.filter(m => {
    const matchStatus = !filterStatus || m.status === filterStatus || (!m.status && filterStatus === 'pending')
    const matchType = !filterType || (m.recipient?.active_tracks || []).includes(filterType)
    const q = searchQ.toLowerCase()
    const matchSearch = !q || (m.subject || '').toLowerCase().includes(q) || (m.body || '').toLowerCase().includes(q) || (m.recipient?.display_name || '').toLowerCase().includes(q)
    return matchStatus && matchType && matchSearch
  })

  // Stats
  const totalMessages = messages.length
  const pendingCount = messages.filter(m => !m.status || m.status === 'pending').length
  const introducedCount = messages.filter(m => m.status === 'introduced').length
  const completedCount = messages.filter(m => m.status === 'completed').length
  const listedProfiles = profiles.filter(p => p.listing_status === 'listed').length
  const talentCount = profiles.filter(p => (p.active_tracks || []).includes('candidate')).length
  const speakerCount = profiles.filter(p => (p.active_tracks || []).includes('speaker')).length
  const employerCount = buyerProfiles.filter(p => p.user_type === 'employer').length
  const organiserCount = buyerProfiles.filter(p => p.user_type === 'organiser').length

  return (
    <div style={{ minHeight: '100vh', background: DARK, fontFamily: "'Raleway', 'Helvetica Neue', Arial, sans-serif", color: PARCHMENT }}>

      {/* HEADER */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/" style={{ lineHeight: 0 }}>
            <img src="/logo.png" alt="Valoria Institute" style={{ height: '40px', width: 'auto' }} />
          </Link>
          <div style={{ width: '1px', height: '28px', background: 'rgba(201,168,76,.2)' }} />
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.18em', color: 'rgba(201,168,76,.6)' }}>ADMIN</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Link href="/marketplace" style={styles.navLink}>Marketplace</Link>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
            style={styles.signOutBtn}>Sign Out</button>
        </div>
      </header>

      <div style={styles.page}>

        {/* STAT CARDS */}
        <div style={styles.statGrid}>
          <StatCard label="Total Enquiries" value={totalMessages} />
          <StatCard label="Pending Action" value={pendingCount} accent="#BA7517" />
          <StatCard label="Introduced" value={introducedCount} accent="#1D9E75" />
          <StatCard label="Completed" value={completedCount} accent={GOLD} />
          <StatCard label="Listed Profiles" value={listedProfiles} />
          <StatCard label="Talent / Speakers" value={`${talentCount} / ${speakerCount}`} />
          <StatCard label="Employers / Organisers" value={`${employerCount} / ${organiserCount}`} />
          <StatCard label="Total Accounts" value={profiles.length + buyerProfiles.length} />
        </div>

        {/* TABS */}
        <div style={styles.tabs}>
          {[['queue', 'Enquiry Queue'], ['profiles', 'All Profiles']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ ...styles.tab, ...(activeTab === id ? styles.tabActive : {}) }}>
              {label}
              {id === 'queue' && pendingCount > 0 && (
                <span style={styles.tabBadge}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── QUEUE TAB ── */}
        {activeTab === 'queue' && (
          <>
            {/* Filters */}
            <div style={styles.filterBar}>
              <input
                type="search" placeholder="Search subject, body, recipient…"
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
                style={styles.searchInput}
              />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={styles.select}>
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_COLORS[s].label}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} style={styles.select}>
                <option value="">All types</option>
                <option value="candidate">Talent enquiries</option>
                <option value="speaker">Speaker bookings</option>
              </select>
              {(filterStatus || filterType || searchQ) && (
                <button onClick={() => { setFilterStatus(''); setFilterType(''); setSearchQ('') }} style={styles.clearBtn}>
                  Clear
                </button>
              )}
            </div>

            <div style={{ fontSize: '12px', color: FAINT, marginBottom: '16px' }}>
              {filteredMessages.length} of {totalMessages} enquiries
            </div>

            {filteredMessages.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: '24px', color: GOLD, marginBottom: '8px' }}>◈</div>
                <p style={{ color: DIM, fontSize: '13px' }}>No enquiries match current filters.</p>
              </div>
            ) : (
              <div style={styles.queueList}>
                {filteredMessages.map(msg => (
                  <MessageRow
                    key={msg.id}
                    msg={msg}
                    updating={updatingId === msg.id}
                    onStatusChange={updateMessageStatus}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PROFILES TAB ── */}
        {activeTab === 'profiles' && (
          <div style={styles.profileTable}>
            <div style={styles.tableHeader}>
              <span>Name / Type</span>
              <span>Headline</span>
              <span>Listed</span>
              <span>Joined</span>
              <span>Actions</span>
            </div>
            {profiles.map(p => (
              <ProfileRow
                key={p.id}
                profile={p}
                onToggle={() => toggleVisibility(p.id, p.listing_status)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, accent }) {
  return (
    <div style={styles.statCard}>
      <div style={{ fontSize: 'clamp(22px,2.5vw,30px)', fontWeight: 700, color: accent || PARCHMENT, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.1em', color: 'rgba(201,168,76,.5)', marginTop: '6px', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function MessageRow({ msg, updating, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)
  const status = msg.status || 'pending'
  const sc = STATUS_COLORS[status] || STATUS_COLORS.pending
  const date = new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const prof = msg.recipient

  return (
    <div style={styles.messageRow}>
      <div style={styles.messageTop} onClick={() => setExpanded(e => !e)}>
        {/* Left: recipient info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <div style={styles.miniAvatar}>
            {prof?.photo_url
              ? <img src={prof.photo_url} alt={prof.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : <span style={{ color: FAINT, fontSize: '12px' }}>◈</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: PARCHMENT, marginBottom: '2px' }}>
              {prof?.display_name || 'Unknown'}
              <span style={{ marginLeft: '8px', fontSize: '10px', color: DIM, fontWeight: 400 }}>
                [{(prof?.active_tracks || []).join(', ') || '—'}]
              </span>
            </div>
            <div style={{ fontSize: '12px', color: DIM, fontWeight: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {msg.subject}
            </div>
          </div>
        </div>

        {/* Right: status + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: FAINT }}>{date}</span>
          <span style={{ ...styles.statusPill, background: sc.bg, color: sc.text }}>{sc.label}</span>
          <span style={{ color: DIM, fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded body + status controls */}
      {expanded && (
        <div style={styles.messageExpanded}>
          <pre style={styles.messageBody}>{msg.body}</pre>

          <div style={styles.statusControls}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.12em', color: 'rgba(201,168,76,.5)' }}>UPDATE STATUS:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map(s => {
                const sc2 = STATUS_COLORS[s]
                const isActive = (msg.status || 'pending') === s
                return (
                  <button
                    key={s}
                    disabled={updating || isActive}
                    onClick={() => onStatusChange(msg.id, s)}
                    style={{
                      padding: '5px 12px', borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                      letterSpacing: '.08em', cursor: isActive || updating ? 'default' : 'pointer',
                      border: `1px solid ${isActive ? sc2.text : 'rgba(201,168,76,.2)'}`,
                      background: isActive ? sc2.bg : 'transparent',
                      color: isActive ? sc2.text : DIM,
                      fontFamily: 'Raleway', opacity: updating ? 0.5 : 1,
                    }}
                  >
                    {updating && isActive ? '…' : sc2.label}
                  </button>
                )
              })}
            </div>
            {prof && (
              <Link href={`/profile/${msg.recipient_profile_id}`} target="_blank"
                style={{ fontSize: '11px', color: GOLD, textDecoration: 'none', marginLeft: 'auto' }}>
                View profile →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileRow({ profile: p, onToggle }) {
  const date = new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
  const typeColors = { candidate: '#378ADD', speaker: '#7F77DD', facilitator: '#1D9E75' }
  const tracks = p.active_tracks || []
  const isListed = p.listing_status === 'listed'

  return (
    <div style={styles.tableRow}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: PARCHMENT, marginBottom: '2px' }}>{p.display_name || '—'}</div>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.08em', color: typeColors[tracks[0]] || DIM, textTransform: 'uppercase' }}>
          {tracks.join(', ') || '—'}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: DIM, fontWeight: 300 }}>{p.headline || '—'}</div>
      <div>
        <button
          onClick={onToggle}
          style={{
            padding: '4px 12px', borderRadius: '999px', fontSize: '10px', fontWeight: 700,
            letterSpacing: '.08em', cursor: 'pointer', border: 'none', fontFamily: 'Raleway',
            background: isListed ? 'rgba(29,158,117,.15)' : 'rgba(255,255,255,.06)',
            color: isListed ? '#1D9E75' : 'rgba(247,244,238,.3)',
          }}
        >
          {isListed ? '● Listed' : '○ Hidden'}
        </button>
      </div>
      <div style={{ fontSize: '11px', color: FAINT }}>{date}</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <Link href={`/profile/${p.id}`} target="_blank"
          style={{ fontSize: '11px', color: GOLD, textDecoration: 'none' }}>
          View →
        </Link>
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '64px', background: MIDNIGHT, borderBottom: '1px solid rgba(201,168,76,.12)', position: 'sticky', top: 0, zIndex: 100 },
  navLink: { fontSize: '12px', color: DIM, textDecoration: 'none' },
  signOutBtn: { fontSize: '11px', fontWeight: 700, letterSpacing: '.1em', color: 'rgba(201,168,76,.6)', background: 'transparent', border: '1px solid rgba(201,168,76,.2)', borderRadius: '999px', padding: '7px 16px', cursor: 'pointer', fontFamily: 'Raleway' },
  page: { maxWidth: '1100px', margin: '0 auto', padding: '40px 24px 80px' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '36px' },
  statCard: { background: 'rgba(26,26,46,.5)', border: '1px solid rgba(201,168,76,.1)', borderRadius: '10px', padding: '16px' },
  tabs: { display: 'flex', gap: '4px', background: 'rgba(255,255,255,.03)', borderRadius: '8px', padding: '4px', marginBottom: '24px', width: 'fit-content' },
  tab: { padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'transparent', color: DIM, fontSize: '12px', fontWeight: 600, letterSpacing: '.06em', cursor: 'pointer', fontFamily: 'Raleway', display: 'flex', alignItems: 'center', gap: '8px' },
  tabActive: { background: 'rgba(201,168,76,.12)', color: GOLD },
  tabBadge: { fontSize: '10px', fontWeight: 700, background: '#BA7517', color: PARCHMENT, borderRadius: '999px', padding: '2px 7px' },
  filterBar: { display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: '200px', padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '6px', color: PARCHMENT, fontSize: '13px', fontFamily: 'Raleway', outline: 'none' },
  select: { padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: '6px', color: PARCHMENT, fontSize: '12px', fontFamily: 'Raleway', outline: 'none' },
  clearBtn: { padding: '9px 16px', background: 'transparent', border: '1px solid rgba(201,168,76,.15)', borderRadius: '6px', color: DIM, fontSize: '12px', cursor: 'pointer', fontFamily: 'Raleway' },
  queueList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  messageRow: { background: 'rgba(26,26,46,.5)', border: '1px solid rgba(201,168,76,.1)', borderRadius: '10px', overflow: 'hidden' },
  messageTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px', cursor: 'pointer' },
  messageExpanded: { borderTop: '1px solid rgba(201,168,76,.08)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  messageBody: { fontSize: '12px', color: DIM, fontWeight: 300, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'Raleway', margin: 0, background: 'rgba(0,0,0,.2)', padding: '12px', borderRadius: '6px' },
  statusControls: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  statusPill: { fontSize: '10px', fontWeight: 700, letterSpacing: '.08em', padding: '3px 10px', borderRadius: '999px', whiteSpace: 'nowrap' },
  miniAvatar: { width: '36px', height: '36px', borderRadius: '50%', border: '1px solid rgba(201,168,76,.25)', background: MIDNIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  profileTable: { display: 'flex', flexDirection: 'column', gap: '1px', border: '1px solid rgba(201,168,76,.1)', borderRadius: '10px', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: '12px', padding: '10px 20px', background: 'rgba(201,168,76,.06)', fontSize: '9px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(201,168,76,.5)', textTransform: 'uppercase' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: '12px', padding: '14px 20px', background: 'rgba(26,26,46,.4)', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,.03)' },
  emptyState: { textAlign: 'center', padding: '48px', background: 'rgba(26,26,46,.3)', borderRadius: '10px' },
  btnGold: { display: 'inline-block', padding: '10px 24px', background: GOLD, color: MIDNIGHT, fontSize: '11px', fontWeight: 700, letterSpacing: '.12em', borderRadius: '999px', textDecoration: 'none' },
}
