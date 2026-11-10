import React, { useEffect, useMemo, useRef, useState } from 'react';
import './valu-results-responsive.css';
import VALUAssessmentJourney from './VALUAssessmentJourney.jsx';

const API_BASE = (() => {
  const configuredOrigin = String(import.meta.env.VITE_VALU_API_ORIGIN || '').trim().replace(/\/$/, '');
  if (configuredOrigin) return configuredOrigin;

  // Serverless API routes live at the deployment root, not under Vite's
  // /valu/assessment/ asset base. The latter produces POSTs to a path that
  // falls through to index.html and returns 405.
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  if (host === 'valoria-staging-site.riverwayse.workers.dev') return 'https://valoria-staging-assessment.riverwayse.workers.dev';
  if (host === 'valoria-staging-assessment.riverwayse.workers.dev') return typeof window !== 'undefined' ? window.location.origin : '';
  if (host === 'valoriainstitute.com' || host === 'www.valoriainstitute.com' || host === 'assessment.valoriainstitute.com') {
    return 'https://assessment.valoriainstitute.com';
  }

  // Preview deployments call their own root-level API functions.
  return typeof window !== 'undefined' ? window.location.origin : '';
})();

const SITE_BASE = (() => {
  const configuredOrigin = String(import.meta.env.VITE_VALU_SITE_ORIGIN || '').trim().replace(/\/$/, '');
  if (configuredOrigin) return configuredOrigin;
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  if (host === 'valoria-staging-assessment.riverwayse.workers.dev') return 'https://valoria-staging-site.riverwayse.workers.dev';
  if (host.endsWith('.workers.dev')) return typeof window !== 'undefined' ? window.location.origin : '';
  if (host.includes('staging')) return 'https://staging.valoriainstitute.com';
  if (host === 'assessment.valoriainstitute.com' || host === 'valoriainstitute.com' || host === 'www.valoriainstitute.com') return 'https://valoriainstitute.com';
  // Preview deployments must be paired with their site origin explicitly;
  // never silently route preview authentication into production.
  return '';
})();

import { EXPERIENCE_BANDS, TASTER_QUESTIONS, VALU_VERSION } from './valuTaster.js';

const CLUSTERS={P:'Presence',R:'Relationships',I:'Intelligence',M:'Mastery',E:'Enterprise'};
const COLORS={P:'#C9A84C',R:'#C9A84C',I:'#C9A84C',M:'#C9A84C',E:'#C9A84C'};
const DARK='#1A1A2E', SURFACE='#2E2E4A', PARCH='#FAFAF7', GOLD='#C9A84C', BRASS='#D4C9A8', DIM='rgba(250,250,247,.68)';

const RESUME_TOKEN_KEY = 'valu_taster_resume_token';
const SIGNUP_KEY_KEY = 'valu_taster_signup_key';

