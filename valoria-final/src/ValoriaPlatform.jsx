import React, { useCallback, useEffect, useState } from 'react';
import PRIMEAssessment from './PRIMEAssessment.jsx';
import {
  getAssessmentLock,
  resolveLockForIdentity,
  setAssessmentLock,
  computeFingerprint,
  fetchServerLock,
  BRAND,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from './assessmentLock.js';

// ── SHARED NAV COMPONENT ─────────────────────────────────────────────────
export function ValoriaNav({ minimal = false }) {
  const [scrolled, setScrolled] = React.useState(false);

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
    fontSize: 12,
    fontFamily: BRAND.FONT_UI,
    fontWeight: 400,
    color: 'rgba(247,244,238,0.45)',
    textDecoration: 'none',
    letterSpacing: '0.07em',
    padding: '8px 14px',
    transition: 'color 0.2s',
  };

  return (
    <>
      {/* PRIME cluster stripe */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, display: 'flex', zIndex: 200, pointerEvents: 'none' }}>
        {CLUSTER_STRIPE.map(([color, pct], i) => (
          <div key={i} style={{ flex: pct, background: color, opacity: 0.85 }} />
        ))}
      </div>

      {/* Nav bar */}
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
        <a href="https://valoriainstitute.com" aria-label="Valoria Institute — home" style={{ lineHeight: 0, flexShrink: 0 }}>
          <img src="/logo.png" alt="Valoria Institute" style={{ height: 40, width: 'auto', display: 'block' }} />
        </a>

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
            <a
              href="#begin"
              onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{
                marginLeft: 12,
                padding: '9px 20px',
                background: BRAND.GOLD,
                color: BRAND.DARK,
                fontFamily: BRAND.FONT_UI,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.14em',
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: 'clamp(24px,4vw,56px)',
          marginBottom: 'clamp(32px,4vw,52px)',
        }}>
          <div>
            <img src="/logo.png" alt="Valoria Institute" style={{ height: 56, width: 'auto', display: 'block', marginBottom: 14 }} />
            <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(247,244,238,0.35)', lineHeight: 1.7, maxWidth: 260, marginBottom: 12, fontFamily: BRAND.FONT_UI }}>
              The marketplace where African professionals rise. One assessed standard. Three ways to engage.
            </p>
            <div style={{ fontFamily: BRAND.FONT_UI, fontSize: 13, fontStyle: 'italic', fontWeight: 300, color: 'rgba(201,168,76,0.45)', letterSpacing: '0.06em' }}>
              Worth. Built.
            </div>
          </div>
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
          <div>
            <div style={colTitle}>Company</div>
            {[
              { label: 'About Us', href: 'https://valoriainstitute.com/about-us' },
              { label: 'Programmes', href: 'https://valoriainstitute.com/programmes' },
              { label: 'Contact', href: 'https://valoriainstitute.com/contact-us' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={colLink}
                onMouseEnter={e => e.currentTarget.style.color = BRAND.GOLD}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(247,244,238,0.4)'}
              >{label}</a>
            ))}
          </div>
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

// ── FETCH ASSESSMENT BY FINGERPRINT (shell-level) ─────────────────────────
// Used on mount to hydrate the lock record with full DB data including
// the ai_report field, so "View Previous Report" works immediately.
async function hydrateAssessmentFromDB(fingerprint) {
  if (!fingerprint) return null;
  try {
    const params = new URLSearchParams({
      identity_hash: `eq.${fingerprint}`,
      select: 'name,role,total_score,cluster_scores,skill_scores,ai_report,expires_at,completed_at',
      order: 'completed_at.desc',
      limit: '1',
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length) return null;
    return rows[0];
  } catch {
    return null;
  }
}

// ── PLATFORM SHELL ────────────────────────────────────────────────────────
export default function ValoriaPlatform() {
  const [assessmentLockRecord, setAssessmentLockRecord] = useState(null);
  const [assessmentPhase, setAssessmentPhase] = useState('idle');

  // On mount: restore any existing local lock.
  // FIX: also attempt to hydrate from DB using the stored fingerprint
  // so "View Previous Report" works without requiring name/role to be typed first.
  useEffect(() => {
    async function initLock() {
      const localLock = getAssessmentLock();
      if (!localLock?.fingerprint) return;

      // Start with local lock so the locked banner shows immediately
      setAssessmentLockRecord(localLock);

      // Then try to hydrate from DB to confirm the lock is still valid server-side
      // and to enrich the record with expiresAt from the DB row
      try {
        const serverLock = await fetchServerLock(localLock.fingerprint);
        if (serverLock) {
          // Merge: keep fingerprint from local, use server expiry
          const enriched = {
            fingerprint: localLock.fingerprint,
            expiresAt: serverLock.expiresAt,
            completedAt: serverLock.completedAt,
          };
          setAssessmentLock(enriched);
          setAssessmentLockRecord(enriched);
        }
      } catch {
        // DB unreachable — local lock is sufficient
      }
    }
    initLock();
  }, []);

  // Called by PRIMEAssessment whenever name+role are committed.
  const handleIdentityChange = useCallback(async (name, role) => {
    const record = await resolveLockForIdentity(name, role);
    setAssessmentLockRecord(record ?? null);
  }, []);

  // Called immediately on assessment completion (before email signup).
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
        paddingTop: 67px (3px stripe + 64px nav).
        PRIMEAssessment screens manage their own internal fixed headers.
        FIX: removed double logo — IntroScreen no longer renders logo since
        nav already shows it. The 67px offset handles all screens correctly.
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

      {!isAssessing && <ValoriaFooter />}
    </div>
  );
}
