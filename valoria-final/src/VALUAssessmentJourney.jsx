import React from 'react';

const STEPS = [
  { key: 'taster', title: 'Taster', detail: '9 separate questions' },
  { key: 'account', title: 'Account', detail: 'Create & confirm' },
  { key: 'full', title: 'Full VALU Index', detail: '58 questions' },
];

export default function VALUAssessmentJourney({ stage = 'taster', currentQuestion }) {
  const activeIndex = Math.max(0, STEPS.findIndex(step => step.key === stage));
  return (
    <section aria-label="Separate VALU assessment stages" style={{ margin: '0 0 28px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:12 }}>
        <span style={{ color:'#C9A84C', fontSize:9, fontWeight:800, letterSpacing:'.16em' }}>VALU ASSESSMENT JOURNEY</span>
        <span style={{ color:'rgba(247,244,238,.48)', fontSize:10 }}>
          {Number.isInteger(currentQuestion) ? `QUESTION ${currentQuestion} OF ${stage === 'taster' ? 9 : 58}` : 'YOUR PROGRESS IS PRESERVED'}
        </span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8 }}>
        {STEPS.map((step,index) => {
          const done = index < activeIndex;
          const current = index === activeIndex;
          return <div key={step.key} aria-current={current ? 'step' : undefined} style={{ minWidth:0 }}>
            <div style={{ height:3, borderRadius:99, background:done || current ? '#C9A84C' : 'rgba(247,244,238,.12)' }} />
            <div style={{ display:'flex', gap:6, alignItems:'baseline', flexWrap:'wrap', marginTop:8 }}>
              <span style={{ color:done || current ? '#C9A84C' : 'rgba(247,244,238,.4)', fontSize:9, fontWeight:800 }}>{done ? '✓' : `0${index+1}`}</span>
              <span style={{ color:current ? '#FAFAF7' : 'rgba(247,244,238,.58)', fontSize:9, fontWeight:800, letterSpacing:'.08em' }}>{step.title.toUpperCase()}</span>
            </div>
            <div style={{ color:'rgba(247,244,238,.4)', fontSize:9, marginTop:3 }}>{step.detail}</div>
          </div>
        })}
      </div>
    </section>
  );
}
