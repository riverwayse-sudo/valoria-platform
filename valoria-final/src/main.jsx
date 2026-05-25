import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ValoriaApp from './ValoriaPlatform'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ValoriaApp />
  </StrictMode>
)
