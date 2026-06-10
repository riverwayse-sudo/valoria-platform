import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ValoriaPlatform from './ValoriaPlatform.jsx'

// Global brand reset — applied before any component renders
const brandStyles = document.createElement('style')
brandStyles.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap');

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
    font-family: 'DM Sans', sans-serif;
    color: #F7F4EE;
    overflow-x: hidden;
  }

  /* Brand scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.25); border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(201,168,76,0.45); }

  /* Input reset — brand-compliant */
  input, textarea, select {
    font-family: 'DM Sans', sans-serif;
  }

  /* Focus ring — brand gold */
  :focus-visible {
    outline: 2px solid rgba(201,168,76,0.5);
    outline-offset: 2px;
  }
`
document.head.appendChild(brandStyles)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ValoriaPlatform />
  </StrictMode>,
)
