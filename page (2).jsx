'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

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
function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// ─── brand tokens ─────────────────────────────────────────────
const GOLD    = '#C9A84C'
const DARK    = '#0F0F1A'
const MID     = '#1A1A2E'
const PARCH   = '#F7F4EE'
const DIM     = 'rgba(247,244,238,.5)'
const FAINT   = 'rgba(247,244,238,.15)'
const GLINE   = 'rgba(201,168,76,.12)'
const GLINE2  = 'rgba(201,168,76,.28)'
const PRIME   = [
  { letter: 'P', color: '#1D9E75', label: 'Presence' },
  { letter: 'R', color: '#378ADD', label: 'Relationships' },
  { letter: 'I', color: '#7F77DD', label: 'Intelligence' },
  { letter: 'M', color: '#BA7517', label: 'Mastery' },
  { letter: 'E', color: '#D85A30', label: 'Enterprise' },
]

// ─── component ─────────────────────────────────────────────
export default function ProfilePage({ params }) {
  const { id } = params
  const [profile, setProfile]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [activeVideo, setActiveVideo] = useState(null)
  const [avatarError, setAvatarError] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: real, error: realError } = await supabase
        .from('professional_profiles')
        .select('id, display_name, headline, location, industry, experience_years, bio, skills, topics, active_tracks, valu_index, cluster_scores, designation, linkedin_url, website_url, youtube_links, fee_range, salary_expectation, atb_id, availability, photo_url')
        .eq('id', id)
        .maybeSingle()

      // This used to fail silently on a bad column name — the query errored,
      // `real` was always null, and every real profile fell through to the
      // dummy marketplace_profiles lookup below without a trace. Logging it
      // now so a future schema drift shows up immediately instead of
      // masquerading as "profile not found."
      if (realError) console.error('professional_profiles fetch failed:', realError)

      if (real) {
        setProfile({
          ...real,
          // Keep the form-facing name the rest of this component already
          // expects, while the query itself uses the real column name.
          years_experience: real.experience_years,
          // Real column is a text[]; the rest of this page treats
          // availability as a single string.
          availability: Array.isArray(real.availability) ? (real.availability[0] || null) : real.availability,
          valu_score: real.valu_index,
          active_tracks: real.active_tracks || [],
          _source: 'real',
        })
        setLoading(false)
        return
      }

      const { data: dummy } = await supabase
        .from('marketplace_profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (dummy) {
        setProfile({
          id: dummy.id,
          display_name: dummy.full_name,
          headline: dummy.headline,
          location: dummy.location,
          industry: dummy.industry,
          years_experience: dummy.years_experience,
          bio: dummy.bio,
          skills: dummy.skills || [],
          topics: dummy.skills || [],
          user_type: dummy.section,
          valu_score: null,
          cluster_scores: null,
          linkedin_url: dummy.linkedin_url,
          website_url: dummy.portfolio_url,
          youtube_links: dummy.video_url ? [dummy.video_url] : [],
          fee_range: dummy.fee_range,
          salary_expectation: dummy.salary_expectation,
          atb_id: dummy.atb_id,
          availability: 'open',
          is_dummy: true,
          _source: 'dummy',
        })
        setLoading(false)
        return
      }
      setNotFound(true)
      setLoading(false)
    }
    load()
  }, [id])

  function copyLink() {
    if (typeof window === 'undefined') return
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background: DARK, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font,Raleway,sans-serif)', color: DIM, fontSize:'13px', letterSpacing:'.08em' }}>
      Loading…
    </div>
  )

  if (notFound) return (
    <>
      <Nav />
      <div style={{ minHeight:'100vh', background: DARK, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', fontFamily:'var(--font,Raleway,sans-serif)', color: PARCH }}>
        <div style={{ fontSize:'32px', color: GOLD }}>◈</div>
        <p style={{ fontSize:'14px', fontWeight:300, color: DIM }}>Profile not found</p>
        <Link href="/atb-connect" style={{ fontSize:'12px', color: GOLD, textDecoration:'none', letterSpacing:'.08em' }}>← Back to marketplace</Link>
      </div>
      <Footer />
    </>
  )

  const p           = profile
  const tracks        = p.active_tracks || (p.user_type ? [p.user_type] : [])
  const isSpeaker     = tracks.includes('speaker')
  const isFacilitator = tracks.includes('facilitator')
  const isCandidate   = tracks.includes('candidate') || tracks.length === 0
  const initials    = getInitials(p.display_name)
  const avatarLetters = getAvatarLetters(p.display_name)
  const atbId       = p.atb_id || '—'
  const videos      = (p.youtube_links || []).filter(v => v && !v.includes('dQw4w9WgXcQ'))
  const compensation = (isSpeaker || isFacilitator) ? (p.fee_range || p.salary_expectation || null) : (p.salary_expectation || p.fee_range || null)
  const compLabel   = (isSpeaker || isFacilitator) ? 'Fee Range' : 'Salary Range'
  const displayTrack = isFacilitator ? 'facilitator' : isSpeaker ? 'speaker' : 'candidate'
  const tags        = displayTrack === 'facilitator' ? (p.programme_types || []) : displayTrack === 'speaker' ? (p.topics || []) : (p.skills || [])

  const stats = [
    { label:'Location',   value: p.location || '—' },
    { label:'Industry',   value: p.industry || '—' },
    { label:'Experience', value: p.years_experience ? `${p.years_experience} yrs` : '—' },
    { label: compLabel,   value: compensation || '—' },
    { label:'VALU Index', value: p.valu_score != null ? `${p.valu_score} / 100` : 'Not assessed', href: p.valu_score != null ? '#valu-card' : null },
  ]

  return (
    <>
      <Nav />

      <div style={{ minHeight:'100vh', background: DARK, color: PARCH, fontFamily:'var(--font,Raleway,sans-serif)', paddingTop:'67px' }}>

        {/* PRIME stripe */}
        <div style={{ position:'fixed', top:0, left:0, right:0, height:'3px', display:'flex', zIndex:201, pointerEvents:'none' }}>
          {[['#1D9E75',20],['#378ADD',25],['#7F77DD',25],['#BA7517',20],['#D85A30',10]].map(([c,p],i) => (
            <div key={i} style={{ flex:p, background:c, opacity:.85 }} />
          ))}
        </div>

        {/* COVER BANNER */}
        <div style={{ position:'relative', height:'280px', overflow:'hidden', background:`radial-gradient(ellipse 800px 400px at 10% 30%, rgba(201,168,76,.22), transparent 60%), radial-gradient(ellipse 600px 400px at 90% 70%, rgba(201,168,76,.1), transparent 55%), linear-gradient(155deg, ${MID} 0%, ${DARK} 70%)` }}>
          <svg viewBox="0 0 1200 280" preserveAspectRatio="none" style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:.45 }}>
            <g stroke="#C9A84C" strokeOpacity=".18" strokeWidth="1" fill="none">
              <path d="M0,240 C300,160 500,280 800,180 S1100,240 1200,160"/>
              <path d="M0,180 C300,100 500,220 800,120 S1100,180 1200,100"/>
              <path d="M0,120 C300,40 500,160 800,60 S1100,120 1200,40"/>
              <path d="M0,280 C200,220 400,260 600,200 S900,240 1200,200"/>
            </g>
            <polygon points="1060,50 1110,140 1060,110 1010,140" fill="rgba(201,168,76,.15)"/>
            <polygon points="80,200 120,260 80,240 40,260" fill="rgba(201,168,76,.08)"/>
          </svg>
          {/* availability chip */}
          <div style={{ position:'absolute', top:'20px', right:'28px', display:'flex', alignItems:'center', gap:'7px', background:'rgba(26,26,46,.75)', border:`1px solid ${GLINE2}`, padding:'7px 16px 7px 12px', borderRadius:'999px', fontSize:'11px', letterSpacing:'.1em', textTransform:'uppercase', color: GOLD, backdropFilter:'blur(8px)' }}>
            <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#1D9E75', boxShadow:'0 0 0 0 rgba(29,158,117,.6)', animation:'vi-pulse 2s infinite' }} />
            {p.availability === 'open' ? 'Open to Introductions' : p.availability === 'contract_only' ? 'Contract Only' : 'Not Available'}
          </div>
          <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, transparent 35%, ${DARK} 100%)` }} />
        </div>

        {/* HEADER BLOCK */}
        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'0 clamp(20px,4vw,40px)' }}>
          <div className="vi-header-block" style={{ display:'flex', alignItems:'flex-end', gap:'24px', marginTop:'-80px', position:'relative', zIndex:5, flexWrap:'wrap' }}>

            {/* Avatar — static ring, no longer spins the photo */}
            <div style={{ width:'148px', height:'148px', borderRadius:'50%', padding:'3px', background:`conic-gradient(from 180deg, ${GOLD}, #8a6420, ${GOLD})`, flexShrink:0, boxShadow:'0 10px 30px rgba(0,0,0,.5), 0 0 0 1px rgba(201,168,76,.08)' }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: DARK, padding:'3px' }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: (p.photo_url && !avatarError) ? undefined : `linear-gradient(145deg,${MID},${DARK})`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'36px', fontWeight:700, color: GOLD, letterSpacing:'.04em' }}>
                  {p.photo_url && !avatarError
                    ? <img
                        src={p.photo_url}
                        alt={p.display_name ? `${p.display_name}'s photo` : 'Profile photo'}
                        loading="lazy"
                        decoding="async"
                        onError={() => setAvatarError(true)}
                        style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center' }}
                      />
                    : avatarLetters}
                </div>
              </div>
            </div>

            {/* ID block */}
            <div style={{ paddingBottom:'16px', flex:1, minWidth:'200px' }}>
              <div style={{ fontSize:'clamp(22px,3.5vw,32px)', fontWeight:700, letterSpacing:'.04em', lineHeight:1.1, marginBottom:'10px', color: PARCH, fontVariantNumeric:'tabular-nums' }}>
                {atbId}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                <span style={{ fontSize:'14px', fontWeight:400, color: GOLD, letterSpacing:'.04em' }}>
                  {p.headline || (displayTrack === 'facilitator' ? 'Valoria Facilitator' : displayTrack === 'speaker' ? 'Valoria Speaker' : 'Valoria Professional')}
                </span>
                <span style={{ fontSize:'11px', letterSpacing:'.06em', background: MID, border:`1px solid ${GLINE2}`, padding:'4px 10px', borderRadius:'4px', color: DIM }}>
                  {initials} · Verified {displayTrack === 'facilitator' ? 'Facilitator' : displayTrack === 'speaker' ? 'Speaker' : 'Professional'}
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div style={{ display:'flex', gap:'10px', paddingBottom:'16px', flexShrink:0, flexWrap:'wrap' }}>
              <button onClick={copyLink}
                style={{ padding:'12px 18px', background:'transparent', border:`1px solid ${GLINE}`, color: DIM, fontSize:'11px', fontWeight:700, letterSpacing:'.12em', cursor:'pointer', fontFamily:'inherit' }}>
                {copied ? 'LINK COPIED' : 'SHARE'}
              </button>
              <Link href={displayTrack === 'facilitator' ? '/valoria-develop' : displayTrack === 'speaker' ? '/spotlight' : '/atb-connect'}
                style={{ padding:'12px 22px', background:'transparent', border:`1px solid ${GLINE2}`, color: PARCH, fontSize:'11px', fontWeight:700, letterSpacing:'.12em', textDecoration:'none' }}>
                MORE {displayTrack === 'facilitator' ? 'FACILITATORS' : displayTrack === 'speaker' ? 'SPEAKERS' : 'TALENT'}
              </Link>
              <a href={`mailto:info@valoriainstitute.com?subject=${encodeURIComponent((displayTrack === 'facilitator' ? 'Facilitator Commission' : displayTrack === 'speaker' ? 'Speaker Booking' : 'Introduction Request') + ' — ' + atbId)}`}
                style={{ padding:'12px 22px', background: GOLD, color: DARK, fontSize:'11px', fontWeight:700, letterSpacing:'.12em', textDecoration:'none' }}>
                {displayTrack === 'facilitator' ? 'REQUEST FACILITATOR' : displayTrack === 'speaker' ? 'BOOK SPEAKER' : 'REQUEST INTRO'}
              </a>
            </div>
          </div>
        </div>

        {/* STAT STRIP */}
        <div style={{ maxWidth:'1100px', margin:'32px auto 0', padding:'0 clamp(20px,4vw,40px)' }}>
          <div className="vi-stat-strip" style={{ display:'flex', borderTop:`1px solid ${GLINE}`, borderBottom:`1px solid ${GLINE}`, flexWrap:'wrap' }}>
            {stats.map((s, i, arr) => {
              const itemStyle = {
                flex:'1 1 140px', padding:'16px 16px 16px 0',
                borderRight: i < arr.length - 1 ? `1px solid ${GLINE}` : 'none',
                paddingLeft: i > 0 ? '16px' : 0,
                textDecoration:'none', display:'block',
                transition:'background .15s ease',
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

        {/* VIDEO HIGHLIGHTS ROW */}
        {videos.length > 0 && (
          <div style={{ maxWidth:'1100px', margin:'32px auto 0', padding:'0 clamp(20px,4vw,40px)' }}>
            <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.45)', marginBottom:'14px' }}>Highlights</div>
            <div style={{ display:'flex', gap:'16px', overflowX:'auto', paddingBottom:'6px' }}>
              {videos.map((url, i) => {
                const ytId = getYouTubeId(url)
                const labels = ['Intro reel','Case study','Keynote clip','Panel talk']
                const isActive = activeVideo === i
                return (
                  <div key={i} onClick={() => setActiveVideo(isActive ? null : i)}
                    style={{ flexShrink:0, width:'84px', textAlign:'center', cursor:'pointer' }}>
                    <div style={{ width:'72px', height:'72px', borderRadius:'50%', margin:'0 auto 8px', padding:'2.5px', background: isActive ? `conic-gradient(${GOLD}, rgba(201,168,76,.2) 40%, rgba(201,168,76,.05) 41%)` : 'rgba(201,168,76,.15)', border: isActive ? `none` : `1px solid ${GLINE}` }}>
                      <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: MID, display:'flex', alignItems:'center', justifyContent:'center', color: GOLD, fontSize:'18px', border:`2px solid ${DARK}`, overflow:'hidden' }}>
                        {ytId
                          ? <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                          : '▶'}
                      </div>
                    </div>
                    <div style={{ fontSize:'10px', color: DIM, letterSpacing:'.04em' }}>{labels[i] || `Video ${i+1}`}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* MAIN GRID */}
        <div className="vi-profile-grid" style={{ maxWidth:'1100px', margin:'36px auto 80px', padding:'0 clamp(20px,4vw,40px)', display:'grid', gridTemplateColumns:'280px 1fr', gap:'40px' }}>

          {/* SIDEBAR */}
          <div style={{ minWidth:0 }}>

            {/* VALU Index */}
            <div id="valu-card" style={{ background: MID, border:`1px solid ${GLINE}`, padding:'22px', marginBottom:'16px', scrollMarginTop:'96px' }}>
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.5)', marginBottom:'14px' }}>VALU Index</div>
              {p.valu_score != null ? (
                <>
                  <div style={{ fontSize:'52px', fontWeight:700, color: GOLD, lineHeight:1, marginBottom:'4px' }}>{p.valu_score}<span style={{ fontSize:'20px', color: DIM, fontWeight:400 }}>/100</span></div>
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
                    This professional has not yet completed their VALU Index assessment.
                  </p>
                  <a href="https://assessment.valoriainstitute.com/" target="_blank" rel="noopener noreferrer"
                    style={{ display:'block', padding:'11px', background:'transparent', border:`1px solid ${GLINE2}`, color: GOLD, fontSize:'10px', fontWeight:700, letterSpacing:'.12em', textAlign:'center', textDecoration:'none' }}>
                    ABOUT THE VALU INDEX
                  </a>
                </>
              )}
            </div>

            {/* Profile ID verification */}
            <div style={{ background: MID, border:`1px solid ${GLINE}`, padding:'22px', marginBottom:'16px' }}>
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.5)', marginBottom:'12px' }}>Profile ID</div>
              <div style={{ fontSize:'13px', fontWeight:700, color: PARCH, letterSpacing:'.06em', marginBottom:'8px', fontVariantNumeric:'tabular-nums' }}>{atbId}</div>
              <div style={{ fontSize:'11px', fontWeight:300, color: DIM, lineHeight:1.6 }}>Registered with African Talent Bureau Ltd.</div>
            </div>

            {/* Links — gated */}
            <div style={{ background: MID, border:`1px solid ${GLINE}`, padding:'22px' }}>
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.5)', marginBottom:'12px' }}>Links</div>
              {p.linkedin_url || p.website_url ? (
                <>
                  {p.linkedin_url && (
                    <div style={{ fontSize:'13px', fontWeight:300, color: DIM, padding:'10px 0', borderTop:`1px solid ${GLINE}` }}>
                      in&ensp;LinkedIn — visible after introduction
                    </div>
                  )}
                  {p.website_url && (
                    <div style={{ fontSize:'13px', fontWeight:300, color: DIM, padding:'10px 0', borderTop:`1px solid ${GLINE}` }}>
                      ↗&ensp;Website — visible after introduction
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize:'12px', fontWeight:300, color:'rgba(247,244,238,.3)', fontStyle:'italic' }}>No links added yet.</p>
              )}
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div style={{ minWidth:0 }}>

            {/* Expanded video player */}
            {activeVideo !== null && videos[activeVideo] && (() => {
              const ytId = getYouTubeId(videos[activeVideo])
              return ytId ? (
                <div style={{ marginBottom:'32px' }}>
                  <div style={{ position:'relative', paddingBottom:'56.25%', height:0, background:'#000', overflow:'hidden' }}>
                    <iframe src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                      title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
                      style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', border:'none' }} />
                  </div>
                  <button onClick={() => setActiveVideo(null)}
                    style={{ fontSize:'12px', color: DIM, background:'none', border:'none', cursor:'pointer', padding:'10px 0', fontFamily:'var(--font,Raleway,sans-serif)', letterSpacing:'.04em' }}>
                    ← Close video
                  </button>
                </div>
              ) : null
            })()}

            {/* About */}
            <Section label="About">
              {p.bio
                ? <p style={{ fontSize:'15px', fontWeight:300, color: DIM, lineHeight:1.8 }}>{p.bio}</p>
                : <p style={{ fontSize:'13px', fontWeight:300, color:'rgba(247,244,238,.3)', fontStyle:'italic' }}>No bio added yet.</p>}
            </Section>

            {/* Skills / Topics */}
            {tags.length > 0 && (
              <Section label={displayTrack === 'facilitator' ? 'Programme Types' : displayTrack === 'speaker' ? 'Speaking Topics' : 'Core Skills'}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'10px' }}>
                  {tags.map(t => (
                    <span key={t} style={{ padding:'8px 16px', border:`1px solid ${GLINE2}`, fontSize:'12px', fontWeight:400, color: DIM, letterSpacing:'.04em' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Video grid (when no video expanded) */}
            {videos.length > 0 && activeVideo === null && (
              <Section label={(isSpeaker || isFacilitator) ? 'Speaker Reel & Videos' : 'Videos'}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:'12px' }}>
                  {videos.slice(0,4).map((url, i) => {
                    const ytId = getYouTubeId(url)
                    return (
                      <div key={i} onClick={() => setActiveVideo(i)}
                        style={{ aspectRatio:'16/10', position:'relative', background:`linear-gradient(145deg,${MID},${DARK})`, border:`1px solid ${GLINE}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden' }}>
                        {ytId && <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:.5 }} />}
                        <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'rgba(201,168,76,.9)', display:'flex', alignItems:'center', justifyContent:'center', color: DARK, fontSize:'15px', position:'relative', zIndex:1 }}>▶</div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}

            {/* Introduction CTA — anchor target for the REQUEST INTRO / BOOK SPEAKER
                links on /atb-connect and /spotlight, which already point to
                this page as #contact. scrollMarginTop accounts for the fixed nav. */}
            <div id="contact" className="vi-cta-intro" style={{ background:`linear-gradient(135deg, rgba(201,168,76,.06), rgba(26,26,46,.3))`, border:`1px solid ${GLINE2}`, padding:'28px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'24px', flexWrap:'wrap', marginTop:'8px', scrollMarginTop:'96px' }}>
              <div>
                <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,168,76,.5)', marginBottom:'8px' }}>
                  {displayTrack === 'facilitator' ? 'Commission This Facilitator' : displayTrack === 'speaker' ? 'Book This Speaker' : 'Get in Touch'}
                </div>
                <p style={{ fontSize:'13px', fontWeight:300, color: DIM, maxWidth:'380px', lineHeight:1.7 }}>
                  {displayTrack === 'facilitator'
                    ? `Interested in commissioning ${initials} for a programme? Valoria Institute facilitates all introductions.`
                    : displayTrack === 'speaker'
                    ? `Interested in booking ${initials} for your event? Valoria Institute facilitates all introductions.`
                    : `Want to connect with ${initials}? All introductions go through Valoria Institute — your details stay protected.`}
                </p>
              </div>
              <a href={`mailto:info@valoriainstitute.com?subject=${encodeURIComponent((displayTrack === 'facilitator' ? 'Facilitator Commission' : displayTrack === 'speaker' ? 'Speaker Booking' : 'Introduction Request') + ' — ' + atbId)}`}
                style={{ padding:'14px 28px', background: GOLD, color: DARK, fontSize:'11px', fontWeight:700, letterSpacing:'.14em', textDecoration:'none', flexShrink:0, whiteSpace:'nowrap' }}>
                {displayTrack === 'facilitator' ? 'REQUEST FACILITATOR' : displayTrack === 'speaker' ? 'BOOK SPEAKER' : 'SEND INTRODUCTION'}
              </a>
            </div>

            {p.is_dummy && (
              <div style={{ textAlign:'center', fontSize:'11px', fontWeight:300, color:'rgba(201,168,76,.25)', marginTop:'24px', letterSpacing:'.06em' }}>
                Sample profile — real professionals launching soon.
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />

      <style>{`
        @keyframes vi-pulse {
          0%{box-shadow:0 0 0 0 rgba(29,158,117,.55);}
          70%{box-shadow:0 0 0 6px rgba(29,158,117,0);}
          100%{box-shadow:0 0 0 0 rgba(29,158,117,0);}
        }
        .vi-stat-strip a:hover, .vi-stat-strip div:hover {
          background: rgba(201,168,76,.04);
        }
        @media (max-width: 860px) {
          .vi-profile-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .vi-stat-strip { flex-wrap: wrap !important; }
          .vi-header-block { margin-top: -60px !important; }
          .vi-cta-intro { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>
    </>
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
