'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const GOLD = '#C9A84C'
const MIDNIGHT = '#1A1A2E'
const PARCHMENT = '#F7F4EE'
const DARK = '#0F0F1A'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (loginError) throw loginError
      // Authenticated users must never be blocked by the waitlist gate.
      document.cookie = `vi_waitlist_v2=submitted; path=/; max-age=31536000`
      const { data: { user } } = await supabase.auth.getUser()

      // Buyers (employer/organiser) live in `profiles`, professionals in
      // `professional_profiles` — these are two entirely separate tables.
      // Checking only professional_profiles meant every buyer account (zero
      // rows there, always) got misrouted into the professional setup
      // wizard on every login after their first session.
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (buyerProfile) {
        window.location.href = '/dashboard'
        return
      }

      const { data: profile } = await supabase
        .from('professional_profiles')
        .select('id, display_name, listing_status, active_tracks')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile || !profile.display_name) {
        // First time — go to setup wizard
        window.location.href = '/profile/setup'
      } else {
        // Returning user — go to dashboard
        window.location.href = '/dashboard'
      }
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Try again, or reset your password below.'
          : (err.message || 'Something went wrong. Please try again.')
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    if (!form.email) { setError('Enter your email above first, then click "Forgot password."'); return }
    setResetting(true)
    setError('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : 'https://valoriainstitute.com/reset-password',
      })
      if (resetError) throw resetError
      setResetSent(true)
    } catch (err) {
      setError(err.message || 'Could not send reset email. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.eyebrow}>
          <div style={styles.eyebrowLine} />
          <span style={styles.eyebrowText}>SIGN IN</span>
          <div style={styles.eyebrowLine} />
        </div>

        <h1 style={styles.title}>
          Welcome<br /><em style={{ color: GOLD, fontStyle: 'italic' }}>back.</em>
        </h1>
        <p style={styles.sub}>Sign in to your Valoria Institute account.</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="Your password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              style={styles.input}
            />
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}
          {resetSent && (
            <div style={styles.successBox}>
              Check your email for a password reset link.
            </div>
          )}

          <button type="submit" disabled={loading} style={{ ...styles.btnGold, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>

          <button type="button" onClick={handleReset} disabled={resetting} style={styles.forgotBtn}>
            {resetting ? 'Sending reset link...' : 'Forgot password?'}
          </button>
        </form>

        <div style={{ marginTop: '24px', fontSize: '13px', color: 'rgba(247,244,238,.4)', textAlign: 'center', lineHeight: 1.8 }}>
          <p style={{ margin: '0 0 4px' }}>
            Employer or organiser?{' '}
            <Link href="/signup" style={{ color: GOLD }}>Create account</Link>
          </p>
          <p style={{ margin: 0 }}>
            Talent or speaker?{' '}
            <a href="https://assessment.valoriainstitute.com/" target="_blank" rel="noopener noreferrer" style={{ color: GOLD }}>Take the VALU Index</a>
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: DARK,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    fontFamily: "'Raleway', 'Helvetica Neue', Arial, sans-serif",
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    background: 'rgba(26,26,46,.6)',
    border: '1px solid rgba(201,168,76,.15)',
    borderRadius: '12px',
    padding: 'clamp(32px, 5vw, 56px)',
  },
  eyebrow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' },
  eyebrowLine: { flex: 1, height: '1px', background: 'rgba(201,168,76,.3)' },
  eyebrowText: { fontSize: '10px', fontWeight: 700, letterSpacing: '.16em', color: GOLD },
  title: { fontSize: 'clamp(28px,4vw,42px)', fontWeight: 200, color: PARCHMENT, lineHeight: 1.1, marginBottom: '12px', letterSpacing: '-.02em' },
  sub: { fontSize: '14px', fontWeight: 300, color: 'rgba(247,244,238,.5)', marginBottom: '28px', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '11px', fontWeight: 700, letterSpacing: '.1em', color: 'rgba(247,244,238,.5)', textTransform: 'uppercase' },
  input: { padding: '12px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.2)', borderRadius: '6px', color: PARCHMENT, fontSize: '14px', fontFamily: "'Raleway', sans-serif", outline: 'none' },
  btnGold: { display: 'block', width: '100%', padding: '16px', background: GOLD, color: MIDNIGHT, fontSize: '12px', fontWeight: 700, letterSpacing: '.14em', borderRadius: '999px', border: 'none', cursor: 'pointer', textAlign: 'center', textDecoration: 'none', fontFamily: "'Raleway', sans-serif", marginTop: '8px' },
  forgotBtn: { background: 'none', border: 'none', color: 'rgba(247,244,238,.4)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textAlign: 'center', padding: '4px' },
  errorBox: { padding: '12px 14px', background: 'rgba(216,90,48,.12)', border: '1px solid rgba(216,90,48,.3)', borderRadius: '6px', fontSize: '13px', color: '#F09595' },
  successBox: { padding: '12px 14px', background: 'rgba(29,158,117,.12)', border: '1px solid rgba(29,158,117,.3)', borderRadius: '6px', fontSize: '13px', color: '#7FD9B8' },
  loginLink: { marginTop: '24px', fontSize: '13px', color: 'rgba(247,244,238,.4)', textAlign: 'center' },
}
