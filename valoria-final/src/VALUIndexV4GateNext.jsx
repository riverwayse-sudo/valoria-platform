import React, { useMemo, useRef, useState } from 'react';
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

import { EXPERIENCE_BANDS, TASTER_QUESTIONS, computeTasterResult, VALU_VERSION } from './valuTaster.js';

const CLUSTERS={P:'Presence',R:'Relationships',I:'Intelligence',M:'Mastery',E:'Enterprise'};
const COLORS={P:'#C9A84C',R:'#C9A84C',I:'#C9A84C',M:'#C9A84C',E:'#C9A84C'};
const DARK='#1A1A2E', SURFACE='#2E2E4A', PARCH='#FAFAF7', GOLD='#C9A84C', BRASS='#D4C9A8', DIM='rgba(250,250,247,.68)';

export default function VALUIndexV4GateNext(){
 const [phase,setPhase]=useState('signup'),[name,setName]=useState(''),[role,setRole]=useState(''),[experience,setExperience]=useState('');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [current,setCurrent]=useState(0),[answers,setAnswers]=useState({}),[selected,setSelected]=useState(null),[result,setResult]=useState(null),[tasterId,setTasterId]=useState('');
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const timer=useRef(null);
 const q=TASTER_QUESTIONS[current]; const progress=Math.round(((current+1)/TASTER_QUESTIONS.length)*100);
 const scores=useMemo(()=>result?Object.entries(result.normalisedScores).sort((a,b)=>b[1]-a[1]):[],[result]);
 const validSignup=!!(name.trim()&&role.trim()&&experience&&email.trim()&&password.length>=8&&password===confirm);

 async function createAccount(e){
  e.preventDefault(); if(!validSignup||saving)return; setSaving(true); setError('');
  try{
   const response=await fetch(API_BASE + '/api/create-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim().toLowerCase(),password,name:name.trim(),role:role.trim()})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'We could not create your account.');
   setPhase('taster');
  }catch(err){
   const message=err?.message||'Something went wrong.';
   setError(/already|registered|exists/i.test(message)?'An account may already exist for this email. Sign in instead, or use a different email address.':message);
  }finally{setSaving(false)}
 }

 async function answer(index){
  const next={...answers,[current]:index}; setAnswers(next);
  if(current<TASTER_QUESTIONS.length-1){setTimeout(()=>{setCurrent(v=>v+1);setSelected(null)},180);return}
  setSaving(true);setError('');
  try{
   const response=await fetch(API_BASE + '/api/submit-taster',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),role:role.trim(),experience,answers:next})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Your snapshot could not be saved.');
   setResult(data.results||computeTasterResult(next)); setTasterId(data.taster_id||'');
   try{if(data.taster_id)localStorage.setItem('pending_taster_id',data.taster_id)}catch{}
   setPhase('results');
  }catch(err){setError(err?.message||'Something went wrong. Please try again.')}
  finally{setSaving(false);setSelected(null)}
 }
 function choose(index){if(selected!==null||saving)return;setSelected(index);timer.current=setTimeout(()=>answer(index),120)}

 if(phase==='signup')return <Shell>
  <div className="valu-entry-grid" style={S.entryGrid}>
   <section className="valu-entry-intro" style={S.entryIntro}>
    <div style={S.homeKicker}>A PROFESSIONAL VALUE ASSESSMENT</div>
    <h1 style={S.hero}>See the value<br/><em>you bring.</em></h1>
    <p style={S.lead}>Begin with a 15-question VALU snapshot. In about five minutes, you’ll get a first read across the five dimensions of PRIME.</p>
    <div className="valu-dimension-list" style={S.dimensionList}>
     {[
      ['01','PRESENCE','How you show up'],
      ['02','RELATIONSHIPS','How you create trust'],
      ['03','INTELLIGENCE','How you think'],
      ['04','MASTERY','How you apply capability'],
      ['05','ENTERPRISE','How you create value'],
     ].map(([n,t,d])=><div key={t} style={S.dimension}><span>{n}</span><div style={S.dimensionCopy}><b style={S.dimensionTitle}>{t}</b><small style={S.dimensionDescription}>{d}</small></div></div>)}
    </div>
    
   </section>

   <form className="valu-entry-form" onSubmit={createAccount} style={S.form}>
    <div className="valu-entry-form-card" style={S.formCard}>
     <div style={S.formTop}>
      <div><div style={S.eyebrow}>START HERE · 01 / 05</div><h2 style={S.formTitle}>Tell us about yourself.</h2></div>
      <div style={S.formTime}>FREE<br/>~5 MIN</div>
     </div>
     
     <div className="valu-entry-form-grid" style={S.grid}>
      <Field label="FULL NAME"><input required style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="Your full professional name" autoComplete="name"/></Field>
      <Field label="CURRENT ROLE"><input required style={S.input} value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Product Manager" autoComplete="organization-title"/></Field>
     </div>
     <Field label="PROFESSIONAL EXPERIENCE"><select required style={S.input} value={experience} onChange={e=>setExperience(e.target.value)}><option value="">Select your experience</option>{EXPERIENCE_BANDS.map(x=><option key={x.id} value={x.id}>{x.label} · {x.desc}</option>)}</select></Field>
     <Field label="EMAIL ADDRESS"><input required style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></Field>
     <div style={S.grid}>
      <Field label="PASSWORD"><input required style={S.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password"/></Field>
      <Field label="CONFIRM PASSWORD"><input required style={S.input} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password" autoComplete="new-password"/></Field>
     </div>
     {error&&<div style={S.error}>{error}</div>}
     <button type="submit" disabled={!validSignup||saving} style={{...S.primary,opacity:(!validSignup||saving)?.5:1}}>{saving?'SAVING YOUR JOURNEY…':'START MY VALU SNAPSHOT →'}</button>
     <div style={S.saveNote}><span>✓</span> Progress is saved. You can return without starting again.</div>
     <p style={S.login}>Already have an account? <a href="https://valoriainstitute.com/login" style={{color:GOLD}}>Sign in</a></p>
    </div>
   </form>
  </div>
 </Shell>
 if(phase==='taster')return <Shell mode="taster">
  <StepBar active={2}/>
  <div className="valu-taster-top" style={S.top}><div><div style={S.eyebrow}>VALU SNAPSHOT · PRIME</div><div style={S.cluster}>{q.cluster} · {CLUSTERS[q.cluster]}</div></div><div style={S.counter}>{current+1} / {TASTER_QUESTIONS.length}</div></div>
  <div className="valu-taster-progress" style={S.progress}><div style={{...S.fill,width:`${progress}%`,background:COLORS[q.cluster]}}/></div>
  <h1 className="valu-taster-question" style={S.question}>{q.q}</h1><div className="valu-taster-insight" style={S.insight}>{q.tasterInsight}</div>
  <div className="valu-taster-options" style={S.options}>{q.options.map((o,i)=><button className="valu-option" key={i} disabled={selected!==null||saving} onClick={()=>choose(i)} style={{...S.option,borderColor:selected===i?GOLD:'rgba(247,244,238,.1)',background:selected===i?'rgba(201,168,76,.14)':'#2E2E4A',opacity:selected!==null&&selected!==i?.58:1}}><span style={S.optionLetter}>{String.fromCharCode(65+i)}</span><span>{o.text}</span></button>)}</div>
  {error&&<div style={S.error}>{error}</div>}<p style={S.note}>Your answers are saved as a directional snapshot. They do not become the official VALU Index score.</p>
 </Shell>;

 return <Shell>
  <StepBar active={3}/>
  <div style={S.eyebrow}>SNAPSHOT SAVED · VALU v{VALU_VERSION}</div><h1 style={S.h1}>Your first read is <em>ready.</em></h1>
  <p style={S.p}>Your account has been captured and your 15-question snapshot is saved. The snapshot is directional; the full assessment establishes your official VALU Index.</p>
  <div style={S.resultGrid}>{scores.map(([id,value])=><div key={id} style={S.resultRow}><div><b style={{color:COLORS[id]}}>{id}</b><span>{CLUSTERS[id]}</span></div><strong>{value}</strong></div>)}</div>
  <div style={S.highlight}><div style={S.eyebrow}>YOUR STRONGEST SIGNAL</div><div style={S.signal}>{result?.strongest?.name}</div><p style={S.p}>The full VALU assessment goes deeper across the PRIME framework and produces the authoritative score.</p></div>
  <div style={S.next}><div style={S.eyebrow}>NEXT STEP</div><h2 style={S.nextTitle}>Confirm your email, then continue.</h2><p style={S.p}>We have saved your snapshot. Confirm the email used for your account, sign in, and Valoria will attach this result to your professional journey.</p>
   <a href={`https://valoriainstitute.com/login?pending_taster_id=${encodeURIComponent(tasterId)}`} style={S.primaryLink}>CONFIRM & SIGN IN →</a>
   <a href={`https://assessment.valoriainstitute.com/?full=1&taster_id=${encodeURIComponent(tasterId)}`} style={S.secondary}>I'M ALREADY SIGNED IN — CONTINUE</a>
  </div>
  <p style={S.note}>Signup or the snapshot does not grant marketplace listing. Listing remains governed by the full assessment, profile, capability and eligibility checks.</p>
 </Shell>;
}
function Field({label,children}){return <label style={S.label}>{label}{children}</label>}
function StepBar({active}){return <div className="valu-assessment-steps" style={S.steps}>{['ACCOUNT','SNAPSHOT','NEXT'].map((x,i)=><div key={x} style={{...S.step,opacity:i+1<=active?1:.35}}><span style={{...S.stepDot,background:i+1<=active?GOLD:'transparent'}}>{i+1}</span>{x}</div>)}</div>}
function Shell({children,mode=''}){return <main className={`valu-assessment-page ${mode ? `valu-assessment-${mode}` : ''}`} style={S.page}><div className="valu-assessment-shell" style={S.shell}>{children}</div></main>}

