import React from 'react';

const STEPS = [
  { key: 'account', title: 'Account', detail: 'Account registered' },
  { key: 'taster', title: 'Taster', detail: 'A guided starting point' },
  { key: 'dashboard', title: 'Dashboard', detail: 'Your next step' },
  { key: 'full', title: 'Full VALU Index', detail: 'Your official result' },
];

export default function VALUAssessmentJourney({ stage = 'taster' }) {
  const normalizedStage = stage === 'registration' ? 'taster' : stage === 'account' ? 'dashboard' : stage;
  const statusLabel = stage === 'registration'
    ? 'ACCOUNT REGISTERED · TASTER NEXT'
    : stage === 'account'
      ? 'TASTER SAVED · READY FOR YOUR DASHBOARD'
      : stage === 'full'
        ? 'CONTINUE YOUR FULL VALU INDEX'
        : 'YOUR PROGRESS IS SAVED';
  const activeIndex = Math.max(0, STEPS.findIndex(step => step.key === normalizedStage));

  return (
    <section className="valu-journey" aria-label="VALU Index progress">
      <div className="valu-journey__heading">
        <span className="valu-journey__eyebrow">YOUR VALU INDEX JOURNEY</span>
        <span className="valu-journey__status" aria-live="polite">{statusLabel}</span>
      </div>
      <ol className="valu-journey__steps" aria-label="Journey stages">
        {STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          const stateClass = done ? 'is-complete' : active ? 'is-current' : 'is-upcoming';
          return (
            <li
              key={step.key}
              className={`valu-journey__step ${stateClass}`}
              aria-current={active ? 'step' : undefined}
            >
              <div className="valu-journey__track" aria-hidden="true">
                <span className="valu-journey__track-fill" />
              </div>
              <div className="valu-journey__step-label">
                {done && <span className="valu-journey__check" aria-hidden="true">✓</span>}
                <span>{step.title}</span>
              </div>
              <p className="valu-journey__detail">{step.detail}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