// Entry flow for the VALU journey.
// Participants begin with the VALU taster before account setup.
// Taster responses are stored and scored independently; they never populate
// the formal VALU assessment response record.
export default function VALUIndexV4GateNext(){
 const [phase,setPhase]=useState('loading');
 const [name,setName]=useState(''),[role,setRole]=useState(''),[experience,setExperience]=useState(''),[email,setEmail]=useState('');
 const [organisation,setOrganisation]=useState(''),[interest,setInterest]=useState('');
 const [marketingConsent,setMarketingConsent]=useState(false),[privacyAcknowledged,setPrivacyAcknowledged]=useState(false);
 const [registrationKey,setRegistrationKey]=useState('');
 const [current,setCurrent]=useState(0),[answers,setAnswers]=useState({}),[selected,setSelected]=useState(null);
 const [questionBank,setQuestionBank]=useState(TASTER_QUESTIONS);
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const [progressToken,setProgressToken]=useState('');
 const [submissionKey,setSubmissionKey]=useState('');
 const [tasterId,setTasterId]=useState('');
 const startedRef=useRef(false);
 const timer=useRef(null);

 const q=questionBank[current];
 const sessionProgress=Math.round(((current+1)/questionBank.length)*100);
 const placeInAssessment=current+1;

 useEffect(()=>()=>{timer.current&&clearTimeout(timer.current)},[]);

 async function postProgress(body){
  const response=await fetch(API_BASE+'/api/taster-progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
   const failure=new Error(payload.error||'Your progress could not be saved.');
   failure.status=response.status;
   throw failure;
  }
  return payload;
 }

 // Restore a registered session, or require registration before any new taster begins.
 useEffect(()=>{
  if(startedRef.current)return;
  startedRef.current=true;
  let cancelled=false;
  async function begin(){
   let pending='';
   try{pending=localStorage.getItem('pending_taster_id')||''}catch{}
   if(pending){
    window.location.assign((SITE_BASE?SITE_BASE:'')+'/journey/continue?stage=assess&taster_id='+encodeURIComponent(pending));
    return;
   }
   let stored='';
   try{stored=localStorage.getItem(RESUME_TOKEN_KEY)||''}catch{}
   if(stored){
    try{
     const loaded=await postProgress({action:'load',resume_token:stored});
     if(cancelled)return;
     const p=loaded.progress||{};
     const version=String(p.taster_version||'4.1');
     let restoredBank=null;
     if(version===VALU_VERSION){
      restoredBank=TASTER_QUESTIONS;
     }else if(version==='4.1'){
      const legacy=await import('./valuTasterLegacy.js');
      restoredBank=legacy.LEGACY_TASTER_QUESTIONS;
     }else{
      setProgressToken(stored);
      setError('Your saved session needs assistance before it can continue. Your responses remain saved. Please contact Valoria support.');
      setPhase('unsupported');
      return;
     }
     setQuestionBank(restoredBank);
     setName(p.name||'');setRole(p.role||'');setExperience(p.experience||'');setEmail(p.email||'');
     setProgressToken(stored);
     setPrivacyAcknowledged(Boolean(p.lead_capture_id));
     const savedAnswers=p.answers&&typeof p.answers==='object'?p.answers:{};
     setAnswers(savedAnswers);
     setSubmissionKey(p.submission_key||'');
     const answeredCount=Object.keys(savedAnswers).length;
     const complete=Number(p.current_question)===restoredBank.length&&answeredCount===restoredBank.length&&!!p.submission_key;
     if(p.lead_capture_id){
      if(complete){setCurrent(restoredBank.length-1);setPhase('break');return}
      setCurrent(Math.min(Number(p.current_question)||0,restoredBank.length-1));
      setPhase('session1');
      return;
     }
     // Legacy in-progress sessions are preserved. Their owner registers once
     // before continuing, which attaches the existing progress to a lead ID.
     try{setRegistrationKey(localStorage.getItem(SIGNUP_KEY_KEY)||'')}catch{}
     setCurrent(Math.min(Number(p.current_question)||0,restoredBank.length-1));
     setPhase('registration');
     return;
    }catch(err){
     if(cancelled)return;
     if(err?.status===401||err?.status===404){
      try{localStorage.removeItem(RESUME_TOKEN_KEY);localStorage.removeItem(SIGNUP_KEY_KEY)}catch{}
      setPhase('registration');
      return;
     }
     // Transient network/server failures must never erase the only local
     // reference to a participant's saved progress.
     setProgressToken(stored);
     setError('Your saved responses remain stored. We could not reach your session just now. Check your connection and try again.');
     setPhase('resume-error');
     return;
    }
   }
   if(!cancelled)setPhase('registration');
  }
  begin();
  return ()=>{cancelled=true};
 },[]);

 async function answer(index){
  const next={...answers,[current]:index};
  setAnswers(next);
  setSaving(true);
  setError('');
  try{
   const isLast=current===questionBank.length-1;
   const response=await postProgress({
    action:'save',
    resume_token:progressToken,
    answers:next,
    current_question:isLast?questionBank.length:current+1,
    ...(isLast&&submissionKey?{submission_key:submissionKey}:{}),
   });
   if(response.submission_key&&!submissionKey)setSubmissionKey(response.submission_key);
   if(isLast){
    // The break screen must not appear until all nine responses are persisted.
    setPhase('break');
    return;
   }
   setCurrent(v=>v+1);
  }catch(err){
   setError(err?.message||'Your answer could not be saved. Please retry before continuing.');
  }finally{
   setSaving(false);
   setSelected(null);
  }
 }

 function choose(index){if(selected!==null||saving)return;setSelected(index);timer.current=setTimeout(()=>answer(index),120)}

 const identityValid=!!(name.trim()&&role.trim()&&experience&&email.trim()&&privacyAcknowledged);

 async function registerForTaster(e){
  e.preventDefault();
  if(saving)return;
  setSaving(true);
  setError('');
  try{
   const token=progressToken||(()=>{
    const bytes=new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   })();
   const signupKey=registrationKey||window.crypto.randomUUID();
   setProgressToken(token);
   setRegistrationKey(signupKey);
   try{localStorage.setItem(RESUME_TOKEN_KEY,token);localStorage.setItem(SIGNUP_KEY_KEY,signupKey)}catch{}
   const data=await postProgress({
    action:'register',resume_token:token,signup_key:signupKey,
    name:name.trim(),role:role.trim(),experience,email:email.trim().toLowerCase(),
    organisation:organisation.trim(),interest,
    marketing_consent:marketingConsent,privacy_acknowledged:privacyAcknowledged,
   });
   if(!data.lead_capture_id)throw new Error('Your registration could not be connected to your VALU journey. Please retry.');
   const answeredCount=Object.keys(answers).length;
   const complete=current===questionBank.length-1&&answeredCount===questionBank.length&&!!submissionKey;
   setPhase(complete?'break':answeredCount?'session1':'intro');
  }catch(err){
   setError(err?.message||'We could not save your registration. Please retry.');
  }finally{
   setSaving(false);
  }
 }

 async function createAccount(e){
  e.preventDefault();
  if(!progressToken||saving)return;
  setSaving(true);
  setError('');
  try{
   const key=submissionKey||(typeof window.crypto!=='undefined'&&window.crypto.randomUUID?window.crypto.randomUUID():'');
   if(!key)throw new Error('Your browser could not create a secure submission reference. Refresh the page and try again.');
   setSubmissionKey(key);
   const saved=await postProgress({action:'save',resume_token:progressToken,answers,current_question:questionBank.length,submission_key:key});
   if(saved.submission_key&&saved.submission_key!==key)throw new Error('This session already has a different submission reference. Refresh the page to continue.');
   const response=await fetch(API_BASE+'/api/submit-taster',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resume_token:progressToken,submission_key:key})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Your taster could not be saved. Please retry.');
   if(!data.taster_id)throw new Error('Your saved session is missing its continuation reference. Please retry.');
   setTasterId(data.taster_id);
   try{localStorage.setItem('pending_taster_id',data.taster_id)}catch{}
   const completion=await postProgress({action:'complete',resume_token:progressToken,taster_id:data.taster_id,submission_key:key});
   if(completion?.completed!==true)throw new Error('Your taster is saved, but we could not confirm the completion step. Please retry.');
   try{localStorage.removeItem(RESUME_TOKEN_KEY);localStorage.removeItem(SIGNUP_KEY_KEY)}catch{}
   const params=new URLSearchParams({taster_id:data.taster_id,name:name.trim(),role:role.trim(),experience,email:email.trim().toLowerCase()});
   window.location.assign((SITE_BASE?SITE_BASE:'')+'/professional-signup/?'+params.toString());
  }catch(err){
   setError(err?.message||'Your taster could not be saved yet. Your registered details and responses remain intact — please retry.');
   setSaving(false);
  }
 }

 if(phase==='resume-error')return <Shell>
  <section className="valu-results-header" style={S.resultsHeader}>
   <div style={S.resultsEyebrow}><span style={S.statusDot}/> SAVED PROGRESS</div>
   <h1 className="valu-results-title" style={S.h1}>Your progress is <em>safe.</em></h1>
   <p className="valu-results-intro" style={S.resultsIntro}>{error}</p>
   <button type="button" onClick={()=>window.location.reload()} style={S.primary}>TRY AGAIN</button>
  </section>
 </Shell>;

 if(phase==='unsupported')return <Shell>
  <section className="valu-results-header" style={S.resultsHeader}>
   <div style={S.resultsEyebrow}><span style={S.statusDot}/> SAVED SESSION</div>
   <h1 className="valu-results-title" style={S.h1}>Your session is <em>safe.</em></h1>
   <p className="valu-results-intro" style={S.resultsIntro}>{error}</p>
  </section>
 </Shell>;

 if(phase==='registration')return <Shell>
  <VALUAssessmentJourney stage="registration" />
  <section className="valu-results-header" style={S.resultsHeader}>
   <div style={S.resultsEyebrow}><span style={S.statusDot}/> YOUR DETAILS FIRST</div>
   <h1 className="valu-results-title" style={S.h1}>Start with your <em>details.</em></h1>
   <p className="valu-results-intro" style={S.resultsIntro}>Your details connect your responses to you, so you can pause and return without losing your place. You will create your Valoria account after completing the taster.</p>
  </section>
  <form onSubmit={registerForTaster} className="valu-entry-form-card" style={{...S.formCard,marginTop:18}}>
   <div style={S.formTop}><div><div style={S.eyebrow}>REGISTRATION</div><h2 style={S.formTitle}>Begin your VALU taster.</h2></div><div style={S.formTime}>BEFORE YOU BEGIN</div></div>
   <p style={S.formIntro}>Complete the required details and acknowledge the Privacy Notice. Your answers stay connected to your registration. Optional details can be added below.</p>
   <div className="valu-entry-form-grid" style={S.grid}>
    <Field label="FULL NAME"><input required style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="Your full professional name" autoComplete="name" maxLength={200}/></Field>
    <Field label="EMAIL ADDRESS"><input required style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={254}/></Field>
   </div>
   <div className="valu-entry-form-grid" style={S.grid}>
    <Field label="CURRENT ROLE"><input required style={S.input} value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Product Manager" autoComplete="organization-title" maxLength={160}/></Field>
    <Field label="PROFESSIONAL EXPERIENCE"><select required style={S.input} value={experience} onChange={e=>setExperience(e.target.value)}><option value="">Select your experience</option>{EXPERIENCE_BANDS.map(x=><option key={x.id} value={x.id}>{x.label} · {x.desc}</option>)}</select></Field>
   </div>
   <p style={S.note}>If you already have a Valoria account, use the email address associated with it so your taster can be connected to that account.</p>
   <details className="valu-optional-details">
    <summary>Add optional professional details</summary>
    <Field label="ORGANISATION (OPTIONAL)"><input style={S.input} value={organisation} onChange={e=>setOrganisation(e.target.value)} placeholder="Your organisation" autoComplete="organization" maxLength={180}/></Field>
    <Field label="WHAT ARE YOU MOST INTERESTED IN? (OPTIONAL)"><select style={S.input} value={interest} onChange={e=>setInterest(e.target.value)}><option value="">Select an interest</option><option value="Professional visibility">Professional visibility</option><option value="Career and leadership opportunities">Career and leadership opportunities</option><option value="Speaking and facilitation">Speaking and facilitation</option><option value="Learning and development">Learning and development</option><option value="Other">Other</option></select></Field>
   </details>
   <label style={{display:'flex',alignItems:'flex-start',gap:10,color:DIM,fontSize:11,lineHeight:1.6}}>
    <input type="checkbox" required checked={privacyAcknowledged} onChange={e=>setPrivacyAcknowledged(e.target.checked)} style={{marginTop:2,accentColor:GOLD}}/>
    <span>I acknowledge that Valoria will process these details to administer my assessment and manage my journey. Read the <a href={(SITE_BASE||'https://valoriainstitute.com')+'/privacypolicy'} style={{color:GOLD,textDecoration:'underline'}}>Privacy Notice</a>.</span>
   </label>
   <label style={{display:'flex',alignItems:'flex-start',gap:10,color:DIM,fontSize:11,lineHeight:1.6}}>
    <input type="checkbox" checked={marketingConsent} onChange={e=>setMarketingConsent(e.target.checked)} style={{marginTop:2,accentColor:GOLD}}/>
    <span>I'd also like to receive relevant Valoria updates, programmes and opportunities by email. This is optional.</span>
   </label>
   {error&&<div style={S.error} role="alert">{error}</div>}
   <button type="submit" disabled={saving} style={{...S.primary,opacity:saving?.5:1}}>{saving?'SAVING YOUR REGISTRATION…':'CONTINUE TO MY VALU TASTER →'}</button>
   <div style={S.saveNote}><span>✓</span> Your details will be connected to your saved taster.</div>
  </form>
 </Shell>;

 if(phase==='loading')return <Shell><div style={S.eyebrow}>VALU</div><h1 style={S.h1}>Preparing your taster…</h1><p style={S.p}>We are getting your session ready.</p></Shell>;

 if(phase==='intro')return <Shell>
  <section className="valu-assessment-intro" aria-labelledby="valu-taster-intro-title">
   <div className="valu-intro-kicker">VALORIA INSTITUTE <span>·</span> VALU TASTER</div>
   <div className="valu-intro-rule"><span/></div>
   <p className="valu-intro-overline">A CLEARER VIEW OF YOUR PROFESSIONAL CAPABILITY</p>
   <h1 id="valu-taster-intro-title" className="valu-intro-title">Your professional worth deserves to be <em>understood.</em></h1>
   <p className="valu-intro-copy">Begin with a short reflection on how you think, make strategic decisions, understand commercial value and work with AI. Your responses provide a starting point for your Valoria journey.</p>
   <div className="valu-intro-benefits">
    <div><span className="valu-intro-check">✓</span><span><strong>Simple, considered choices</strong><small>Choose the response that best reflects your experience.</small></span></div>
    <div><span className="valu-intro-check">✓</span><span><strong>Your progress is saved</strong><small>You can leave and return without losing saved responses.</small></span></div>
    <div><span className="valu-intro-check">✓</span><span><strong>A useful next step</strong><small>Your taster helps you understand where to continue.</small></span></div>
   </div>
   <button type="button" className="valu-intro-cta" onClick={()=>setPhase('session1')}>BEGIN MY VALU TASTER <span>→</span></button>
   <p className="valu-intro-assurance">Your responses are handled securely and are not shown as a public profile.</p>
  </section>
 </Shell>;

 if(phase==='break')return <Shell>
  <VALUAssessmentJourney stage="account" />
  <section className="valu-results-header" style={S.resultsHeader}>
   <div style={S.resultsEyebrow}><span style={S.statusDot}/> TASTER SAVED <span style={S.statusDivider}>/</span> VALU v{VALU_VERSION}</div>
   <h1 className="valu-results-title" style={S.h1}>Your taster is <em>saved.</em></h1>
   <p className="valu-results-intro" style={S.resultsIntro}>Your responses are safely saved. Create your account to continue your Valoria journey.</p>
  </section>
  <section aria-label="What happens next" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,margin:'8px 0 22px'}}>
   <div style={{padding:'16px 17px',border:'1px solid rgba(201,168,76,.28)',borderRadius:9,background:'rgba(201,168,76,.07)'}}>
    <div style={{fontSize:9,fontWeight:900,letterSpacing:'.13em',color:GOLD}}>01 · COMPLETED</div>
    <h3 style={{fontSize:14,color:PARCH,margin:'8px 0 5px'}}>Your VALU taster</h3>
    <p style={{fontSize:11,lineHeight:1.6,color:DIM,margin:0}}>Your responses are saved and ready for your next step.</p>
   </div>
   <div style={{padding:'16px 17px',border:'1px solid rgba(201,168,76,.28)',borderRadius:9,background:'rgba(201,168,76,.07)'}}>
    <div style={{fontSize:9,fontWeight:900,letterSpacing:'.13em',color:GOLD}}>02 · YOU ARE HERE</div>
    <h3 style={{fontSize:14,color:PARCH,margin:'8px 0 5px'}}>Create your account</h3>
    <p style={{fontSize:11,lineHeight:1.6,color:DIM,margin:0}}>Add your details now. You’ll set your password and confirm your email in the next step.</p>
   </div>
   <div style={{padding:'16px 17px',border:'1px solid rgba(201,168,76,.16)',borderRadius:9,background:'rgba(46,46,74,.35)'}}>
    <div style={{fontSize:9,fontWeight:900,letterSpacing:'.13em',color:'rgba(250,250,247,.55)'}}>03 · UP NEXT</div>
    <h3 style={{fontSize:14,color:PARCH,margin:'8px 0 5px'}}>Continue with Valoria</h3>
    <p style={{fontSize:11,lineHeight:1.6,color:DIM,margin:0}}>Confirm your email, then return to your dashboard to continue.</p>
   </div>
  </section>
  <section aria-label="Assessment progress" style={S.scoreSection}>
   <div className="valu-result-grid" style={{...S.resultGrid,gridTemplateColumns:'1fr 1fr'}}>
    <div style={S.resultRow}><div style={S.dimensionCode}>YOUR TASTER</div><h2 style={S.scoreName}>Saved</h2><strong style={S.scoreValue}>✓</strong></div>
    <div style={S.resultRow}><div style={S.dimensionCode}>NEXT STEP</div><h2 style={S.scoreName}>Account setup</h2><strong style={S.scoreValue}>→</strong></div>
   </div>
  </section>
  <section className="valu-entry-form-card" style={{...S.formCard,marginTop:18}}>
   <div style={S.formTop}><div><div style={S.eyebrow}>YOUR NEXT STEP</div><h2 style={S.formTitle}>Secure your Valoria account.</h2></div><div style={S.formTime}>ACCOUNT SETUP</div></div>
   <p style={S.formIntro}>Your registration details and taster are saved. Continue to create your Valoria account, confirm your email and access your dashboard.</p>
   <div className="valu-entry-form-grid" style={S.grid}>
    <div style={S.resultRow}><div style={S.dimensionCode}>REGISTERED NAME</div><h2 style={S.scoreName}>{name}</h2></div>
    <div style={S.resultRow}><div style={S.dimensionCode}>REGISTERED EMAIL</div><h2 style={{...S.scoreName,overflowWrap:'anywhere'}}>{email}</h2></div>
   </div>
   {error&&<div style={S.error} role="alert">{error}</div>}
   <button type="button" onClick={createAccount} disabled={saving} style={{...S.primary,opacity:saving?.5:1}}>{saving?'SAVING YOUR TASTER…':'CONTINUE TO ACCOUNT CREATION →'}</button>
   <div style={S.saveNote}><span>✓</span> Your registration and taster remain connected.</div>
  </section>
  <p style={S.note}>Completing the assessment does not grant marketplace listing. Listing eligibility depends on the full assessment, professional profile, capabilities, and applicable eligibility checks.</p>
 </Shell>;

 return <Shell mode="taster">
  <VALUAssessmentJourney stage="taster" currentQuestion={placeInAssessment} />
  <div className="valu-taster-top" style={S.top}><div><div style={S.eyebrow}>VALU TASTER</div><div style={S.cluster}>{q.cluster} · {CLUSTERS[q.cluster]}</div></div><div className="valu-taster-save-state"><span aria-hidden="true">✓</span> YOUR PROGRESS IS SAVED</div></div>
  <div className="valu-taster-progress" role="progressbar" aria-label="Taster progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={sessionProgress} style={S.progress}><div style={{...S.fill,width:`${sessionProgress}%`,background:COLORS[q.cluster]}}/></div>
  <h1 className="valu-taster-question" style={S.question}>{q.q}</h1>
  <div className="valu-taster-options" style={S.options}>{q.options.map((o,i)=><button className="valu-option" key={i} disabled={selected!==null||saving} onClick={()=>choose(i)} style={{...S.option,borderColor:(selected===i||answers[current]===i)?GOLD:'rgba(247,244,238,.1)',background:(selected===i||answers[current]===i)?'rgba(201,168,76,.14)':'#2E2E4A',opacity:selected!==null&&selected!==i?.58:1}}><span style={S.optionLetter}>{String.fromCharCode(65+i)}</span><span>{o.text}</span></button>)}</div>
  {current>0&&<button type="button" className="valu-assessment-back" disabled={saving||selected!==null} onClick={()=>setCurrent(value=>Math.max(0,value-1))}>← REVIEW PREVIOUS RESPONSE</button>}
  {error&&<div style={S.error}>{error}</div>}
  <p style={S.note}>Your progress is saved as you go.</p>
 </Shell>;
}
function Field({label,children}){return <label style={S.label}>{label}{children}</label>}
function StepBar({active}){return null}
function Shell({children,mode=''}){return <main id="main-content" tabIndex={-1} className={`valu-assessment-page ${mode ? `valu-assessment-${mode}` : ''}`} style={S.page}><div className="valu-assessment-shell" style={S.shell}>{children}</div></main>}

