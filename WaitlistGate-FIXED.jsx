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
    // Post-launch, the whole reason this modal exists — nagging a
    // pre-launch visitor to join the waitlist — no longer applies. It
    // previously had zero launch-awareness at all, so it would have kept
    // popping this at every single post-launch visitor, on a live site,
    // asking them to join a founding cohort that had already opened.
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
