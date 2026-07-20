'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLaunchStatus } from '@/lib/useLaunchStatus'

export default function Nav() {
  const [scrolled, setScrolled]       = useState(false)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [dropOpen, setDropOpen]       = useState(false)
  const [user, setUser]               = useState(null)
  const [userType, setUserType]       = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [gateCleared, setGateCleared] = useState(false)
  const launched = useLaunchStatus()

  useEffect(() => {
    // Post-launch, the nav always shows — the full-lockdown gate is gone
    // entirely at that point (see middleware.js). Pre-launch, it still
    // shows only once the visitor has cleared the waitlist popup/page.
    if (launched) {
      setGateCleared(true)
      return
    }
    const inCookie = document.cookie.includes('vi_waitlist_v2')
    const inLocal = localStorage.getItem('vi_waitlist_gate_v2')
    setGateCleared(inCookie || !!inLocal)
  }, [launched])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
  }, [menuOpen])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        const { data: profile } = await supabase
          .from('professional_profiles').select('active_tracks').eq('id', user.id).maybeSingle()
        setUserType((profile?.active_tracks?.[0]) || user?.user_metadata?.user_type || null)
      }
      setAuthChecked(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const u = session?.user || null
      setUser(u)
      if (u) {
        const { data: profile } = await supabase
          .from('professional_profiles').select('active_tracks').eq('id', u.id).maybeSingle()
        setUserType((profile?.active_tracks?.[0]) || u?.user_metadata?.user_type || null)
      } else {
        setUserType(null)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  function handleSignOut() {
    supabase.auth.signOut().then(() => { window.location.href = '/' })
  }

  const closeMenu = () => setMenuOpen(false)

  // Pre-launch: always push toward the waitlist. Post-launch: the site is
  // actually open, so pushing people to "JOIN THE WAITLIST" would look
  // broken — swap to a real signup/dashboard CTA instead.
  const cta = !launched
    ? { label: 'JOIN THE WAITLIST', href: '/#waitlist' }
    : user
      ? { label: 'GET STARTED', href: '/dashboard' }
      : { label: 'JOIN VALORIA', href: '/register' }

  if (!gateCleared) return null

  return (
    <>
      <style>{`
        nav.vi-nav {
          position: fixed; top: 3px; left: 0; right: 0; z-index: 200;
          padding: 0 var(--pad);
          display: flex; align-items: center; justify-content: space-between;
          height: 64px;
          transition: background .3s, border-color .3s;
          background: var(--nav-bg);
          border-bottom: 1px solid rgba(201,168,76,0.08);
        }
        nav.vi-nav.scrolled {
          background: rgba(15,15,26,0.97);
          border-color: rgba(201,168,76,.14);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .nav-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; line-height: 0; }
        .nav-logo img { height: 40px; width: auto; display: block; }
        .nav-links { display: flex; align-items: center; gap: 6px; list-style: none; margin: 0; padding: 0; }
        .nav-explore-btn {
          background: none; border: none; cursor: pointer; padding: 8px 14px;
          font-size: 12px; color: var(--dim); letter-spacing: .07em;
          font-weight: 400; font-family: var(--font); transition: color .2s;
          display: flex; align-items: center; gap: 5px;
        }
        .nav-explore-btn:hover { color: var(--parchment); }
        .nav-explore-arrow { font-size: 8px; transition: transform .2s; display: inline-block; }
        .nav-explore-arrow.open { transform: rotate(180deg); }
        .nav-dropdown {
          position: absolute; top: calc(100% + 8px); left: 0;
          background: rgba(15,15,26,.98); border: 1px solid rgba(201,168,76,.15);
          border-radius: 10px; padding: 8px 0; min-width: 220px;
          backdrop-filter: blur(20px); display: none; z-index: 300;
        }
        .nav-dropdown.open { display: block; }
        .nav-dropdown a {
          display: block; padding: 10px 18px;
          font-size: 12px; color: var(--dim); text-decoration: none;
          letter-spacing: .06em; transition: color .15s, background .15s;
        }
        .nav-dropdown a:hover { color: var(--parchment); background: rgba(201,168,76,.06); }
        .nav-dropdown-divider { height: 1px; background: rgba(201,168,76,.08); margin: 6px 0; }
        .nav-explore-wrap { position: relative; }
        .nav-link {
          font-size: 12px; color: var(--dim); text-decoration: none;
          letter-spacing: .07em; font-weight: 400; transition: color .2s;
          padding: 8px 14px; display: block;
        }
        .nav-link:hover { color: var(--parchment); }
        .nav-link-btn {
          background: none; border: none; cursor: pointer; padding: 8px 14px;
          font-size: 12px; color: var(--dim); letter-spacing: .07em;
          font-weight: 400; font-family: var(--font); transition: color .2s;
        }
        .nav-link-btn:hover { color: var(--parchment); }
        .nav-cta {
          padding: 10px 22px;
          background: var(--gold); color: var(--dark) !important;
          border-radius: var(--btn-radius);
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-decoration: none; white-space: nowrap;
          transition: opacity .2s; margin-left: 8px;
        }
        .nav-cta:hover { opacity: .88; }
        .nav-burger {
          display: none; flex-direction: column; gap: 5px;
          cursor: pointer; padding: 4px; background: none; border: none;
        }
        .nav-burger span {
          display: block; width: 22px; height: 1.5px;
          background: var(--parchment); transition: all .3s;
        }
        .nav-burger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
        .nav-burger.open span:nth-child(2) { opacity: 0; }
        .nav-burger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }
        .nav-mobile {
          display: none; position: fixed; inset: 0; top: 68px;
          background: rgba(10,10,20,.98); z-index: 199;
          padding: 32px var(--pad) 48px; flex-direction: column; gap: 0;
          backdrop-filter: blur(20px); overflow-y: auto;
        }
        .nav-mobile.open { display: flex; }
        .nav-mobile a, .nav-mobile button.m-signout {
          font-size: 20px; font-family: var(--font); color: var(--dim); font-weight: 300;
          text-decoration: none; padding: 16px 0;
          border-bottom: 1px solid rgba(255,255,255,.05); transition: color .2s;
          display: block;
        }
        .nav-mobile a:hover { color: var(--parchment); }
        button.m-signout {
          background: none; border: none; border-bottom: 1px solid rgba(255,255,255,.05);
          cursor: pointer; text-align: left; width: 100%;
        }
        .nav-mobile .m-section-label {
          font-size: 9px; font-weight: 700; letter-spacing: .18em;
          color: rgba(201,168,76,.4); margin: 24px 0 4px; text-transform: uppercase;
        }
        .nav-mobile .m-cta {
          margin-top: 28px; padding: 16px 32px;
          background: var(--gold); color: var(--dark);
          font-size: 12px; font-weight: 700; letter-spacing: .14em;
          text-align: center; border-radius: var(--btn-radius); border: none;
          text-decoration: none; display: block;
        }
        @media (max-width: 900px) {
          .nav-links { display: none; }
          .nav-burger { display: flex; }
        }
      `}</style>

      {dropOpen && (
        <div onClick={() => setDropOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 199 }} aria-hidden="true" />
      )}

      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', display: 'flex', zIndex: 201, pointerEvents: 'none' }}>
        {[['#1D9E75',20],['#378ADD',25],['#7F77DD',25],['#BA7517',20],['#D85A30',10]].map(([color, pct], i) => (
          <div key={i} style={{ flex: pct, background: color, opacity: 0.85 }} />
        ))}
      </div>

      <nav className={`vi-nav${scrolled ? ' scrolled' : ''}`} style={{ top: '3px' }}>
        <Link href="/" className="nav-logo" aria-label="Valoria Institute home">
          <img src="/logo.png" alt="Valoria Institute" />
        </Link>

        <ul className="nav-links" role="list">
          <li className="nav-explore-wrap">
            <button className="nav-explore-btn" onClick={() => setDropOpen(d => !d)} aria-expanded={dropOpen} aria-haspopup="true">
              Explore
              <span className={`nav-explore-arrow${dropOpen ? ' open' : ''}`}>▾</span>
            </button>
            <div className={`nav-dropdown${dropOpen ? ' open' : ''}`} role="menu">
              <a href="/atb-connect" onClick={() => setDropOpen(false)}>ATB Connect — Find Talent</a>
              <a href="/spotlight" onClick={() => setDropOpen(false)}>ATB Spotlight — Book a Speaker</a>
              <a href="/facilitators" onClick={() => setDropOpen(false)}>ATB Develop — Commission Facilitators</a>
              <div className="nav-dropdown-divider" />
              <a href="/programmes" onClick={() => setDropOpen(false)}>Programmes</a>
            </div>
          </li>
          <li><Link href="/about-us" className="nav-link">About</Link></li>
          <li><Link href="/contact-us" className="nav-link">Contact</Link></li>
          {authChecked && (
            user ? (
              <>
                <li>
                  <Link href="/dashboard" className="nav-link">Dashboard</Link>
                </li>
                <li><button onClick={handleSignOut} className="nav-link-btn">Sign Out</button></li>
              </>
            ) : (
              <li><Link href="/login" className="nav-link">Sign In</Link></li>
            )
          )}
          <li>
            <a href={cta.href} className="nav-cta">
              {cta.label}
            </a>
          </li>
        </ul>

        <button className={`nav-burger${menuOpen ? ' open' : ''}`} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </button>
      </nav>

      <nav className={`nav-mobile${menuOpen ? ' open' : ''}`} aria-label="Mobile navigation">
        <div className="m-section-label">Marketplace</div>
        <Link href="/atb-connect" onClick={closeMenu}>ATB Connect — Find Talent</Link>
        <Link href="/spotlight" onClick={closeMenu}>ATB Spotlight — Book a Speaker</Link>
        <Link href="/facilitators" onClick={closeMenu}>ATB Develop — Facilitators</Link>
        <div className="m-section-label">Company</div>
        <Link href="/about-us" onClick={closeMenu}>About</Link>
        <Link href="/programmes" onClick={closeMenu}>Programmes</Link>
        <Link href="/contact-us" onClick={closeMenu}>Contact</Link>
        <div className="m-section-label">Account</div>
        {authChecked && (
          user ? (
            <>
              <Link href="/dashboard" onClick={closeMenu}>Dashboard</Link>
              <button className="m-signout" onClick={() => { closeMenu(); handleSignOut() }}>Sign Out</button>
            </>
          ) : (
            <Link href="/login" onClick={closeMenu}>Sign In</Link>
          )
        )}
        <a href={cta.href} className="m-cta" onClick={closeMenu}>
          {cta.label}
        </a>
      </nav>
    </>
  )
}
