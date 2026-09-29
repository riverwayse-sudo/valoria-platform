import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import VALUIndexV4App from './VALUIndexV4App.jsx'
import AssessmentNavigation from './AssessmentNavigation.jsx'

// Global brand reset — applied before any component renders
const brandStyles = document.createElement('style')
brandStyles.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Raleway:wght@200;300;400;500;600;700&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-tap-highlight-color: transparent;
  }

  html, body, #root {
    margin: 0;
    padding: 0;
    min-height: 100%;
    background: #1A1A2E;
  }

  body {
    font-family: 'Raleway', sans-serif;
    color: #F7F4EE;
    overflow-x: hidden;
  }

  button, input, textarea, select {
    font-family: 'Raleway', sans-serif;
  }

  /* VALU answer surfaces are explicitly branded so browser/user-agent button
     defaults cannot turn them white or produce white-on-white text. */
  button.valu-option,
  button.valu-option:disabled,
  button.valu-option:hover,
  button.valu-option:active {
    appearance: none !important;
    -webkit-appearance: none !important;
    -moz-appearance: none !important;
    background: #2E2E4A !important;
    color: #FAFAF7 !important;
    border: 1px solid rgba(247,244,238,.12) !important;
    box-shadow: none !important;
  }

  button.valu-option:hover,
  button.valu-option:focus-visible {
    background: #363657 !important;
  }

  button.valu-option:disabled {
    cursor: default;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.25); border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(201,168,76,0.45); }

  :focus-visible {
    outline: 2px solid rgba(201,168,76,0.5);
    outline-offset: 2px;
  }

  .valu-path-rail { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .valu-start-panel { min-width: 0; }
  @media (max-width: 760px) {
    .valu-path-rail { grid-template-columns: 1fr; }
    .valu-path-rail > div { min-height: auto !important; }
    .valu-path-rail > div > div:last-child { display: none; }
    .valu-start-panel { align-items: flex-start !important; flex-direction: column !important; }
    .valu-start-panel > div:last-child { text-align: left !important; }
  }

  @media (max-width: 820px) {
    .valu-entry-grid { grid-template-columns: 1fr !important; gap: 28px !important; overflow:auto; padding-right:4px; }
    .valu-entry-intro { max-width: none !important; padding-top: 0 !important; }
    .valu-entry-form { max-width: none !important; }
    .valu-dimension-list { max-width: 620px !important; }
  }

  @media (max-width: 560px) {
    .valu-entry-grid { gap: 28px !important; }
    .valu-top-brand { margin-bottom: 36px !important; padding-bottom: 18px !important; }
    .valu-brand-version { display: none !important; }
    .valu-entry-intro h1 { font-size: 48px !important; }
    .valu-entry-form-card { padding: 22px 18px !important; }
    .valu-entry-form-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
  }

  @media (max-width: 640px) {
    .assessment-nav-inner { grid-template-columns: 1fr auto !important; min-height: 58px !important; }
    .assessment-nav-center { display: none !important; }
    .assessment-nav-wordmark { display: none !important; }
    .assessment-nav-exit span:first-child { font-size: 8px !important; }
  }
`
document.head.appendChild(brandStyles)

function AssessmentShell() {
  return (
    <>
      <AssessmentNavigation />
      <VALUIndexV4App />
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AssessmentShell />
  </StrictMode>,
)
