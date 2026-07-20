'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ─── brand tokens — same system as the public profile page ─────────────────
const GOLD    = '#C9A84C'
const DARK    = '#0F0F1A'
const MID     = '#1A1A2E'
const PARCH   = '#F7F4EE'
const DIM     = 'rgba(247,244,238,.5)'
const FAINT   = 'rgba(247,244,238,.15)'
const GLINE   = 'rgba(201,168,76,.12)'
const GLINE2  = 'rgba(201,168,76,.28)'
const PRIME   = [
  { letter: 'P', color: '#1D9E75' },
  { letter: 'R', color: '#378ADD' },
  { letter: 'I', color: '#7F77DD' },
  { letter: 'M', color: '#BA7517' },
  { letter: 'E', color: '#D85A30' },
]

const FIRST_TIME_WINDOW_HOURS = 48

const STATUS_COLORS = {
  pending:    { bg: 'rgba(186,117,23,.12)',  text: '#BA7517',  label: 'Pending' },
  reviewing:  { bg: 'rgba(55,138,221,.12)',  text: '#378ADD',  label: 'Under Review' },
  introduced: { bg: 'rgba(29,158,117,.12)',  text: '#1D9E75',  label: 'Introduced' },
  declined:   { bg: 'rgba(216,90,48,.12)',   text: '#D85A30',  label: 'Declined' },
  completed:  { bg: 'rgba(201,168,76,.12)',  text: GOLD,       label: 'Completed' },
}

