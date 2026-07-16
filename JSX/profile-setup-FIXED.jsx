'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const GOLD  = '#C9A84C'
const DARK  = '#0F0F1A'
const MID   = '#1A1A2E'
const PARCH = '#F7F4EE'
const DIM   = 'rgba(247,244,238,.5)'
const GLINE = 'rgba(201,168,76,.14)'

const PRIME_COLORS = { P:'#1D9E75', R:'#378ADD', I:'#7F77DD', M:'#BA7517', E:'#D85A30' }

const INDUSTRIES = ['Agriculture & Agritech','Architecture & Design','Consulting & Strategy','Education & EdTech','Energy & Sustainability','Entertainment & Media','Fashion & Beauty','Fintech & Banking','Government & Public Policy','Healthcare','Hospitality & Travel','Law','Logistics & Supply Chain','Manufacturing','Marketing & Advertising','Nonprofit & Development','Real Estate','Sports & Wellness','Technology & SaaS','Telecommunications']

const SKILLS_POOL = ['Strategy','Leadership','Public Speaking','Negotiation','Branding','Operations','Data Analysis','Fundraising','Policy Design','Product Management','Stakeholder Management','Storytelling','Market Research','Change Management','Innovation','Project Management','Financial Modelling','People Management','Business Development','Digital Marketing']

const TOPICS_POOL = ['Leadership & Management','Strategy & Innovation','Diversity & Inclusion','Finance & Investment','Technology & AI','Entrepreneurship','Sustainability','Future of Work','Communication','Governance','Mental Health at Work','Global Affairs','People Development','Brand & Marketing','Education Reform']

const PROGRAMME_TYPES = ['Leadership Development','Team Effectiveness','Strategic Thinking','DEI & Belonging','Communication Skills','Sales Enablement','Executive Coaching','Change Management','Culture & Values','Finance for Non-Finance']

const LANGUAGES = ['English','French','Swahili','Hausa','Yoruba','Igbo','Zulu','Amharic','Arabic','Portuguese','Wolof','Twi','Shona']

const CONTRACT_PREFS = [
  { value:'permanent',  label:'Permanent / full-time' },
  { value:'contract',   label:'Contract / freelance' },
  { value:'both',       label:'Open to both' },
]

const AVAILABILITY = [
  { value:'open',          label:'Open to opportunities' },
  { value:'contract_only', label:'Contract / project only' },
  { value:'not_available', label:'Not currently available' },
]

const MODALITY = ['In-person','Virtual','Hybrid','Open to relocation']

const FORMAT_CAPS = ['Keynote','Panel speaker','Workshop facilitator','Masterclass host','Conference MC','Fireside chat']

const AUDIENCE_SIZES = ['Under 50','50–200','200–500','500–1,000','1,000–5,000','5,000+']

const STEPS = ['Track','Profile','Expertise','Media','Terms','Review']

function getInitials(name) {
  if (!name) return '?'
  const w = name.trim().split(/\s+/)
  return w.length === 1 ? w[0].slice(0,2).toUpperCase() : (w[0][0] + w[w.length-1][0]).toUpperCase()
}

