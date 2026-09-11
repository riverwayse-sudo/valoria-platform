import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import VALUIndexV4App from './VALUIndexV4App.jsx'
import ProductHomepageConceptV2 from './ProductHomepageConceptV2.jsx'

const brandStyles = document.createElement('style')
brandStyles.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Raleway:wght@200;300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing:border-box; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; -webkit-tap-highlight-color:transparent; }
  html, body, #root { margin:0; padding:0; min-height:100%; background:#1A1A2E; }
  body { font-family:'Raleway',sans-serif; color:#F7F4EE; overflow-x:hidden; }
  button,input,textarea,select { font-family:'Raleway',sans-serif; }
  ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(201,168,76,.25); border-radius:2px; }
  :focus-visible { outline:2px solid rgba(201,168,76,.5); outline-offset:2px; }
`
document.head.appendChild(brandStyles)

const conceptRoute = window.location.pathname.replace(/\/$/, '') === '/homepage-concept'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {conceptRoute ? <ProductHomepageConceptV2 /> : <VALUIndexV4App />}
  </StrictMode>,
)
