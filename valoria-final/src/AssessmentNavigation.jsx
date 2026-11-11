import React from 'react';

const T = { parchment:'#F7F4EE', gold:'#C9A84C', faint:'rgba(247,244,238,.28)', dark:'#1A1A2E' };
const ALLOWED_SITE_ORIGINS = new Set([
  'https://valoriainstitute.com',
  'https://www.valoriainstitute.com',
  'https://staging.valoriainstitute.com',
  'https://valoria-staging-site.riverwayse.workers.dev',
]);
function getSiteUrl() {
  if (typeof window === 'undefined') return 'https://valoriainstitute.com';
  const host = window.location.hostname.toLowerCase();
  const environmentDefault =
    host === 'valoria-staging-assessment.riverwayse.workers.dev' ||
    host === 'valoria-staging-site.riverwayse.workers.dev' ||
    host === 'assessment-staging.valoriainstitute.com'
      ? 'https://valoria-staging-site.riverwayse.workers.dev'
      : host === 'staging.valoriainstitute.com'
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
  return ALLOWED_SITE_ORIGINS.has(environmentDefault) || environmentDefault.startsWith('https://') ? environmentDefault : 'https://valoriainstitute.com';
}
const LOGO_URL = `${getSiteUrl()}/logo.png`;

export default function AssessmentNavigation({ progress = null, label = 'VALU ASSESSMENT' }) {
  const siteUrl = getSiteUrl();
  return (
    <header style={styles.header} aria-label="Assessment navigation">
      <a className="assessment-skip-link" href="#main-content">Skip to assessment content</a>
      <div className="assessment-nav-inner" style={styles.inner}>
        <a href={`${siteUrl}/`} style={styles.brand} aria-label="Return to Valoria Institute homepage">
          <img src={LOGO_URL} alt="Valoria Institute" className="assessment-nav-logo" style={styles.logo} />
        </a>
        <div className="assessment-nav-center" style={styles.center} aria-live="polite">
          <span style={styles.label}>{label}</span>
          {progress != null && <span style={styles.progress}>{progress}%</span>}
        </div>
        <a className="assessment-nav-exit" href={`${siteUrl}/dashboard`} style={styles.exit} aria-label="Return to your Valoria dashboard">
          <span>RETURN TO DASHBOARD</span><span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  );
}

const styles = {
  header:{position:'sticky',top:0,zIndex:50,width:'100%',borderBottom:'1px solid rgba(201,168,76,.14)',background:'rgba(26,26,46,.94)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'},
  inner:{width:'100%',maxWidth:1180,minHeight:64,margin:'0 auto',padding:'0 20px',display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:18},
  brand:{display:'inline-flex',alignItems:'center',gap:9,width:'fit-content',color:T.parchment,textDecoration:'none'},
  logo:{height:40,width:'auto',display:'block',objectFit:'contain'},
  center:{display:'flex',alignItems:'center',justifyContent:'flex-start',gap:10,whiteSpace:'nowrap',textAlign:'left'},
  label:{fontSize:10,fontWeight:700,letterSpacing:'.16em',color:T.gold},
  progress:{fontSize:10,color:T.faint,letterSpacing:'.08em'},
  exit:{justifySelf:'end',display:'inline-flex',alignItems:'center',gap:7,minHeight:44,color:T.faint,textDecoration:'none',fontSize:9,fontWeight:600,letterSpacing:'.12em'},
};