export default function ProfileSetupPage() {
  const router = useRouter()
  const [user, setUser]     = useState(null)
  const [step, setStep]     = useState(0)
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileRef = useRef(null)

  const [form, setForm] = useState({
    // Step 0 — Track
    active_tracks: [],
    // Step 1 — Profile
    display_name: '', headline: '', location: '', industry: '',
    years_experience: '', bio: '', languages: [],
    // Step 2 — Expertise
    skills: [], topics: [], facilitation_topics: [],
    programme_types: [], format_capabilities: [],
    audience_sizes: [], pcp_certified: false,
    work_history: [{ title:'', org:'', duration:'' }],
    past_events: [{ name:'', role:'' }],
    past_clients: [{ name:'', programme:'' }],
    certifications: '',
    // Step 3 — Media
    photo_url: '', youtube_links: [''],
    linkedin_url: '', website_url: '',
    // Step 4 — Terms
    availability: 'open', modality: [],
    contract_preference: 'both', notice_period: '',
    salary_expectation: '', fee_range: '',
    // Step 5 — Review
    consent: false,
  })

  const isCandidate   = form.active_tracks.includes('candidate')
  const isSpeaker     = form.active_tracks.includes('speaker')
  const isFacilitator = form.active_tracks.includes('facilitator')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Prefill from an existing row so this page also serves as "edit" —
      // previously it only ever started blank, even for someone who'd
      // already completed setup and just wanted to change one field.
      const { data: existing } = await supabase
        .from('professional_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (existing) {
        setForm(f => ({
          ...f,
          ...existing,
          // Array/object columns come back null from Postgres if never set —
          // fall back to the form's own empty defaults rather than passing
          // null into .includes()/.map() calls throughout the wizard.
          active_tracks:       existing.active_tracks || f.active_tracks,
          languages:           existing.languages || f.languages,
          skills:              existing.skills || f.skills,
          topics:              existing.topics || f.topics,
          facilitation_topics: existing.facilitation_topics || f.facilitation_topics,
          programme_types:     existing.programme_types || f.programme_types,
          format_capabilities: existing.format_capabilities || f.format_capabilities,
          audience_sizes:      existing.audience_sizes || f.audience_sizes,
          work_history:        existing.work_history?.length ? existing.work_history : f.work_history,
          past_events:         existing.past_events?.length ? existing.past_events : f.past_events,
          past_clients:        existing.past_clients?.length ? existing.past_clients : f.past_clients,
          youtube_links:       existing.youtube_links?.length ? existing.youtube_links : f.youtube_links,
          modality:            existing.modality || f.modality,
        }))
      } else if (user.user_metadata?.full_name) {
        setForm(f => ({ ...f, display_name: user.user_metadata.full_name }))
      }
    })
  }, [])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function toggleArr(key, val) {
    setForm(f => ({ ...f, [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val] }))
  }

  function updateListItem(key, idx, field, val) {
    setForm(f => {
      const arr = [...f[key]]
      arr[idx] = { ...arr[idx], [field]: val }
      return { ...f, [key]: arr }
    })
  }

  async function uploadPhoto(file) {
    if (!file || !user) return
    setPhotoUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `profiles/${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      set('photo_url', data.publicUrl)
    }
    setPhotoUploading(false)
  }

  async function saveProgress() {
    if (!user) return
    await supabase.from('professional_profiles').upsert({
      id: user.id,
      display_name:       form.display_name || null,
      headline:           form.headline || null,
      location:           form.location || null,
      industry:           form.industry || null,
      years_experience:   form.years_experience ? parseInt(form.years_experience) : null,
      bio:                form.bio || null,
      languages:          form.languages,
      active_tracks:      form.active_tracks,
      skills:             form.skills,
      topics:             form.topics,
      facilitation_topics: form.facilitation_topics,
      programme_types:    form.programme_types,
      format_capabilities: form.format_capabilities,
      audience_sizes:     form.audience_sizes,
      pcp_certified:      form.pcp_certified,
      work_history:       form.work_history.filter(w => w.title || w.org),
      past_events:        form.past_events.filter(e => e.name),
      past_clients:       form.past_clients.filter(c => c.name),
      certifications:     form.certifications || null,
      photo_url:          form.photo_url || null,
      youtube_links:      form.youtube_links.filter(Boolean),
      linkedin_url:       form.linkedin_url || null,
      website_url:        form.website_url || null,
      availability:       form.availability,
      modality:           form.modality,
      contract_preference: form.contract_preference,
      notice_period:      form.notice_period || null,
      salary_expectation: form.salary_expectation || null,
      fee_range:          form.fee_range || null,
      listing_status:     'pending',
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'id' })
  }

  async function handleNext() {
    setSaving(true); await saveProgress(); setSaving(false)
    setStep(s => s + 1); window.scrollTo(0, 0)
  }

  async function handleFinish() {
    setSaving(true); await saveProgress(); setSaving(false)
    router.push('/dashboard')
  }

  if (!user) return <div style={{ minHeight:'100vh', background:DARK, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font,Raleway,sans-serif)', color:DIM, fontSize:'13px' }}>Loading…</div>

  const tags        = isSpeaker ? form.topics : form.skills
  const allTags     = [...form.skills, ...form.topics, ...form.facilitation_topics]
  const videoLinks  = (form.youtube_links || []).filter(Boolean)

  return (
    <div style={{ minHeight:'100vh', background:DARK, color:PARCH, fontFamily:'var(--font,Raleway,sans-serif)' }}>
      {/* PRIME stripe */}
      <div style={{ height:'3px', display:'flex', position:'sticky', top:0, zIndex:200 }}>
        {Object.values(PRIME_COLORS).map((c,i) => <div key={i} style={{ flex:1, background:c, opacity:.85 }} />)}
      </div>

      {/* NAV */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 clamp(20px,4vw,40px)', height:'60px', background:MID, borderBottom:`1px solid ${GLINE}` }}>
        <Link href="/" style={{ lineHeight:0 }}><img src="/logo.png" alt="Valoria" style={{ height:'36px', width:'auto' }} /></Link>
        <div style={{ fontSize:'11px', fontWeight:700, letterSpacing:'.14em', color:'rgba(201,168,76,.5)' }}>PROFILE SETUP</div>
        <button onClick={async () => { await saveProgress(); router.push('/dashboard') }} style={{ fontSize:'11px', color:DIM, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', letterSpacing:'.06em' }}>SAVE &amp; EXIT</button>
      </header>

      {/* PROGRESS */}
      <div style={{ background:MID, borderBottom:`1px solid ${GLINE}`, padding:'0 clamp(20px,4vw,40px)' }}>
        <div style={{ maxWidth:'680px', margin:'0 auto', display:'flex', alignItems:'center', padding:'16px 0' }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', flex: i < STEPS.length-1 ? 1 : 'none' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                <div style={{ width:'28px', height:'28px', borderRadius:'50%', background: i < step ? GOLD : 'transparent', border: i < step ? 'none' : i === step ? `2px solid ${GOLD}` : '1px solid rgba(247,244,238,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:700, color: i < step ? DARK : i === step ? GOLD : 'rgba(247,244,238,.3)', flexShrink:0 }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.1em', color: i <= step ? GOLD : 'rgba(247,244,238,.25)', whiteSpace:'nowrap' }}>{label.toUpperCase()}</span>
              </div>
              {i < STEPS.length-1 && <div style={{ flex:1, height:'1px', background: i < step ? GOLD : GLINE, margin:'0 4px', marginBottom:'14px' }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:'680px', margin:'0 auto', padding:'clamp(32px,5vw,56px) clamp(20px,4vw,40px) 80px' }}>

        {/* ── STEP 0: TRACK ── */}
        {step === 0 && (
          <div>
            <Eyebrow>STEP 1 OF 6</Eyebrow>
            <h1 style={S.title}>How are you joining<br/><em style={{ fontStyle:'italic', color:GOLD }}>Valoria?</em></h1>
            <p style={S.sub}>Select all that apply. You can hold multiple tracks simultaneously — a speaker can also be a candidate.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'32px' }}>
              {[
                { id:'candidate',   label:'Candidate / Talent',   desc:'I want employers and recruiters to find me through ATB Connect.', color:'#378ADD' },
                { id:'speaker',     label:'Speaker',              desc:'I want to be booked for events and conferences through ATB Spotlight.', color:GOLD },
                { id:'facilitator', label:'Facilitator',          desc:'I want to be commissioned for L&D programmes through ATB Develop.', color:'#1D9E75' },
              ].map(t => {
                const active = form.active_tracks.includes(t.id)
                return (
                  <div key={t.id} onClick={() => toggleArr('active_tracks', t.id)}
                    style={{ padding:'20px', border:`1.5px solid ${active ? t.color : GLINE}`, cursor:'pointer', background: active ? `${t.color}0f` : `${MID}66`, transition:'all .15s' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'6px' }}>
                      <div style={{ width:'18px', height:'18px', border:`2px solid ${active ? t.color : 'rgba(247,244,238,.25)'}`, borderRadius:'4px', background: active ? t.color : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {active && <span style={{ color: t.id === 'speaker' ? DARK : '#fff', fontSize:'11px', fontWeight:700 }}>✓</span>}
                      </div>
                      <span style={{ fontSize:'15px', fontWeight:600, color: active ? t.color : PARCH }}>{t.label}</span>
                    </div>
                    <p style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.65, margin:0, paddingLeft:'30px' }}>{t.desc}</p>
                  </div>
                )
              })}
            </div>
            <NavButtons onNext={handleNext} nextDisabled={form.active_tracks.length === 0} saving={saving} showBack={false} />
          </div>
        )}

        {/* ── STEP 1: PROFILE ── */}
        {step === 1 && (
          <div>
            <Eyebrow>STEP 2 OF 6</Eyebrow>
            <h1 style={S.title}>Your professional<br/><em style={{ fontStyle:'italic', color:GOLD }}>identity.</em></h1>
            <p style={S.sub}>Your name is hidden from buyers until Valoria facilitates an introduction. Everything else is visible on your profile.</p>
            <div style={S.fieldStack}>
              <Field label="Full name *">
                <input style={S.input} value={form.display_name} onChange={e => set('display_name', e.target.value)} placeholder="Your full professional name" />
              </Field>
              <Field label="Professional headline *" hint="One line. What you do and who you serve.">
                <input style={S.input} value={form.headline} onChange={e => set('headline', e.target.value)} placeholder={isSpeaker ? 'e.g. Executive Coach & Leadership Speaker' : 'e.g. Head of Strategy — Fintech & Payments'} maxLength={100} />
                <CharCount val={form.headline} max={100} />
              </Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <Field label="Location"><input style={S.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Lagos, Nigeria" /></Field>
                <Field label="Years of experience"><input style={S.input} type="number" min="0" max="50" value={form.years_experience} onChange={e => set('years_experience', e.target.value)} placeholder="e.g. 12" /></Field>
              </div>
              <Field label="Industry">
                <select style={S.input} value={form.industry} onChange={e => set('industry', e.target.value)}>
                  <option value="">Select your primary industry</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Professional bio *" hint="Write in third person. 2–4 sentences. What you do, who you serve, what makes you distinct.">
                <textarea style={{ ...S.input, minHeight:'120px', resize:'vertical', lineHeight:'1.7' }} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Chioma Adeyemi is a fintech growth strategist with 12 years of experience..." maxLength={600} />
                <CharCount val={form.bio} max={600} />
              </Field>
              <Field label="Languages spoken">
                <div style={S.tagGrid}>
                  {LANGUAGES.map(l => {
                    const on = form.languages.includes(l)
                    return <Chip key={l} label={l} on={on} onClick={() => toggleArr('languages', l)} color={GOLD} />
                  })}
                </div>
              </Field>
            </div>
            <NavButtons onBack={() => setStep(s => s-1)} onNext={handleNext} nextDisabled={!form.display_name.trim() || !form.headline.trim() || !form.bio.trim()} saving={saving} />
          </div>
        )}

        {/* ── STEP 2: EXPERTISE ── */}
        {step === 2 && (
          <div>
            <Eyebrow>STEP 3 OF 6</Eyebrow>
            <h1 style={S.title}>What you<br/><em style={{ fontStyle:'italic', color:GOLD }}>bring.</em></h1>
            <p style={S.sub}>Select tags that appear on your profile and power marketplace search. Add work history so buyers understand your track record.</p>

            {(isCandidate || isFacilitator) && (
              <div style={{ marginBottom:'28px' }}>
                <div style={S.tagLabel}>Core skills <span style={{ color:'rgba(201,168,76,.4)', fontWeight:400 }}>— max 8</span></div>
                <div style={S.tagGrid}>
                  {SKILLS_POOL.map(s => <Chip key={s} label={s} on={form.skills.includes(s)} onClick={() => { if (!form.skills.includes(s) && form.skills.length >= 8) return; toggleArr('skills', s) }} color='#378ADD' disabled={!form.skills.includes(s) && form.skills.length >= 8} />)}
                </div>
              </div>
            )}

            {(isSpeaker || isFacilitator) && (
              <div style={{ marginBottom:'28px' }}>
                <div style={S.tagLabel}>Speaking topics <span style={{ color:'rgba(201,168,76,.4)', fontWeight:400 }}>— max 6</span></div>
                <div style={S.tagGrid}>
                  {TOPICS_POOL.map(t => <Chip key={t} label={t} on={form.topics.includes(t)} onClick={() => { if (!form.topics.includes(t) && form.topics.length >= 6) return; toggleArr('topics', t) }} color={GOLD} disabled={!form.topics.includes(t) && form.topics.length >= 6} />)}
                </div>
              </div>
            )}

            {isSpeaker && (
              <>
                <div style={{ marginBottom:'28px' }}>
                  <div style={S.tagLabel}>Speaking formats</div>
                  <div style={S.tagGrid}>
                    {FORMAT_CAPS.map(f => <Chip key={f} label={f} on={form.format_capabilities.includes(f)} onClick={() => toggleArr('format_capabilities', f)} color='#7F77DD' />)}
                  </div>
                </div>
                <div style={{ marginBottom:'28px' }}>
                  <div style={S.tagLabel}>Audience size experience</div>
                  <div style={S.tagGrid}>
                    {AUDIENCE_SIZES.map(a => <Chip key={a} label={a} on={form.audience_sizes.includes(a)} onClick={() => toggleArr('audience_sizes', a)} color='#1D9E75' />)}
                  </div>
                </div>
                <div style={{ marginBottom:'28px' }}>
                  <div style={S.tagLabel}>Past speaking engagements <span style={{ color:'rgba(201,168,76,.4)', fontWeight:400 }}>— up to 3</span></div>
                  {form.past_events.map((ev, i) => (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                      <input style={S.input} placeholder="Event name" value={ev.name} onChange={e => updateListItem('past_events', i, 'name', e.target.value)} />
                      <input style={S.input} placeholder="Your role" value={ev.role} onChange={e => updateListItem('past_events', i, 'role', e.target.value)} />
                    </div>
                  ))}
                  {form.past_events.length < 3 && <button onClick={() => set('past_events', [...form.past_events, { name:'', role:'' }])} style={S.btnGhost}>+ Add event</button>}
                </div>
              </>
            )}

            {isFacilitator && (
              <>
                <div style={{ marginBottom:'28px' }}>
                  <div style={S.tagLabel}>Programme types</div>
                  <div style={S.tagGrid}>
                    {PROGRAMME_TYPES.map(p => <Chip key={p} label={p} on={form.programme_types.includes(p)} onClick={() => toggleArr('programme_types', p)} color='#1D9E75' />)}
                  </div>
                </div>
                <div style={{ marginBottom:'28px' }}>
                  <div style={S.tagLabel}>Past clients / programmes <span style={{ color:'rgba(201,168,76,.4)', fontWeight:400 }}>— up to 3</span></div>
                  {form.past_clients.map((cl, i) => (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                      <input style={S.input} placeholder="Organisation" value={cl.name} onChange={e => updateListItem('past_clients', i, 'name', e.target.value)} />
                      <input style={S.input} placeholder="Programme delivered" value={cl.programme} onChange={e => updateListItem('past_clients', i, 'programme', e.target.value)} />
                    </div>
                  ))}
                  {form.past_clients.length < 3 && <button onClick={() => set('past_clients', [...form.past_clients, { name:'', programme:'' }])} style={S.btnGhost}>+ Add client</button>}
                </div>
                <div style={{ marginBottom:'28px' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', fontSize:'14px', color:PARCH }}>
                    <input type="checkbox" checked={form.pcp_certified} onChange={e => set('pcp_certified', e.target.checked)} style={{ width:'16px', height:'16px', accentColor: GOLD }} />
                    I hold a Valoria PCP (PRIME-Certified Practitioner) certification
                  </label>
                </div>
              </>
            )}

            {isCandidate && (
              <>
                <div style={{ marginBottom:'28px' }}>
                  <div style={S.tagLabel}>Work history <span style={{ color:'rgba(201,168,76,.4)', fontWeight:400 }}>— up to 3 roles</span></div>
                  {form.work_history.map((wh, i) => (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 120px', gap:'10px', marginBottom:'10px' }}>
                      <input style={S.input} placeholder="Job title" value={wh.title} onChange={e => updateListItem('work_history', i, 'title', e.target.value)} />
                      <input style={S.input} placeholder="Organisation" value={wh.org} onChange={e => updateListItem('work_history', i, 'org', e.target.value)} />
                      <input style={S.input} placeholder="Duration" value={wh.duration} onChange={e => updateListItem('work_history', i, 'duration', e.target.value)} />
                    </div>
                  ))}
                  {form.work_history.length < 3 && <button onClick={() => set('work_history', [...form.work_history, { title:'', org:'', duration:'' }])} style={S.btnGhost}>+ Add role</button>}
                </div>
                <Field label="Certifications &amp; credentials" hint="e.g. PMP, SHRM, CFA, Google Analytics — comma separated">
                  <input style={S.input} value={form.certifications} onChange={e => set('certifications', e.target.value)} placeholder="PMP, Google Analytics, HubSpot Marketing" />
                </Field>
              </>
            )}

            <NavButtons onBack={() => setStep(s => s-1)} onNext={handleNext} saving={saving} />
          </div>
        )}

        {/* ── STEP 3: MEDIA ── */}
        {step === 3 && (
          <div>
            <Eyebrow>STEP 4 OF 6</Eyebrow>
            <h1 style={S.title}>Your presence<br/><em style={{ fontStyle:'italic', color:GOLD }}>on record.</em></h1>
            <p style={S.sub}>Profiles with a photo and at least one video receive significantly more introduction requests.</p>
            <div style={{ marginBottom:'32px' }}>
              <div style={S.tagLabel}>Profile photo</div>
              <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
                <div style={{ width:'80px', height:'80px', borderRadius:'50%', border:`2px solid ${GOLD}`, background:MID, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'22px', fontWeight:700, color:GOLD }}>
                  {form.photo_url ? <img src={form.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : getInitials(form.display_name)}
                </div>
                <div>
                  <button onClick={() => fileRef.current?.click()} disabled={photoUploading} style={{ ...S.btnGhost, marginBottom:'6px' }}>
                    {photoUploading ? 'Uploading…' : form.photo_url ? 'Change photo' : 'Upload photo'}
                  </button>
                  <p style={{ fontSize:'11px', color:DIM, margin:0, lineHeight:1.6 }}>JPG or PNG. Square crop recommended. At least 400×400px.</p>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={e => e.target.files[0] && uploadPhoto(e.target.files[0])} />
                </div>
              </div>
            </div>
            <div style={{ marginBottom:'32px' }}>
              <div style={S.tagLabel}>{isSpeaker ? 'Speaker reel & videos' : 'Video links'} <span style={{ color:'rgba(201,168,76,.4)', fontWeight:400 }}>— YouTube URLs, max 4</span></div>
              {form.youtube_links.map((url, i) => (
                <div key={i} style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                  <input style={{ ...S.input, flex:1 }} value={url} placeholder={i === 0 ? (isSpeaker ? 'Intro / speaker reel URL' : 'YouTube link') : 'Additional video'} onChange={e => { const l = [...form.youtube_links]; l[i] = e.target.value; set('youtube_links', l) }} />
                  {form.youtube_links.length > 1 && <button onClick={() => set('youtube_links', form.youtube_links.filter((_,j) => j !== i))} style={{ ...S.btnGhost, padding:'0 12px', color:'#D85A30', borderColor:'rgba(216,90,48,.3)' }}>✕</button>}
                </div>
              ))}
              {form.youtube_links.length < 4 && <button onClick={() => set('youtube_links', [...form.youtube_links, ''])} style={S.btnGhost}>+ Add video</button>}
            </div>
            <div style={S.fieldStack}>
              <Field label="LinkedIn URL"><input style={S.input} value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/yourname" /></Field>
              <Field label="Website / Portfolio URL"><input style={S.input} value={form.website_url} onChange={e => set('website_url', e.target.value)} placeholder="https://yourwebsite.com" /></Field>
            </div>
            <NavButtons onBack={() => setStep(s => s-1)} onNext={handleNext} saving={saving} />
          </div>
        )}

        {/* ── STEP 4: TERMS ── */}
        {step === 4 && (
          <div>
            <Eyebrow>STEP 5 OF 6</Eyebrow>
            <h1 style={S.title}>Your terms<br/><em style={{ fontStyle:'italic', color:GOLD }}>& availability.</em></h1>
            <p style={S.sub}>This information is visible to buyers on your profile. It filters enquiries to genuine opportunities only.</p>
            <div style={S.fieldStack}>
              <Field label="Current availability">
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {AVAILABILITY.map(a => (
                    <label key={a.value} style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', fontSize:'14px', color: form.availability === a.value ? PARCH : DIM }}>
                      <input type="radio" name="avail" value={a.value} checked={form.availability === a.value} onChange={() => set('availability', a.value)} style={{ accentColor:GOLD, width:'16px', height:'16px' }} />
                      {a.label}
                    </label>
                  ))}
                </div>
              </Field>

              {isCandidate && (
                <>
                  <Field label="Contract preference">
                    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                      {CONTRACT_PREFS.map(c => (
                        <label key={c.value} style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', fontSize:'14px', color: form.contract_preference === c.value ? PARCH : DIM }}>
                          <input type="radio" name="contract" value={c.value} checked={form.contract_preference === c.value} onChange={() => set('contract_preference', c.value)} style={{ accentColor:GOLD, width:'16px', height:'16px' }} />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Notice period" hint="How quickly can you start a new role?">
                    <input style={S.input} value={form.notice_period} onChange={e => set('notice_period', e.target.value)} placeholder="e.g. 1 month, Immediately, 3 months" />
                  </Field>
                  <Field label="Salary expectation" hint="Shown on your profile — helps match you to relevant opportunities">
                    <input style={S.input} value={form.salary_expectation} onChange={e => set('salary_expectation', e.target.value)} placeholder="e.g. ₦6M – ₦10M / year" />
                  </Field>
                </>
              )}

              {(isSpeaker || isFacilitator) && (
                <Field label={isFacilitator && isSpeaker ? 'Speaking / facilitation fee' : isSpeaker ? 'Speaking fee' : 'Facilitation day rate'} hint="Visible to event organisers and training buyers on your profile">
                  <input style={S.input} value={form.fee_range} onChange={e => set('fee_range', e.target.value)} placeholder="e.g. $1,500 – $3,000 per engagement" />
                </Field>
              )}

              <Field label="Work modality">
                <div style={S.tagGrid}>
                  {MODALITY.map(m => <Chip key={m} label={m} on={form.modality.includes(m)} onClick={() => toggleArr('modality', m)} color={GOLD} />)}
                </div>
              </Field>
            </div>
            <NavButtons onBack={() => setStep(s => s-1)} onNext={handleNext} saving={saving} />
          </div>
        )}

        {/* ── STEP 5: REVIEW ── */}
        {step === 5 && (
          <div>
            <Eyebrow>STEP 6 OF 6</Eyebrow>
            <h1 style={S.title}>Review your<br/><em style={{ fontStyle:'italic', color:GOLD }}>profile.</em></h1>
            <p style={S.sub}>This is how you'll appear in the marketplace. Buyers see your ATB ID and initials — not your name — until a formal introduction.</p>

            {/* Profile card preview */}
            <div style={{ background:'#F7F4EE', border:'0.5px solid #D4C9A8', padding:'20px', marginBottom:'32px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:'12px', marginBottom:'12px' }}>
                <div style={{ width:'52px', height:'52px', borderRadius:'50%', border:`2px solid ${GOLD}`, background:MID, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', fontSize:'16px', fontWeight:700, color:GOLD, flexShrink:0 }}>
                  {form.photo_url ? <img src={form.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : getInitials(form.display_name)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px', color:GOLD, fontWeight:700, letterSpacing:'.08em', marginBottom:'2px', fontVariantNumeric:'tabular-nums' }}>ATB ID — pending assessment</div>
                  <div style={{ fontSize:'12px', color:GOLD, fontWeight:500, marginBottom:'2px' }}>{form.headline || 'Your headline'}</div>
                  {form.location && <div style={{ fontSize:'11px', color:'#5F5E5A' }}>📍 {form.location}</div>}
                </div>
                <div style={{ fontSize:'11px', fontWeight:700, color:'#1D9E75' }}>● Open</div>
              </div>
              {allTags.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
                  {allTags.slice(0,5).map(t => <span key={t} style={{ padding:'4px 10px', border:'1px solid #D4C9A8', fontSize:'11px', color:'#2E2E4A', background:'#EDE8DC' }}>{t}</span>)}
                </div>
              )}
              {form.bio && <p style={{ fontSize:'12px', color:'#444441', lineHeight:1.6, margin:'0 0 12px' }}>{form.bio.slice(0,120)}{form.bio.length > 120 ? '…' : ''}</p>}
              {(form.salary_expectation || form.fee_range) && <div style={{ fontSize:'11px', color:GOLD, marginBottom:'12px', fontWeight:600 }}>{form.salary_expectation || form.fee_range}</div>}
              <div style={{ display:'flex', gap:'8px' }}>
                <div style={{ flex:1, padding:'8px', border:'1px solid #0F0F1A', fontSize:'10px', fontWeight:700, letterSpacing:'.1em', textAlign:'center', color:'#0F0F1A' }}>VIEW PROFILE</div>
                <div style={{ flex:1, padding:'8px', background:'#378ADD', fontSize:'10px', fontWeight:700, letterSpacing:'.1em', textAlign:'center', color:'#fff' }}>REQUEST INTRO</div>
              </div>
            </div>

            {/* Summary table */}
            <div style={{ background:MID, border:`1px solid ${GLINE}`, padding:'20px', marginBottom:'24px' }}>
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', color:'rgba(201,168,76,.45)', marginBottom:'16px' }}>PROFILE SUMMARY</div>
              {[
                { label:'Tracks',       value: form.active_tracks.map(t => t.charAt(0).toUpperCase()+t.slice(1)).join(', ') || '—' },
                { label:'Industry',     value: form.industry || '—' },
                { label:'Experience',   value: form.years_experience ? `${form.years_experience} yrs` : '—' },
                { label:'Languages',    value: form.languages.length > 0 ? form.languages.join(', ') : '—' },
                { label:'Skills',       value: form.skills.length > 0 ? `${form.skills.length} selected` : '—' },
                { label:'Topics',       value: form.topics.length > 0 ? `${form.topics.length} selected` : '—' },
                { label:'Work history', value: form.work_history.filter(w=>w.title).length > 0 ? `${form.work_history.filter(w=>w.title).length} role(s)` : '—' },
                { label:'Photo',        value: form.photo_url ? 'Uploaded ✓' : 'Not uploaded' },
                { label:'Videos',       value: videoLinks.length > 0 ? `${videoLinks.length} link(s)` : 'None' },
                { label:'Availability', value: AVAILABILITY.find(a=>a.value===form.availability)?.label || '—' },
                ...(isCandidate ? [{ label:'Salary range', value: form.salary_expectation || '—' }, { label:'Notice period', value: form.notice_period || '—' }] : []),
                ...(isSpeaker || isFacilitator ? [{ label:'Fee range', value: form.fee_range || '—' }] : []),
              ].map(row => (
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${GLINE}` }}>
                  <span style={{ fontSize:'12px', color:DIM }}>{row.label}</span>
                  <span style={{ fontSize:'12px', fontWeight:500, color:PARCH }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* VALU nudge */}
            <div style={{ background:'rgba(201,168,76,.05)', border:`1px solid ${GLINE}`, padding:'20px', marginBottom:'24px' }}>
              <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', color:'rgba(201,168,76,.45)', marginBottom:'10px' }}>NEXT — VALU INDEX ASSESSMENT</div>
              <p style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.7, margin:'0 0 14px' }}>
                Your profile is set to <strong style={{ color:PARCH }}>Pending</strong> until you complete the VALU Index. Profiles scoring 35 or above become eligible for marketplace listing. The assessment takes approximately 25 minutes.
              </p>
              <a href="https://assessment.valoriainstitute.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize:'11px', fontWeight:700, letterSpacing:'.12em', color:GOLD, textDecoration:'none' }}>
                TAKE THE VALU INDEX →
              </a>
            </div>

            {/* Consent */}
            <label style={{ display:'flex', alignItems:'flex-start', gap:'12px', cursor:'pointer', marginBottom:'32px' }}>
              <input type="checkbox" checked={form.consent} onChange={e => set('consent', e.target.checked)} style={{ width:'16px', height:'16px', accentColor:GOLD, marginTop:'2px', flexShrink:0 }} />
              <span style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.7 }}>
                I confirm all information provided is accurate. I understand my profile will be reviewed before listing, and my full name will only be shared with buyers after a formal introduction is facilitated by Valoria Institute.
              </span>
            </label>

            <button onClick={handleFinish} disabled={!form.consent || saving}
              style={{ display:'block', width:'100%', padding:'16px', background: form.consent && !saving ? GOLD : 'rgba(201,168,76,.2)', color: form.consent && !saving ? DARK : 'rgba(201,168,76,.4)', fontSize:'12px', fontWeight:700, letterSpacing:'.14em', border:'none', cursor: form.consent && !saving ? 'pointer' : 'not-allowed', fontFamily:'inherit', marginBottom:'12px' }}>
              {saving ? 'SAVING…' : 'SUBMIT PROFILE FOR REVIEW'}
            </button>
            <button onClick={() => setStep(s => s-1)} style={{ display:'block', width:'100%', padding:'12px', background:'transparent', border:`1px solid ${GLINE}`, color:DIM, fontSize:'11px', cursor:'pointer', fontFamily:'inherit', letterSpacing:'.08em' }}>← BACK</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Eyebrow({ children }) {
  return (
    <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.2em', color:'rgba(201,168,76,.45)', marginBottom:'12px', display:'flex', alignItems:'center', gap:'10px' }}>
      <div style={{ height:'1px', width:'24px', background:'rgba(201,168,76,.3)' }} />
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.14em', color:'rgba(201,168,76,.5)', marginBottom:'6px', textTransform:'uppercase' }}>{label}</div>
      {hint && <div style={{ fontSize:'11px', color:'rgba(247,244,238,.35)', marginBottom:'8px', fontStyle:'italic' }}>{hint}</div>}
      {children}
    </div>
  )
}

