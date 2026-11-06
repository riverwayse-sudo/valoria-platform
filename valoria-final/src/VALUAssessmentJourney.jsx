import React from 'react';

const STEPS = [
  { key: 'taster', title: 'Taster', detail: '9 questions' },
  { key: 'account', title: 'Account', detail: 'Confirm email' },
  { key: 'full', title: 'Full assessment', detail: '58 questions' },
];

export default function VALUAssessmentJourney({ stage = 'taster', currentQuestion }) {
  const activeIndex = Math.max(0, STEPS.findIndex(step => step.key === stage));
  const questionTotal = stage === 'taster' ? 9 : stage === 'full' ? 58 : null;
  return (
    <section aria-label="Valoria assessment journey" style={{ margin: '0 0 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: '#D4C9A8', fontSize: 9, fontWeight: 800, letterSpacing: '.16em' }}>TASTER → FORMAL ASSESSMENT</span>
        <span style={{ color: 'rgba(250,250,247,.48)', fontSize: 10 }}>
          {Number.isInteger(currentQuestion) && questionTotal ? `QUESTION ${currentQuestion} OF ${questionTotal}` : 'YOUR PROGRESS IS PRESERVED'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        {STEPS.map((step, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex;
          return (
            <div key={step.key} aria-current={active ? 'step' : undefined} style={{ minWidth: 0 }}>
              <div style={{ height: 3, borderRadius: 99, background: complete || active ? '#C9A84C' : 'rgba(250,250,247,.12)' }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ color: complete || active ? '#C9A84C' : 'rgba(250,250,247,.42)', fontSize: 9, fontWeight: 800, letterSpacing: '.08em' }}>{complete ? '✓' : `0${index + 1}`}</span>
                <span style={{ color: active ? '#FAFAF7' : 'rgba(250,250,247,.58)', fontSize: 9, fontWeight: 800, letterSpacing: '.08em' }}>{step.title.toUpperCase()}</span>
              </div>
              <div style={{ color: 'rgba(250,250,247,.4)', fontSize: 9, marginTop: 3 }}>{step.detail}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
