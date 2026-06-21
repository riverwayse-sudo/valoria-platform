import React, { useCallback, useEffect, useState } from 'react';
import PRIMEAssessment from './PRIMEAssessment.jsx';
import {
  getAssessmentLock,
  resolveLockForIdentity,
  setAssessmentLock,
  computeFingerprint,
  BRAND,
} from './assessmentLock.js';

// ── SHARED NAV COMPONENT ─────────────────────────────────────────────────
// Brand-aligned with valoriainstitute.com marketing site.
// PRIME stripe + logo image + 4-item nav + gold CTA.
export function ValoriaNav({ minimal = false }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const CLUSTER_STRIPE = [
    [BRAND.CLUSTER.P, 20],
    [BRAND.CLUSTER.R, 25],
    [BRAND.CLUSTER.I, 25],
    [BRAND.CLUSTER.M, 20],
    [BRAND.CLUSTER.E, 10],
  ];

  const navLinks = [
    { label: 'Marketplace', href: 'https://valoriainstitute.com/marketplace' },
    { label: 'PRIME Framework', href: 'https://valoriainstitute.com/prime' },
    { label: 'About', href: 'https://valoriainstitute.com/about-us' },
  ];

  const linkStyle = {
    fontSize: 11,
    fontFamily: BRAND.FONT_UI,
    fontWeight: 400,
    color: 'rgba(247,244,238,0.45)',
    textDecoration: 'none',
    letterSpacing: '0.08em',
    transition: 'color 0.2s',
  };

  return (
    <>
      {/* 60/30/10 rule:
          60% — dark background (#0F0F1A / #1A1A2E) — dominant
          30% — parchment text (#F7F4EE) — secondary
          10% — gold (#C9A84C) and cluster colours — accent only */}

      {/* PRIME cluster stripe — 3px, always at very top, 10% accent */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, display: 'flex', zIndex: 200, pointerEvents: 'none' }}>
        {CLUSTER_STRIPE.map(([color, pct], i) => (
          <div key={i} style={{ flex: pct, background: color, opacity: 0.85 }} />
        ))}
      </div>

      {/* Nav bar — 60% background, glass effect on scroll */}
      <nav
        aria-label="Main navigation"
        style={{
          position: 'fixed', top: 3, left: 0, right: 0, height: 64,
          background: scrolled ? 'rgba(15,15,26,0.97)' : 'rgba(15,15,26,0.95)',
          borderBottom: `1px solid rgba(201,168,76,${scrolled ? 0.14 : 0.08})`,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 clamp(16px, 4vw, 48px)',
          zIndex: 199,
          transition: 'background 0.3s, border-color 0.3s',
        }}
      >
        {/* LOGO — real image, not wordmark */}
        <a href="https://valoriainstitute.com" aria-label="Valoria Institute — home" style={{ lineHeight: 0, flexShrink: 0 }}>
          <img src="/logo.png" alt="Valoria Institute" style={{ height: 48, width: 'auto', display: 'block' }} />
        </a>

        {/* Desktop nav links — hidden during assessment */}
        {!minimal && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {navLinks.map(({ label, href }) => (
              <a key={href} href={href} style={linkStyle}
                onMouseEnter={e => e.currentTarget.style.color = BRAND.PARCHMENT}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(247,244,238,0.45)'}
              >
                {label}
              </a>
            ))}
            <a
              href="https://valoriainstitute.com/dashboard"
              style={linkStyle}
              onMouseEnter={e => e.currentTarget.style.color = BRAND.PARCHMENT}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(247,244,238,0.45)'}
            >
              Dashboard
            </a>

            {/* Primary CTA — gold, 10% accent, always dominant */}
            <a
              href="#begin"
              onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{
                marginLeft: 12,
                padding: '9px 20px',
                background: BRAND.GOLD,
                color: BRAND.DARK,
                fontFamily: BRAND.FONT_UI,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                borderRadius: BRAND.RADIUS_PILL,
                textDecoration: 'none',
                transition: 'opacity 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              TAKE THE VALU INDEX
            </a>
          </div>
        )}

        {/* Assessment-in-progress label */}
        {minimal && (
          <div style={{ fontSize: 10, color: 'rgba(201,168,76,0.5)', letterSpacing: '0.18em', fontFamily: BRAND.FONT_UI }}>
            VALU INDEX · IN PROGRESS
          </div>
        )}
      </nav>
    </>
  );
}

