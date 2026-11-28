import React from 'react';

const ALLOWED_SITE_ORIGINS = new Set([
  'https://valoriainstitute.com',
  'https://www.valoriainstitute.com',
  'https://staging.valoriainstitute.com',
]);

function getSiteUrl() {
  if (typeof window === 'undefined') return 'https://valoriainstitute.com';
  const host = window.location.hostname.toLowerCase();
  const environmentDefault =
    host === 'assessment-staging.valoriainstitute.com' || host === 'staging.valoriainstitute.com'
      ? 'https://staging.valoriainstitute.com'
      : host === 'assessment.valoriainstitute.com' || host === 'valoriainstitute.com' || host === 'www.valoriainstitute.com'
        ? 'https://valoriainstitute.com'
        : window.location.origin;
  try {
    const requested = new URLSearchParams(window.location.search).get('site_origin');
    const parsed = new URL(requested || '');
    if (parsed.protocol === 'https:' && ALLOWED_SITE_ORIGINS.has(parsed.origin)) {
      window.sessionStorage.setItem('valu-site-origin', parsed.origin);
      return parsed.origin;
    }
  } catch {}
  try {
    const saved = new URL(window.sessionStorage.getItem('valu-site-origin') || '');
    if (saved.protocol === 'https:' && ALLOWED_SITE_ORIGINS.has(saved.origin)) return saved.origin;
  } catch {}
  const localDevelopment = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(host);
  return localDevelopment || ALLOWED_SITE_ORIGINS.has(environmentDefault) ? environmentDefault : 'https://valoriainstitute.com';
}

const LOGO_URL = typeof window === 'undefined' ? '/logo.png' : `${getSiteUrl()}/logo.png`;

export default function AssessmentNavigation({ progress = null, label = 'VALU INDEX' }) {
  const siteUrl = getSiteUrl();
  return (
    <header className="assessment-nav" aria-label="Assessment navigation">
      <a className="assessment-skip-link" href="#main-content">Skip to assessment content</a>
      <div className="assessment-nav-inner">
        <a className="assessment-nav-brand" href={`${siteUrl}/`} aria-label="Return to Valoria Institute homepage">
          <img src={LOGO_URL} alt="Valoria Institute" className="assessment-nav-logo" />
        </a>
        <div className="assessment-nav-center" aria-live="polite">
          <span className="assessment-nav-label">{label}</span>
          {progress != null && <span className="assessment-nav-progress">{progress}%</span>}
        </div>
        <a className="assessment-nav-exit" href={`${siteUrl}/dashboard`} aria-label="Return to dashboard">
          <span>RETURN TO DASHBOARD</span><span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  );
}
