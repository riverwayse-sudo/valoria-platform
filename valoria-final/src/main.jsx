import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import VALUIndexV4App from './VALUIndexV4App.jsx'
import AssessmentNavigation from './AssessmentNavigation.jsx'
import './assessment.css'

const isPreview = import.meta.env.VITE_VALU_PREVIEW === '1'

function loadProductionAnalytics() {
  if (!import.meta.env.PROD || isPreview) return

  const measurementId = 'G-63M4SRXQKM'
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', measurementId)
}

loadProductionAnalytics()

function AssessmentShell() {
  return (
    <div className={isPreview ? 'valu-staging-editorial' : undefined}>
      {isPreview && (
        <div className="staging-site-banner" role="status" aria-live="polite">
          STAGING PREVIEW · This environment is isolated from production.
        </div>
      )}
      <AssessmentNavigation />
      <VALUIndexV4App />
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AssessmentShell />
  </StrictMode>,
)