// ── SHARED FOOTER COMPONENT ───────────────────────────────────────────────
// Brand-aligned with valoriainstitute.com. 60/30/10 colour rule applied.
export function ValoriaFooter() {
  const colTitle = {
    fontSize: 9, fontWeight: 700, color: 'rgba(201,168,76,0.5)',
    letterSpacing: '0.2em', marginBottom: 14, fontFamily: BRAND.FONT_UI,
    textTransform: 'uppercase',
  };
  const colLink = {
    fontSize: 13, fontWeight: 300, color: 'rgba(247,244,238,0.4)',
    textDecoration: 'none', letterSpacing: '0.02em', fontFamily: BRAND.FONT_UI,
    display: 'block', marginBottom: 10, transition: 'color 0.2s',
  };

  return (
    <footer
      role="contentinfo"
      style={{
        background: BRAND.MID,
        borderTop: '1px solid rgba(201,168,76,0.12)',
        padding: 'clamp(48px,6vw,80px) clamp(16px,4vw,48px) 32px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* 4-column grid — matches marketing site footer */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: 'clamp(24px,4vw,56px)',
          marginBottom: 'clamp(32px,4vw,52px)',
        }}>

          {/* COL 1 — brand (60% dark, logo image) */}
          <div>
            <img src="/logo.png" alt="Valoria Institute" style={{ height: 56, width: 'auto', display: 'block', marginBottom: 14 }} />
            <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(247,244,238,0.35)', lineHeight: 1.7, maxWidth: 260, marginBottom: 12, fontFamily: BRAND.FONT_UI }}>
              The marketplace where African professionals rise. One assessed standard. Three ways to engage.
            </p>
            {/* Tagline — 30% secondary text */}
            <div style={{ fontFamily: BRAND.FONT_DISPLAY, fontSize: 15, fontStyle: 'italic', fontWeight: 300, color: 'rgba(201,168,76,0.45)', letterSpacing: '0.06em' }}>
              Worth. Built.
            </div>
          </div>

          {/* COL 2 — Platform links */}
          <div>
            <div style={colTitle}>Platform</div>
            {[
              { label: 'VALU Index', href: '#' },
              { label: 'Marketplace', href: 'https://valoriainstitute.com/marketplace' },
              { label: 'PRIME Framework', href: 'https://valoriainstitute.com/prime' },
              { label: 'ATB Connect', href: 'https://valoriainstitute.com/atb-connect' },
              { label: 'ATB Spotlight', href: 'https://valoriainstitute.com/spotlight' },
              { label: 'Facilitators', href: 'https://valoriainstitute.com/facilitators' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={colLink}
                onMouseEnter={e => e.currentTarget.style.color = BRAND.GOLD}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(247,244,238,0.4)'}
              >{label}</a>
            ))}
          </div>

          {/* COL 3 — Company links */}
          <div>
            <div style={colTitle}>Company</div>
            {[
              { label: 'About Us', href: 'https://valoriainstitute.com/about-us' },
              { label: 'Programmes', href: 'https://valoriainstitute.com/programmes' },
              { label: 'Contact', href: 'https://valoriainstitute.com/contact-us' },
              { label: 'Founding Cohort', href: 'https://valoriainstitute.com/waitlist' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={colLink}
                onMouseEnter={e => e.currentTarget.style.color = BRAND.GOLD}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(247,244,238,0.4)'}
              >{label}</a>
            ))}
          </div>

          {/* COL 4 — Legal + get started (10% gold accent) */}
          <div>
            <div style={colTitle}>Legal</div>
            {[
              { label: 'Privacy Policy', href: 'https://valoriainstitute.com/privacypolicy' },
              { label: 'Terms of Use', href: 'https://valoriainstitute.com/terms-of-use' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={colLink}
                onMouseEnter={e => e.currentTarget.style.color = BRAND.GOLD}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(247,244,238,0.4)'}
              >{label}</a>
            ))}
            <div style={{ ...colTitle, marginTop: 28 }}>Get Started</div>
            {/* 10% accent — gold CTA */}
            <a href="#" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{ ...colLink, color: BRAND.GOLD, fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.color = BRAND.PARCHMENT}
              onMouseLeave={e => e.currentTarget.style.color = BRAND.GOLD}
            >
              Take the VALU Index →
            </a>
            <a href="https://valoriainstitute.com/signup" style={colLink}
              onMouseEnter={e => e.currentTarget.style.color = BRAND.GOLD}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(247,244,238,0.4)'}
            >
              Create Account
            </a>
            <a href="https://valoriainstitute.com/login" style={colLink}
              onMouseEnter={e => e.currentTarget.style.color = BRAND.GOLD}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(247,244,238,0.4)'}
            >
              Sign In
            </a>
          </div>
        </div>

        {/* Bottom bar — 30% secondary */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12, paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          fontSize: 11, fontWeight: 300, color: 'rgba(247,244,238,0.2)',
          letterSpacing: '0.04em', fontFamily: BRAND.FONT_UI,
        }}>
          <span>© {new Date().getFullYear()} African Talent Bureau Ltd · Valoria Institute · Lagos, Nigeria</span>
          <span>VALU Index v4.0 · PRIME Framework</span>
          <span>NDPA 2023 Compliant</span>
          <a href={`mailto:${BRAND.EMAIL}`} style={{ color: 'rgba(247,244,238,0.2)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(201,168,76,0.6)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(247,244,238,0.2)'}
          >{BRAND.EMAIL}</a>
        </div>
      </div>
    </footer>
  );
}