if (typeof document !== 'undefined' && !document.getElementById('valu-mobile-assessment-layout')) {
 const style=document.createElement('style');
 style.id='valu-mobile-assessment-layout';
 style.textContent=`
  @media (max-width: 600px) {
    .valu-assessment-page.valu-assessment-taster { padding: 14px 16px 20px !important; overflow-y: auto !important; overflow-x: hidden !important; align-items: flex-start !important; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell { width:100%; max-width:none; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell > * { flex: 0 0 auto; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-assessment-steps { order:0; margin-bottom:10px !important; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-taster-top { order:1; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-taster-progress { order:2; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-taster-question { order:3; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-taster-insight { order:4; margin:8px 0 0 !important; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-taster-options { order:5; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell { display:flex; flex-direction:column; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-assessment-steps { margin-bottom:10px !important; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-taster-progress { margin:7px 0 14px !important; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-taster-question { font-size:clamp(25px,7.2vw,34px) !important; line-height:1.12 !important; margin:0 0 16px !important; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-option { min-height:54px; padding:11px 12px !important; font-size:13px !important; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell .valu-option span:first-child { width:26px !important; height:26px !important; }
    .valu-assessment-page.valu-assessment-taster .valu-assessment-shell > p { margin-top:12px !important; }
  }
 `;
 document.head.appendChild(style);
}
const S={
 page:{height:'calc(100vh - 65px)',minHeight:0,background:DARK,color:PARCH,padding:'28px 32px 34px',overflow:'hidden',display:'flex',alignItems:'stretch',fontFamily:"'Raleway',sans-serif"},
 shell:{width:'100%',maxWidth:1160,margin:'0 auto',display:'flex',flexDirection:'column',minHeight:0},
 topBrand:{display:'flex',alignItems:'center',justifyContent:'space-between',paddingBottom:14,borderBottom:'1px solid rgba(212,201,168,.13)',marginBottom:24,flex:'0 0 auto'},
 brandMark:{fontSize:15,fontWeight:900,letterSpacing:'.08em',color:PARCH},
 brandVersion:{fontSize:8,fontWeight:800,letterSpacing:'.16em',color:'rgba(212,201,168,.55)'},
 brand:{fontSize:8,fontWeight:700,letterSpacing:'.16em',color:GOLD,textAlign:'center'},
 entryGrid:{display:'grid',gridTemplateColumns:'minmax(0,1.05fr) minmax(420px,.95fr)',gap:'clamp(42px,5vw,68px)',alignItems:'center',flex:'1 1 auto',minHeight:0},
 entryIntro:{paddingTop:0,maxWidth:600,minWidth:0},
 homeKicker:{fontSize:9,fontWeight:800,letterSpacing:'.18em',color:GOLD,marginBottom:18},
 hero:{fontSize:'clamp(44px,4.6vw,62px)',fontWeight:500,lineHeight:1.0,letterSpacing:'-.045em',margin:'0 0 16px'},
 lead:{fontSize:14,lineHeight:1.55,color:'rgba(250,250,247,.66)',maxWidth:560,margin:'0 0 22px'},
 dimensionList:{borderTop:'1px solid rgba(212,201,168,.15)'},
 dimension:{display:'grid',gridTemplateColumns:'42px 1fr',gap:16,alignItems:'start',padding:'11px 0',borderBottom:'1px solid rgba(212,201,168,.1)'},
 dimensionCopy:{display:'flex',flexDirection:'column',gap:4,minWidth:0,paddingTop:1},
 dimensionTitle:{display:'block',fontSize:11.5,fontWeight:800,lineHeight:1.2,letterSpacing:'.05em',marginBottom:0},
 dimensionDescription:{display:'block',fontSize:10.5,lineHeight:1.35,color:'rgba(250,250,247,.5)',marginTop:0},
 dimensionSpan:{fontSize:8},
 pathNote:{display:'flex',gap:14,alignItems:'flex-start',marginTop:16,paddingTop:14,borderTop:'1px solid rgba(201,168,76,.2)'},
 pathCopy:{display:'flex',flexDirection:'column',gap:5,minWidth:0,paddingTop:1},
 pathTitle:{display:'block',fontSize:11.5,fontWeight:800,lineHeight:1.25,letterSpacing:'.025em',marginBottom:0},
 pathDescription:{display:'block',fontSize:10.5,lineHeight:1.4,color:'rgba(250,250,247,.5)',marginTop:0},
 pathLineGold:{width:3,height:36,background:GOLD,flex:'0 0 auto',borderRadius:3},
 form:{display:'block',maxWidth:520,margin:'0 auto',width:'100%'},
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
 login:{fontSize:11,color:'rgba(250,250,247,.42)',textAlign:'center',margin:'17px 0 0'},
 eyebrow:{fontSize:8,fontWeight:800,letterSpacing:'.15em',color:BRASS},
 error:{padding:'12px 14px',border:'1px solid rgba(216,90,48,.3)',background:'rgba(216,90,48,.08)',borderRadius:8,color:'#F3A0A0',fontSize:12,lineHeight:1.5,marginBottom:12},
 steps:{display:'flex',justifyContent:'center',gap:28,margin:'0 0 42px',paddingBottom:18,borderBottom:'1px solid rgba(212,201,168,.16)'},
 step:{display:'flex',alignItems:'center',gap:8,fontSize:9,fontWeight:700,letterSpacing:'.14em',color:'rgba(250,250,247,.55)'},
 stepDot:{width:24,height:24,borderRadius:'50%',border:'1px solid rgba(201,168,76,.45)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,color:PARCH},
 valueStrip:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:18,maxWidth:760,margin:'18px auto 0',padding:'18px',background:SURFACE,border:'1px solid rgba(212,201,168,.16)',borderRadius:10},
 journeyContext:{maxWidth:760,margin:'16px auto 0'},
 top:{display:'flex',justifyContent:'space-between',alignItems:'flex-end'},
 cluster:{fontSize:11,color:'rgba(250,250,247,.5)',marginTop:5},
 counter:{fontSize:11,color:'rgba(250,250,247,.45)'},
 progress:{height:4,background:'rgba(250,250,247,.08)',margin:'14px 0 34px',borderRadius:99,overflow:'hidden'},
 fill:{height:'100%',borderRadius:99},
 insight:{fontSize:11,fontWeight:600,color:BRASS,marginBottom:12,letterSpacing:'.04em'},
 question:{fontSize:'clamp(28px,4.5vw,44px)',fontWeight:500,lineHeight:1.16,letterSpacing:'-.025em',margin:'0 0 26px'},
 options:{display:'grid',gap:10},
 option:{appearance:"none",WebkitAppearance:"none",MozAppearance:"none",display:'grid',gridTemplateColumns:'34px 1fr',alignItems:'center',gap:14,textAlign:'left',padding:'17px 18px',border:'1px solid',borderRadius:9,color:PARCH,fontSize:14,lineHeight:1.55,cursor:'pointer',fontFamily:'inherit',transition:'border-color .18s,background .18s'},
 optionLetter:{width:30,height:30,border:'1px solid rgba(201,168,76,.42)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:GOLD,fontSize:11,fontWeight:700},
 h1:{fontSize:'clamp(40px,7vw,64px)',fontWeight:500,lineHeight:1.04,letterSpacing:'-.035em',margin:'0 0 14px'},
 p:{fontSize:13,lineHeight:1.75,color:DIM},
 resultGrid:{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,margin:'24px 0'},
 resultRow:{padding:'15px 8px',border:'1px solid rgba(212,201,168,.16)',background:SURFACE,borderRadius:8,textAlign:'center',fontSize:10},
 highlight:{padding:22,border:'1px solid rgba(201,168,76,.25)',borderRadius:10,background:SURFACE,marginTop:14},
 signal:{fontSize:25,marginTop:8,color:PARCH},
 next:{marginTop:16,padding:24,border:'1px solid rgba(201,168,76,.3)',borderRadius:10,background:'rgba(201,168,76,.055)'},
 nextTitle:{fontSize:22,fontWeight:600,margin:'9px 0 8px'}
};


// Production deployment sync: latest VALU entry layout.
