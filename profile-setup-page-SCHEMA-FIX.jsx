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
const CURRENCIES = [
  { code:'NGN', symbol:'\u20a6' }, { code:'USD', symbol:'$' }, { code:'GBP', symbol:'\u00a3' },
  { code:'EUR', symbol:'\u20ac' }, { code:'KES', symbol:'KSh' }, { code:'GHS', symbol:'GH\u20b5' },
  { code:'ZAR', symbol:'R' },
]
const NOTICE_PERIODS = ['Immediately','2 weeks','1 month','2 months','3+ months']
const WORK_DURATIONS = ['Less than 1 year','1–2 years','2–3 years','3–5 years','5–10 years','10+ years']

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
function buildScreens(form, showTrackScreens, allowAddTrack) {
  const isCandidate   = form.active_tracks.includes('candidate')
  const isSpeaker     = form.active_tracks.includes('speaker')
  const isFacilitator = form.active_tracks.includes('facilitator')
  const s = []

  if (showTrackScreens) {
    s.push({ key:'active_tracks', kind:'primary-track', section:'Track' })
    // A second track is only ever offered when someone explicitly returns
    // to change their paths after their first profile already exists —
    // never during initial signup. Previously this showed right after
    // picking the first track, in the same session, before that profile
    // was even submitted — and the two tracks were saved onto a single
    // row anyway, not the "independently-listed profile" the copy implied.
    if (allowAddTrack && form.active_tracks.length > 0) s.push({ key:'active_tracks', kind:'add-track', section:'Track' })
  }
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
  if (isCandidate) s.push({ key:'work_history', kind:'list', section:'Expertise', title:'Add your work history.', sub:'Optional — up to 3 roles. Buyers use this to understand your track record.', fields:[{ key:'title', placeholder:'Job title' }, { key:'org', placeholder:'Organisation' }, { key:'duration', type:'select', options:WORK_DURATIONS, placeholder:'Duration' }], max:3, addLabel:'+ Add role', required:false })
  if (isCandidate) s.push({ key:'certifications', kind:'text', section:'Expertise', title:'Any certifications or credentials?', sub:'Optional — comma separated.', placeholder:'PMP, Google Analytics, HubSpot Marketing', required:false })

  s.push({ key:'photo_url', kind:'photo', section:'Media', title:'Add a profile photo.', sub:'Profiles with a photo receive significantly more introduction requests.' })
  s.push({ key:'youtube_links', kind:'link-list', section:'Media', title: isSpeaker ? 'Add your speaker reel.' : 'Add a video link.', sub:'Optional — YouTube URLs, up to 4.', max:4, required:false })
  s.push({ key:'linkedin_url', kind:'text', section:'Media', inputType:'url', title:'Your LinkedIn profile?', sub:'Optional.', placeholder:'https://linkedin.com/in/yourname', required:false })
  s.push({ key:'website_url', kind:'text', section:'Media', inputType:'url', title:'A personal website or portfolio?', sub:'Optional.', placeholder:'https://yourwebsite.com', required:false })

  s.push({ key:'availability', kind:'single-radio', section:'Terms', title:'What\u2019s your current availability?', options:AVAILABILITY })
  if (isCandidate) s.push({ key:'contract_preference', kind:'single-radio', section:'Terms', title:'What kind of work are you open to?', options:CONTRACT_PREFS })
  if (isCandidate) s.push({ key:'notice_period', kind:'select', section:'Terms', title:'How quickly could you start a new role?', sub:'Optional.', options:NOTICE_PERIODS, required:false })
  if (isCandidate) s.push({ key:'salary_expectation', kind:'currency-range', section:'Terms', title:'What\u2019s your salary expectation?', sub:'Optional — helps match you to relevant opportunities. Pick your currency.', period:'year', required:false })
  if (isSpeaker || isFacilitator) s.push({ key:'fee_range', kind:'currency-range', section:'Terms', title: isFacilitator && isSpeaker ? 'Your speaking / facilitation fee?' : isSpeaker ? 'Your speaking fee?' : 'Your facilitation day rate?', sub:'Optional — visible to buyers on your profile. Pick your currency.', period:'engagement', required:false })
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
  const [saveError, setSaveError] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [editingTracks, setEditingTracks] = useState(false)
  const [submittedInfo, setSubmittedInfo] = useState(null)
  const fileRef = useRef(null)
  // Captured once on load — whether this person already had tracks set
  // before this session touched anything. A returning multi-track profile
  // must never have its second track silently wiped just because they
  // clicked through a "pick one" screen again.
  const hadExistingTracksRef = useRef(false)
  // The assessment app can auto-list a profile (listing_status: 'listed')
  // the moment someone signs up post-assessment. Previously every save
  // here unconditionally reset that to 'pending', silently unlisting
  // someone from the marketplace just because they opened this page to
  // add a photo. Preserve whatever status already existed on load.
  const existingListingStatusRef = useRef(null)

  const [form, setForm] = useState(EMPTY_FORM)

  const isCandidate   = form.active_tracks.includes('candidate')
  const isSpeaker     = form.active_tracks.includes('speaker')
  const isFacilitator = form.active_tracks.includes('facilitator')

  // New profiles: forced through "pick one, then optionally add a second"
  // so nobody multi-selects three tracks without deliberation. Returning
  // profiles skip straight past those two screens — their tracks stay
  // exactly as they were unless they explicitly hit "Change your paths".
  const showTrackScreens = !hadExistingTracksRef.current || editingTracks
  const screens = useMemo(() => buildScreens(form, showTrackScreens, editingTracks), [form.active_tracks, form.display_name, isSpeaker, isFacilitator, showTrackScreens, editingTracks])
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
        hadExistingTracksRef.current = (existing.active_tracks || []).length > 0
        existingListingStatusRef.current = existing.listing_status || null
        setForm(f => ({
          ...f, ...existing,
          // The DB column is experience_years, not years_experience — the
          // form's field key. A plain `...existing` spread doesn't map one
          // onto the other, so without this an existing value never made
          // it back into the form on reload.
          years_experience:    existing.experience_years != null ? String(existing.experience_years) : f.years_experience,
          // The DB column is a text[]; the form uses a single string
          // (single-select control). Unwrap on the way in, wrap on the way
          // out (see saveProgress below).
          availability:        Array.isArray(existing.availability) ? (existing.availability[0] || f.availability) : (existing.availability || f.availability),
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

      // Fallback: professional_profiles.valu_index is meant to hold a copy of
      // this person's VALU Index result, but nothing currently syncs it from
      // the assessment platform's valu_assessments table (see the Supabase
      // sync trigger this depends on — supabase/sync-valu-to-profile.sql).
      // Until that trigger has run for everyone, check directly here so a
      // completed assessment isn't shown as "Pending" just because the copy
      // hasn't landed yet. Also self-heals professional_profiles so future
      // loads (and the public profile page) don't need this fallback again.
      if (existing?.valu_index == null) {
        const { data: assessment } = await supabase
          .from('valu_assessments')
          .select('total_score, cluster_scores, designation, completed_at, expires_at')
          .or(`user_id.eq.${user.id},email.eq.${user.email}`)
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (assessment?.total_score != null) {
          setForm(f => ({
            ...f,
            valu_index: assessment.total_score,
            cluster_scores: assessment.cluster_scores,
            designation: assessment.designation,
            assessment_completed_at: assessment.completed_at,
            assessment_expires_at: assessment.expires_at,
          }))
          if (assessment.total_score >= 35) {
            existingListingStatusRef.current = existingListingStatusRef.current || 'listed'
          }
        }
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
    if (!user) return false
    const f = overrides || form
    setSaving(true)
    const { error } = await supabase.from('professional_profiles').upsert({
      id: user.id,
      display_name: f.display_name || null, headline: f.headline || null,
      location: f.location || null, industry: f.industry || null,
      // Real column is experience_years, not years_experience (that's the
      // form field's key). Sending the wrong key doesn't just drop this one
      // field — PostgREST rejects the entire upsert if any key doesn't
      // match a real column, so every field below was failing to save too.
      experience_years: f.years_experience ? parseInt(f.years_experience) : null,
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
      // Real column is a text[]; the form is a single-select string.
      availability: f.availability ? [f.availability] : [],
      modality: f.modality,
      contract_preference: f.contract_preference, notice_period: f.notice_period || null,
      salary_expectation: f.salary_expectation || null, fee_range: f.fee_range || null,
      // Carried forward from the valu_assessments fallback lookup (or a real
      // sync) in the load effect above — only written if we actually have a
      // value, so a save never accidentally clears an existing score.
      ...(f.valu_index != null ? { valu_index: f.valu_index } : {}),
      ...(f.cluster_scores != null ? { cluster_scores: f.cluster_scores } : {}),
      ...(f.designation != null ? { designation: f.designation } : {}),
      ...(f.assessment_completed_at != null ? { assessment_completed_at: f.assessment_completed_at } : {}),
      ...(f.assessment_expires_at != null ? { assessment_expires_at: f.assessment_expires_at } : {}),
      listing_status: existingListingStatusRef.current || 'pending', updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    setSaving(false)
    if (error) {
      console.error('Profile save failed:', error)
      setSaveError('Your last change didn\u2019t save — check your connection and try again.')
      return false
    }
    setSaveError('')
    return true
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
    const ok = await saveProgress()
    if (!ok) { setSaving(false); return }
    // Fetch back what the database actually assigned (atb_id is set by a
    // trigger, not by this app) so we can show it — previously this just
    // redirected silently with no confirmation of any kind.
    const { data: row } = await supabase
      .from('professional_profiles')
      .select('atb_id, listing_status')
      .eq('id', user.id)
      .maybeSingle()
    setSaving(false)
    setSubmittedInfo({ atb_id: row?.atb_id || null, listing_status: row?.listing_status || 'pending' })
  }

  async function handleSaveExit() {
    await saveProgress()
    router.push('/dashboard')
  }

  if (!ready) return <div style={{ minHeight:'100vh', background:DARK, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font,Raleway,sans-serif)', color:DIM, fontSize:'13px' }}>Loading…</div>

  if (submittedInfo) {
    return (
      <div style={{ minHeight:'100vh', background:DARK, color:PARCH, fontFamily:'var(--font,Raleway,sans-serif)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
        <div style={{ maxWidth:'480px', width:'100%', textAlign:'center' }}>
          <div style={{ height:'3px', display:'flex', marginBottom:'40px', borderRadius:'2px', overflow:'hidden' }}>
            {Object.values(PRIME_COLORS).map((c,i) => <div key={i} style={{ flex:1, background:c, opacity:.85 }} />)}
          </div>
          <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'rgba(29,158,117,.12)', border:'1px solid rgba(29,158,117,.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <Title>You&apos;re in,<br/><Em>{form.display_name?.split(' ')[0] || 'welcome'}.</Em></Title>
          <p style={{ fontSize:'14px', fontWeight:300, color:DIM, lineHeight:1.75, marginBottom:'28px' }}>
            Your profile has been submitted to the founding cohort.
          </p>

          <div style={{ background:MID, border:`1px solid ${GLINE}`, padding:'24px', marginBottom:'24px' }}>
            <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', color:'rgba(201,168,76,.45)', marginBottom:'10px' }}>YOUR PROFILE ID</div>
            {submittedInfo.atb_id ? (
              <div style={{ fontSize:'22px', fontWeight:700, color:GOLD, letterSpacing:'.04em', fontFamily:'monospace' }}>{submittedInfo.atb_id}</div>
            ) : (
              <div style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.6 }}>Your ID will appear on your dashboard once your profile clears review — usually within 48 hours.</div>
            )}
          </div>

          <div style={{ background:'rgba(201,168,76,.05)', border:`1px solid ${GLINE}`, padding:'20px', marginBottom:'28px', textAlign:'left' }}>
            <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', color:'rgba(201,168,76,.45)', marginBottom:'10px' }}>WHAT HAPPENS NEXT</div>
            <p style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.8, margin:0 }}>
              Status: <strong style={{ color:PARCH }}>{submittedInfo.listing_status === 'listed' ? 'Listed' : 'Pending review'}</strong>. Complete the VALU Index (if you haven&apos;t already) to become eligible for marketplace listing — a score of 35 or above unlocks it.
            </p>
          </div>

          <button onClick={() => router.push('/dashboard')} style={{ display:'block', width:'100%', padding:'16px', background:GOLD, color:DARK, fontSize:'12px', fontWeight:700, letterSpacing:'.14em', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            GO TO DASHBOARD →
          </button>
        </div>
      </div>
    )
  }

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
          selectAndAdvance={selectAndAdvance} goNext={goNext} saving={saving} saveError={saveError}
          photoUploading={photoUploading} photoError={photoError} fileRef={fileRef} uploadPhoto={uploadPhoto}
          isCandidate={isCandidate} isSpeaker={isSpeaker} isFacilitator={isFacilitator}
          tags={tags} videoLinks={videoLinks} handleFinish={handleFinish}
          onChangeTracks={() => { setEditingTracks(true); setScreenIndex(0) }}
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
          photoUploading, photoError, fileRef, uploadPhoto, isSpeaker, tags, videoLinks, handleFinish, onChangeTracks } = props

  const val = form[screen.key]

  switch (screen.kind) {

    case 'primary-track': {
      const options = [
        { id:'candidate',   label:'Candidate / Talent', desc:'I want employers and recruiters to find me through ATB Connect.', color:'#378ADD' },
        { id:'speaker',     label:'Speaker',            desc:'I want to be booked for events and conferences through ATB Spotlight.', color:GOLD },
        { id:'facilitator', label:'Facilitator',        desc:'I want to be commissioned for L&D programmes through ATB Develop.', color:'#1D9E75' },
      ]
      const current = form.active_tracks[0] || null
      return (
        <div>
          <Title>How are you joining<br/><Em>Valoria?</Em></Title>
          <Sub>Pick the path that fits best. Once your profile is live, you can add a second path from your dashboard.</Sub>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'8px' }}>
            {options.map(t => {
              const active = current === t.id
              return (
                <div key={t.id}
                  onClick={() => selectAndAdvance('active_tracks', [t.id, ...form.active_tracks.filter(x => x !== t.id)])}
                  style={{ padding:'20px', border:`1.5px solid ${active ? t.color : GLINE}`, cursor:'pointer', background: active ? `${t.color}0f` : `${MID}66`, transition:'all .15s' }}>
                  <div style={{ fontSize:'15px', fontWeight:600, color: active ? t.color : PARCH, marginBottom:'6px' }}>{t.label}</div>
                  <p style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.65, margin:0 }}>{t.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    case 'add-track': {
      const allTracks = [
        { id:'candidate',   label:'Candidate / Talent', color:'#378ADD' },
        { id:'speaker',     label:'Speaker',            color:GOLD },
        { id:'facilitator', label:'Facilitator',        color:'#1D9E75' },
      ]
      const primary = form.active_tracks[0]
      const others  = allTracks.filter(t => t.id !== primary)
      return (
        <div>
          <Title>Want to add a<br/><Em>second path?</Em></Title>
          <Sub>Optional — this gives you a second, independently-listed profile in that marketplace too. You can also do this later from your dashboard.</Sub>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'28px' }}>
            {others.map(t => {
              const active = form.active_tracks.includes(t.id)
              return (
                <div key={t.id} onClick={() => toggleArr('active_tracks', t.id)}
                  style={{ padding:'18px 20px', border:`1.5px solid ${active ? t.color : GLINE}`, cursor:'pointer', background: active ? `${t.color}0f` : `${MID}66`, display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'18px', height:'18px', border:`2px solid ${active ? t.color : 'rgba(247,244,238,.25)'}`, borderRadius:'4px', background: active ? t.color : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {active && <span style={{ color: t.id === 'speaker' ? DARK : '#fff', fontSize:'11px', fontWeight:700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:'15px', fontWeight:600, color: active ? t.color : PARCH }}>{t.label}</span>
                </div>
              )
            })}
          </div>
          <ContinueBar onNext={goNext} nextDisabled={false} saving={saving} showSkip />
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

    case 'select': {
      const isValid = !screen.required || !!val
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <select value={val || ''} onChange={e => set(screen.key, e.target.value)} style={selectStyle}>
            <option value="" disabled>Select…</option>
            {screen.options.map(o => (
              typeof o === 'string'
                ? <option key={o} value={o}>{o}</option>
                : <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ContinueBar onNext={goNext} nextDisabled={!isValid} saving={saving} showSkip={!screen.required && !val} />
        </div>
      )
    }

    case 'currency-range': {
      return (
        <div>
          <Title>{screen.title}</Title>
          {screen.sub && <Sub>{screen.sub}</Sub>}
          <CurrencyRangeInput value={val} onChange={v => set(screen.key, v)} periodLabel={screen.period} />
          <ContinueBar onNext={goNext} nextDisabled={false} saving={saving} showSkip={!screen.required && !val} />
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
                  f.type === 'select' ? (
                    <select key={f.key} style={selectStyle} value={row[f.key] || ''}
                      onChange={e => updateListItem(screen.key, i, f.key, e.target.value)}>
                      <option value="" disabled>{f.placeholder}</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input key={f.key} style={inputStyle} placeholder={f.placeholder} value={row[f.key] || ''}
                      onChange={e => updateListItem(screen.key, i, f.key, e.target.value)} />
                  )
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
      return <ReviewScreen {...props} tags={tags} videoLinks={videoLinks} handleFinish={handleFinish} onChangeTracks={onChangeTracks} />
    }

    default:
      return null
  }
}

function ReviewScreen({ form, isCandidate, isSpeaker, isFacilitator, tags, videoLinks, handleFinish, saving, saveError, set, onChangeTracks }) {
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

      <button onClick={onChangeTracks} style={{ background:'none', border:'none', color:GOLD, fontSize:'12px', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline', padding:0, marginBottom:'24px', display:'block' }}>
        Change your paths →
      </button>

      {/* Someone who signed up through the assessment app already has a
          valu_index/designation/assessment_completed_at on this row —
          previously this block ignored that entirely and told every single
          person to go take the assessment, even people who'd already
          scored and were sitting in front of their own result. */}
      {form.assessment_completed_at ? (
        <div style={{ background:'rgba(29,158,117,.06)', border:'1px solid rgba(29,158,117,.3)', padding:'20px', marginBottom:'24px' }}>
          <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', color:'#1D9E75', marginBottom:'10px' }}>VALU INDEX — COMPLETE</div>
          <p style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.7, margin:'0 0 6px' }}>
            Your VALU Index score is <strong style={{ color:PARCH }}>{form.valu_index}</strong>
            {form.designation ? <> — <strong style={{ color:'#1D9E75' }}>{form.designation}</strong></> : null}.
          </p>
          <p style={{ fontSize:'12px', fontWeight:300, color:DIM, lineHeight:1.6, margin:0 }}>
            {Number(form.valu_index) >= 35
              ? 'You\u2019re eligible for marketplace listing once this profile is reviewed.'
              : 'Profiles scoring 35 or above become eligible for marketplace listing — you can retake the VALU Index any time to improve your score.'}
          </p>
        </div>
      ) : (
        <div style={{ background:'rgba(201,168,76,.05)', border:`1px solid ${GLINE}`, padding:'20px', marginBottom:'24px' }}>
          <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'.18em', color:'rgba(201,168,76,.45)', marginBottom:'10px' }}>NEXT — VALU INDEX ASSESSMENT</div>
          <p style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.7, margin:'0 0 14px' }}>
            Your profile is set to <strong style={{ color:PARCH }}>Pending</strong> until you complete the VALU Index. Profiles scoring 35 or above become eligible for marketplace listing. The assessment takes approximately 25 minutes.
          </p>
          <a href="https://assessment.valoriainstitute.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize:'11px', fontWeight:700, letterSpacing:'.12em', color:GOLD, textDecoration:'none' }}>
            TAKE THE VALU INDEX →
          </a>
        </div>
      )}

      <label style={{ display:'flex', alignItems:'flex-start', gap:'12px', cursor:'pointer', marginBottom:'28px' }}>
        <input type="checkbox" checked={form.consent} onChange={e => set('consent', e.target.checked)} style={{ width:'16px', height:'16px', accentColor:GOLD, marginTop:'2px', flexShrink:0 }} />
        <span style={{ fontSize:'13px', fontWeight:300, color:DIM, lineHeight:1.7 }}>
          I confirm all information provided is accurate. I understand my profile will be reviewed before listing, and my full name will only be shared with buyers after a formal introduction is facilitated by Valoria Institute.
        </span>
      </label>

      {saveError && (
        <p style={{ fontSize:'12px', color:'#F09595', margin:'0 0 14px', lineHeight:1.6 }}>{saveError}</p>
      )}

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
const selectStyle = { ...inputStyle, cursor:'pointer' }
const ghostBtnStyle = { padding:'10px 20px', background:'transparent', border:'1px solid rgba(201,168,76,.2)', color:'rgba(247,244,238,.5)', fontSize:'11px', fontWeight:700, letterSpacing:'.1em', cursor:'pointer', fontFamily:'var(--font,Raleway,sans-serif)' }

// ── Currency-aware amount range, used by salary_expectation and fee_range ──
// The underlying DB column is still a plain text string (no schema change
// needed), but the input itself is now a currency dropdown + two number
// fields instead of one free-text box with a hardcoded ₦ or $ in the
// placeholder — previously a candidate paid in Naira and a speaker quoting
// in Dollars were typing into the exact same unstructured field.
function parseCurrencyRange(str) {
  if (!str) return { currency:'NGN', min:'', max:'' }
  const m = str.match(/^(NGN|USD|GBP|EUR|KES|GHS|ZAR)\s[^\d]*([\d,]*)\s?(?:\u2013\s?[^\d]*([\d,]*))?/)
  if (!m) return { currency:'NGN', min:'', max:'', legacy: str }
  return { currency:m[1], min:(m[2]||'').replace(/,/g,''), max:(m[3]||'').replace(/,/g,'') }
}
function formatCurrencyRange({ currency, min, max }, periodLabel) {
  const sym = CURRENCIES.find(c => c.code === currency)?.symbol || currency
  const fmt = n => n ? Number(n).toLocaleString() : ''
  if (!min && !max) return ''
  if (min && max) return `${currency} ${sym}${fmt(min)} \u2013 ${sym}${fmt(max)}${periodLabel ? ' / ' + periodLabel : ''}`
  return `${currency} ${sym}${fmt(min || max)}${periodLabel ? ' / ' + periodLabel : ''}`
}
function CurrencyRangeInput({ value, onChange, periodLabel }) {
  const parsed = parseCurrencyRange(value)
  const [currency, setCurrency] = useState(parsed.currency)
  const [min, setMin] = useState(parsed.min)
  const [max, setMax] = useState(parsed.max)

  function commit(next) {
    const merged = { currency, min, max, ...next }
    onChange(formatCurrencyRange(merged, periodLabel))
  }

  return (
    <div>
      {parsed.legacy && (
        <p style={{ fontSize:'11px', color:DIM, margin:'0 0 10px' }}>
          Currently saved: <span style={{ color:PARCH }}>{parsed.legacy}</span> — update below to replace it.
        </p>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'110px 1fr 1fr', gap:'10px', marginBottom:'6px' }}>
        <select value={currency} onChange={e => { setCurrency(e.target.value); commit({ currency:e.target.value }) }} style={selectStyle}>
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>)}
        </select>
        <input type="number" min="0" inputMode="numeric" style={inputStyle} placeholder="Min" value={min}
          onChange={e => { setMin(e.target.value); commit({ min:e.target.value }) }} />
        <input type="number" min="0" inputMode="numeric" style={inputStyle} placeholder="Max" value={max}
          onChange={e => { setMax(e.target.value); commit({ max:e.target.value }) }} />
      </div>
      {periodLabel && <p style={{ fontSize:'11px', color:DIM, margin:0 }}>per {periodLabel}</p>}
    </div>
  )
}
