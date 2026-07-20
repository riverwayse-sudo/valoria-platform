import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import Reveal from '@/components/Reveal'
import { COLORS } from '@/lib/brand'
import '../pages.css'

export const metadata = {
  title: 'Commission Facilitators — Valoria Develop',
  description: 'Commission PRIME-certified facilitators to run development programmes for your teams. Every programme maps to the same five clusters your team\'s VALU Index is measured against.',
  keywords: ['commission facilitators Nigeria', 'corporate training Africa', 'PRIME certified trainers', 'team development Lagos', 'Valoria Develop', 'capability development Africa'],
  openGraph: {
    title: 'Commission Facilitators — Valoria Develop | Valoria Institute',
    description: 'PRIME-certified facilitators. Programmes mapped to the same clusters the VALU Index measures against.',
    url: 'https://valoriainstitute.com/facilitators',
  },
  alternates: { canonical: 'https://valoriainstitute.com/facilitators' },
}

const color = COLORS.teal

const HOW_IT_WORKS = [
  { step: '01', title: 'Tell us what you need.', body: 'Submit an enquiry through the platform or contact us directly. Tell us which cluster your team needs to close — Presence, Relationships, Intelligence, Mastery, or Enterprise — and the context: team size, delivery format, timeline.' },
  { step: '02', title: 'We match you with a certified facilitator.', body: 'Every facilitator in Valoria Develop is PRIME-certified and has taken the VALU Index themselves. We match based on the cluster you need, the facilitator\'s specialisation, and the commercial context.' },
  { step: '03', title: 'The programme runs against the standard.', body: 'Programmes are built directly on the PRIME framework — the same architecture the VALU Index measures against. So development closes the exact gaps the assessment surfaced, not generic training content.' },
  { step: '04', title: 'Measure movement on the same standard.', body: 'Teams can re-take the VALU Index after 90 days to see cluster score movement. Development that doesn\'t produce measurable shift is not development — it\'s content delivery.' },
]

const DIFF = [
  { label: 'Certified against PRIME', desc: 'Not just experienced trainers — facilitators who know the framework from the inside, because they\'ve been assessed against it themselves.' },
  { label: 'Mapped to your VALU gaps', desc: 'If your team\'s Intelligence cluster scores are pulling the total down, that\'s where the programme targets. Not a generic leadership module.' },
  { label: 'Measurable by design', desc: 'Because development and assessment run on the same framework, before-and-after VALU Index scores tell you what actually moved.' },
  { label: 'One team, or a full cohort', desc: 'Commission for a single senior team, a graduate cohort, or a multi-site org. The framework scales — the delivery doesn\'t change.' },
]

