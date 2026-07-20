'use client'
import { useState, useEffect, useRef } from 'react'
import WaitlistForm from '@/components/WaitlistForm'
import { WaitlistSocialProofToast, WaitlistLiveCountBadge } from '@/components/WaitlistSocialProof'
import { useLaunchStatus } from '@/lib/useLaunchStatus'

// Saturday, July 18, 2026, 10:00 AM WAT (UTC+1) = 09:00 UTC.
// Update this if the event date/time changes — nothing else needs to.
const EVENT_DATE = new Date('2026-07-18T09:00:00Z')
// Webinar runs 10:00 AM – 1:00 PM WAT (3 hours) — used to tell "webinar is
// live right now" apart from "webinar is over," since the site's full
// launch (10:15 AM WAT) happens 15 minutes into it, not at the end.
const WEBINAR_END = new Date(EVENT_DATE.getTime() + 3 * 60 * 60 * 1000)

// From the actual Google Meet invite — used once the countdown hits zero.
const MEET_LINK = 'https://meet.google.com/wwj-yevz-jps'

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

// Tags this visit as coming from the webinar CTA so WaitlistForm can pass
// the right source/type to Brevo (separate list + attributes) and fire the
// right Meta Pixel event on submit. Read once by WaitlistForm at submit time.
function markWebinarSource() {
  try { sessionStorage.setItem('vi_signup_source', 'webinar_july18') } catch {}
}

const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
)
const ClockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
)
const VideoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16.5 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
)
const TagIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M11 3H4v7l10 10 7-7L11 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/></svg>
)

