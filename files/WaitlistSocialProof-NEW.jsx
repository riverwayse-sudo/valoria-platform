'use client'
import { useState, useEffect } from 'react'

const STYLES = `
  .wsp-toast {
    position: fixed;
    left: 20px;
    bottom: 20px;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(26,26,46,.96);
    border: 1px solid rgba(201,168,76,.25);
    border-radius: 10px;
    padding: 12px 16px;
    max-width: 300px;
    box-shadow: 0 12px 32px rgba(0,0,0,.4);
    font-family: var(--font, 'Raleway', sans-serif);
    opacity: 0;
    transform: translateY(12px);
    transition: opacity .5s ease, transform .5s ease;
    pointer-events: none;
  }
  .wsp-toast.wsp-visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
  .wsp-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #1D9E75;
    flex-shrink: 0; animation: wsp-pulse 2s infinite;
  }
  .wsp-toast-text { font-size: 12px; color: #F7F4EE; line-height: 1.4; }
  .wsp-toast-time { color: rgba(247,244,238,.35); font-size: 11px; margin-left: 4px; }
  @keyframes wsp-pulse {
    0%  { box-shadow: 0 0 0 0 rgba(29,158,117,.55); }
    70% { box-shadow: 0 0 0 6px rgba(29,158,117,0); }
    100%{ box-shadow: 0 0 0 0 rgba(29,158,117,0); }
  }
  .wsp-badge {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 10px; font-weight: 700; letter-spacing: .1em;
    color: rgba(201,168,76,.7); text-transform: uppercase;
    font-family: var(--font, 'Raleway', sans-serif);
  }
  @media (max-width: 640px) {
    .wsp-toast { left: 12px; right: 12px; max-width: none; bottom: 12px; }
  }
`

function timeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// Fetches real signup data once and keeps it fresh — never fabricates
// counts or names. If the endpoint returns nothing, both consumers below
// simply render nothing.
export function useWaitlistStats() {
  const [stats, setStats] = useState({ total: null, recent: [] })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/waitlist/stats')
        const data = await res.json()
        if (!cancelled) setStats(data)
      } catch {
        // stay silent — components just won't render
      }
    }
    load()
    const id = setInterval(load, 60000) // refresh every 60s
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return stats
}

// Floating rotating notification — "David just joined as a Professional · 2m ago".
// Cycles through the most recent real signups. Ticks its own "time ago" text
// every 30s so it keeps reading as live between refetches.
export function WaitlistSocialProofToast() {
  const { recent } = useWaitlistStats()
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!recent.length) return
    setVisible(false)
    const showDelay = setTimeout(() => setVisible(true), 400)
    const rotate = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % recent.length)
        setVisible(true)
      }, 400)
    }, 7000)
    return () => { clearTimeout(showDelay); clearInterval(rotate) }
  }, [recent.length])

  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  if (!recent.length) return null
  const entry = recent[index]

  return (
    <>
      <style>{STYLES}</style>
      <div className={`wsp-toast ${visible ? 'wsp-visible' : ''}`} role="status" aria-live="polite">
        <div className="wsp-dot" />
        <div className="wsp-toast-text">
          <strong>{entry.first_name}</strong> just joined as a {entry.interest_label}
          <span className="wsp-toast-time">{timeAgo(entry.created_at)}</span>
        </div>
      </div>
    </>
  )
}

// Compact inline stat for the countdown card footer — replaces a static
// tagline with a real, ticking number: "1,247 people on the waitlist".
export function WaitlistLiveCountBadge() {
  const { total } = useWaitlistStats()
  if (total === null) return null
  return (
    <>
      <style>{STYLES}</style>
      <div className="wsp-badge">
        <span className="wsp-dot" style={{ display: 'inline-block' }} />
        {total.toLocaleString()} people on the waitlist
      </div>
    </>
  )
}
