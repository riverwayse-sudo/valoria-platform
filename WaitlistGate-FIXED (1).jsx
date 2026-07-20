'use client'
import { useState, useEffect } from 'react'
import WaitlistModal from './WaitlistModal'
import { useLaunchStatus } from '@/lib/useLaunchStatus'

const GATE_KEY = 'vi_waitlist_gate_v2'
const COOKIE_KEY = 'vi_waitlist_v2'

export default function WaitlistGate() {
  const [visible, setVisible] = useState(false)
  const launched = useLaunchStatus()

  useEffect(() => {
    // Previously had no launch check at all — every new visitor without
    // the cookie would still get nagged to "join the waitlist" after
    // launch, even though the real site is live and that's no longer
    // the right ask. `launched` is live (see useLaunchStatus), so this
    // also correctly cancels the popup if it fires just before the gate
    // lifts.
    if (launched) { setVisible(false); return }
    const inLocal = localStorage.getItem(GATE_KEY)
    const inCookie = document.cookie.includes(COOKIE_KEY)
    if (!inLocal && !inCookie) {
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [launched])

  return <WaitlistModal open={visible} onClose={null} source="site_gate" />
}
