'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Footer from '@/components/Footer'
import EntryPointsGrid from '@/components/EntryPointsGrid'
import WaitlistForm from '@/components/WaitlistForm'
import { WaitlistSocialProofToast, WaitlistLiveCountBadge } from '@/components/WaitlistSocialProof'

// Saturday, July 18, 2026, 10:00 AM WAT (UTC+1) = 09:00 UTC.
const EVENT_DATE = new Date('2026-07-18T09:00:00Z')
const MEET_LINK = 'https://meet.google.com/zmv-xjtb-iby'
function pad(n) { return String(n).padStart(2, '0') }

function useCountdown(target) {
  const [timeLeft, setTimeLeft] = useState(null)
  useEffect(() => {
    function tick() {
      const diff = target.getTime() - Date.now()
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true }); return }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        done: false,
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])
  return timeLeft
}

// Tags this visit as coming from the webinar CTA so WaitlistForm can route
// it into the separate Brevo webinar list + reminder automation, instead of
// logging as a generic signup. Same pattern as HeroSlider.jsx.
function markWebinarSource() {
  try { sessionStorage.setItem('vi_signup_source', 'webinar_july18') } catch {}
}

// ─── brand ──────────────────────────────────────────────────────────────
const GOLD    = '#C9A84C'
const DARK    = '#0F0F1A'
const MID     = '#1A1A2E'
const PARCH   = '#F7F4EE'
const DIM     = 'rgba(247,244,238,.55)'
const FAINT   = 'rgba(247,244,238,.25)'
const GLINE   = 'rgba(201,168,76,.12)'
const GLINE2  = 'rgba(201,168,76,.28)'

// ─── Copy data ──────────────────────────────────────────────────────────
const PAIN_POINTS = [
  { icon: '👀', headline: 'You applied for the job.', body: 'Someone with half your experience got it. Why? Because they knew the hiring manager.' },
  { icon: '🎤', headline: 'You should be on that stage.', body: "The same three speakers keep getting booked — not because they're the best, but because the organiser only has five contacts." },
  { icon: '📋', headline: "You've done the work.", body: 'But the training contract went to the big-name consultant everyone already knows. Your track record stayed invisible.' },
]

const HOW_IT_WORKS = [
  { num: '01', color: '#378ADD', title: 'Take the VALU Index', body: 'A 25-minute assessment that measures your professional capability across five dimensions. Not a quiz. An independent standard.' },
  { num: '02', color: GOLD,       title: 'Your profile goes live', body: 'Once assessed, your profile appears in our marketplace with your score, skills, and ATB ID. Buyers can find you. You stay in control.' },
  { num: '03', color: '#1D9E75', title: 'Valoria makes the introduction', body: 'Interested employers and organisers submit a request. We review it. Only then do we connect you — never the other way around.' },
]

const WEBINAR_DETAILS = [
  { label: 'DATE', value: 'Saturday, July 18, 2026' },
  { label: 'TIME', value: '10:00 AM – 1:00 PM WAT' },
  { label: 'FORMAT', value: 'Virtual — Google Meet' },
  { label: 'COST', value: 'Free' },
]

