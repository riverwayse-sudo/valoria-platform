'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

const GOLD = '#C9A84C'
const DARK = '#0F0F1A'
const MID = '#1A1A2E'
const PARCH = '#F7F4EE'
const DIM = 'rgba(247,244,238,.5)'
const GLINE2 = 'rgba(201,168,76,.28)'

// useSearchParams() requires a Suspense boundary in the App Router, or the
// production build fails outright — this default export just supplies that
// boundary; the real component (and the useSearchParams call) lives below.
export default function FeedbackPage() {
  return (
    <Suspense fallback={null}>
      <FeedbackForm />
    </Suspense>
  )
}

function FeedbackForm() {
  const params = useSearchParams()
  const prefillEmail = params.get('email') || ''
  const prefillName = params.get('name') || ''

  const [attended, setAttended] = useState(null)
  const [rating, setRating] = useState(0)
  const [mostValuable, setMostValuable] = useState('')
  const [improvements, setImprovements] = useState('')
  const [recommend, setRecommend] = useState(null)
  const [name, setName] = useState(prefillName)
  const [email, setEmail] = useState(prefillEmail)
  const [status, setStatus] = useState('idle')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!rating) return
    setStatus('submitting')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attended,
          overall_rating: rating,
          most_valuable: mostValuable,
          improvements,
          would_recommend: recommend,
          name,
          email,
        }),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', background: MID,
    border: `1px solid ${GLINE2}`, color: PARCH, fontSize: 14,
    fontFamily: 'var(--font,Raleway,sans-serif)', outline: 'none',
  }

  const labelStyle = {
    fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
    textTransform: 'uppercase', color: 'rgba(201,168,76,.6)', marginBottom: 8, display: 'block',
  }

  if (status === 'done') {
    return (
      <>
        <Nav />
        <div style={{ minHeight: '100vh', background: DARK, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: 'var(--font,Raleway,sans-serif)', color: PARCH, padding: '0 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, color: GOLD }}>◈</div>
          <h1 style={{ fontSize: 24, fontWeight: 300 }}>Thank you</h1>
          <p style={{ fontSize: 14, color: DIM, maxWidth: 400, lineHeight: 1.7 }}>
            Your feedback helps us shape what Valoria Institute builds next.
          </p>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Nav />
      <div style={{ minHeight: '100vh', background: DARK, color: PARCH, fontFamily: 'var(--font,Raleway,sans-serif)', paddingTop: '110px', paddingBottom: 80 }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 clamp(20px,4vw,40px)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(201,168,76,.6)', letterSpacing: '.14em', marginBottom: 16 }}>WEBINAR FEEDBACK</div>
          <h1 style={{ fontFamily: 'var(--font,Raleway,sans-serif)', fontSize: 'clamp(26px,4vw,34px)', fontWeight: 200, lineHeight: 1.2, marginBottom: 12 }}>
            How was the <em style={{ fontStyle: 'italic', color: GOLD }}>session?</em>
          </h1>
          <p style={{ fontSize: 14, color: DIM, lineHeight: 1.7, marginBottom: 36 }}>
            Two minutes, and it goes straight to the team shaping what comes next.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={labelStyle}>Did you attend?</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[['live', 'Yes, live'], ['replay', 'Watched the replay'], ['no', "Couldn't make it"]].map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setAttended(val)}
                    style={{ padding: '10px 16px', borderRadius: 999, border: `1px solid ${attended === val ? GOLD : GLINE2}`, background: attended === val ? 'rgba(201,168,76,.1)' : 'transparent', color: attended === val ? GOLD : DIM, fontSize: 13, cursor: 'pointer' }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Overall rating</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setRating(n)}
                    style={{ width: 44, height: 44, borderRadius: 8, border: `1px solid ${n <= rating ? GOLD : GLINE2}`, background: n <= rating ? 'rgba(201,168,76,.14)' : 'transparent', color: n <= rating ? GOLD : DIM, fontSize: 18, cursor: 'pointer' }}>
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>What was most valuable?</label>
              <textarea value={mostValuable} onChange={e => setMostValuable(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Optional" />
            </div>

            <div>
              <label style={labelStyle}>What could we improve?</label>
              <textarea value={improvements} onChange={e => setImprovements(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Optional" />
            </div>

            <div>
              <label style={labelStyle}>Would you recommend Valoria Institute to a colleague?</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[[true, 'Yes'], [false, 'No']].map(([val, lbl]) => (
                  <button key={lbl} type="button" onClick={() => setRecommend(val)}
                    style={{ padding: '10px 20px', borderRadius: 6, border: `1px solid ${recommend === val ? GOLD : GLINE2}`, background: recommend === val ? 'rgba(201,168,76,.1)' : 'transparent', color: recommend === val ? GOLD : DIM, fontSize: 13, cursor: 'pointer' }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Name (optional)</label>
                <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email (optional)</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <button type="submit" disabled={!rating || status === 'submitting'}
              style={{ padding: '16px 24px', background: rating ? GOLD : GLINE2, color: DARK, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', border: 'none', cursor: rating ? 'pointer' : 'not-allowed', marginTop: 8 }}>
              {status === 'submitting' ? 'SENDING…' : 'SUBMIT FEEDBACK'}
            </button>

            {status === 'error' && (
              <p style={{ fontSize: 13, color: '#D85A30' }}>Something went wrong — please try again.</p>
            )}
          </form>
        </div>
      </div>
      <Footer />
    </>
  )
}
