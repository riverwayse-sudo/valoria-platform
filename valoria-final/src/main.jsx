import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import VALUIndexV4App from './VALUIndexV4App.jsx'
import AssessmentNavigation from './AssessmentNavigation.jsx'
import './assessment.css'

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