const S={
 page:{minHeight:'calc(100dvh - 65px)',height:'auto',background:DARK,color:PARCH,padding:'28px 32px 34px',overflowX:'hidden',overflowY:'auto',display:'flex',alignItems:'stretch',fontFamily:"'Raleway',sans-serif"},
 shell:{width:'100%',maxWidth:1160,margin:'0 auto',display:'flex',flexDirection:'column',minHeight:'auto'},
 eyebrow:{fontSize:8,fontWeight:800,letterSpacing:'.15em',color:BRASS},
 error:{padding:'12px 14px',border:'1px solid rgba(216,90,48,.3)',background:'rgba(216,90,48,.08)',borderRadius:8,color:'#F3A0A0',fontSize:12,lineHeight:1.5,marginBottom:12},
 steps:{display:'flex',justifyContent:'center',gap:28,margin:'0 0 42px',paddingBottom:18,borderBottom:'1px solid rgba(212,201,168,.16)'},
 step:{display:'flex',alignItems:'center',gap:8,fontSize:9,fontWeight:700,letterSpacing:'.14em',color:'rgba(250,250,247,.55)'},
 stepDot:{width:24,height:24,borderRadius:'50%',border:'1px solid rgba(201,168,76,.45)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,color:PARCH},
 top:{display:'flex',justifyContent:'space-between',alignItems:'flex-end'},
 cluster:{fontSize:11,color:'rgba(250,250,247,.5)',marginTop:5},
 counter:{fontSize:11,color:'rgba(250,250,247,.45)'},
 progress:{height:4,background:'rgba(250,250,247,.08)',margin:'14px 0 34px',borderRadius:99,overflow:'hidden'},
 fill:{height:'100%',borderRadius:99},
 question:{fontSize:'clamp(28px,4.5vw,44px)',fontWeight:500,lineHeight:1.16,letterSpacing:'-.025em',margin:'0 0 26px'},
 options:{display:'grid',gap:10},
 option:{appearance:"none",WebkitAppearance:"none",MozAppearance:"none",display:'grid',gridTemplateColumns:'34px 1fr',alignItems:'center',gap:14,textAlign:'left',padding:'17px 18px',border:'1px solid',borderRadius:9,color:PARCH,fontSize:14,lineHeight:1.55,cursor:'pointer',fontFamily:'inherit',transition:'border-color .18s,background .18s'},
 optionLetter:{width:30,height:30,border:'1px solid rgba(201,168,76,.42)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:GOLD,fontSize:11,fontWeight:700},
 h1:{fontSize:'clamp(40px,7vw,64px)',fontWeight:500,lineHeight:1.04,letterSpacing:'-.035em',margin:'0 0 14px'},
 p:{fontSize:13,lineHeight:1.75,color:DIM},
 formCard:{padding:'24px 28px',background:'rgba(46,46,74,.72)',border:'1px solid rgba(212,201,168,.2)',borderRadius:14,boxShadow:'0 20px 60px rgba(0,0,0,.22)'},
 formTop:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:18,paddingBottom:18,borderBottom:'1px solid rgba(212,201,168,.14)'},
 formTime:{fontSize:8,fontWeight:900,lineHeight:1.7,letterSpacing:'.13em',textAlign:'right',color:BRASS},
 formTitle:{fontSize:23,fontWeight:600,letterSpacing:'-.025em',margin:'5px 0 0',lineHeight:1.15},
 formIntro:{fontSize:11,lineHeight:1.45,color:'rgba(250,250,247,.52)',margin:'12px 0 16px',maxWidth:420},
 grid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12},
 label:{display:'grid',gap:6,fontSize:7.5,fontWeight:800,letterSpacing:'.14em',color:'rgba(250,250,247,.62)',marginBottom:11},
 input:{width:'100%',boxSizing:'border-box',padding:'10px 12px',background:'#23233A',border:'1px solid rgba(212,201,168,.2)',borderRadius:7,color:PARCH,fontSize:12.5,fontFamily:'inherit',outline:'none',minHeight:40},
 primary:{width:'100%',padding:'13px 18px',border:0,borderRadius:7,background:GOLD,color:DARK,fontWeight:900,letterSpacing:'.1em',fontSize:9.5,cursor:'pointer',fontFamily:'inherit',marginTop:3,minHeight:44},
 saveNote:{display:'flex',justifyContent:'center',gap:7,alignItems:'center',fontSize:9.5,color:'rgba(250,250,247,.42)',marginTop:13},
 resultsHeader:{maxWidth:790,margin:'0 auto',width:'100%'},
 resultsEyebrow:{display:'flex',alignItems:'center',gap:9,fontSize:9,fontWeight:800,letterSpacing:'.13em',color:BRASS,flexWrap:'wrap'},
 statusDot:{width:7,height:7,borderRadius:'50%',background:'#91B79A',display:'inline-block'},
 statusDivider:{opacity:.45},
 resultsIntro:{fontSize:14,lineHeight:1.75,color:DIM,maxWidth:690,margin:'0 0 24px'},
 scoreSection:{maxWidth:900,width:'100%',margin:'0 auto'},
 resultGrid:{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:10,margin:'0 0 18px'},
 resultRow:{position:'relative',minWidth:0,padding:'18px 15px 15px',border:'1px solid rgba(212,201,168,.16)',background:SURFACE,borderRadius:10,textAlign:'left',fontSize:11,display:'flex',flexDirection:'column',gap:10,overflow:'hidden'},
 dimensionCode:{fontSize:8,fontWeight:900,letterSpacing:'.14em',lineHeight:1.4,color:GOLD,marginBottom:1},
 scoreName:{fontSize:16,fontWeight:800,lineHeight:1.3,letterSpacing:'-.02em',color:PARCH,overflowWrap:'anywhere',margin:0},
 scoreValue:{fontSize:27,fontWeight:700,lineHeight:1.1,letterSpacing:'-.04em',color:PARCH,marginTop:'auto'},
 scoreOutOf:{fontSize:10,fontWeight:500,letterSpacing:0,color:'rgba(250,250,247,.42)',marginLeft:3},
 note:{fontSize:10,lineHeight:1.65,color:'rgba(250,250,247,.48)',maxWidth:900,margin:'14px auto 0',width:'100%'}
};
