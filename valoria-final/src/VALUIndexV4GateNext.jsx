import React, { useMemo, useRef, useState } from 'react';
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
   const response=await fetch('/api/create-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim().toLowerCase(),password,name:name.trim(),role:role.trim()})});
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
   const response=await fetch('/api/submit-taster',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),role:role.trim(),experience,answers:next})});
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
  <div style={S.heroBlock}>
   <div style={S.brand}>VALORIA INSTITUTE · VALU INDEX v{VALU_VERSION}</div>
   <div style={S.homeKicker}>KNOW YOUR WORTH · UNDERSTAND YOUR CAPABILITY · SEE WHERE YOU CAN GO NEXT</div>
   <div style={S.heroBadge}><span style={S.liveDot}/> FREE · 15 QUESTIONS · ABOUT 5 MINUTES</div>
   <h1 style={S.hero}>Your value is already there.<br/><em>Let’s make it visible.</em></h1>
   <p style={S.lead}>Start with a short VALU snapshot designed to give you a clear first read of how your professional value shows up across the PRIME framework.</p>
  </div>

  <form onSubmit={createAccount} style={S.form}>
   <div style={S.formCard}>
    <div style={S.formHeader}>
     <div><div style={S.eyebrow}>START HERE · 01 / 05</div><h2 style={S.formTitle}>Begin with who you are.</h2></div>
     <div style={S.formMeta}>FREE TO START<br/>PROGRESS SAVED</div>
    </div>
    <p style={S.formIntro}>Your details create one Valoria identity so your snapshot, future VALU assessment, report and professional profile stay connected.</p>
   <div style={S.grid}>
    <Field label="FULL NAME"><input required style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="Your full professional name" autoComplete="name"/></Field>
    <Field label="CURRENT ROLE"><input required style={S.input} value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Senior Product Manager" autoComplete="organization-title"/></Field>
   </div>
   <Field label="PROFESSIONAL EXPERIENCE"><select required style={S.input} value={experience} onChange={e=>setExperience(e.target.value)}><option value="">Select your experience</option>{EXPERIENCE_BANDS.map(x=><option key={x.id} value={x.id}>{x.label} · {x.desc}</option>)}</select></Field>
   <Field label="EMAIL ADDRESS"><input required style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></Field>
   <div style={S.grid}>
    <Field label="PASSWORD"><input required style={S.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password"/></Field>
    <Field label="CONFIRM PASSWORD"><input required style={S.input} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password" autoComplete="new-password"/></Field>
   </div>
   {error&&<div style={S.error}>{error}</div>}
   <button type="submit" disabled={!validSignup||saving} style={{...S.primary,opacity:(!validSignup||saving)?.5:1}}>{saving?'SAVING YOUR JOURNEY…':'START MY VALU SNAPSHOT →'}</button>
   <div style={S.reassurance}><span>✓</span> No experience level is “wrong” here. This is about understanding your current professional signal.</div>
   <p style={S.note}>Your progress is saved so you can return without starting again. The snapshot is directional and does not determine marketplace listing.</p>
   <p style={S.login}>Already have an account? <a href="https://valoriainstitute.com/login" style={{color:GOLD}}>Sign in</a></p>
   </div>
  </form>

  <section style={S.valueStrip}>
   <div style={S.valueLead}><div style={S.eyebrow}>WHAT YOU’LL SEE</div><strong>One first read. Five dimensions.</strong><p>Your snapshot gives you a directional view across the five PRIME dimensions — then shows you where the full VALU journey goes next.</p></div>
   <div style={S.primeMini}>{[['P','Presence'],['R','Relationships'],['I','Intelligence'],['M','Mastery'],['E','Enterprise']].map(([id,title])=><div key={id} style={S.primeItem}><b>{id}</b><span>{title}</span></div>)}</div>
  </section>

  <section style={S.journeyContext}>
   <div style={S.journeyIntro}><div><div style={S.eyebrow}>YOUR VALORIA PATH</div><strong>Discover → assess → build → connect → understand.</strong></div><span>ONE CONTINUOUS JOURNEY</span></div>
   <div className="valu-path-rail" style={S.pathRail}>
    {[
      ['01','DISCOVER'],['02','ASSESS'],['03','BUILD'],['04','CONNECT'],['05','UNDERSTAND'],
    ].map(([n,title])=><div key={title} style={S.pathItem}><div style={S.pathNumber}>{n}</div><div style={S.pathTitle}>{title}</div></div>)}
   </div>
  </section>
 </Shell>
 if(phase==='taster')return <Shell>
  <StepBar active={2}/>
  <div style={S.top}><div><div style={S.eyebrow}>VALU SNAPSHOT · PRIME</div><div style={S.cluster}>{q.cluster} · {CLUSTERS[q.cluster]}</div></div><div style={S.counter}>{current+1} / {TASTER_QUESTIONS.length}</div></div>
  <div style={S.progress}><div style={{...S.fill,width:`${progress}%`,background:COLORS[q.cluster]}}/></div>
  <div style={S.insight}>{q.tasterInsight}</div><h1 style={S.question}>{q.q}</h1>
  <div style={S.options}>{q.options.map((o,i)=><button className="valu-option" key={i} disabled={selected!==null||saving} onClick={()=>choose(i)} style={{...S.option,borderColor:selected===i?GOLD:'rgba(247,244,238,.1)',background:selected===i?'rgba(201,168,76,.14)':'#2E2E4A',opacity:selected!==null&&selected!==i?.58:1}}><span style={S.optionLetter}>{String.fromCharCode(65+i)}</span><span>{o.text}</span></button>)}</div>
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
function StepBar({active}){return <div style={S.steps}>{['ACCOUNT','SNAPSHOT','NEXT'].map((x,i)=><div key={x} style={{...S.step,opacity:i+1<=active?1:.35}}><span style={{...S.stepDot,background:i+1<=active?GOLD:'transparent'}}>{i+1}</span>{x}</div>)}</div>}
function Shell({children}){return <main style={S.page}><div style={S.shell}>{children}</div></main>}
const S={
 page:{minHeight:'100vh',background:DARK,color:PARCH,padding:'36px 22px 72px',fontFamily:"'Raleway',sans-serif"},
 shell:{maxWidth:900,margin:'0 auto'},
 steps:{display:'flex',justifyContent:'center',gap:28,margin:'0 0 42px',paddingBottom:18,borderBottom:'1px solid rgba(212,201,168,.16)'},
 step:{display:'flex',alignItems:'center',gap:8,fontSize:9,fontWeight:700,letterSpacing:'.14em',color:'rgba(250,250,247,.55)'},
 stepDot:{width:24,height:24,borderRadius:'50%',border:'1px solid rgba(201,168,76,.45)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,color:PARCH},
 brand:{fontSize:8,fontWeight:700,letterSpacing:'.16em',color:GOLD,textAlign:'center'},
 heroBlock:{padding:'4px 0 22px',textAlign:'center'},
 heroBadge:{display:'inline-flex',alignItems:'center',gap:7,margin:'13px auto 0',padding:'7px 10px',border:'1px solid rgba(201,168,76,.28)',borderRadius:999,background:'rgba(201,168,76,.06)',fontSize:8,fontWeight:800,letterSpacing:'.12em',color:BRASS},
 liveDot:{width:6,height:6,borderRadius:'50%',background:GOLD,boxShadow:'0 0 0 4px rgba(201,168,76,.1)'},
 homeHero:{padding:'12px 0 0'},
 homeKicker:{fontSize:8,fontWeight:700,letterSpacing:'.14em',color:BRASS,textAlign:'center',marginTop:7},
 hero:{fontSize:'clamp(27px,3.8vw,38px)',fontWeight:600,lineHeight:1.08,letterSpacing:'-.035em',textAlign:'center',margin:'7px 0 7px'},
 lead:{fontSize:12,lineHeight:1.5,color:DIM,textAlign:'center',maxWidth:600,margin:'0 auto 10px'},
 pathRail:{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:1,border:'1px solid rgba(212,201,168,.14)',borderRadius:8,overflow:'hidden',background:'rgba(212,201,168,.09)',marginBottom:8},
 pathItem:{position:'relative',minHeight:0,padding:'9px 10px',background:SURFACE},
 pathNumber:{fontSize:8,fontWeight:700,letterSpacing:'.1em',color:GOLD,marginBottom:5},
 pathTitle:{fontSize:8,fontWeight:800,letterSpacing:'.08em',color:PARCH,marginBottom:0},
 pathDesc:{fontSize:11,lineHeight:1.55,color:'rgba(250,250,247,.56)'},
 pathLine:{display:'none'},
 startPanel:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:28,padding:'24px 26px',background:'rgba(201,168,76,.055)',border:'1px solid rgba(201,168,76,.28)',borderRadius:14,marginBottom:44},
 formMeta:{flex:'0 0 auto',textAlign:'right',fontSize:9,fontWeight:800,lineHeight:1.8,letterSpacing:'.13em',color:BRASS},
 valueStrip:{display:'grid',gridTemplateColumns:'1.05fr 1.4fr',alignItems:'center',gap:22,maxWidth:780,margin:'18px auto 0',padding:'18px',background:'rgba(46,46,74,.7)',border:'1px solid rgba(212,201,168,.16)',borderRadius:12},
 valueLead:{minWidth:0},
 primeMini:{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:7},
 primeItem:{display:'grid',gap:7,minHeight:72,padding:'11px 9px',background:'rgba(26,26,46,.58)',border:'1px solid rgba(212,201,168,.12)',borderRadius:9},
 reassurance:{display:'flex',alignItems:'flex-start',gap:8,padding:'10px 11px',borderTop:'1px solid rgba(212,201,168,.1)',color:'rgba(250,250,247,.48)',fontSize:10,lineHeight:1.5},
 journeyIntro:{display:'flex',alignItems:'end',justifyContent:'space-between',gap:18,marginBottom:9},
 journeyIntroStrong:{fontSize:14},

 valueStripStrong:{fontSize:16},
 valuePoints:{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'},
 journeyContext:{maxWidth:760,margin:'16px auto 0'},
 startTitle:{fontSize:22,fontWeight:600,color:PARCH,marginTop:7},
 startCopy:{fontSize:12,lineHeight:1.7,color:'rgba(250,250,247,.62)',maxWidth:610,margin:'8px 0 0'},
 startMeta:{flex:'0 0 auto',display:'grid',gap:6,textAlign:'right',fontSize:9,fontWeight:700,letterSpacing:'.13em',color:BRASS},
 form:{display:'grid',gap:12,maxWidth:780,margin:'0 auto'},
 formCard:{padding:'22px 22px 18px',background:'rgba(46,46,74,.68)',border:'1px solid rgba(212,201,168,.2)',borderRadius:14,boxShadow:'0 18px 55px rgba(0,0,0,.16)'},
 formHeader:{display:'flex',alignItems:'end',justifyContent:'space-between',gap:20,borderBottom:'1px solid rgba(212,201,168,.16)',paddingBottom:9},
 formTitle:{fontSize:20,fontWeight:600,letterSpacing:'-.02em',margin:'5px 0 0'},
 formRule:{width:120,height:2,background:GOLD,opacity:.7,marginBottom:5},
 formIntro:{fontSize:11,lineHeight:1.5,color:'rgba(250,250,247,.52)',margin:'-1px 0 2px'},
 grid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14},
 label:{display:'grid',gap:6,fontSize:8,fontWeight:800,letterSpacing:'.13em',color:'rgba(250,250,247,.62)'},
 input:{width:'100%',boxSizing:'border-box',padding:'11px 13px',background:SURFACE,border:'1px solid rgba(212,201,168,.2)',borderRadius:8,color:PARCH,fontSize:14,fontFamily:'inherit',outline:'none'},
 primary:{width:'100%',padding:'13px 18px',border:0,borderRadius:8,background:GOLD,color:DARK,fontWeight:800,letterSpacing:'.11em',fontSize:10,cursor:'pointer',fontFamily:'inherit'},
 primaryLink:{display:'block',padding:'15px 18px',background:GOLD,color:DARK,borderRadius:8,textDecoration:'none',textAlign:'center',fontSize:10,fontWeight:800,letterSpacing:'.11em'},
 secondary:{display:'block',marginTop:10,padding:'14px 18px',border:'1px solid rgba(201,168,76,.38)',color:GOLD,borderRadius:8,textAlign:'center',textDecoration:'none',fontSize:10,fontWeight:800,letterSpacing:'.09em'},
 note:{fontSize:10,lineHeight:1.6,color:'rgba(250,250,247,.36)',textAlign:'center',marginTop:9},
 login:{fontSize:12,color:'rgba(250,250,247,.48)',textAlign:'center'},
 error:{padding:'12px 14px',border:'1px solid rgba(216,90,48,.3)',background:'rgba(216,90,48,.08)',borderRadius:8,color:'#F3A0A0',fontSize:12,lineHeight:1.5},
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