// ─── component ──────────────────────────────────────────────────────────
export default function WaitlistPage() {
  const timeLeft = useCountdown(EVENT_DATE)
  return (
    <>
      <main style={{ background: DARK, color: PARCH, fontFamily: "var(--font,'Raleway','Helvetica Neue',Arial,sans-serif)", overflow: 'hidden' }}>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section style={{ padding: 'clamp(60px,8vw,110px) clamp(20px,5vw,80px) clamp(48px,6vw,80px)', borderBottom: `1px solid ${GLINE}`, position: 'relative', overflow: 'hidden' }}>
          {/* Background glow */}
          <div style={{ position:'absolute', top:'-20%', right:'-10%', width:'600px', height:'600px', borderRadius:'50%', background:`radial-gradient(circle, rgba(201,168,76,.1) 0%, transparent 70%)`, pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:'-10%', left:'-5%', width:'400px', height:'400px', borderRadius:'50%', background:`radial-gradient(circle, rgba(55,138,221,.07) 0%, transparent 70%)`, pointerEvents:'none' }} />

          <div style={{ maxWidth:'760px', margin:'0 auto', textAlign:'center', position:'relative' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:'10px', marginBottom:'28px', padding:'7px 16px', border:`1px solid ${GLINE2}`, background:'rgba(201,168,76,.06)' }}>
              <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#1D9E75', animation:'vi-pulse 2s infinite' }} />
              <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.18em', color:GOLD }}>FOUNDING COHORT — NOW OPEN</span>
            </div>

            <h1 style={{ fontSize:'clamp(32px,5vw,60px)', fontWeight:200, lineHeight:1.15, letterSpacing:'-.03em', marginBottom:'24px', color:PARCH, maxWidth:'820px', marginLeft:'auto', marginRight:'auto' }}>
              The best person for the job keeps losing to the{' '}
              <em style={{ fontStyle:'italic', color:GOLD, fontWeight:300 }}>most connected one.</em>
            </h1>
            <p style={{ fontSize:'clamp(16px,2vw,20px)', fontWeight:300, color:DIM, lineHeight:1.75, maxWidth:'560px', margin:'0 auto 40px' }}>
              Valoria is where African professionals get assessed, verified, and put in front of the people who actually hire, book, and commission — based on what they can do, not who they know.
            </p>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
              <Link href="#join"
                style={{ padding:'16px 36px', background:GOLD, color:DARK, fontSize:'12px', fontWeight:700, letterSpacing:'.14em', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'none', display:'inline-block' }}>
                JOIN THE WAITLIST →
              </Link>
              <Link href="#how-it-works" style={{ padding:'16px 36px', border:`1px solid ${GLINE2}`, color:PARCH, fontSize:'12px', fontWeight:700, letterSpacing:'.14em', textDecoration:'none' }}>
                SEE HOW IT WORKS
              </Link>
            </div>
            <div style={{ marginTop:'20px' }}>
              <WaitlistLiveCountBadge />
            </div>
          </div>
        </section>

        {/* ── JOIN FORM — the actual signup mechanism. Everything above and
             below this exists to get someone here and get them to submit. ── */}
        <section id="join" style={{ padding:'clamp(48px,7vw,80px) clamp(20px,5vw,80px)', borderBottom:`1px solid ${GLINE}`, display:'flex', justifyContent:'center' }}>
          <WaitlistForm />
        </section>

        {/* ── WEBINAR FLYER ─────────────────────────────────────────────── */}
        <section style={{ padding:'clamp(48px,7vw,80px) clamp(20px,5vw,80px)', borderBottom:`1px solid ${GLINE}`, background:MID }}>
          <div style={{ maxWidth:'760px', margin:'0 auto' }}>
            <div style={{ border:`1px solid ${GLINE2}`, background:'rgba(201,168,76,.05)', padding:'clamp(28px,5vw,48px)', textAlign:'center', position:'relative' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:'10px', marginBottom:'20px', padding:'6px 14px', border:`1px solid ${GLINE2}` }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#D85A30' }} />
                <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.18em', color:GOLD }}>LIVE WEBINAR</span>
              </div>

              <h2 style={{ fontSize:'clamp(24px,3.6vw,38px)', fontWeight:200, lineHeight:1.2, letterSpacing:'-.02em', color:PARCH, marginBottom:'12px' }}>
                Why being good at your job<br/>is no longer <em style={{ fontStyle:'italic', color:GOLD }}>enough.</em>
              </h2>
              <p style={{ fontSize:'14px', fontWeight:300, color:DIM, lineHeight:1.7, marginBottom:'32px' }}>
                A new standard for visibility, trust, and opportunity.
              </p>

              {/* Live ticking countdown — was previously just a static
                  date/time row with nothing that moved. Urgency triggers
                  work because they're visibly alive, not printed once. */}
              <div style={{ marginBottom:'32px' }}>
                <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.22em', color:'rgba(201,168,76,.5)', textTransform:'uppercase', marginBottom:'16px' }}>
                  {timeLeft && timeLeft.done ? "WE'RE LIVE" : 'STARTS IN'}
                </div>
                {timeLeft && !timeLeft.done ? (
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'center', gap:'4px' }}>
                    {[
                      { n: timeLeft.days, l: 'Days' },
                      { n: timeLeft.hours, l: 'Hrs' },
                      { n: timeLeft.minutes, l: 'Min' },
                      { n: timeLeft.seconds, l: 'Sec' },
                    ].map((u, i, arr) => (
                      <div key={u.l} style={{ display:'flex', alignItems:'flex-start' }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:'52px' }}>
                          <span style={{ fontFamily:'var(--font)', fontSize:'clamp(28px,3.5vw,40px)', fontWeight:200, color:PARCH, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{pad(u.n)}</span>
                          <span style={{ fontSize:'9px', fontWeight:600, letterSpacing:'.12em', color:'rgba(247,244,238,.4)', textTransform:'uppercase', marginTop:'6px' }}>{u.l}</span>
                        </div>
                        {i < arr.length - 1 && <span style={{ fontSize:'clamp(24px,3vw,34px)', fontWeight:200, color:'rgba(201,168,76,.3)', padding:'0 2px' }}>:</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <a href={MEET_LINK} target="_blank" rel="noopener noreferrer" onClick={markWebinarSource}
                    style={{ display:'inline-block', fontSize:'18px', fontWeight:300, color:GOLD, textDecoration:'none' }}>
                    Join now →
                  </a>
                )}
                <div style={{ marginTop:'20px', paddingTop:'16px', borderTop:`1px solid ${GLINE}` }}>
                  <WaitlistLiveCountBadge />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:'1px', background:GLINE, marginBottom:'32px', border:`1px solid ${GLINE}` }}>
                {WEBINAR_DETAILS.map((d, i) => (
                  <div key={i} style={{ background:DARK, padding:'18px 12px' }}>
                    <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.16em', color:'rgba(201,168,76,.5)', marginBottom:'6px' }}>{d.label}</div>
                    <div style={{ fontSize:'13px', fontWeight:500, color:PARCH }}>{d.value}</div>
                  </div>
                ))}
              </div>

              <p style={{ fontSize:'12px', fontWeight:300, color:FAINT, marginBottom:'28px' }}>
                Hosted by <strong style={{ color:DIM, fontWeight:600 }}>Temitayo Adetokunbo</strong> — Founder, Valoria Institute
              </p>

              <Link href="#join" onClick={markWebinarSource}
                style={{ padding:'16px 40px', background:GOLD, color:DARK, fontSize:'12px', fontWeight:700, letterSpacing:'.14em', border:'none', textDecoration:'none', display:'inline-block' }}>
                RESERVE YOUR SEAT →
              </Link>
            </div>
          </div>
        </section>

        {/* ── THE PROBLEM ──────────────────────────────────────────────── */}
        <section style={{ padding:'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', borderBottom:`1px solid ${GLINE}` }}>
          <div style={{ maxWidth:'900px', margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
              <div style={{ height:'1px', width:'32px', background:GLINE2 }} />
              <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.2em', color:'rgba(201,168,76,.5)' }}>THE PROBLEM</span>
            </div>
            <h2 style={{ fontSize:'clamp(28px,4vw,52px)', fontWeight:200, lineHeight:1.1, letterSpacing:'-.02em', marginBottom:'16px' }}>
              You already know<br/><em style={{ fontStyle:'italic', color:GOLD }}>this feeling.</em>
            </h2>
            <p style={{ fontSize:'clamp(15px,1.8vw,18px)', fontWeight:300, color:DIM, lineHeight:1.8, maxWidth:'640px', marginBottom:'56px' }}>
              Somewhere out there, a person less qualified than you just got the job, the stage, or the contract.
              Not because they were better. Because they were <strong style={{ color:PARCH, fontWeight:500 }}>more visible</strong> to the right person at the right moment.
            </p>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px,1fr))', gap:'1px', background:GLINE }}>
              {PAIN_POINTS.map((p, i) => (
                <div key={i} style={{ background:DARK, padding:'32px 28px' }}>
                  <div style={{ fontSize:'32px', marginBottom:'16px' }}>{p.icon}</div>
                  <div style={{ fontSize:'15px', fontWeight:600, color:PARCH, marginBottom:'10px', lineHeight:1.3 }}>{p.headline}</div>
                  <p style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.75, margin:0 }}>{p.body}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop:'48px', padding:'28px 32px', background:'rgba(201,168,76,.04)', border:`1px solid ${GLINE2}` }}>
              <p style={{ fontSize:'clamp(18px,2.5vw,26px)', fontWeight:200, lineHeight:1.5, color:PARCH, textAlign:'center', margin:0, letterSpacing:'-.01em' }}>
                Across Africa, the talent is not the problem.<br/>
                <em style={{ fontStyle:'italic', color:GOLD }}>The system that surfaces it is.</em>
              </p>
            </div>
          </div>
        </section>

        {/* ── THE SOLUTION ─────────────────────────────────────────────── */}
        <section style={{ padding:'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', borderBottom:`1px solid ${GLINE}`, background:MID }}>
          <div style={{ maxWidth:'900px', margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
              <div style={{ height:'1px', width:'32px', background:GLINE2 }} />
              <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.2em', color:'rgba(201,168,76,.5)' }}>THE SOLUTION</span>
            </div>
            <h2 style={{ fontSize:'clamp(28px,4vw,52px)', fontWeight:200, lineHeight:1.1, letterSpacing:'-.02em', marginBottom:'20px' }}>
              What if your work could<br/><em style={{ fontStyle:'italic', color:GOLD }}>speak for itself?</em>
            </h2>
            <p style={{ fontSize:'clamp(15px,1.8vw,18px)', fontWeight:300, color:DIM, lineHeight:1.8, maxWidth:'640px', marginBottom:'16px' }}>
              Valoria Institute is a professional marketplace for Africa. But before anyone can list on it, they go through one thing: the VALU Index.
            </p>
            <p style={{ fontSize:'clamp(15px,1.8vw,18px)', fontWeight:300, color:DIM, lineHeight:1.8, maxWidth:'640px', marginBottom:'56px' }}>
              The VALU Index is an independent assessment that measures your actual professional capability — not your job title, not your degree, not who vouched for you.
              It produces a score. A profile. A verified identity that any employer, organiser, or training buyer can trust.
            </p>

            {/* PRIME dimensions */}
            <div style={{ marginBottom:'48px' }}>
              <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.18em', color:'rgba(201,168,76,.45)', marginBottom:'20px' }}>THE VALU INDEX MEASURES FIVE THINGS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {[
                  { letter:'P', color:'#1D9E75', name:'Presence',     desc:'How you show up — your visibility, credibility, and professional confidence.' },
                  { letter:'R', color:'#378ADD', name:'Relationships',desc:'How you build trust and collaborate — the quality of the networks you create.' },
                  { letter:'I', color:'#7F77DD', name:'Intelligence',  desc:'How you think — your strategic thinking, problem-solving, and learning speed.' },
                  { letter:'M', color:'#BA7517', name:'Mastery',       desc:'How good you are at your actual work — depth of expertise and craft.' },
                  { letter:'E', color:'#D85A30', name:'Enterprise',    desc:'How you build and run things — commercial thinking and a venture mindset.' },
                ].map(d => (
                  <div key={d.letter} style={{ display:'flex', alignItems:'center', gap:'20px', padding:'14px 20px', border:`1px solid ${GLINE}`, background:'rgba(255,255,255,.02)' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'50%', border:`2px solid ${d.color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:700, color:d.color, flexShrink:0 }}>{d.letter}</div>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:700, color:d.color, marginBottom:'3px', letterSpacing:'.04em' }}>{d.name}</div>
                      <div style={{ fontSize:'12px', fontWeight:300, color:DIM, lineHeight:1.6 }}>{d.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding:'28px 32px', background:'rgba(201,168,76,.04)', border:`1px solid ${GLINE2}` }}>
              <p style={{ fontSize:'clamp(15px,2vw,20px)', fontWeight:200, lineHeight:1.6, color:PARCH, margin:'0 0 8px' }}>
                Think of it like this: imagine if every professional had a verified report card that showed exactly how capable they are.
              </p>
              <p style={{ fontSize:'14px', fontWeight:300, color:DIM, lineHeight:1.7, margin:0 }}>
                That's what Valoria does. One score. Five dimensions. An identity that follows you across every opportunity on the platform.
              </p>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
        <section id="how-it-works" style={{ padding:'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', borderBottom:`1px solid ${GLINE}`, scrollMarginTop:'70px' }}>
          <div style={{ maxWidth:'900px', margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
              <div style={{ height:'1px', width:'32px', background:GLINE2 }} />
              <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.2em', color:'rgba(201,168,76,.5)' }}>HOW IT WORKS</span>
            </div>
            <h2 style={{ fontSize:'clamp(28px,4vw,52px)', fontWeight:200, lineHeight:1.1, letterSpacing:'-.02em', marginBottom:'48px' }}>
              Three steps.<br/><em style={{ fontStyle:'italic', color:GOLD }}>One clean system.</em>
            </h2>

            <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
              {HOW_IT_WORKS.map((h, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'60px 4px 1fr', gap:'0 24px', alignItems:'stretch' }}>
                  {/* Number */}
                  <div style={{ display:'flex', alignItems:'flex-start', paddingTop:'28px', justifyContent:'flex-end' }}>
                    <span style={{ fontFamily:'var(--font,Raleway,sans-serif)', fontSize:'11px', fontWeight:700, letterSpacing:'.1em', color:h.color }}>{h.num}</span>
                  </div>
                  {/* Line */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ width:'4px', height:'28px', background: i === 0 ? 'transparent' : GLINE }} />
                    <div style={{ width:'14px', height:'14px', borderRadius:'50%', border:`2px solid ${h.color}`, background:DARK, flexShrink:0 }} />
                    <div style={{ flex:1, width:'2px', background: i === HOW_IT_WORKS.length-1 ? 'transparent' : GLINE }} />
                  </div>
                  {/* Content */}
                  <div style={{ padding:'20px 0 32px' }}>
                    <div style={{ fontSize:'16px', fontWeight:600, color:PARCH, marginBottom:'8px' }}>{h.title}</div>
                    <p style={{ fontSize:'14px', fontWeight:300, color:DIM, lineHeight:1.75, margin:0, maxWidth:'560px' }}>{h.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHO IT'S FOR ─────────────────────────────────────────────── */}
        <section style={{ padding:'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', borderBottom:`1px solid ${GLINE}`, background:MID }}>
          <div style={{ maxWidth:'900px', margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
              <div style={{ height:'1px', width:'32px', background:GLINE2 }} />
              <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.2em', color:'rgba(201,168,76,.5)' }}>WHO IT'S FOR</span>
            </div>
            <h2 style={{ fontSize:'clamp(28px,4vw,52px)', fontWeight:200, lineHeight:1.1, letterSpacing:'-.02em', marginBottom:'48px' }}>
              If any of these<br/><em style={{ fontStyle:'italic', color:GOLD }}>sound like you.</em>
            </h2>

            {/* Three entry points — same shared component as the homepage,
                so this never drifts out of sync with it again. */}
            <div className="ep-grid" style={{ border:`1px solid ${GLINE2}` }}>
              <EntryPointsGrid ctaHref="#join" />
            </div>
          </div>
        </section>

        {/* ── THE FOUNDING COHORT ──────────────────────────────────────── */}
        <section style={{ padding:'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', borderBottom:`1px solid ${GLINE}` }}>
          <div style={{ maxWidth:'900px', margin:'0 auto', textAlign:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px', justifyContent:'center' }}>
              <div style={{ height:'1px', width:'32px', background:GLINE2 }} />
              <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.2em', color:'rgba(201,168,76,.5)' }}>THE FOUNDING COHORT</span>
              <div style={{ height:'1px', width:'32px', background:GLINE2 }} />
            </div>
            <h2 style={{ fontSize:'clamp(28px,4vw,52px)', fontWeight:200, lineHeight:1.1, letterSpacing:'-.02em', marginBottom:'20px' }}>
              The people who join first<br/><em style={{ fontStyle:'italic', color:GOLD }}>matter most.</em>
            </h2>
            <p style={{ fontSize:'clamp(15px,1.8vw,18px)', fontWeight:300, color:DIM, lineHeight:1.8, maxWidth:'580px', margin:'0 auto 40px' }}>
              We're building the founding cohort right now. The professionals who join before public launch get priority placement, early access to the marketplace, and a direct line to shape how Valoria develops.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:'1px', background:GLINE, marginBottom:'40px', border:`1px solid ${GLINE}` }}>
              {[
                { stat:'1st access', label:'Before the public launch' },
                { stat:'Priority',   label:'Placement in search results' },
                { stat:'Founding',   label:'Cohort badge on your profile' },
                { stat:'Direct',     label:'Input into how Valoria grows' },
              ].map((b, i) => (
                <div key={i} style={{ background:DARK, padding:'28px 20px', textAlign:'center' }}>
                  <div style={{ fontSize:'22px', fontWeight:700, color:GOLD, marginBottom:'6px', letterSpacing:'-.01em' }}>{b.stat}</div>
                  <div style={{ fontSize:'12px', fontWeight:300, color:FAINT, lineHeight:1.5 }}>{b.label}</div>
                </div>
              ))}
            </div>
            <Link href="#join"
              style={{ padding:'16px 36px', background:GOLD, color:DARK, fontSize:'12px', fontWeight:700, letterSpacing:'.14em', border:'none', textDecoration:'none', display:'inline-block' }}>
              JOIN THE FOUNDING COHORT →
            </Link>
          </div>
        </section>

        {/* ── ALIGNMENT PRINCIPLE ──────────────────────────────────────── */}
        <section style={{ padding:'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', borderTop:`1px solid ${GLINE}`, textAlign:'center' }}>
          <div style={{ maxWidth:'720px', margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', justifyContent:'center' }}>
              <div style={{ height:'1px', width:'32px', background:GLINE2 }} />
              <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.2em', color:'rgba(201,168,76,.5)' }}>THE ALIGNMENT PRINCIPLE</span>
              <div style={{ height:'1px', width:'32px', background:GLINE2 }} />
            </div>
            <blockquote style={{ fontSize:'clamp(18px,2.5vw,28px)', fontWeight:200, fontStyle:'italic', lineHeight:1.5, color:PARCH, margin:'0 0 24px', letterSpacing:'-.01em' }}>
              "When people encounter a person or institution, they place them in one of four categories. Forgotten. Used. <span style={{ color:GOLD }}>A force to align with.</span> Or one they submit to."
            </blockquote>
            <p style={{ fontSize:'14px', fontWeight:300, color:DIM, lineHeight:1.75, maxWidth:'560px', margin:'0 auto' }}>
              Valoria Institute exists to move African professionals from category two — used, deployed as a resource without development — to category three.
              Every profile, every assessment, every programme is an act of infrastructure toward that one outcome.
            </p>
          </div>
        </section>

      </main>

      <style>{`
        @keyframes vi-pulse {
          0%  { box-shadow: 0 0 0 0 rgba(29,158,117,.55); }
          70% { box-shadow: 0 0 0 6px rgba(29,158,117,0); }
          100%{ box-shadow: 0 0 0 0 rgba(29,158,117,0); }
        }
        select option { background: #1A1A2E; color: #F7F4EE; }
      `}</style>
      <WaitlistSocialProofToast />
      <Footer />
    </>
  )
}