// ─── helpers ─────────────────────────────────────────────
function getInitials(name) {
  if (!name) return '??'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words.slice(0, 3).map(w => w[0].toUpperCase()).join('.') + '.'
}
function getAvatarLetters(name) {
  if (!name) return '?'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
function completenessFields(isSpeaker) {
  return isSpeaker
    ? ['display_name', 'headline', 'bio', 'photo_url', 'topics', 'tier', 'fee_range']
    : ['display_name', 'headline', 'bio', 'photo_url', 'skills', 'industry', 'availability']
}
function computeCompleteness(profile, isSpeaker) {
  const fields = completenessFields(isSpeaker)
  const filled = fields.filter(f => {
    const v = profile[f]
    return Array.isArray(v) ? v.length > 0 : !!v
  }).length
  return Math.round((filled / fields.length) * 100)
}
function memberSince(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isSupply, setIsSupply] = useState(false)
  const [enquiries, setEnquiries] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWelcome, setShowWelcome] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)

      const { data: proProfile } = await supabase
        .from('professional_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      let prof = proProfile
      let supply = !!proProfile

      if (!prof) {
        const { data: buyerProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        prof = buyerProfile
        supply = false
      }

      setProfile(prof)
      setIsSupply(supply)

      // First-time welcome: gated on how recently this profile row was created.
      // sessionStorage just stops it replaying on every refresh in the same tab.
      if (prof?.created_at) {
        const hoursSinceCreated = (Date.now() - new Date(prof.created_at).getTime()) / 36e5
        const seenThisSession = typeof window !== 'undefined' && sessionStorage.getItem(`valoria_welcome_${user.id}`)
        if (hoursSinceCreated < FIRST_TIME_WINDOW_HOURS && !seenThisSession) {
          setShowWelcome(true)
        }
      }

      if (supply) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('recipient_profile_id', user.id)
          .order('created_at', { ascending: false })
        setEnquiries(msgs || [])
      } else {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*, professional_profiles:recipient_profile_id(display_name, headline, photo_url, active_tracks)')
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false })
        setRequests(msgs || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  function dismissWelcome() {
    setShowWelcome(false)
    if (typeof window !== 'undefined' && user) {
      sessionStorage.setItem(`valoria_welcome_${user.id}`, '1')
    }
  }

  function copyPublicLink() {
    if (typeof window === 'undefined' || !user) return
    const url = `${window.location.origin}/profile/${user.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background: DARK, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font,Raleway,sans-serif)', color: DIM, fontSize:'13px', letterSpacing:'.08em' }}>
      Loading your dashboard…
    </div>
  )

  if (!profile) return (
    <div style={{ minHeight:'100vh', background: DARK, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', fontFamily:'var(--font,Raleway,sans-serif)', color: PARCH }}>
      <p style={{ fontSize:'14px', fontWeight:300, color: DIM }}>No profile found yet.</p>
      <Link href="/profile/setup" style={{ padding:'12px 22px', background: GOLD, color: DARK, fontSize:'11px', fontWeight:700, letterSpacing:'.12em', textDecoration:'none' }}>COMPLETE YOUR PROFILE</Link>
    </div>
  )

  const p           = profile
  const isSpeaker   = isSupply && (p.active_tracks || []).includes('speaker')
  const isOrganiser = !isSupply && p.user_type === 'organiser'
  const isVisible   = isSupply && p.listing_status === 'listed'
  const initials    = getInitials(p.display_name)
  const avatarLetters = getAvatarLetters(p.display_name)
  const firstName   = p.display_name ? p.display_name.split(' ')[0] : 'there'
  const atbId       = p.atb_id || null
  const compensation = isSpeaker ? (p.fee_range || null) : (p.salary_expectation || p.fee_range || null)
  const compLabel    = isSpeaker ? 'Speaking Fee' : 'Salary Range'
  const completenessPct = isSupply ? computeCompleteness(p, isSpeaker) : null

  const stats = isSupply ? [
    { label:'Location',   value: p.location || '—' },
    { label:'Industry',   value: p.industry || '—' },
    { label:'Experience', value: p.years_experience || p.experience_years ? `${p.years_experience || p.experience_years} yrs` : '—' },
    { label: compLabel,   value: compensation || '—' },
    { label:'VALU Index', value: p.valu_index != null ? `${p.valu_index} / 100` : 'Not assessed', href: p.valu_index != null ? '#valu-card' : null },
  ] : []

  return (
    <>
      <div style={{ minHeight:'100vh', background: DARK, color: PARCH, fontFamily:'var(--font,Raleway,sans-serif)' }}>

        {showWelcome && (
          <WelcomeModal
            firstName={firstName}
            isSupply={isSupply}
            isOrganiser={isOrganiser}
            pct={completenessPct}
            onClose={dismissWelcome}
          />
        )}

        {/* PRIME stripe */}
        <div style={{ position:'fixed', top:0, left:0, right:0, height:'3px', display:'flex', zIndex:201, pointerEvents:'none' }}>
          {[['#1D9E75',20],['#378ADD',25],['#7F77DD',25],['#BA7517',20],['#D85A30',10]].map(([c,w],i) => (
            <div key={i} style={{ flex:w, background:c, opacity:.85 }} />
          ))}
        </div>

        {/* HEADER NAV */}
        <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 clamp(20px,4vw,40px)', height:'64px', background: MID, borderBottom:`1px solid ${GLINE}`, position:'sticky', top:0, zIndex:100 }}>
          <Link href="/" style={{ lineHeight:0 }}>
            <img src="/logo.png" alt="Valoria Institute" style={{ height:'40px', width:'auto' }} />
          </Link>
          <nav style={{ display:'flex', gap:'22px', alignItems:'center' }}>
            <Link href="/marketplace" style={{ fontSize:'12px', color: DIM, textDecoration:'none' }}>Marketplace</Link>
            {isSupply && <Link href="/profile/edit" style={{ fontSize:'12px', color: DIM, textDecoration:'none' }}>Edit Profile</Link>}
            <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
              style={{ fontSize:'11px', fontWeight:700, letterSpacing:'.1em', color:'rgba(201,168,76,.7)', background:'transparent', border:`1px solid ${GLINE2}`, borderRadius:'999px', padding:'7px 16px', cursor:'pointer', fontFamily:'inherit' }}>
              Sign Out
            </button>
          </nav>
        </header>

        {/* COVER BANNER */}
        <div style={{ position:'relative', height:'240px', overflow:'hidden', background:`radial-gradient(ellipse 800px 400px at 10% 30%, rgba(201,168,76,.22), transparent 60%), radial-gradient(ellipse 600px 400px at 90% 70%, rgba(201,168,76,.1), transparent 55%), linear-gradient(155deg, ${MID} 0%, ${DARK} 70%)` }}>
          <svg viewBox="0 0 1200 240" preserveAspectRatio="none" style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:.45 }}>
            <g stroke="#C9A84C" strokeOpacity=".18" strokeWidth="1" fill="none">
              <path d="M0,200 C300,130 500,240 800,150 S1100,200 1200,130"/>
              <path d="M0,150 C300,80 500,190 800,100 S1100,150 1200,80"/>
              <path d="M0,240 C200,190 400,220 600,170 S900,200 1200,170"/>
            </g>
            <polygon points="1060,40 1110,120 1060,95 1010,120" fill="rgba(201,168,76,.15)"/>
          </svg>
          {isSupply && (
            <div style={{ position:'absolute', top:'20px', right:'28px', display:'flex', alignItems:'center', gap:'7px', background:'rgba(26,26,46,.75)', border:`1px solid ${GLINE2}`, padding:'7px 16px 7px 12px', borderRadius:'999px', fontSize:'11px', letterSpacing:'.1em', textTransform:'uppercase', color: isVisible ? '#1D9E75' : GOLD, backdropFilter:'blur(8px)' }}>
              <div style={{ width:'7px', height:'7px', borderRadius:'50%', background: isVisible ? '#1D9E75' : '#888', boxShadow: isVisible ? '0 0 0 0 rgba(29,158,117,.6)' : 'none', animation: isVisible ? 'dv-pulse 2s infinite' : 'none' }} />
              {isVisible ? 'Listed — Visible to Buyers' : 'Not Listed'}
            </div>
          )}
          <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, transparent 35%, ${DARK} 100%)` }} />
        </div>

        {/* HEADER BLOCK */}
        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'0 clamp(20px,4vw,40px)' }}>
          <div className="dv-header-block" style={{ display:'flex', alignItems:'flex-end', gap:'24px', marginTop:'-70px', position:'relative', zIndex:5, flexWrap:'wrap' }}>

            {/* Avatar — individual professionals only; employer/organiser accounts are businesses, not people */}
            {isSupply && (
              <div style={{ width:'132px', height:'132px', borderRadius:'50%', padding:'3px', background:`conic-gradient(from 180deg, ${GOLD}, #8a6420, ${GOLD})`, flexShrink:0, boxShadow:'0 10px 30px rgba(0,0,0,.5), 0 0 0 1px rgba(201,168,76,.08)' }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: DARK, padding:'3px' }}>
                  <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: (p.photo_url && !avatarError) ? undefined : `linear-gradient(145deg,${MID},${DARK})`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'32px', fontWeight:700, color: GOLD, letterSpacing:'.04em' }}>
                    {p.photo_url && !avatarError
                      ? <img src={p.photo_url} alt={p.display_name ? `${p.display_name}'s photo` : 'Profile photo'} loading="lazy" decoding="async" onError={() => setAvatarError(true)} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center' }} />
                      : avatarLetters}
                  </div>
                </div>
              </div>
            )}

            {/* ID block */}
            <div style={{ paddingBottom:'14px', flex:1, minWidth:'200px' }}>
              <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.6)', marginBottom:'6px' }}>
                WELCOME BACK
              </div>
              <div style={{ fontSize:'clamp(20px,3.2vw,30px)', fontWeight:700, letterSpacing:'.02em', lineHeight:1.1, marginBottom:'10px', color: PARCH }}>
                {p.display_name || (atbId ? atbId : 'Your Account')}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                <span style={{ fontSize:'14px', fontWeight:400, color: GOLD, letterSpacing:'.04em' }}>
                  {p.headline || (isSupply ? (isSpeaker ? 'Valoria Speaker' : 'Valoria Professional') : (isOrganiser ? 'Event Organiser' : 'Employer'))}
                </span>
                {isSupply && atbId && (
                  <span style={{ fontSize:'11px', letterSpacing:'.06em', background: MID, border:`1px solid ${GLINE2}`, padding:'4px 10px', color: DIM, fontVariantNumeric:'tabular-nums' }}>
                    {atbId} · {initials}
                  </span>
                )}
              </div>
            </div>

            {/* CTAs */}
            <div style={{ display:'flex', gap:'10px', paddingBottom:'14px', flexShrink:0, flexWrap:'wrap' }}>
              {isSupply && (
                <button onClick={copyPublicLink}
                  style={{ padding:'12px 18px', background:'transparent', border:`1px solid ${GLINE}`, color: DIM, fontSize:'11px', fontWeight:700, letterSpacing:'.12em', cursor:'pointer', fontFamily:'inherit' }}>
                  {copied ? 'LINK COPIED' : 'COPY PUBLIC LINK'}
                </button>
              )}
              <Link href={isSupply ? '/profile/edit' : '/marketplace'}
                style={{ padding:'12px 22px', background: GOLD, color: DARK, fontSize:'11px', fontWeight:700, letterSpacing:'.12em', textDecoration:'none' }}>
                {isSupply ? 'EDIT PROFILE' : 'BROWSE MARKETPLACE'}
              </Link>
            </div>
          </div>
        </div>

        {/* STAT STRIP — professionals only */}
        {stats.length > 0 && (
        <div style={{ maxWidth:'1100px', margin:'32px auto 0', padding:'0 clamp(20px,4vw,40px)' }}>
          <div className="dv-stat-strip" style={{ display:'flex', borderTop:`1px solid ${GLINE}`, borderBottom:`1px solid ${GLINE}`, flexWrap:'wrap' }}>
            {stats.map((s, i, arr) => {
              const itemStyle = {
                flex:'1 1 140px', padding:'16px 16px 16px 0',
                borderRight: i < arr.length - 1 ? `1px solid ${GLINE}` : 'none',
                paddingLeft: i > 0 ? '16px' : 0,
                textDecoration:'none', display:'block',
              }
              const inner = (
                <>
                  <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.16em', textTransform:'uppercase', color:'rgba(201,168,76,.45)', marginBottom:'6px' }}>{s.label}</div>
                  <div style={{ fontSize:'14px', fontWeight:500, color: PARCH, letterSpacing:'.02em' }}>{s.value}</div>
                </>
              )
              return s.href
                ? <a key={s.label} href={s.href} style={itemStyle}>{inner}</a>
                : <div key={s.label} style={itemStyle}>{inner}</div>
            })}
          </div>
        </div>
        )}

        {/* MAIN */}
        {isSupply ? (
          <div className="dv-grid" style={{ maxWidth:'1100px', margin:'36px auto 80px', padding:'0 clamp(20px,4vw,40px)', display:'grid', gridTemplateColumns:'280px 1fr', gap:'40px' }}>

            {/* SIDEBAR */}
            <div style={{ minWidth:0 }}>

              {/* VALU Index */}
              <div id="valu-card" style={{ background: MID, border:`1px solid ${GLINE}`, padding:'22px', marginBottom:'16px', scrollMarginTop:'96px' }}>
                <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.5)', marginBottom:'14px' }}>VALU Index</div>
                {p.valu_index != null ? (
                  <>
                    <div style={{ fontSize:'52px', fontWeight:700, color: GOLD, lineHeight:1, marginBottom:'4px' }}>{p.valu_index}<span style={{ fontSize:'20px', color: DIM, fontWeight:400 }}>/100</span></div>
                    {p.designation && <div style={{ fontSize:'11px', fontWeight:700, color: GOLD, marginBottom:'20px', letterSpacing:'.1em', textTransform:'uppercase' }}>{p.designation.replace(/_/g,' ')}</div>}
                    {p.cluster_scores && (
                      <div>
                        {PRIME.map(({ letter, color }) => {
                          const score = p.cluster_scores[letter]
                          if (score == null) return null
                          return (
                            <div key={letter} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'11px' }}>
                              <span style={{ fontSize:'11px', fontWeight:700, color, width:'12px', flexShrink:0 }}>{letter}</span>
                              <div style={{ flex:1, height:'4px', background: FAINT, borderRadius:'2px', overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${score}%`, background: color, borderRadius:'2px' }} />
                              </div>
                              <span style={{ fontSize:'11px', color: DIM, width:'20px', textAlign:'right', flexShrink:0 }}>{score}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ fontSize:'13px', fontWeight:300, color: DIM, lineHeight:1.7, marginBottom:'16px' }}>
                      You haven't completed your VALU Index assessment yet.
                    </p>
                    <a href="https://assessment.valoriainstitute.com/" target="_blank" rel="noopener noreferrer"
                      style={{ display:'block', padding:'11px', background:'transparent', border:`1px solid ${GLINE2}`, color: GOLD, fontSize:'10px', fontWeight:700, letterSpacing:'.12em', textAlign:'center', textDecoration:'none' }}>
                      TAKE THE ASSESSMENT
                    </a>
                  </>
                )}
              </div>

              {/* Profile completeness */}
              <div style={{ background: MID, border:`1px solid ${GLINE}`, padding:'22px', marginBottom:'16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                  <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.5)' }}>Profile Completeness</div>
                  <span style={{ fontSize:'16px', fontWeight:700, color: completenessPct === 100 ? '#1D9E75' : GOLD }}>{completenessPct}%</span>
                </div>
                <div style={{ height:'4px', background: FAINT, borderRadius:'2px' }}>
                  <div style={{ height:'100%', width:`${completenessPct}%`, background: completenessPct === 100 ? '#1D9E75' : GOLD, borderRadius:'2px', transition:'width .4s' }} />
                </div>
                {completenessPct < 100 && (
                  <Link href="/profile/edit" style={{ fontSize:'11px', color: GOLD, marginTop:'12px', display:'block' }}>
                    Complete your profile to improve visibility →
                  </Link>
                )}
              </div>

              {/* Profile ID */}
              {atbId && (
                <div style={{ background: MID, border:`1px solid ${GLINE}`, padding:'22px', marginBottom:'16px' }}>
                  <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.5)', marginBottom:'12px' }}>Profile ID</div>
                  <div style={{ fontSize:'13px', fontWeight:700, color: PARCH, letterSpacing:'.06em', marginBottom:'8px', fontVariantNumeric:'tabular-nums' }}>{atbId}</div>
                  <div style={{ fontSize:'11px', fontWeight:300, color: DIM, lineHeight:1.6 }}>Registered with African Talent Bureau Ltd.</div>
                </div>
              )}

              {/* Links */}
              <div style={{ background: MID, border:`1px solid ${GLINE}`, padding:'22px' }}>
                <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.5)', marginBottom:'12px' }}>Links</div>
                {p.linkedin_url || p.website_url ? (
                  <>
                    {p.linkedin_url && <LinkRow label="LinkedIn" href={p.linkedin_url} />}
                    {p.website_url && <LinkRow label="Website" href={p.website_url} />}
                  </>
                ) : (
                  <p style={{ fontSize:'12px', fontWeight:300, color:'rgba(247,244,238,.3)', fontStyle:'italic', marginBottom:'10px' }}>No links added yet.</p>
                )}
                <Link href="/profile/edit" style={{ fontSize:'11px', color: GOLD, marginTop:'6px', display:'block' }}>Edit links →</Link>
              </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={{ minWidth:0 }}>
              <Section label="About">
                {p.bio
                  ? <p style={{ fontSize:'15px', fontWeight:300, color: DIM, lineHeight:1.8 }}>{p.bio}</p>
                  : <p style={{ fontSize:'13px', fontWeight:300, color:'rgba(247,244,238,.3)', fontStyle:'italic' }}>No bio added yet. <Link href="/profile/edit" style={{ color: GOLD }}>Add one →</Link></p>}
              </Section>

              {(isSpeaker ? p.topics : p.skills)?.length > 0 && (
                <Section label={isSpeaker ? 'Speaking Topics' : 'Core Skills'}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'10px' }}>
                    {(isSpeaker ? p.topics : p.skills).map(t => (
                      <span key={t} style={{ padding:'8px 16px', border:`1px solid ${GLINE2}`, fontSize:'12px', fontWeight:400, color: DIM, letterSpacing:'.04em' }}>{t}</span>
                    ))}
                  </div>
                </Section>
              )}

              <div style={{ marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.45)' }}>Enquiries Received</div>
                <span style={{ fontSize:'11px', fontWeight:700, background:'rgba(201,168,76,.12)', color: GOLD, borderRadius:'999px', padding:'2px 9px' }}>{enquiries.length}</span>
              </div>

              {enquiries.length === 0 ? (
                <EmptyState
                  icon="◈"
                  message={isVisible ? 'No enquiries yet — your profile is live and visible.' : 'Enable your marketplace listing to start receiving enquiries.'}
                  cta={!isVisible ? { label: 'Enable Listing', href: '/profile/edit' } : null}
                />
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {enquiries.map(msg => <EnquiryCard key={msg.id} msg={msg} isSpeaker={isSpeaker} />)}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* DEMAND SIDE — single column */
          <div style={{ maxWidth:'1100px', margin:'36px auto 80px', padding:'0 clamp(20px,4vw,40px)' }}>
            <Link href="/marketplace" style={{ display:'flex', alignItems:'center', gap:'16px', background: MID, border:`1px solid ${GLINE}`, padding:'18px 20px', textDecoration:'none', color: PARCH, marginBottom:'32px' }}>
              <span style={{ fontSize:'22px', color: GOLD, flexShrink:0 }}>{isOrganiser ? '◉' : '◈'}</span>
              <div>
                <div style={{ fontSize:'14px', fontWeight:600, marginBottom:'2px' }}>{isOrganiser ? 'Find Speakers' : 'Search Talent'}</div>
                <div style={{ fontSize:'12px', color: DIM, fontWeight:300 }}>Browse the {isOrganiser ? 'ATB Spotlight' : 'ATB Connect'} marketplace</div>
              </div>
              <span style={{ color: GOLD, marginLeft:'auto' }}>→</span>
            </Link>

            <div style={{ marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' }}>
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.45)' }}>Your Enquiries</div>
              <span style={{ fontSize:'11px', fontWeight:700, background:'rgba(201,168,76,.12)', color: GOLD, borderRadius:'999px', padding:'2px 9px' }}>{requests.length}</span>
            </div>

            {requests.length === 0 ? (
              <EmptyState
                icon={isOrganiser ? '◉' : '◈'}
                message={`You haven't sent any enquiries yet. Browse the marketplace to find ${isOrganiser ? 'speakers' : 'talent'}.`}
                cta={{ label: isOrganiser ? 'Browse Speakers' : 'Search Talent', href: '/marketplace' }}
              />
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {requests.map(msg => <SentRequestCard key={msg.id} msg={msg} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes dv-pulse {
          0%{box-shadow:0 0 0 0 rgba(29,158,117,.55);}
          70%{box-shadow:0 0 0 6px rgba(29,158,117,0);}
          100%{box-shadow:0 0 0 0 rgba(29,158,117,0);}
        }
        @media (max-width: 860px) {
          .dv-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .dv-stat-strip { flex-wrap: wrap !important; }
          .dv-header-block { margin-top: -50px !important; }
        }
      `}</style>
    </>
  )
}

// ── Welcome modal ────────────────────────────────────────────────────────────
function WelcomeModal({ firstName, isSupply, isOrganiser, pct, onClose }) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)

  const beats = isSupply ? [
    { eyebrow:'PROFILE LIVE', title:`You did it, ${firstName}.`, body:`${pct}% complete — your profile is officially part of the Valoria marketplace.`, icon:'✓' },
    { eyebrow:"YOU'RE IN GOOD COMPANY", title:'Welcome to Valoria.', body:"Every professional here is independently assessed. You're not just listed — you're verified.", icon:'◈' },
    { eyebrow:'WHAT HAPPENS NEXT', title:'Buyers are browsing right now.', body:"Your next introduction could land today. We'll let you know the moment someone reaches out.", icon:'→' },
  ] : [
    { eyebrow:"YOU'RE IN", title:`Welcome, ${firstName}.`, body:'Your account is set up and ready to go.', icon:'✓' },
    { eyebrow:'WHAT YOU HAVE ACCESS TO', title:'Welcome to Valoria.', body:`You now have access to Africa's independently verified ${isOrganiser ? 'speaker' : 'professional'} network.`, icon:'◈' },
    { eyebrow:'READY WHEN YOU ARE', title:'Find your first match.', body:`Search the marketplace and send your first enquiry — most ${isOrganiser ? 'speakers' : 'professionals'} respond within days.`, icon:'→' },
  ]

  const isLast = step === beats.length - 1
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => { const t = setTimeout(() => setVisible(true), 20); return () => clearTimeout(t) }, [])
  useEffect(() => {
    if (isLast || reducedMotion) return
    timerRef.current = setTimeout(() => setStep(s => Math.min(s + 1, beats.length - 1)), 3800)
    return () => clearTimeout(timerRef.current)
  }, [step, isLast, reducedMotion])

  function handleClose() { setVisible(false); setTimeout(onClose, 200) }
  function next() { clearTimeout(timerRef.current); isLast ? handleClose() : setStep(s => s + 1) }

  const beat = beats[step]

  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome to Valoria"
      style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(15,15,26,.82)', backdropFilter:'blur(6px)', opacity: visible ? 1 : 0, transition:'opacity .25s ease', padding:'20px' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <div style={{ width:'100%', maxWidth:'420px', background:`linear-gradient(160deg, ${MID} 0%, ${DARK} 100%)`, border:'1px solid rgba(201,168,76,.22)', borderRadius:'14px', padding:'40px 32px 32px', position:'relative', boxShadow:'0 24px 60px rgba(0,0,0,.5)', transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(.98)', transition:'transform .3s ease' }}>
        <button onClick={handleClose} aria-label="Skip" style={{ position:'absolute', top:'16px', right:'18px', background:'none', border:'none', color:'rgba(247,244,238,.35)', fontSize:'11px', letterSpacing:'.08em', cursor:'pointer', fontFamily:'inherit' }}>SKIP</button>
        <div key={step} style={{ animation: reducedMotion ? 'none' : 'dv-welcome-in .45s ease' }}>
          <div style={{ width:'52px', height:'52px', borderRadius:'50%', border:'1px solid rgba(201,168,76,.35)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', color: GOLD, marginBottom:'22px', background:'rgba(201,168,76,.06)' }}>{beat.icon}</div>
          <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.18em', color:'rgba(201,168,76,.6)', marginBottom:'10px' }}>{beat.eyebrow}</div>
          <h2 style={{ fontSize:'24px', fontWeight:300, color: PARCH, margin:'0 0 12px', lineHeight:1.25 }}>{beat.title}</h2>
          <p style={{ fontSize:'14px', color: DIM, fontWeight:300, lineHeight:1.7, margin:0 }}>{beat.body}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'32px' }}>
          <div style={{ display:'flex', gap:'6px' }}>
            {beats.map((_, i) => <div key={i} style={{ width: i === step ? '18px' : '6px', height:'4px', borderRadius:'2px', background: i === step ? GOLD : 'rgba(201,168,76,.2)', transition:'width .25s ease' }} />)}
          </div>
          <button onClick={next} style={{ padding:'11px 22px', background: isLast ? GOLD : 'transparent', color: isLast ? DARK : PARCH, border: isLast ? 'none' : '1px solid rgba(201,168,76,.3)', borderRadius:'999px', fontSize:'11px', fontWeight:700, letterSpacing:'.1em', cursor:'pointer', fontFamily:'inherit' }}>
            {isLast ? (isSupply ? 'EXPLORE YOUR DASHBOARD' : 'BROWSE THE MARKETPLACE') : 'CONTINUE'}
          </button>
        </div>
      </div>
      <style>{`@keyframes dv-welcome-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────
function LinkRow({ label, href }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ display:'block', fontSize:'13px', fontWeight:400, color: GOLD, padding:'10px 0', borderTop:`1px solid ${GLINE}`, textDecoration:'none' }}>
      {label} ↗
    </a>
  )
}
function Section({ label, children }) {
  return (
    <div style={{ marginBottom:'36px', paddingBottom:'36px', borderBottom:`1px solid ${GLINE}` }}>
      <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.45)', marginBottom:'16px' }}>{label}</div>
      {children}
    </div>
  )
}
function EnquiryCard({ msg, isSpeaker }) {
  const date = new Date(msg.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
  const status = STATUS_COLORS[msg.status] || STATUS_COLORS.pending
  const lines = (msg.body || '').split('\n')
  const fromLine = lines[0] || ''
  const orgLine = lines[1] || ''
  return (
    <div style={{ background: MID, border:`1px solid ${GLINE}`, padding:'18px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'16px', marginBottom:'8px' }}>
        <div>
          <div style={{ fontSize:'14px', fontWeight:600, color: PARCH, marginBottom:'3px' }}>{msg.subject || (isSpeaker ? 'Booking enquiry' : 'Talent enquiry')}</div>
          <div style={{ fontSize:'12px', color: DIM, fontWeight:300 }}>{fromLine} · {orgLine}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px' }}>
          <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.08em', padding:'3px 10px', borderRadius:'999px', background: status.bg, color: status.text, whiteSpace:'nowrap' }}>{status.label}</span>
          <span style={{ fontSize:'11px', color: FAINT }}>{date}</span>
        </div>
      </div>
      {msg.body && (
        <p style={{ fontSize:'13px', color: DIM, fontWeight:300, lineHeight:1.6, margin:0 }}>
          {lines.slice(isSpeaker ? 3 : 2).join(' ').trim().slice(0, 180)}{msg.body.length > 180 ? '…' : ''}
        </p>
      )}
    </div>
  )
}
function SentRequestCard({ msg }) {
  const date = new Date(msg.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
  const status = STATUS_COLORS[msg.status] || STATUS_COLORS.pending
  const prof = msg.professional_profiles
  return (
    <div style={{ background: MID, border:`1px solid ${GLINE}`, padding:'18px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'16px', marginBottom:'8px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'40px', height:'40px', borderRadius:'50%', border:`1px solid ${GLINE2}`, background: DARK, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
            {prof?.photo_url
              ? <img src={prof.photo_url} alt={prof.display_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <span style={{ color: FAINT, fontSize:'14px' }}>◈</span>}
          </div>
          <div>
            <div style={{ fontSize:'14px', fontWeight:600, color: PARCH, marginBottom:'3px' }}>{prof?.display_name || 'Professional'}</div>
            <div style={{ fontSize:'12px', color: DIM, fontWeight:300 }}>{prof?.headline || ''}</div>
            <div style={{ fontSize:'11px', color: DIM, marginTop:'4px' }}>{msg.subject}</div>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px' }}>
          <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.08em', padding:'3px 10px', borderRadius:'999px', background: status.bg, color: status.text, whiteSpace:'nowrap' }}>{status.label}</span>
          <span style={{ fontSize:'11px', color: FAINT }}>{date}</span>
        </div>
      </div>
      {prof && <Link href={`/profile/${msg.recipient_profile_id}`} style={{ fontSize:'11px', color: GOLD, textDecoration:'none', marginTop:'8px', display:'inline-block' }}>View profile →</Link>}
    </div>
  )
}
function EmptyState({ icon, message, cta }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 20px', background:'rgba(26,26,46,.3)', border:`1px solid ${GLINE}` }}>
      <div style={{ fontSize:'28px', color: GOLD, marginBottom:'10px' }}>{icon}</div>
      <p style={{ fontSize:'13px', color: DIM, marginBottom: cta ? '16px' : 0 }}>{message}</p>
      {cta && <Link href={cta.href} style={{ display:'inline-block', padding:'10px 24px', background: GOLD, color: DARK, fontSize:'11px', fontWeight:700, letterSpacing:'.12em', borderRadius:'999px', textDecoration:'none' }}>{cta.label}</Link>}
    </div>
  )
}
