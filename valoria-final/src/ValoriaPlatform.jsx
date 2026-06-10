import { useCallback, useEffect, useState } from 'react';
import PRIMEAssessment from './PRIMEAssessment.jsx';
import {
  getAssessmentLock,
  resolveLockForIdentity,
  setAssessmentLock,
  computeFingerprint,
  BRAND,
} from './assessmentLock.js';

// ── SHARED NAV COMPONENT ─────────────────────────────────────────────────
// Locked per VI-WDS-2026-001. Do not alter colours, fonts, or structure.
// The nav is always transparent-over-dark, sticky, with the PRIME stripe above it.
export function ValoriaNav({ minimal = false }) {
  return (
    <>
      {/* PRIME cluster stripe — 3px, always at very top */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          display: 'flex',
          zIndex: 100,
          pointerEvents: 'none',
        }}
      >
        {[
          [BRAND.CLUSTER.P, 20],
          [BRAND.CLUSTER.R, 25],
          [BRAND.CLUSTER.I, 25],
          [BRAND.CLUSTER.M, 20],
          [BRAND.CLUSTER.E, 10],
        ].map(([color, pct], i) => (
          <div key={i} style={{ flex: pct, background: color, opacity: 0.9 }} />
        ))}
      </div>

      {/* Main nav bar */}
      <nav
        role="banner"
        style={{
          position: 'fixed',
          top: 3,          // sits below the cluster stripe
          left: 0,
          right: 0,
          height: 56,
          background: 'rgba(26,26,46,0.97)',
          borderBottom: '1px solid rgba(201,168,76,0.1)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(16px, 4vw, 48px)',
          zIndex: 99,
        }}
      >
        {/* Wordmark */}
        <a
          href="https://valoriainstitute.com"
          aria-label="Valoria Institute — home"
          style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <span
            style={{
              fontFamily: BRAND.FONT_DISPLAY,
              fontSize: 20,
              fontWeight: 600,
              color: BRAND.GOLD,
              letterSpacing: '0.2em',
              lineHeight: 1,
            }}
          >
            VALORIA
          </span>
          <span
            style={{
              fontSize: 8,
              color: 'rgba(201,168,76,0.4)',
              letterSpacing: '0.3em',
              fontFamily: BRAND.FONT_BODY,
              fontWeight: 400,
            }}
          >
            INSTITUTE
          </span>
        </a>

        {/* Nav items — hidden in minimal mode (assessment in progress) */}
        {!minimal && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a
              href="https://valoriainstitute.com"
              style={{
                fontSize: 11,
                color: 'rgba(247,244,238,0.4)',
                textDecoration: 'none',
                letterSpacing: '0.1em',
                fontFamily: BRAND.FONT_BODY,
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = BRAND.PARCHMENT)}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(247,244,238,0.4)')}
            >
              ABOUT
            </a>
            <a
              href={`mailto:${BRAND.EMAIL}`}
              style={{
                fontSize: 11,
                color: 'rgba(247,244,238,0.4)',
                textDecoration: 'none',
                letterSpacing: '0.1em',
                fontFamily: BRAND.FONT_BODY,
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = BRAND.PARCHMENT)}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(247,244,238,0.4)')}
            >
              CONTACT
            </a>
          </div>
        )}

        {/* Assessment label — only in minimal mode */}
        {minimal && (
          <div
            style={{
              fontSize: 10,
              color: 'rgba(201,168,76,0.5)',
              letterSpacing: '0.18em',
              fontFamily: BRAND.FONT_BODY,
            }}
          >
            VALU INDEX ASSESSMENT
          </div>
        )}
      </nav>
    </>
  );
}

// ── SHARED FOOTER COMPONENT ───────────────────────────────────────────────
// Locked per VI-WDS-2026-001.
export function ValoriaFooter() {
  return (
    <footer
      role="contentinfo"
      style={{
        borderTop: '1px solid rgba(201,168,76,0.08)',
        padding: 'clamp(24px, 4vw, 40px) clamp(16px, 4vw, 48px)',
        background: BRAND.DARK,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Brand */}
        <div>
          <div
            style={{
              fontFamily: BRAND.FONT_DISPLAY,
              fontSize: 16,
              fontWeight: 600,
              color: BRAND.GOLD,
              letterSpacing: '0.2em',
              lineHeight: 1,
              marginBottom: 3,
            }}
          >
            VALORIA
          </div>
          <div
            style={{
              fontSize: 8,
              color: 'rgba(201,168,76,0.35)',
              letterSpacing: '0.3em',
              fontFamily: BRAND.FONT_BODY,
            }}
          >
            INSTITUTE
          </div>
        </div>

        {/* Centre — brand essence + framework note */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(247,244,238,0.2)',
              letterSpacing: '0.18em',
              fontFamily: BRAND.FONT_BODY,
              marginBottom: 4,
            }}
          >
            WORTH. BUILT.
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(247,244,238,0.12)',
              letterSpacing: '0.08em',
              fontFamily: BRAND.FONT_MONO,
            }}
          >
            VALU INDEX v4.0 · PRIME FRAMEWORK · © {new Date().getFullYear()}
          </div>
        </div>

        {/* Right — links */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'valoriainstitute.com', href: 'https://valoriainstitute.com' },
            { label: BRAND.EMAIL, href: `mailto:${BRAND.EMAIL}` },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              style={{
                fontSize: 10,
                color: 'rgba(247,244,238,0.2)',
                textDecoration: 'none',
                letterSpacing: '0.08em',
                fontFamily: BRAND.FONT_BODY,
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(201,168,76,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(247,244,238,0.2)')}
            >
              {label}
            </a>
          ))}
          <div
            style={{
              fontSize: 9,
              color: 'rgba(247,244,238,0.12)',
              letterSpacing: '0.06em',
              fontFamily: BRAND.FONT_BODY,
            }}
          >
            NDPA 2023 compliant
          </div>
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
  const [assessmentPhase, setAssessmentPhase] = useState('idle'); // idle | assessing | results | generating

  useEffect(() => {
    const lock = getAssessmentLock();
    if (lock) setAssessmentLockRecord(lock);
  }, []);

  const handleIdentityChange = useCallback(async (name, role) => {
    const record = await resolveLockForIdentity(name, role);
    setAssessmentLockRecord(record);
  }, []);

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

  // Minimal nav (no links) while assessment is in progress
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
        Top padding accounts for the fixed cluster stripe (3px) + fixed nav (56px).
        The assessment component has its own internal padding, but the
        intro and results screens need the offset here.
      */}
      <main
        role="main"
        style={{
          flex: 1,
          paddingTop: 59, // 3px stripe + 56px nav
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

      {/* Footer is hidden during the active question sequence */}
      {!isAssessing && <ValoriaFooter />}
    </div>
  );
}