function CharCount({ val, max }) {
  const len = (val || '').length
  return <div style={{ fontSize:'10px', color: len > max * 0.9 ? '#C9A84C' : 'rgba(247,244,238,.25)', textAlign:'right', marginTop:'4px' }}>{len} / {max}</div>
}

function Chip({ label, on, onClick, color, disabled }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{ padding:'7px 13px', border:`1px solid ${on ? color : 'rgba(201,168,76,.14)'}`, fontSize:'12px', color: on ? color : 'rgba(247,244,238,.5)', background: on ? `${color}12` : 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1, userSelect:'none', transition:'all .12s' }}>
      {label}
    </div>
  )
}

function NavButtons({ onBack, onNext, nextDisabled, saving, showBack=true }) {
  return (
    <div style={{ display:'flex', gap:'12px', marginTop:'40px' }}>
      {showBack && <button onClick={onBack} style={{ padding:'14px 24px', background:'transparent', border:'1px solid rgba(201,168,76,.2)', color:'rgba(247,244,238,.5)', fontSize:'11px', fontWeight:700, letterSpacing:'.12em', cursor:'pointer', fontFamily:'inherit' }}>← BACK</button>}
      {onNext && <button onClick={onNext} disabled={nextDisabled || saving} style={{ flex:1, padding:'14px', background: !nextDisabled && !saving ? '#C9A84C' : 'rgba(201,168,76,.2)', color: !nextDisabled && !saving ? '#0F0F1A' : 'rgba(201,168,76,.4)', fontSize:'12px', fontWeight:700, letterSpacing:'.14em', border:'none', cursor: !nextDisabled && !saving ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>{saving ? 'SAVING…' : 'CONTINUE →'}</button>}
    </div>
  )
}

const S = {
  title:     { fontSize:'clamp(28px,4vw,44px)', fontWeight:200, color:'#F7F4EE', lineHeight:1.1, letterSpacing:'-.02em', marginBottom:'12px' },
  sub:       { fontSize:'14px', fontWeight:300, color:'rgba(247,244,238,.5)', lineHeight:1.75, marginBottom:'32px' },
  fieldStack:{ display:'flex', flexDirection:'column', gap:'20px', marginBottom:'8px' },
  input:     { width:'100%', padding:'12px 14px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(201,168,76,.2)', color:'#F7F4EE', fontSize:'14px', fontFamily:'var(--font,Raleway,sans-serif)', outline:'none', boxSizing:'border-box' },
  tagLabel:  { fontSize:'10px', fontWeight:700, letterSpacing:'.14em', color:'rgba(201,168,76,.5)', marginBottom:'12px', textTransform:'uppercase' },
  tagGrid:   { display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'8px' },
  btnGhost:  { padding:'10px 20px', background:'transparent', border:'1px solid rgba(201,168,76,.2)', color:'rgba(247,244,238,.5)', fontSize:'11px', fontWeight:700, letterSpacing:'.1em', cursor:'pointer', fontFamily:'var(--font,Raleway,sans-serif)' },
}
