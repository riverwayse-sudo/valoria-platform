import React from 'react';

const T = { parchment:'#F7F4EE', gold:'#C9A84C', faint:'rgba(247,244,238,.74)', dark:'#1A1A2E' };
const ALLOWED_SITE_HOSTS = ['valoriainstitute.com', 'www.valoriainstitute.com', 'staging.valoriainstitute.com'];
const IS_STAGING = import.meta.env.VITE_VALU_PREVIEW === '1';

function getSiteUrl() {
  if (typeof window !== 'undefined') {
    try {
      const configured = new URL(String(import.meta.env.VITE_VALU_SITE_ORIGIN || ''));
      if (configured.protocol === 'https:' && ALLOWED_SITE_HOSTS.includes(configured.hostname)) {
        window.sessionStorage.setItem('valu-site-origin', configured.origin);
        return configured.origin;
      }
      const requested = new URLSearchParams(window.location.search).get('site_origin');
      const parsed = new URL(requested || '');
      if (parsed.protocol === 'https:' && ALLOWED_SITE_HOSTS.includes(parsed.hostname)) {
        window.sessionStorage.setItem('valu-site-origin', parsed.origin);
        return parsed.origin;
      }
      const saved = new URL(window.sessionStorage.getItem('valu-site-origin') || '');
      if (saved.protocol === 'https:' && ALLOWED_SITE_HOSTS.includes(saved.hostname)) return saved.origin;
      if (window.location.hostname === 'staging.valoriainstitute.com') return window.location.origin;
    } catch {}
  }
  return 'https://valoriainstitute.com';
}
const LOGO_URL = 'https://valoriainstitute.com/logo.png';

export default function AssessmentNavigation({ progress = null, label = 'VALU INDEX' }) {
  const siteUrl = getSiteUrl();
  return (
    <>
      {IS_STAGING && <div role="status" aria-label="Staging environment notice" style={styles.previewNotice}>STAGING PREVIEW · NOT PRODUCTION</div>}
      <header style={styles.header} aria-label="Assessment navigation">
        <div className="assessment-nav-inner" style={styles.inner}>
          <a href={`${siteUrl}/`} style={styles.brand} aria-label="Return to Valoria Institute homepage">
            <img src={LOGO_URL} alt="Valoria Institute" className="assessment-nav-logo" style={styles.logo} />
          </a>
          <div className="assessment-nav-center" style={styles.center} aria-live="polite">
            <span style={styles.label}>{label}</span>
            {progress != null && <span style={styles.progress}>{progress}%</span>}
          </div>
          <a className="assessment-nav-exit" href={`${siteUrl}/dashboard`} style={styles.exit} aria-label="Return to dashboard">
            <span>RETURN TO DASHBOARD</span><span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
    </>
  );
}

const styles = {
  previewNotice:{background:'#C9A84C',color:'#1A1A2E',textAlign:'center',fontSize:9,fontWeight:800,letterSpacing:'.16em',padding:'6px 12px'},
  header:{position:'sticky',top:0,zIndex:50,width:'100%',borderBottom:'1px solid rgba(201,168,76,.14)',background:'rgba(26,26,46,.94)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'},
  inner:{width:'100%',maxWidth:1180,minHeight:64,margin:'0 auto',padding:'0 20px',display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:18},
  brand:{display:'inline-flex',alignItems:'center',gap:9,width:'fit-content',color:T.parchment,textDecoration:'none'},
  logo:{height:40,width:'auto',display:'block',objectFit:'contain'},
  center:{display:'flex',alignItems:'center',justifyContent:'center',gap:10,whiteSpace:'nowrap'},
  label:{fontSize:10,fontWeight:700,letterSpacing:'.16em',color:T.gold},
  progress:{fontSize:10,color:T.faint,letterSpacing:'.08em'},
  exit:{justifySelf:'end',display:'inline-flex',alignItems:'center',gap:7,minHeight:44,color:T.faint,textDecoration:'none',fontSize:9,fontWeight:600,letterSpacing:'.12em'},
};
