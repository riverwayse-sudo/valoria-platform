'use client'
import { useState, useEffect } from 'react'
import { isLaunched } from './launchDate'

// Shared across Nav.jsx, EntryPointsGrid.jsx, HeroSlider.jsx, and
// WaitlistGate.jsx so they all react to the same moment, without each
// component doing its own one-time check that only ever runs on mount.
// A visitor sitting on the page when launch happens (very plausible —
// launch is timed to the exact start of a live webinar people are
// actively watching) will see the site unlock live, no refresh needed.
export function useLaunchStatus() {
  const [launched, setLaunched] = useState(false)

  useEffect(() => {
    setLaunched(isLaunched())
    const id = setInterval(() => setLaunched(isLaunched()), 15000)
    return () => clearInterval(id)
  }, [])

  return launched
}