// ── PLATFORM SHELL ────────────────────────────────────────────────────────
// Owns the lock state and passes it into PRIMEAssessment.
// Nav and Footer are rendered here so they frame every screen consistently.
export default function ValoriaPlatform() {
  const [assessmentLockRecord, setAssessmentLockRecord] = useState(null);
  const [assessmentPhase, setAssessmentPhase] = useState('idle');

  // On mount: restore any existing local lock so the intro screen
  // correctly shows the locked banner before identity is typed.
  useEffect(() => {
    const lock = getAssessmentLock();
    if (lock) setAssessmentLockRecord(lock);
  }, []);

  // Called by PRIMEAssessment whenever name+role are committed.
  // Resolves server lock first, falls back to local.
  const handleIdentityChange = useCallback(async (name, role) => {
    const record = await resolveLockForIdentity(name, role);
    setAssessmentLockRecord(record ?? null);
  }, []);

  // Called immediately on assessment completion (before email signup).
  // Writes the lock locally so the next page load is gated.
  function persistLock(results) {
    const fingerprint = computeFingerprint(results.name, results.role);
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const record = {
      fingerprint,
      expiresAt: expiresAt.toISOString(),
      completedAt: results.completedAt || new Date().toISOString(),
    };
    setAssessmentLock(record);
    setAssessmentLockRecord(record);
  }

  // Minimal nav (no links) while the question sequence is active.
  const isAssessing = assessmentPhase === 'assessing';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BRAND.DARK,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ValoriaNav minimal={isAssessing} />

      {/*
        Top padding: 3px stripe + 64px nav = 67px.
        PRIMEAssessment screens have their own internal top-padding for
        the fixed assessment nav bar, so we only apply this offset on
        screens that don't have their own fixed header.
      */}
      <main
        role="main"
        style={{
          flex: 1,
          paddingTop: 67,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PRIMEAssessment
          onIdentityChange={handleIdentityChange}
          onAssessmentSubmitted={persistLock}
          onComplete={persistLock}
          assessmentLockRecord={assessmentLockRecord}
          onPhaseChange={setAssessmentPhase}
        />
      </main>

      {/* Footer hidden during the active question sequence */}
      {!isAssessing && <ValoriaFooter />}
    </div>
  );
}
