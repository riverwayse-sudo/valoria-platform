'use client'
import { useState, useEffect } from 'react'

const GATE_KEY   = 'vi_waitlist_gate_v2'
const COOKIE_KEY = 'vi_waitlist_v2'

const SUCCESS_STYLES = `
  .wl-success-wrap { padding: 8px 0; }
  .wl-done-icon {
    width: 56px; height: 56px; border-radius: 50%;
    background: rgba(29,158,117,0.12);
    border: 1px solid rgba(29,158,117,0.3);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 20px;
  }
  .wl-done-title {
    font-family: var(--font); font-size: 24px; font-weight: 200;
    color: #F7F4EE; margin-bottom: 10px; text-align: center;
  }
  .wl-done-sub {
    font-size: 13px; color: rgba(247,244,238,0.45);
    line-height: 1.7; text-align: center; margin-bottom: 0;
    font-family: var(--font);
  }
  .wl-done-sections {
    border-top: 1px solid rgba(201,168,76,0.15);
    margin-top: 24px; padding-top: 24px;
  }
  .wl-done-section { margin-bottom: 28px; }
  .wl-done-label {
    font-size: 9px; font-weight: 700; letter-spacing: 0.2em;
    color: rgba(201,168,76,0.45); margin-bottom: 8px;
    font-family: var(--font); text-transform: uppercase;
  }
  .wl-done-body {
    font-size: 13px; color: rgba(247,244,238,0.55);
    line-height: 1.8; font-family: var(--font); font-weight: 300; margin: 0;
  }
  .wl-em-white { color: #F7F4EE; font-style: italic; }
  .wl-em-gold  { color: #C9A84C; font-style: italic; }
  .wl-done-three {
    border-top: 1px solid rgba(201,168,76,0.1);
    padding-top: 20px; margin-bottom: 4px;
  }
  .wl-done-track {
    display: flex; gap: 12px; margin-bottom: 14px; align-items: flex-start;
  }
  .wl-track-bar {
    width: 3px; border-radius: 2px; flex-shrink: 0;
    margin-top: 3px; align-self: stretch; min-height: 36px;
  }
  .wl-track-name {
    font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
    margin-bottom: 3px; font-family: var(--font);
  }
  .wl-track-desc {
    font-size: 11px; color: rgba(247,244,238,0.4);
    line-height: 1.6; font-family: var(--font);
  }
  .wl-done-close {
    border-top: 1px solid rgba(201,168,76,0.1);
    padding-top: 20px; margin-top: 8px;
    font-size: 13px; color: rgba(247,244,238,0.35);
    line-height: 1.8; font-family: var(--font); font-weight: 300;
    font-style: italic; text-align: center;
  }
  .wl-done-close-tag {
    color: rgba(201,168,76,0.6); font-style: normal;
    font-size: 11px; letter-spacing: 0.1em;
  }
`