export default function HeroSlider() {
  const [slide, setSlide] = useState(0)
  const pausedRef = useRef(false)
  const timeLeft = useCountdown(EVENT_DATE)
  const launched = useLaunchStatus()
  // timeLeft ticks every second even after done:true, so this recomputes
  // freshly on the same cadence rather than needing its own timer.
  const webinarLive = timeLeft?.done && Date.now() < WEBINAR_END.getTime()
  const webinarOver  = timeLeft?.done && Date.now() >= WEBINAR_END.getTime()

  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current) setSlide(s => (s + 1) % 2)
    }, 8000)
    return () => clearInterval(id)
  }, [])

  function goTo(i) {
    setSlide(i)
    pausedRef.current = true
    setTimeout(() => { pausedRef.current = false }, 16000)
  }

  return (
    <section className="hero" id="hero">
      <div className="hero-bg" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />

      <div className="hero-slides">
        {/* ── SLIDE 1 — main introduction ────────────────────────────────── */}
        <div className={`hero-slide ${slide === 0 ? 'is-active' : ''}`} aria-hidden={slide !== 0}>
          <div className="container hero-inner">
            <div>
              <div className="hero-eyebrow au d1" aria-hidden="true">
                <div className="hero-eyebrow-line" />
                <span className="hero-eyebrow-text">THE AFRICAN PROFESSIONAL MARKETPLACE</span>
              </div>

              <h1 className="hero-title au d2">
                Valoria is where<br />African professionals<br /><em>rise.</em>
              </h1>

              <p className="hero-sub au d3">
                One marketplace. Three ways to engage Africa&apos;s best professionals. Search candidates, book speakers, commission facilitators — every profile underwritten by one independently assessed standard.
              </p>

              <div className="hero-actions au d4">
                {launched ? (
                  <a href="/atb-connect" className="btn-gold">
                    EXPLORE THE MARKETPLACE
                  </a>
                ) : (
                  <a href="#waitlist" className="btn-gold">
                    JOIN THE FOUNDING COHORT
                  </a>
                )}
                <a href="#valu" className="btn-outline">
                  SEE HOW IT WORKS
                </a>
              </div>

              <div className="hero-mobile-card au d5" aria-hidden="true">
                <div className="hmc-row">
                  <div className="hmc-score">84</div>
                  <div className="hmc-right">
                    <div className="hmc-desig">FORCE TO ALIGN WITH</div>
                    <div className="hmc-bars">
                      <div className="hmc-bar" style={{ background: '#1D9E75', width: '88%' }} />
                      <div className="hmc-bar" style={{ background: '#378ADD', width: '90%' }} />
                      <div className="hmc-bar" style={{ background: '#7F77DD', width: '82%' }} />
                      <div className="hmc-bar" style={{ background: '#BA7517', width: '80%' }} />
                      <div className="hmc-bar" style={{ background: '#D85A30', width: '75%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="valu-card au d4" aria-label="Sample VALU Index profile">
              <div className="vc-label">VALU INDEX &nbsp;&middot;&nbsp; ILLUSTRATIVE PROFILE</div>
              <div className="vc-score">
                <span className="vc-num">84</span>
                <span className="vc-denom">/ 100</span>
              </div>
              <div className="vc-desig">FORCE TO ALIGN WITH</div>
              <div className="vc-modalities">
                <span className="mod-pill" style={{ background: 'rgba(55,138,221,.12)', color: '#378ADD', border: '1px solid rgba(55,138,221,.25)' }}>CANDIDATE</span>
                <span className="mod-pill" style={{ background: 'rgba(201,168,76,.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.25)' }}>SPEAKER</span>
              </div>
              <div className="vc-bars">
                <div className="vb"><span className="vb-l">P</span><div className="vb-bg"><div className="vb-fill" style={{ width: '88%', background: '#1D9E75' }} /></div><span className="vb-s">88</span></div>
                <div className="vb"><span className="vb-l">R</span><div className="vb-bg"><div className="vb-fill" style={{ width: '90%', background: '#378ADD' }} /></div><span className="vb-s">90</span></div>
                <div className="vb"><span className="vb-l">I</span><div className="vb-bg"><div className="vb-fill" style={{ width: '82%', background: '#7F77DD' }} /></div><span className="vb-s">82</span></div>
                <div className="vb"><span className="vb-l">M</span><div className="vb-bg"><div className="vb-fill" style={{ width: '80%', background: '#BA7517' }} /></div><span className="vb-s">80</span></div>
                <div className="vb"><span className="vb-l">E</span><div className="vb-bg"><div className="vb-fill" style={{ width: '75%', background: '#D85A30' }} /></div><span className="vb-s">75</span></div>
              </div>
              <div className="vc-foot">illustrative profile — one identity, two active modalities</div>
            </div>
          </div>
        </div>

        {/* ── SLIDE 2 — live webinar ─────────────────────────────────────── */}
        <div className={`hero-slide ${slide === 1 ? 'is-active' : ''}`} aria-hidden={slide !== 1}>
          <div className="container hero-inner">
            <div>
              <div className="hero-eyebrow au d1" aria-hidden="true">
                <div className="hero-eyebrow-line" />
                <span className="hero-eyebrow-text">LIVE WEBINAR</span>
              </div>

              <h1 className="hero-title au d2" style={{ fontSize: 'clamp(30px,4.2vw,48px)' }}>
                Why being good at your job<br />is no longer <em>enough.</em>
              </h1>

              <p className="hero-sub au d3">
                A new standard for visibility, trust, and opportunity.
              </p>

              <div className="webinar-details au d3">
                <div className="webinar-detail-row"><CalendarIcon /> Saturday, July 18</div>
                <div className="webinar-detail-row"><ClockIcon /> 10:00 AM – 1:00 PM WAT</div>
                <div className="webinar-detail-row"><VideoIcon /> Virtual — Google Meet</div>
                <div className="webinar-detail-row"><TagIcon /> Free</div>
              </div>

              <div className="hero-actions au d4">
                {webinarOver ? (
                  <a href="/atb-connect" className="btn-gold">
                    EXPLORE THE MARKETPLACE →
                  </a>
                ) : webinarLive ? (
                  <a href={MEET_LINK} target="_blank" rel="noopener noreferrer" className="btn-gold" onClick={markWebinarSource}>
                    JOIN THE WEBINAR →
                  </a>
                ) : (
                  <a href="#waitlist" className="btn-gold" onClick={markWebinarSource}>
                    RESERVE YOUR SEAT →
                  </a>
                )}
              </div>

              <div className="webinar-host au d5">
                <span className="webinar-host-label">HOST</span>
                Temitayo Adetokunbo <span className="webinar-host-role">— Founder, Valoria Institute</span>
              </div>
            </div>

            <div className="webinar-countdown-card au d4" aria-label="Countdown to the webinar">
              <div className="wc-label">
                {webinarOver ? 'WEBINAR ENDED' : timeLeft && timeLeft.done ? "WE'RE LIVE" : 'STARTS IN'}
              </div>
              {timeLeft && !timeLeft.done ? (
                <div className="wc-grid">
                  <div className="wc-unit"><span className="wc-num">{pad(timeLeft.days)}</span><span className="wc-unit-label">Days</span></div>
                  <div className="wc-sep">:</div>
                  <div className="wc-unit"><span className="wc-num">{pad(timeLeft.hours)}</span><span className="wc-unit-label">Hrs</span></div>
                  <div className="wc-sep">:</div>
                  <div className="wc-unit"><span className="wc-num">{pad(timeLeft.minutes)}</span><span className="wc-unit-label">Min</span></div>
                  <div className="wc-sep">:</div>
                  <div className="wc-unit"><span className="wc-num">{pad(timeLeft.seconds)}</span><span className="wc-unit-label">Sec</span></div>
                </div>
              ) : webinarOver ? (
                <a href="/atb-connect" className="wc-live-link">Explore the marketplace →</a>
              ) : (
                <a href={MEET_LINK} target="_blank" rel="noopener noreferrer" className="wc-live-link" onClick={markWebinarSource}>Join now →</a>
              )}
              <div className="wc-foot"><WaitlistLiveCountBadge /></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── IN-HERO WAITLIST FORM ─────────────────────────────────────────
          Lives inside the Hero (not further down the page) so ad traffic
          converts without scrolling. Reuses id="waitlist" for both slides'
          pre-launch CTAs. Only rendered pre-launch — post-launch, both
          CTAs above point at the real marketplace instead, and a founding-
          cohort signup form has nothing left to do on a live site. */}
      {!launched && (
        <div id="waitlist" className="container" style={{ padding: 'clamp(40px,6vw,72px) 0 clamp(24px,4vw,48px)', position: 'relative', zIndex: 2 }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>
            <WaitlistForm />
          </div>
        </div>
      )}

      <div className="hero-slide-dots" role="tablist" aria-label="Hero slides">
        <button
          className={slide === 0 ? 'is-active' : ''}
          onClick={() => goTo(0)}
          role="tab"
          aria-selected={slide === 0}
          aria-label="Show marketplace introduction"
        />
        <button
          className={slide === 1 ? 'is-active' : ''}
          onClick={() => goTo(1)}
          role="tab"
          aria-selected={slide === 1}
          aria-label="Show live webinar details"
        />
      </div>

      <div className="hero-scroll-cue" aria-hidden="true">
        <span>Scroll</span>
        <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
          <path d="M1 1l6 6 6-6" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <WaitlistSocialProofToast />
    </section>
  )
}
