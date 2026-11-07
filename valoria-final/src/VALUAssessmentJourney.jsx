import React from 'react';

const STEPS = [
  { key: 'registration', title: 'Register', detail: 'Your details are connected' },
  { key: 'taster', title: 'Taster', detail: 'A guided starting point' },
  { key: 'account', title: 'Account', detail: 'Secure your Valoria access' },
  { key: 'full', title: 'Assessment', detail: 'Continue when ready' },
];

export default function VALUAssessmentJourney({ stage = 'taster' }) {
  const statusLabel = stage === 'registration' ? 'REGISTER TO SAVE YOUR JOURNEY' : stage === 'account' ? 'YOUR TASTER IS SAVED' : stage === 'full' ? 'CONTINUE WHEN READY' : 'YOUR PROGRESS IS SAVED';
  const activeIndex = Math.max(0, STEPS.findIndex(step => step.key === stage));
  return (
    <section aria-label="VALU assessment progress" style={{ margin: '0 0 28px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:12 }}>
        <span style={{ color:'#C9A84C', fontSize:9, fontWeight:800, letterSpacing:'.16em' }}>YOUR VALU JOURNEY</span>
        <span style={{ color:'rgba(247,244,238,.48)', fontSize:10 }}>{statusLabel}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(88px,1fr))', gap:8 }}>
        {STEPS.map((step,index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <div key={step.key} aria-current={active ? 'step' : undefined} style={{ minWidth:0 }}>
              <div style={{ height:3, borderRadius:99, background:done || active ? '#C9A84C' : 'rgba(247,244,238,.12)' }} />
              <div style={{ display:'flex', alignItems:'baseline', gap:6, flexWrap:'wrap', marginTop:8 }}>
                {done && <span aria-hidden="true" style={{ color:'#C9A84C', fontSize:9, fontWeight:800 }}>✓</span>}
                <span style={{ color:active ? '#FAFAF7' : 'rgba(247,244,238,.58)', fontSize:9, fontWeight:800, letterSpacing:'.08em' }}>{step.title.toUpperCase()}</span>
              </div>
              <div style={{ color:'rgba(247,244,238,.4)', fontSize:9, marginTop:3 }}>{step.detail}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