export default function FacilitatorsPage() {
  return (
    <>
      <Nav />
      <main id="main-content">

        {/* HERO */}
        <section className="page-hero">
          <div className="page-hero-inner">
            <div className="eyebrow"><div className="eyebrow-line" /><span className="eyebrow-text" style={{ color }}>03 &nbsp;&middot;&nbsp; FOR TRAINING BUYERS</span></div>
            <h1 className="page-title">Don&apos;t train on theory.<br /><em>Train on the framework.</em></h1>
            <p className="page-sub">
              Valoria Develop is the facilitator modality of the marketplace. Commission PRIME-certified facilitators to run development programmes built directly on the same five-cluster standard your team&apos;s VALU Index is measured against — so training closes real gaps, not hypothetical ones.
            </p>
            <div className="page-hero-actions">
              <a href="/contact-us" className="btn-gold">COMMISSION A PROGRAMME</a>
              <a href="/valoria-develop" className="btn-outline">BROWSE CERTIFIED FACILITATORS</a>
            </div>
          </div>
        </section>

        {/* THE PROBLEM WITH CORPORATE TRAINING */}
        <section className="page-section">
          <div className="page-section-inner two-col">
            <Reveal>
              <div className="eyebrow"><div className="eyebrow-line" /><span className="eyebrow-text">THE PROBLEM WITH MOST TRAINING</span></div>
              <h2 className="section-title">PRIME is the architecture.<br /><em>Facilitators are the delivery.</em></h2>
              <p style={{ color: 'var(--dim)', fontWeight: 300, lineHeight: 1.8, fontSize: '15px' }}>
                Most corporate training programmes fail the same way: they run on generic content, delivered by trainers who weren&apos;t assessed against the same standard being taught, and measured by attendance sheets rather than capability movement. Six weeks later, nothing has changed except the training budget.
              </p>
              <p style={{ color: 'var(--dim)', fontWeight: 300, lineHeight: 1.8, fontSize: '15px', marginTop: '16px' }}>
                Valoria-certified facilitators teach to the same five PRIME clusters the VALU Index measures your team against. Development closes the exact gaps the assessment surfaced. And because before-and-after scores run on the same framework, you can see what actually moved.
              </p>
            </Reveal>
            <Reveal>
              <ul className="checklist" role="list">
                {[
                  'Facilitators certified directly against the PRIME framework — assessed themselves',
                  'Programmes mapped to the same five clusters as the VALU Index',
                  'Commission for a single team or a full organisational cohort',
                  'Measure capability movement with before-and-after VALU Index scores',
                  'In-person, virtual, or hybrid delivery — confirmed at commissioning',
                ].map((t, i) => (
                  <li key={i}>
                    <span className="dot"><svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="page-section alt">
          <div className="page-section-inner">
            <Reveal>
              <div className="eyebrow" style={{ justifyContent: 'center' }}><div className="eyebrow-line" /><span className="eyebrow-text">HOW COMMISSIONING WORKS</span><div className="eyebrow-line" /></div>
              <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '40px' }}>From gap identification<br /><em>to measurable outcome.</em></h2>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {HOW_IT_WORKS.map(s => (
                <Reveal key={s.step}>
                  <div className="card-gold">
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.16em', color: 'rgba(29,158,117,.6)', marginBottom: '12px' }}>{s.step}</div>
                    <div className="cluster-name" style={{ marginBottom: '10px' }}>{s.title}</div>
                    <p className="cluster-desc">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* WHAT MAKES IT DIFFERENT */}
        <section className="page-section">
          <div className="page-section-inner two-col">
            <Reveal>
              <div className="eyebrow"><div className="eyebrow-line" /><span className="eyebrow-text">WHAT MAKES IT DIFFERENT</span></div>
              <h2 className="section-title">Not a training programme.<br /><em>A development system.</em></h2>
              <p style={{ color: 'var(--dim)', fontWeight: 300, lineHeight: 1.8, fontSize: '15px' }}>
                The difference between a training programme and a development system is measurement. Valoria Develop is built around the same five PRIME clusters the VALU Index runs on — so there is a measurable standard before, during, and after.
              </p>
            </Reveal>
            <Reveal>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {DIFF.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ width: '6px', height: '6px', background: color, borderRadius: '50%', flexShrink: 0, marginTop: '6px' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--parchment)', marginBottom: '6px' }}>{d.label}</div>
                      <p style={{ fontSize: '13px', color: 'var(--dim)', fontWeight: 300, lineHeight: 1.6, margin: 0 }}>{d.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="page-section alt cta-banner">
          <Reveal>
            <div className="eyebrow" style={{ justifyContent: 'center' }}><div className="eyebrow-line" /><span className="eyebrow-text">FOR TRAINING BUYERS</span><div className="eyebrow-line" /></div>
            <h2 className="section-title">Commission a programme<br /><em>against the standard.</em></h2>
            <p className="page-sub">Valoria Develop runs through a direct conversation for now — tell us the cluster, the team, and the context, and we&apos;ll match you with the right facilitator.</p>
            <div className="page-hero-actions" style={{ justifyContent: 'center' }}>
              <a href="/contact-us" className="btn-gold">COMMISSION A PROGRAMME</a>
              <a href="/programmes" className="btn-outline">SEE PROGRAMMES BY CLUSTER</a>
            </div>
          </Reveal>
        </section>

      </main>
      <Footer />
    </>
  )
}