export default function WaitlistForm() {
  const [name,      setName]      = useState('')
  const [email,     setEmail]     = useState('')
  const [role,      setRole]      = useState('')
  const [interest,  setInterest]  = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [utm,       setUtm]       = useState({ source: null, medium: null, campaign: null })

  // Capture UTM params on mount so live campaign traffic is attributable.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const source = params.get('utm_source')
    const medium = params.get('utm_medium')
    const campaign = params.get('utm_campaign')
    if (source || medium || campaign) setUtm({ source, medium, campaign })
  }, [])

  const valid = name.trim() && email.includes('@')

  async function handleSubmit() {
    if (!valid || loading) return
    setLoading(true)
    setError('')

    // If this visit came from the webinar CTA (set by HeroSlider), route this
    // signup into the webinar's own Brevo list/attributes instead of the
    // general waitlist — read once, then clear so it doesn't leak into a
    // later, unrelated signup in the same browser session.
    let source = 'homepage_form'
    let type = 'homepage'
    try {
      const webinarSource = sessionStorage.getItem('vi_signup_source')
      if (webinarSource) {
        source = webinarSource
        type = 'webinar'
        sessionStorage.removeItem('vi_signup_source')
      }
    } catch {}

    try {
      // FIX: previously inserted directly into Supabase from the browser,
      // which skipped the Brevo welcome email + CRM list sync entirely —
      // both only run inside the /api/waitlist route. Routing through the
      // API here is what actually gets these signups into Brevo.
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name.trim(),
          email:     email.trim().toLowerCase(),
          role:      role.trim() || null,
          interest:  interest || null,
          type,
          source,
          utm_source: utm.source,
          utm_medium: utm.medium,
          utm_campaign: utm.campaign,
        }),
      })
      if (!res.ok && res.status !== 409) throw new Error('failed')

      localStorage.setItem(GATE_KEY, 'submitted')
      document.cookie = `${COOKIE_KEY}=submitted; path=/; max-age=31536000`
      setSubmitted(true)

      // Meta Pixel — fires only if NEXT_PUBLIC_META_PIXEL_ID is configured
      // and the base pixel script (in layout.jsx) has loaded.
      if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
        window.fbq('track', 'Lead')
        if (type === 'webinar') {
          window.fbq('track', 'CompleteRegistration', { content_name: 'Webinar — July 18' })
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{SUCCESS_STYLES}</style>
      <div className="waitlist-card">
        <div className="eyebrow">
          <div className="eyebrow-line" />
          <span className="eyebrow-text">JOIN THE WAITLIST</span>
        </div>

        {submitted ? (
          <div className="wl-success-wrap">
            <div className="wl-done-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L20 7" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="wl-done-title">You&apos;re on the list.</div>
            <p className="wl-done-sub">Something is being built that Africa has never had before.</p>
            <div className="wl-done-sections">
              <div className="wl-done-section">
                <div className="wl-done-label">THE PROBLEM</div>
                <p className="wl-done-body">Every day, exceptional African professionals are passed over — not because they lack capability, but because no one can prove it. The same names circulate. The same networks win. Everyone else waits.</p>
              </div>
              <div className="wl-done-section">
                <div className="wl-done-label">THE SHIFT</div>
                <p className="wl-done-body">Valoria changes the question employers and organisers ask. Not <em className="wl-em-white">&ldquo;who do I already know?&rdquo;</em> — but <em className="wl-em-gold">&ldquo;who is genuinely the best for this?&rdquo;</em> One assessed standard. No guesswork. No gatekeeping.</p>
              </div>
              <div className="wl-done-section">
                <div className="wl-done-label">WHAT&apos;S COMING</div>
                <p className="wl-done-body">A marketplace where every profile is verified by the VALU Index. Where employers search by capability, not connection. Where speakers get booked on merit. Where facilitators earn trust before they walk into the room.</p>
              </div>
              <div className="wl-done-three">
                <div className="wl-done-label">THREE WAYS IN</div>
                {[
                  { color:'#378ADD', label:'ATB CONNECT',   desc:'For employers and recruiters — search pre-assessed candidates by score, strength, and sector.' },
                  { color:'#C9A84C', label:'ATB SPOTLIGHT', desc:'For event planners — discover and book speakers whose capability you can actually verify.' },
                  { color:'#1D9E75', label:'ATB DEVELOP',   desc:'For L&D leaders — commission PRIME-certified facilitators with an assessed track record.' },
                ].map((t,i) => (
                  <div key={i} className="wl-done-track">
                    <div className="wl-track-bar" style={{ background: t.color }} />
                    <div>
                      <div className="wl-track-name" style={{ color: t.color }}>{t.label}</div>
                      <div className="wl-track-desc">{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="wl-done-close">
                You&apos;re early. That matters more than you think.<br/>
                <span className="wl-done-close-tag">WE&apos;LL BE IN TOUCH.</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="waitlist-card-desc">
              Tell us who you are and how you&apos;d like to engage — we&apos;ll hold your spot in the founding cohort.
            </p>

            <label className="wl-field-label" htmlFor="wlf-name">FULL NAME</label>
            <input id="wlf-name" className="wl-field" type="text"
              placeholder="Your name" value={name}
              onChange={e => setName(e.target.value)} autoComplete="name" />

            <label className="wl-field-label" htmlFor="wlf-email">EMAIL ADDRESS</label>
            <input id="wlf-email" className="wl-field" type="email"
              placeholder="you@email.com" value={email}
              onChange={e => setEmail(e.target.value)} autoComplete="email" />

            <label className="wl-field-label" htmlFor="wlf-role">YOUR ROLE / TITLE</label>
            <input id="wlf-role" className="wl-field" type="text"
              placeholder="e.g. Head of People" value={role}
              onChange={e => setRole(e.target.value)} />

            <label className="wl-field-label" htmlFor="wlf-interest">I AM A...</label>
            <select id="wlf-interest" className="wl-field"
              value={interest} onChange={e => setInterest(e.target.value)}>
              <option value="">Select one</option>
              <option value="professional">Professional / Talent</option>
              <option value="speaker">Speaker / Facilitator</option>
              <option value="employer">Employer / Recruiter</option>
              <option value="event_planner">Event Planner / Organiser</option>
              <option value="other">Other</option>
            </select>

            {error && (
              <div style={{ fontSize:'12px', color:'#D85A30', marginBottom:'12px', padding:'10px 12px', background:'rgba(216,90,48,.07)', borderLeft:'2px solid rgba(216,90,48,.5)' }}>
                {error}
              </div>
            )}

            <button className="wl-btn" onClick={handleSubmit} disabled={!valid || loading}>
              {loading ? 'JOINING…' : 'JOIN THE FOUNDING COHORT →'}
            </button>
          </>
        )}
      </div>
    </>
  )
}
