'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
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
const CONTRACT_PREFS = [{ value:'permanent', label:'Permanent / full-time' }, { value:'contract', label:'Contract / freelance' }, { value:'both', label:'Open to both' }]
const AVAILABILITY = [{ value:'open', label:'Open to opportunities' }, { value:'contract_only', label:'Contract / project only' }, { value:'not_available', label:'Not currently available' }]
const MODALITY = ['In-person','Virtual','Hybrid','Open to relocation']
const FORMAT_CAPS = ['Keynote','Panel speaker','Workshop facilitator','Masterclass host','Conference MC','Fireside chat']
const AUDIENCE_SIZES = ['Under 50','50–200','200–500','500–1,000','1,000–5,000','5,000+']

function getInitials(name) {
  if (!name) return '?'
  const w = name.trim().split(/\s+/)
  return w.length === 1 ? w[0].slice(0,2).toUpperCase() : (w[0][0] + w[w.length-1][0]).toUpperCase()
}

const EMPTY_FORM = {
  active_tracks: [],
  display_name: '', headline: '', location: '', industry: '',
  years_experience: '', bio: '', languages: [],
  skills: [], topics: [], facilitation_topics: [],
  programme_types: [], format_capabilities: [],
  audience_sizes: [], pcp_certified: false,
  work_history: [{ title:'', org:'', duration:'' }],
  past_events: [{ name:'', role:'' }],
  past_clients: [{ name:'', programme:'' }],
  certifications: '',
  photo_url: '', youtube_links: [''],
  linkedin_url: '', website_url: '',
  availability: 'open', modality: [],
  contract_preference: 'both', notice_period: '',
  salary_expectation: '', fee_range: '',
  consent: false,
}

