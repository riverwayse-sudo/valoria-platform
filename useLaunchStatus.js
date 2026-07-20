'use client'
import { useState, useEffect } from 'react'
import { isLaunched, LAUNCH_DATE } from './launchDate'

// Live-updating version of isLaunched() for client components.
//
// The pattern used elsewhere before this (`useEffect(() => setLaunched(
// isLaunched()), [])`) only checks once, at mount. That's fine for someone
// who loads the page fresh after launch — but anyone with a tab already
// open when LAUNCH_DATE passes keeps seeing pre-launch UI (waitlist CTAs,
// "Get Early Access" copy, the nag modal) until they manually refresh.
// That's exactly the expected case here: the gate is lifting mid-webinar,
// while a live audience is actively on the site.
//
// This schedules a one-shot flip for the exact moment, plus a 30s poll as
// a safety net in case the tab is backgrounded and the browser throttles
// setTimeout (common on mobile, and this is a mobile-heavy audience).
export function useLaunchStatus() {
  const [launched, setLaunched] = useState(isLaunched())

  useEffect(() => {
    if (launched) return
    const ms = LAUNCH_DATE.getTime() - Date.now()
    if (ms <= 0) { setLaunched(true); return }
    const timeout = setTimeout(() => setLaunched(true), Math.min(ms, 2147483647))
    const poll = setInterval(() => { if (isLaunched()) setLaunched(true) }, 30000)
    return () => { clearTimeout(timeout); clearInterval(poll) }
  }, [launched])

  return launched
}
