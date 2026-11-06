import React, { useEffect, useMemo, useRef, useState } from 'react';
import './valu-results-responsive.css';
import VALUAssessmentJourney from './VALUAssessmentJourney.jsx';

const IS_PREVIEW = import.meta.env.VITE_VALU_PREVIEW === '1';

const API_BASE = (() => {
  const configuredOrigin = String(import.meta.env.VITE_VALU_API_ORIGIN || '').trim().replace(/\/$/, '');
  if (configuredOrigin) return configuredOrigin;

  // Serverless API routes live at the deployment root, not under Vite's
  // /valu/assessment/ asset base. The latter produces POSTs to a path that
  // falls through to index.html and returns 405.
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
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

// The nine-question directional taster is a separate instrument from the
// formal 58-question VALU assessment. Its answers are saved independently,
// never seed formal answers, and never produce an official VALU Index.
export default function VALUIndexV4GateNext(){
 const [phase,setPhase]=useState('loading');
 const [name,setName]=useState(IS_PREVIEW?'Staging Preview Participant':''),[role,setRole]=useState(IS_PREVIEW?'Product Experience Reviewer':''),[experience,setExperience]=useState(IS_PREVIEW?'9-15':''),[email,setEmail]=useState(IS_PREVIEW?'preview@example.com':'');
 const [current,setCurrent]=useState(0),[answers,setAnswers]=useState({}),[selected,setSelected]=useState(null);
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const [progressToken,setProgressToken]=useState('');
 const [submissionKey,setSubmissionKey]=useState('');
 const [tasterId,setTasterId]=useState('');
 const startedRef=useRef(false);
 const timer=useRef(null);

 const q=TASTER_QUESTIONS[current];
 const sessionProgress=Math.round(((current+1)/TASTER_QUESTIONS.length)*100);
 const placeInTaster=current+1;

 useEffect(()=>()=>{timer.current&&clearTimeout(timer.current)},[]);

 async function postProgress(body){
  const response=await fetch(API_BASE+'/api/taster-progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||'Your progress could not be saved.');
  return payload;
 }

 // Direct entry: restore a resumable session, or begin one anonymously.
 useEffect(()=>{
  if(startedRef.current)return;
  startedRef.current=true;
  let cancelled=false;
  async function begin(){
   // A participant who already completed the opening session and has a pending
   // assessment reference must not start a second, duplicate session. Send them
   // to the authenticated continuation instead.
   let pending='';
   try{pending=localStorage.getItem('pending_taster_id')||''}catch{}
   if(pending){
    window.location.assign((SITE_BASE?SITE_BASE:'')+'/journey/continue?stage=assess&taster_id='+encodeURIComponent(pending));
    return;
   }
   let stored='';
   try{stored=localStorage.getItem(RESUME_TOKEN_KEY)||''}catch{}
   try{
    if(stored){
     const loaded=await postProgress({action:'load',resume_token:stored});
     if(cancelled)return;
     const p=loaded.progress||{};
     setName(p.name||'');setRole(p.role||'');setExperience(p.experience||'');setEmail(p.email||'');
     const savedAnswers=p.answers&&typeof p.answers==='object'?p.answers:{};
     setAnswers(savedAnswers);
     setSubmissionKey(p.submission_key||'');
     setProgressToken(stored);
     const answeredCount=Object.keys(savedAnswers).length;
     const complete=Number(p.current_question)===TASTER_QUESTIONS.length&&answeredCount===TASTER_QUESTIONS.length&&!!p.submission_key;
     if(complete){setCurrent(TASTER_QUESTIONS.length-1);setPhase('break');return}
     setCurrent(Math.min(Number(p.current_question)||0,TASTER_QUESTIONS.length-1));
     setPhase('session1');
     return;
    }
   }catch{
    // A stale or expired resume token must not block entry: discard it and
    // start a fresh anonymous session below.
    try{localStorage.removeItem(RESUME_TOKEN_KEY)}catch{}
   }
   try{
    const created=await postProgress({action:'init'});
    if(cancelled)return;
    if(!created.resume_token)throw new Error('Your assessment could not be started. Please retry.');
    try{localStorage.setItem(RESUME_TOKEN_KEY,created.resume_token)}catch{}
    setProgressToken(created.resume_token);
    setPhase('session1');
   }catch(err){
    if(cancelled)return;
    setError(err?.message||'We could not start your assessment. Please refresh to retry.');
    setPhase('session1');
   }
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
   const isLast=current===TASTER_QUESTIONS.length-1;
   const response=await postProgress({
    action:'save',
    resume_token:progressToken,
    answers:next,
    current_question:isLast?TASTER_QUESTIONS.length:current+1,
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

 const identityValid=!!(name.trim()&&role.trim()&&experience&&email.trim());

 async function createAccount(e){
  e.preventDefault();
  if(!identityValid||saving)return;
  setSaving(true);
  setError('');
  try{
   // Attach the account identity to the saved session, then persist the snapshot.
   await postProgress({action:'identify',resume_token:progressToken,name:name.trim(),role:role.trim(),experience,email:email.trim().toLowerCase()});
   const key=submissionKey||(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'');
   if(!key)throw new Error('Your browser could not create a secure submission reference. Refresh the page and try again.');
   setSubmissionKey(key);
   const saved=await postProgress({action:'save',resume_token:progressToken,answers,current_question:TASTER_QUESTIONS.length,submission_key:key});
   if(saved.submission_key&&saved.submission_key!==key)throw new Error('This session already has a different submission reference. Refresh the page to continue.');
   const response=await fetch(API_BASE+'/api/submit-taster',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resume_token:progressToken,submission_key:key})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Your taster response could not be saved. Please retry.');
   if(!data.taster_id)throw new Error('Your saved session is missing its continuation reference. Please retry.');
   setTasterId(data.taster_id);
   try{localStorage.setItem('pending_taster_id',data.taster_id)}catch{}
   await postProgress({action:'complete',resume_token:progressToken,taster_id:data.taster_id,submission_key:key}).catch(()=>{});
   try{localStorage.removeItem(RESUME_TOKEN_KEY)}catch{}
   const params=new URLSearchParams({taster_id:data.taster_id,name:name.trim(),role:role.trim(),experience,email:email.trim().toLowerCase()});
   window.location.assign((SITE_BASE?SITE_BASE:'')+'/professional-signup/?'+params.toString());
  }catch(err){
   setError(err?.message||'Your account could not be created yet. Your saved responses are intact — please retry.');
   setSaving(false);
  }
 }

 if(phase==='loading')return <Shell preview={IS_PREVIEW}><div style={S.eyebrow}>VALU TASTER</div><h1 style={S.h1}>Preparing your assessment…</h1><p style={S.p}>We are getting Question 1 ready.</p></Shell>;

 if(phase==='break')return <Shell preview={IS_PREVIEW}>
  <VALUAssessmentJourney stage="account" preview={IS_PREVIEW} />
  <section className="valu-results-header" style={S.resultsHeader}>
   <div style={S.resultsEyebrow}><span style={S.statusDot}/> {IS_PREVIEW ? 'STAGING TASTER PREVIEW' : 'VALU TASTER SAVED'} <span style={S.statusDivider}>/</span> VALU v{VALU_VERSION}</div>
   <h1 className="valu-results-title" style={S.h1}>{IS_PREVIEW ? <>Your 9-question taster is <em>complete.</em></> : <>Your 9-question taster is <em>saved.</em></>}</h1>
   <p className="valu-results-intro" style={S.resultsIntro}>{IS_PREVIEW ? 'This is a local-only simulation. No taster answers, account details, or participant records are stored. The separate formal assessment preview begins at Question 1.' : 'Your taster responses are safely saved as a separate directional experience. They are not part of the formal 58-question assessment and will not prefill or count toward it.'}</p>
  </section>
  <section aria-label="What happens next" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,margin:'8px 0 22px'}}>
   <div style={{padding:'16px 17px',border:'1px solid rgba(201,168,76,.28)',borderRadius:9,background:'rgba(201,168,76,.07)'}}>
    <div style={{fontSize:9,fontWeight:900,letterSpacing:'.13em',color:GOLD}}>01 · COMPLETED</div>
    <h3 style={{fontSize:14,color:PARCH,margin:'8px 0 5px'}}>Your 9-question taster</h3>
    <p style={{fontSize:11,lineHeight:1.6,color:DIM,margin:0}}>{IS_PREVIEW ? 'These answers exist only in this browser session.' : 'Your taster answers are saved separately and will not carry into the formal assessment.'}</p>
   </div>
   <div style={{padding:'16px 17px',border:'1px solid rgba(201,168,76,.28)',borderRadius:9,background:'rgba(201,168,76,.07)'}}>
    <div style={{fontSize:9,fontWeight:900,letterSpacing:'.13em',color:GOLD}}>{IS_PREVIEW ? '02 · PREVIEW ONLY' : '02 · YOU ARE HERE'}</div>
    <h3 style={{fontSize:14,color:PARCH,margin:'8px 0 5px'}}>{IS_PREVIEW ? 'Account setup disabled' : 'Create your account'}</h3>
    <p style={{fontSize:11,lineHeight:1.6,color:DIM,margin:0}}>{IS_PREVIEW ? 'Account creation and email confirmation are disabled in this simulation. Continue to inspect the separate formal assessment.' : 'Add your details now. You’ll set your password and confirm your email in the next step.'}</p>
   </div>
   <div style={{padding:'16px 17px',border:'1px solid rgba(201,168,76,.16)',borderRadius:9,background:'rgba(46,46,74,.35)'}}>
    <div style={{fontSize:9,fontWeight:900,letterSpacing:'.13em',color:'rgba(250,250,247,.55)'}}>03 · UP NEXT</div>
    <h3 style={{fontSize:14,color:PARCH,margin:'8px 0 5px'}}>Start the full 58-question assessment</h3>
    <p style={{fontSize:11,lineHeight:1.6,color:DIM,margin:0}}>{IS_PREVIEW?'Continue to the local-only formal assessment preview.':'Confirm your email, return signed in to your dashboard, and begin all 58 formal questions from Question 1.'}</p>
   </div>
  </section>
  <section aria-label="Assessment progress" style={S.scoreSection}>
   <div className="valu-result-grid" style={{...S.resultGrid,gridTemplateColumns:'1fr 1fr'}}>
    <div style={S.resultRow}><div style={S.dimensionCode}>TASTER</div><h2 style={S.scoreName}>Completed</h2><strong style={S.scoreValue}>{TASTER_QUESTIONS.length}<small style={S.scoreOutOf}>/{TASTER_QUESTIONS.length} questions</small></strong></div>
    <div style={S.resultRow}><div style={S.dimensionCode}>FORMAL ASSESSMENT</div><h2 style={S.scoreName}>Ready to begin</h2><strong style={S.scoreValue}>58<small style={S.scoreOutOf}> separate questions</small></strong></div>
   </div>
  </section>
  <form onSubmit={createAccount} className="valu-entry-form-card" style={{...S.formCard,marginTop:18}}>
   <div style={S.formTop}><div><div style={S.eyebrow}>{IS_PREVIEW ? 'STAGING PREVIEW · NO ACCOUNT CREATED' : 'ACCOUNT SETUP · STEP 2 OF 3'}</div><h2 style={S.formTitle}>{IS_PREVIEW ? 'Explore the separate formal assessment.' : 'Let’s keep your progress connected.'}</h2></div><div style={S.formTime}>FORMAL ASSESSMENT<br/>58 QUESTIONS</div></div>
   <p style={S.formIntro}>{IS_PREVIEW ? 'This is a local-only staging simulation. The sample identity below is not a real account, and no information is sent or stored.' : 'Use an email address you can access. We’ll keep your taster record linked to your account, then guide you through password setup and email confirmation before returning you to your dashboard. Your separate formal assessment begins at Question 1.'}</p>
   <div className="valu-entry-form-grid" style={S.grid}>
    <Field label="FULL NAME"><input required style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="Your full professional name" autoComplete="name" disabled={IS_PREVIEW}/></Field>
    <Field label="CURRENT ROLE"><input required style={S.input} value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Product Manager" autoComplete="organization-title" disabled={IS_PREVIEW}/></Field>
   </div>
   <Field label="PROFESSIONAL EXPERIENCE"><select required disabled={IS_PREVIEW} style={S.input} value={experience} onChange={e=>setExperience(e.target.value)}><option value="">Select your experience</option>{EXPERIENCE_BANDS.map(x=><option key={x.id} value={x.id}>{x.label} · {x.desc}</option>)}</select></Field>
   <Field label="EMAIL ADDRESS"><input required style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" disabled={IS_PREVIEW}/></Field>
   {error&&<div style={S.error}>{error}</div>}
   <button type="submit" disabled={!identityValid||saving} style={{...S.primary,opacity:(!identityValid||saving)?.5:1}}>{saving?'SAVING YOUR SESSION…':IS_PREVIEW?'OPEN FULL 58-QUESTION PREVIEW →':'SAVE MY DETAILS & CONTINUE →'}</button>
   <div style={S.saveNote}><span>✓</span> {IS_PREVIEW ? 'No account is created and no data is saved.' : 'Your taster answers are saved separately.'}</div>
  </form>
  <p style={S.note}>{IS_PREVIEW ? 'STAGING SIMULATION ONLY · No official VALU Index, account, or participant record is created.' : 'Completing the assessment does not grant marketplace listing. Listing eligibility depends on the full assessment, professional profile, capabilities, and applicable eligibility checks.'}</p>
 </Shell>;

 return <Shell mode="taster" preview={IS_PREVIEW}>
  <VALUAssessmentJourney stage="taster" currentQuestion={placeInTaster} preview={IS_PREVIEW} />
  <div className="valu-taster-top" style={S.top}><div><div style={S.eyebrow}>VALU TASTER</div><div style={S.cluster}>{q.cluster} · {CLUSTERS[q.cluster]}</div></div><div style={S.counter}>Question {placeInTaster} of {TASTER_QUESTIONS.length}</div></div>
  <div className="valu-taster-progress" style={S.progress}><div style={{...S.fill,width:`${sessionProgress}%`,background:COLORS[q.cluster]}}/></div>
  <h1 className="valu-taster-question" style={S.question}>{q.q}</h1>
  <div className="valu-taster-options" style={S.options}>{q.options.map((o,i)=><button className="valu-option" key={i} disabled={selected!==null||saving} onClick={()=>choose(i)} style={{...S.option,borderColor:(selected===i||answers[current]===i)?GOLD:'rgba(247,244,238,.1)',background:(selected===i||answers[current]===i)?'rgba(201,168,76,.14)':'#2E2E4A',opacity:selected!==null&&selected!==i?.58:1}}><span style={S.optionLetter}>{String.fromCharCode(65+i)}</span><span>{o.text}</span></button>)}</div>
  {error&&<div style={S.error}>{error}</div>}
  <p style={S.note}>{IS_PREVIEW ? `STAGING PREVIEW · ${placeInTaster} OF ${TASTER_QUESTIONS.length} · NOT SAVED` : `${placeInTaster} of ${TASTER_QUESTIONS.length} taster questions · Saved separately from the formal assessment.`}</p>
 </Shell>;
}
function Field({label,children}){return <label style={S.label}>{label}{children}</label>}
function StepBar({active}){return null}
function Shell({children,mode='',preview=false}){return <main className={'valu-assessment-page '+(mode?'valu-assessment-'+mode:'')} style={S.page}>{preview&&<div role="status" style={{position:'sticky',top:0,zIndex:5,background:'#C9A84C',color:'#1A1A2E',padding:'8px 14px',textAlign:'center',fontSize:9,fontWeight:900,letterSpacing:'.12em',margin:'-28px -32px 18px'}}>STAGING PREVIEW · SIMULATED · NO PARTICIPANT DATA SAVED</div>}<div className="valu-assessment-shell" style={S.shell}>{children}</div></main>}

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