// Builds the flattened, one-question-per-screen sequence. Recomputed live
// from the current form so track changes (candidate/speaker/facilitator)
// immediately reshape which screens exist — e.g. a pure candidate never
// sees the speaker fee-range or past-events screens at all.
function buildScreens(form) {
  const isCandidate   = form.active_tracks.includes('candidate')
  const isSpeaker     = form.active_tracks.includes('speaker')
  const isFacilitator = form.active_tracks.includes('facilitator')
  const s = []

  s.push({ key:'active_tracks', kind:'tracks', section:'Track' })
  s.push({ key:'display_name', kind:'text', section:'Profile', title:'What should we call you?', sub:'Your name is hidden from buyers until Valoria facilitates an introduction.', placeholder:'Your full professional name', required:true })
  s.push({ key:'headline', kind:'text', section:'Profile', title:'Sum up what you do in one line.', sub:'This is the first thing buyers see on your profile.', placeholder: isSpeaker ? 'e.g. Executive Coach & Leadership Speaker' : 'e.g. Head of Strategy — Fintech & Payments', maxLength:100, required:true })
  s.push({ key:'location', kind:'text', section:'Profile', title:'Where are you based?', sub:'Optional, but helps buyers searching by region.', placeholder:'e.g. Lagos, Nigeria', required:false })
  s.push({ key:'years_experience', kind:'text', section:'Profile', inputType:'number', title:'How many years of experience?', sub:'A rough number is fine.', placeholder:'e.g. 12', required:false })
  s.push({ key:'industry', kind:'single-chip', section:'Profile', title:'Which industry do you know best?', sub:'Optional — pick the closest fit.', options:INDUSTRIES, required:false })
  s.push({ key:'bio', kind:'textarea', section:'Profile', title:'Write a short bio.', sub:'Third person, 2–4 sentences. What you do, who you serve, what makes you distinct.', placeholder:'Chioma Adeyemi is a fintech growth strategist with 12 years of experience...', maxLength:600, required:true })
  s.push({ key:'languages', kind:'multi-chip', section:'Profile', title:'Which languages do you speak?', sub:'Select all that apply.', options:LANGUAGES, required:false })

  if (isCandidate || isFacilitator) s.push({ key:'skills', kind:'multi-chip', section:'Expertise', title:'What are your core skills?', sub:'Select up to 8 — these power marketplace search.', options:SKILLS_POOL, max:8, required:false, color:'#378ADD' })
  if (isSpeaker || isFacilitator) s.push({ key:'topics', kind:'multi-chip', section:'Expertise', title:'What topics do you speak on?', sub:'Select up to 6.', options:TOPICS_POOL, max:6, required:false })
  if (isSpeaker) s.push({ key:'format_capabilities', kind:'multi-chip', section:'Expertise', title:'What speaking formats do you offer?', sub:'Select all that apply.', options:FORMAT_CAPS, required:false, color:'#7F77DD' })
  if (isSpeaker) s.push({ key:'audience_sizes', kind:'multi-chip', section:'Expertise', title:'What audience sizes have you spoken to?', sub:'Select all that apply.', options:AUDIENCE_SIZES, required:false, color:'#1D9E75' })
  if (isSpeaker) s.push({ key:'past_events', kind:'list', section:'Expertise', title:'Any past speaking engagements?', sub:'Optional — up to 3. These build buyer trust.', fields:[{ key:'name', placeholder:'Event name' }, { key:'role', placeholder:'Your role' }], max:3, addLabel:'+ Add event', required:false })
  if (isFacilitator) s.push({ key:'programme_types', kind:'multi-chip', section:'Expertise', title:'What programme types do you run?', sub:'Select all that apply.', options:PROGRAMME_TYPES, required:false, color:'#1D9E75' })
  if (isFacilitator) s.push({ key:'past_clients', kind:'list', section:'Expertise', title:'Any past clients or programmes?', sub:'Optional — up to 3.', fields:[{ key:'name', placeholder:'Organisation' }, { key:'programme', placeholder:'Programme delivered' }], max:3, addLabel:'+ Add client', required:false })
  if (isFacilitator) s.push({ key:'pcp_certified', kind:'boolean', section:'Expertise', title:'Do you hold a Valoria PCP certification?', sub:'PRIME-Certified Practitioner.' })
  if (isCandidate) s.push({ key:'work_history', kind:'list', section:'Expertise', title:'Add your work history.', sub:'Optional — up to 3 roles. Buyers use this to understand your track record.', fields:[{ key:'title', placeholder:'Job title' }, { key:'org', placeholder:'Organisation' }, { key:'duration', placeholder:'Duration' }], max:3, addLabel:'+ Add role', required:false })
  if (isCandidate) s.push({ key:'certifications', kind:'text', section:'Expertise', title:'Any certifications or credentials?', sub:'Optional — comma separated.', placeholder:'PMP, Google Analytics, HubSpot Marketing', required:false })

  s.push({ key:'photo_url', kind:'photo', section:'Media', title:'Add a profile photo.', sub:'Profiles with a photo receive significantly more introduction requests.' })
  s.push({ key:'youtube_links', kind:'link-list', section:'Media', title: isSpeaker ? 'Add your speaker reel.' : 'Add a video link.', sub:'Optional — YouTube URLs, up to 4.', max:4, required:false })
  s.push({ key:'linkedin_url', kind:'text', section:'Media', inputType:'url', title:'Your LinkedIn profile?', sub:'Optional.', placeholder:'https://linkedin.com/in/yourname', required:false })
  s.push({ key:'website_url', kind:'text', section:'Media', inputType:'url', title:'A personal website or portfolio?', sub:'Optional.', placeholder:'https://yourwebsite.com', required:false })

  s.push({ key:'availability', kind:'single-radio', section:'Terms', title:'What\u2019s your current availability?', options:AVAILABILITY })
  if (isCandidate) s.push({ key:'contract_preference', kind:'single-radio', section:'Terms', title:'What kind of work are you open to?', options:CONTRACT_PREFS })
  if (isCandidate) s.push({ key:'notice_period', kind:'text', section:'Terms', title:'How quickly could you start a new role?', sub:'Optional.', placeholder:'e.g. 1 month, Immediately, 3 months', required:false })
  if (isCandidate) s.push({ key:'salary_expectation', kind:'text', section:'Terms', title:'What\u2019s your salary expectation?', sub:'Optional — helps match you to relevant opportunities.', placeholder:'e.g. \u20a66M \u2013 \u20a610M / year', required:false })
  if (isSpeaker || isFacilitator) s.push({ key:'fee_range', kind:'text', section:'Terms', title: isFacilitator && isSpeaker ? 'Your speaking / facilitation fee?' : isSpeaker ? 'Your speaking fee?' : 'Your facilitation day rate?', sub:'Optional — visible to buyers on your profile.', placeholder:'e.g. $1,500 \u2013 $3,000 per engagement', required:false })
  s.push({ key:'modality', kind:'multi-chip', section:'Terms', title:'What work modality do you prefer?', sub:'Select all that apply.', options:MODALITY, required:false })

  s.push({ key:'review', kind:'review', section:'Review' })
  return s
}

