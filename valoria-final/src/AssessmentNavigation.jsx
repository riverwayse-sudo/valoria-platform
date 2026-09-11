import React from 'react';

const T = { dark:'#0F0F1A', parchment:'#F7F4EE', gold:'#C9A84C', faint:'rgba(247,244,238,.28)' };
const SITE_URL = 'https://valoriainstitute.com';

export default function AssessmentNavigation({ progress = null, label = 'VALU INDEX' }) {
  return (
    <header style={styles.header} aria-label="Assessment navigation">
      <div style={styles.inner}>
        <a href={`${SITE_URL}/`} style={styles.brand} aria-label="Return to Valoria Institute homepage">
          <span style={styles.mark}>V</span><span style={styles.wordmark}>VALORIA</span>
        </a>
        <div style={styles.center} aria-live="polite">
          <span style={styles.label}>{label}</span>
          {progress != null && <span style={styles.progress}>{progress}%</span>}
        </div>
        <a href={`${SITE_URL}/valu`} style={styles.exit} aria-label="Exit assessment and return to Valoria">
          <span>RETURN TO VALORIA</span><span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  );
}

const styles = {
  header:{position:'sticky',top:0,zIndex:50,width:'100%',borderBottom:'1px solid rgba(201,168,76,.14)',background:'rgba(15,15,26,.94)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'},
  inner:{width:'100%',maxWidth:1180,minHeight:64,margin:'0 auto',padding:'0 20px',display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:18},
  brand:{display:'inline-flex',alignItems:'center',gap:9,width:'fit-content',color:T.parchment,textDecoration:'none'},
  mark:{width:28,height:28,display:'inline-flex',alignItems:'center',justifyContent:'center',border:`1px solid ${T.gold}`,color:T.gold,fontSize:11,fontWeight:700,letterSpacing:'.04em'},
  wordmark:{fontSize:11,fontWeight:700,letterSpacing:'.16em'},
  center:{display:'flex',alignItems:'center',justifyContent:'center',gap:10,whiteSpace:'nowrap'},
  label:{fontSize:10,fontWeight:700,letterSpacing:'.16em',color:T.gold},
  progress:{fontSize:10,color:T.faint,letterSpacing:'.08em'},
  exit:{justifySelf:'end',display:'inline-flex',alignItems:'center',gap:7,minHeight:44,color:T.faint,textDecoration:'none',fontSize:9,fontWeight:600,letterSpacing:'.12em'},
};