export default function ProfileSetupPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [screenIndex, setScreenIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const fileRef = useRef(null)

  const [form, setForm] = useState(EMPTY_FORM)

  const isCandidate   = form.active_tracks.includes('candidate')
  const isSpeaker     = form.active_tracks.includes('speaker')
  const isFacilitator = form.active_tracks.includes('facilitator')

  const screens = useMemo(() => buildScreens(form), [form.active_tracks, form.display_name, isSpeaker, isFacilitator])
  const screen = screens[Math.min(screenIndex, screens.length - 1)]
  const progress = Math.round((screenIndex / (screens.length - 1)) * 100)

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
          ...f, ...existing,
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
      setReady(true)
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
    setPhotoError('')
    try {
      const ext  = file.name.split('.').pop()
      const path = `profiles/${user.id}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      set('photo_url', data.publicUrl)
    } catch (err) {
      console.error('Photo upload failed:', err)
      setPhotoError(err?.message || 'Upload failed. Please try a different image.')
    } finally {
      setPhotoUploading(false)
    }
  }

  async function saveProgress(overrides) {
    if (!user) return
    const f = overrides || form
    setSaving(true)
    await supabase.from('professional_profiles').upsert({
      id: user.id,
      display_name: f.display_name || null, headline: f.headline || null,
      location: f.location || null, industry: f.industry || null,
      years_experience: f.years_experience ? parseInt(f.years_experience) : null,
      bio: f.bio || null, languages: f.languages, active_tracks: f.active_tracks,
      skills: f.skills, topics: f.topics, facilitation_topics: f.facilitation_topics,
      programme_types: f.programme_types, format_capabilities: f.format_capabilities,
      audience_sizes: f.audience_sizes, pcp_certified: f.pcp_certified,
      work_history: f.work_history.filter(w => w.title || w.org),
      past_events: f.past_events.filter(e => e.name),
      past_clients: f.past_clients.filter(c => c.name),
      certifications: f.certifications || null, photo_url: f.photo_url || null,
      youtube_links: f.youtube_links.filter(Boolean),
      linkedin_url: f.linkedin_url || null, website_url: f.website_url || null,
      availability: f.availability, modality: f.modality,
      contract_preference: f.contract_preference, notice_period: f.notice_period || null,
      salary_expectation: f.salary_expectation || null, fee_range: f.fee_range || null,
      listing_status: 'pending', updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    setSaving(false)
  }

  // Mirrors the assessment's pattern: click an answer, brief highlight,
  // then auto-advance — no separate "Continue" click needed for
  // single-choice questions.
  function selectAndAdvance(key, val) {
    if (transitioning) return
    const nextForm = { ...form, [key]: val }
    setForm(nextForm)
    setTransitioning(true)
    saveProgress(nextForm)
    setTimeout(() => {
      setScreenIndex(i => Math.min(i + 1, screens.length - 1))
      setTransitioning(false)
    }, 320)
  }

  function goNext() {
    if (transitioning) return
    saveProgress()
    setScreenIndex(i => Math.min(i + 1, screens.length - 1))
  }

  function goBack() {
    if (screenIndex === 0) return
    setScreenIndex(i => Math.max(i - 1, 0))
  }

  async function handleFinish() {
    setSaving(true)
    await saveProgress()
    setSaving(false)
    router.push('/dashboard')
  }

  async function handleSaveExit() {
    await saveProgress()
    router.push('/dashboard')
  }

  if (!ready) return <div style={{ minHeight:'100vh', background:DARK, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font,Raleway,sans-serif)', color:DIM, fontSize:'13px' }}>Loading…</div>

  const tags       = [...form.skills, ...form.topics, ...form.facilitation_topics]
  const videoLinks = (form.youtube_links || []).filter(Boolean)

  return (
    <div style={{ minHeight:'100vh', background:DARK, color:PARCH, fontFamily:'var(--font,Raleway,sans-serif)' }}>
      {/* PRIME stripe */}
      <div style={{ height:'3px', display:'flex', position:'sticky', top:0, zIndex:200 }}>
        {Object.values(PRIME_COLORS).map((c,i) => <div key={i} style={{ flex:1, background:c, opacity:.85 }} />)}
      </div>

      {/* NAV */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 clamp(20px,4vw,40px)', height:'60px', background:MID, borderBottom:`1px solid ${GLINE}` }}>
        <Link href="/" style={{ lineHeight:0 }}><img src="/logo.png" alt="Valoria" style={{ height:'36px', width:'auto' }} /></Link>
        <div style={{ fontSize:'11px', fontWeight:700, letterSpacing:'.14em', color:'rgba(201,168,76,.5)' }}>{screen.section?.toUpperCase()}</div>
        <button onClick={handleSaveExit} style={{ fontSize:'11px', color:DIM, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', letterSpacing:'.06em' }}>SAVE &amp; EXIT</button>
      </header>

      {/* THIN PROGRESS BAR — same visual language as the VALU Index assessment */}
      <div style={{ height:'2px', background:'rgba(255,255,255,.06)' }}>
        <div style={{ height:'100%', width:`${progress}%`, background:GOLD, transition:'width .4s ease' }} />
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'clamp(40px,8vh,80px) 20px 60px', minHeight:'calc(100vh - 66px)', display:'flex', flexDirection:'column', justifyContent:'center' }}>
        <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.2em', color:'rgba(201,168,76,.4)', marginBottom:'16px' }}>
          {screenIndex + 1} OF {screens.length}
        </div>

        <ScreenBody
          screen={screen} form={form} set={set} toggleArr={toggleArr} updateListItem={updateListItem}
          selectAndAdvance={selectAndAdvance} goNext={goNext} saving={saving}
          photoUploading={photoUploading} photoError={photoError} fileRef={fileRef} uploadPhoto={uploadPhoto}
          isCandidate={isCandidate} isSpeaker={isSpeaker} isFacilitator={isFacilitator}
          tags={tags} videoLinks={videoLinks} handleFinish={handleFinish}
        />

        <div style={{ display:'flex', gap:'12px', marginTop:'32px' }}>
          {screenIndex > 0 && screen.kind !== 'review' && (
            <button onClick={goBack} style={{ padding:'12px 20px', background:'transparent', border:`1px solid ${GLINE}`, color:'rgba(247,244,238,.4)', fontSize:'11px', fontWeight:700, letterSpacing:'.1em', cursor:'pointer', fontFamily:'inherit' }}>
              ← BACK
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Generic single-screen renderer — one question, one job ──────────────
function ScreenBody(props) {
  const { screen, form, set, toggleArr, updateListItem, selectAndAdvance, goNext, saving,
          photoUploading, photoError, fileRef, uploadPhoto, isSpeaker, tags, videoLinks, handleFinish } = props

  const val = form[screen.key]

  switch (screen.kind) {

    case 'tracks': {
      const options = [
        { id:'candidate',   label:'Candidate / Talent', desc:'I want employers and recruiters to find me through ATB Connect.', color:'#378ADD' },
        { id:'speaker',     label:'Speaker',            desc:'I want to be booked for events and conferences through ATB Spotlight.', color:GOLD },
        { id:'facilitator', label:'Facilitator',        desc:'I want to be commissioned for L&D programmes through ATB Develop.', color:'#1D9E75' },
      ]
      return (
        <div>
          <Title>How are you joining<br/><Em>Valoria?</Em></Title>
          <Sub>Select all that apply — a speaker can also be a candidate.</Sub>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'28px' }}>
            {options.map(t => {
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
          <ContinueBar onNext={goNext} nextDisabled={form.active_tracks.length === 0} saving={saving} />
        </div>
      )
    }

    case 'text': {
      const isValid = !screen.required || (val || '').trim()
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <input
            autoFocus type={screen.inputType || 'text'} maxLength={screen.maxLength}
            style={inputStyle} value={val || ''} placeholder={screen.placeholder}
            onChange={e => set(screen.key, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && isValid) goNext() }}
          />
          {screen.maxLength && <CharCount val={val} max={screen.maxLength} />}
          <ContinueBar onNext={goNext} nextDisabled={!isValid} saving={saving} showSkip={!screen.required && !val} />
        </div>
      )
    }

    case 'textarea': {
      const isValid = !screen.required || (val || '').trim()
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <textarea
            autoFocus maxLength={screen.maxLength}
            style={{ ...inputStyle, minHeight:'140px', resize:'vertical', lineHeight:1.7 }}
            value={val || ''} placeholder={screen.placeholder} onChange={e => set(screen.key, e.target.value)}
          />
          {screen.maxLength && <CharCount val={val} max={screen.maxLength} />}
          <ContinueBar onNext={goNext} nextDisabled={!isValid} saving={saving} />
        </div>
      )
    }

    case 'single-chip': {
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'28px' }}>
            {screen.options.map(o => (
              <Chip key={o} label={o} on={val === o} onClick={() => selectAndAdvance(screen.key, o)} color={GOLD} />
            ))}
          </div>
          {!screen.required && <SkipLink onSkip={goNext} />}
        </div>
      )
    }

    case 'single-radio': {
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'8px' }}>
            {screen.options.map(o => {
              const active = val === o.value
              return (
                <div key={o.value} onClick={() => selectAndAdvance(screen.key, o.value)}
                  style={{ padding:'16px 18px', border:`1.5px solid ${active ? GOLD : GLINE}`, cursor:'pointer', background: active ? 'rgba(201,168,76,.08)' : `${MID}66`, fontSize:'14px', fontWeight:500, color: active ? GOLD : PARCH, transition:'all .15s' }}>
                  {o.label}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    case 'boolean': {
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <div style={{ display:'flex', gap:'12px', marginBottom:'8px' }}>
            {[{ label:'Yes', v:true }, { label:'No', v:false }].map(o => (
              <div key={o.label} onClick={() => selectAndAdvance(screen.key, o.v)}
                style={{ flex:1, padding:'20px', textAlign:'center', border:`1.5px solid ${val === o.v ? GOLD : GLINE}`, cursor:'pointer', background: val === o.v ? 'rgba(201,168,76,.08)' : `${MID}66`, fontSize:'14px', fontWeight:600, color: val === o.v ? GOLD : PARCH }}>
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )
    }

    case 'multi-chip': {
      const arr = val || []
      const atMax = screen.max && arr.length >= screen.max
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'28px' }}>
            {screen.options.map(o => {
              const on = arr.includes(o)
              return <Chip key={o} label={o} on={on} color={screen.color || GOLD}
                disabled={!on && atMax}
                onClick={() => { if (!on && atMax) return; toggleArr(screen.key, o) }} />
            })}
          </div>
          <ContinueBar onNext={goNext} nextDisabled={false} saving={saving} showSkip={!screen.required && arr.length === 0} />
        </div>
      )
    }

    case 'list': {
      const rows = val || []
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <div style={{ marginBottom:'16px' }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns: `repeat(${screen.fields.length}, 1fr)`, gap:'10px', marginBottom:'10px' }}>
                {screen.fields.map(f => (
                  <input key={f.key} style={inputStyle} placeholder={f.placeholder} value={row[f.key] || ''}
                    onChange={e => updateListItem(screen.key, i, f.key, e.target.value)} />
                ))}
              </div>
            ))}
            {rows.length < screen.max && (
              <button onClick={() => set(screen.key, [...rows, Object.fromEntries(screen.fields.map(f => [f.key, '']))])} style={ghostBtnStyle}>
                {screen.addLabel}
              </button>
            )}
          </div>
          <ContinueBar onNext={goNext} nextDisabled={false} saving={saving} showSkip />
        </div>
      )
    }

    case 'link-list': {
      const links = val || ['']
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <div style={{ marginBottom:'16px' }}>
            {links.map((url, i) => (
              <div key={i} style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                <input style={{ ...inputStyle, flex:1 }} value={url}
                  placeholder={i === 0 ? (isSpeaker ? 'Intro / speaker reel URL' : 'YouTube link') : 'Additional video'}
                  onChange={e => { const l = [...links]; l[i] = e.target.value; set(screen.key, l) }} />
                {links.length > 1 && (
                  <button onClick={() => set(screen.key, links.filter((_,j) => j !== i))}
                    style={{ ...ghostBtnStyle, padding:'0 12px', color:'#D85A30', borderColor:'rgba(216,90,48,.3)' }}>✕</button>
                )}
              </div>
            ))}
            {links.length < screen.max && (
              <button onClick={() => set(screen.key, [...links, ''])} style={ghostBtnStyle}>+ Add video</button>
            )}
          </div>
          <ContinueBar onNext={goNext} nextDisabled={false} saving={saving} showSkip />
        </div>
      )
    }

    case 'photo': {
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <div style={{ display:'flex', alignItems:'center', gap:'20px', marginBottom:'8px' }}>
            <div style={{ width:'90px', height:'90px', borderRadius:'50%', border:`2px solid ${GOLD}`, background:MID, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'24px', fontWeight:700, color:GOLD }}>
              {form.photo_url ? <img src={form.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : getInitials(form.display_name)}
            </div>
            <div>
              <button onClick={() => fileRef.current?.click()} disabled={photoUploading} style={{ ...ghostBtnStyle, marginBottom:'6px' }}>
                {photoUploading ? 'Uploading…' : form.photo_url ? 'Change photo' : 'Upload photo'}
              </button>
              <p style={{ fontSize:'11px', color:DIM, margin:0, lineHeight:1.6 }}>JPG or PNG. Square crop recommended. At least 400×400px.</p>
              {photoError && <p style={{ fontSize:'11px', color:'#F09595', margin:'6px 0 0', lineHeight:1.5 }}>{photoError}</p>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={e => e.target.files[0] && uploadPhoto(e.target.files[0])} />
            </div>
          </div>
          <ContinueBar onNext={goNext} nextDisabled={photoUploading} saving={saving} showSkip={!form.photo_url} />
        </div>
      )
    }

    case 'review': {
      return <ReviewScreen {...props} tags={tags} videoLinks={videoLinks} handleFinish={handleFinish} />
    }

    default:
      return null
  }
}

function ReviewScreen({ form, isCandidate, isSpeaker, isFacilitator, tags, videoLinks, handleFinish, saving, set }) {
  return (
    <div>
      <Title>Review &amp;<br/><Em>submit.</Em></Title>
      <Sub>Take one more look before this goes live for review.</Sub>

      <div style={{ background:'rgba(237,232,220,0.97)', color:'#0F0F1A', padding:'20px', marginBottom:'24px', border:'1px solid #C9A84C' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'#0F0F1A', color:GOLD, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'14px', overflow:'hidden', flexShrink:0 }}>
            {form.photo_url ? <img src={form.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : getInitials(form.display_name)}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'12px', color:GOLD, fontWeight:500, marginBottom:'2px' }}>{form.headline || 'Your headline'}</div>
            {form.location && <div style={{ fontSize:'11px', color:'#5F5E5A' }}>📍 {form.location}</div>}
          </div>
          <div style={{ fontSize:'11px', fontWeight:700, color:'#1D9E75' }}>● Open</div>
        </div>
        {tags.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
            {tags.slice(0,5).map(t => <span key={t} style={{ padding:'4px 10px', border:'1px solid #D4C9A8', fontSize:'11px', color:'#2E2E4A', background:'#EDE8DC' }}>{t}</span>)}
          </div>
        )}
        {form.bio && <p style={{ fontSize:'12px', color:'#444441', lineHeight:1.6, margin:'0 0 12px' }}>{form.bio.slice(0,120)}{form.bio.length > 120 ? '…' : ''}</p>}
      </div>

      <div style={{ background:MID, border:`1px solid ${GLINE}`, padding:'20px', marginBottom:'24px' }}>
        <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', color:'rgba(201,168,76,.45)', marginBottom:'16px' }}>PROFILE SUMMARY</div>
        {[
          { label:'Tracks', value: form.active_tracks.map(t => t.charAt(0).toUpperCase()+t.slice(1)).join(', ') || '—' },
          { label:'Industry', value: form.industry || '—' },
          { label:'Experience', value: form.years_experience ? `${form.years_experience} yrs` : '—' },
          { label:'Languages', value: form.languages.length > 0 ? form.languages.join(', ') : '—' },
          { label:'Skills / topics', value: tags.length > 0 ? `${tags.length} selected` : '—' },
          { label:'Photo', value: form.photo_url ? 'Uploaded ✓' : 'Not uploaded' },
          { label:'Videos', value: videoLinks.length > 0 ? `${videoLinks.length} link(s)` : 'None' },
          { label:'Availability', value: AVAILABILITY.find(a=>a.value===form.availability)?.label || '—' },
          ...(isCandidate ? [{ label:'Salary range', value: form.salary_expectation || '—' }] : []),
          ...(isSpeaker || isFacilitator ? [{ label:'Fee range', value: form.fee_range || '—' }] : []),
        ].map(row => (
          <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${GLINE}` }}>
            <span style={{ fontSize:'12px', color:DIM }}>{row.label}</span>
            <span style={{ fontSize:'12px', fontWeight:500, color:PARCH }}>{row.value}</span>
          </div>
        ))}
      </div>

      <div style={{ background:'rgba(201,168,76,.05)', border:`1px solid ${GLINE}`, padding:'20px', marginBottom:'24px' }}>
        <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', color:'rgba(201,168,76,.45)', marginBottom:'10px' }}>NEXT — VALU INDEX ASSESSMENT</div>
        <p style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.7, margin:'0 0 14px' }}>
          Your profile is set to <strong style={{ color:PARCH }}>Pending</strong> until you complete the VALU Index. Profiles scoring 35 or above become eligible for marketplace listing. The assessment takes approximately 25 minutes.
        </p>
        <a href="https://assessment.valoriainstitute.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize:'11px', fontWeight:700, letterSpacing:'.12em', color:GOLD, textDecoration:'none' }}>
          TAKE THE VALU INDEX →
        </a>
      </div>

      <label style={{ display:'flex', alignItems:'flex-start', gap:'12px', cursor:'pointer', marginBottom:'28px' }}>
        <input type="checkbox" checked={form.consent} onChange={e => set('consent', e.target.checked)} style={{ width:'16px', height:'16px', accentColor:GOLD, marginTop:'2px', flexShrink:0 }} />
        <span style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.7 }}>
          I confirm all information provided is accurate. I understand my profile will be reviewed before listing, and my full name will only be shared with buyers after a formal introduction is facilitated by Valoria Institute.
        </span>
      </label>

      <button onClick={handleFinish} disabled={!form.consent || saving}
        style={{ display:'block', width:'100%', padding:'16px', background: form.consent && !saving ? GOLD : 'rgba(201,168,76,.2)', color: form.consent && !saving ? DARK : 'rgba(201,168,76,.4)', fontSize:'12px', fontWeight:700, letterSpacing:'.14em', border:'none', cursor: form.consent && !saving ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
        {saving ? 'SUBMITTING…' : 'SUBMIT PROFILE FOR REVIEW'}
      </button>
    </div>
  )
}

// ── Shared small pieces ───────────────────────────────────────────────────
function Title({ children }) { return <h1 style={{ fontSize:'clamp(26px,4vw,38px)', fontWeight:200, color:PARCH, lineHeight:1.15, letterSpacing:'-.02em', marginBottom:'12px' }}>{children}</h1> }
function Em({ children }) { return <em style={{ fontStyle:'italic', color:GOLD }}>{children}</em> }
function Sub({ children }) { return <p style={{ fontSize:'14px', fontWeight:300, color:DIM, lineHeight:1.75, marginBottom:'28px' }}>{children}</p> }

function CharCount({ val, max }) {
  const len = (val || '').length
  return <div style={{ fontSize:'10px', color: len > max * 0.9 ? GOLD : 'rgba(247,244,238,.25)', textAlign:'right', margin:'4px 0 20px' }}>{len} / {max}</div>
}

function Chip({ label, on, onClick, color, disabled }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{ padding:'9px 15px', border:`1px solid ${on ? color : 'rgba(201,168,76,.14)'}`, fontSize:'13px', color: on ? color : 'rgba(247,244,238,.5)', background: on ? `${color}12` : 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1, userSelect:'none', transition:'all .12s' }}>
      {label}
    </div>
  )
}

function SkipLink({ onSkip }) {
  return <button onClick={onSkip} style={{ background:'none', border:'none', color:DIM, fontSize:'12px', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline', padding:0 }}>Skip this question →</button>
}

function ContinueBar({ onNext, nextDisabled, saving, showSkip }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'16px', marginTop: showSkip ? '4px' : '8px' }}>
      <button onClick={onNext} disabled={nextDisabled || saving}
        style={{ padding:'14px 32px', background: !nextDisabled && !saving ? GOLD : 'rgba(201,168,76,.2)', color: !nextDisabled && !saving ? DARK : 'rgba(201,168,76,.4)', fontSize:'12px', fontWeight:700, letterSpacing:'.14em', border:'none', cursor: !nextDisabled && !saving ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
        {saving ? 'SAVING…' : 'CONTINUE →'}
      </button>
      {showSkip && <SkipLink onSkip={onNext} />}
    </div>
  )
}

const inputStyle = { width:'100%', padding:'14px 16px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(201,168,76,.2)', color:PARCH, fontSize:'15px', fontFamily:'var(--font,Raleway,sans-serif)', outline:'none', boxSizing:'border-box', marginBottom:'8px' }
const ghostBtnStyle = { padding:'10px 20px', background:'transparent', border:'1px solid rgba(201,168,76,.2)', color:'rgba(247,244,238,.5)', fontSize:'11px', fontWeight:700, letterSpacing:'.1em', cursor:'pointer', fontFamily:'var(--font,Raleway,sans-serif)' }
