import React, { useMemo, useState } from "react";
import { BRAND } from "./assessmentLock.js";
import { EXPERIENCE_BANDS, TASTER_QUESTIONS, computeTasterResult, VALU_VERSION } from "./valuTaster.js";

const CLUSTER_COLORS = { P:"#1D9E75", R:"#378ADD", I:"#7F77DD", M:"#BA7517", E:"#D85A30" };
const CLUSTER_NAMES = { P:"Presence", R:"Relationships", I:"Intelligence", M:"Mastery", E:"Enterprise" };

async function saveTaster({ name, role, experience, answers }) {
  try {
    const res = await fetch("/api/submit-taster", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name,role,experience,answers}) });
    return res.ok;
  } catch { return false; }
}

const inputStyle={width:"100%",boxSizing:"border-box",padding:"13px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(247,244,238,.12)",borderRadius:6,color:BRAND.PARCHMENT,fontFamily:BRAND.FONT_UI,fontSize:14,outline:"none"};
const overlayStyle={position:"fixed",inset:0,zIndex:1000,overflowY:"auto",background:"#0F0F1A",color:"#F7F4EE",padding:"88px 20px 60px",fontFamily:"Raleway, sans-serif"};
const cardStyle={maxWidth:680,width:"100%",margin:"0 auto",padding:"clamp(22px,5vw,52px) 0"};
const eyebrow={fontSize:10,fontWeight:700,letterSpacing:".20em",color:"rgba(201,168,76,.65)",fontFamily:"Raleway, sans-serif"};
const titleStyle={fontSize:"clamp(38px,7vw,62px)",lineHeight:1.03,fontWeight:300,letterSpacing:"-.025em",margin:"14px 0"};
const leadStyle={fontSize:15,lineHeight:1.75,color:"rgba(247,244,238,.58)",maxWidth:620};
const statStyle={padding:"13px 12px",border:"1px solid rgba(201,168,76,.16)",borderRadius:6,textAlign:"center",fontSize:12,color:"rgba(247,244,238,.58)"};
const fieldGrid={display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,margin:"24px 0"};
const label={fontSize:10,letterSpacing:".16em",color:"rgba(201,168,76,.55)",fontWeight:700,display:"flex",flexDirection:"column",gap:7};
const buttonStyle={width:"100%",border:0,borderRadius:6,padding:"16px 20px",background:"#C9A84C",color:"#0F0F1A",fontWeight:700,letterSpacing:".12em",fontSize:12,cursor:"pointer",fontFamily:"Raleway, sans-serif"};
const finePrint={fontSize:11,lineHeight:1.6,color:"rgba(247,244,238,.27)",textAlign:"center",marginTop:16};
const counter={fontFamily:"DM Mono, monospace",fontSize:12,color:"rgba(247,244,238,.35)"};

export default function VALUIndexV4Gate({onComplete}) {
  const [phase,setPhase]=useState("intro"),[name,setName]=useState(""),[role,setRole]=useState(""),[experience,setExperience]=useState(""),[current,setCurrent]=useState(0),[answers,setAnswers]=useState({}),[selected,setSelected]=useState(null),[results,setResults]=useState(null),[saving,setSaving]=useState(false);
  const question=TASTER_QUESTIONS[current];
  const canStart=Boolean(name.trim()&&role.trim()&&experience);
  const progress=Math.round((current/TASTER_QUESTIONS.length)*100);
  const sortedScores=useMemo(()=>results?Object.entries(results.normalisedScores).sort(([,a],[,b])=>b-a):[],[results]);
  function start(){if(!canStart)return;setCurrent(0);setAnswers({});setSelected(null);setPhase("taster");}
  async function next(){if(selected===null)return;const nextAnswers={...answers,[current]:selected};setAnswers(nextAnswers);if(current+1<TASTER_QUESTIONS.length){setCurrent(current+1);setSelected(null);return;}const r=computeTasterResult(nextAnswers);setResults(r);setSaving(true);await saveTaster({name:name.trim(),role:role.trim(),experience,answers:nextAnswers});setSaving(false);setPhase("results");}

  if(phase==="intro")return <div style={overlayStyle}><div style={cardStyle}>
    <div style={eyebrow}>VALORIA INSTITUTE · VALU INDEX v{VALU_VERSION}</div><h1 style={titleStyle}>Find out where you stand.</h1>
    <p style={leadStyle}>Start with a free 9-question taster across the five PRIME capability clusters. Get a directional read in about five minutes.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"24px 0"}}>{["9 questions","~5 minutes","Free"].map(x=><div key={x} style={statStyle}>{x}</div>)}</div>
    <div style={fieldGrid}><label style={label}>YOUR NAME<input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" style={inputStyle}/></label><label style={label}>YOUR ROLE<input value={role} onChange={e=>setRole(e.target.value)} placeholder="Current professional role" style={inputStyle}/></label><label style={{...label,gridColumn:"1 / -1"}}>EXPERIENCE<select value={experience} onChange={e=>setExperience(e.target.value)} style={{...inputStyle,appearance:"auto"}}><option value="">Select your experience</option>{EXPERIENCE_BANDS.map(b=><option key={b.id} value={b.id}>{b.label} · {b.desc}</option>)}</select></label></div>
    <button disabled={!canStart} onClick={start} style={{...buttonStyle,opacity:canStart?1:.45,cursor:canStart?"pointer":"not-allowed"}}>START THE FREE TASTER →</button>
    <p style={finePrint}>Your experience band is profile metadata only. It does not affect your score. Taster answers never enter your full VALU Index.</p>
  </div></div>;

  if(phase==="taster")return <div style={overlayStyle}><div style={{...cardStyle,maxWidth:760}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:18}}><div style={eyebrow}>{question.cluster} · {CLUSTER_NAMES[question.cluster]}</div><div style={counter}>{current+1} / {TASTER_QUESTIONS.length}</div></div>
    <div style={{height:3,background:"rgba(255,255,255,.06)",marginBottom:30}}><div style={{height:"100%",width:`${progress}%`,background:CLUSTER_COLORS[question.cluster],transition:"width .25s"}}/></div>
    <div style={{fontSize:12,color:CLUSTER_COLORS[question.cluster],letterSpacing:".12em",fontFamily:BRAND.FONT_UI,marginBottom:12}}>{question.tasterInsight.toUpperCase()}</div>
    <h2 style={{...titleStyle,fontSize:"clamp(25px,4vw,38px)",marginBottom:28}}>{question.q}</h2>
    <div style={{display:"grid",gap:10}}>{question.options.map((opt,i)=>{const active=selected===i;return <button key={i} onClick={()=>setSelected(i)} style={{textAlign:"left",padding:"17px 18px",background:active?"rgba(201,168,76,.10)":"rgba(255,255,255,.025)",border:`1px solid ${active?BRAND.GOLD:"rgba(247,244,238,.10)"}`,borderRadius:7,color:BRAND.PARCHMENT,cursor:"pointer",fontFamily:BRAND.FONT_UI,fontSize:14,lineHeight:1.55}}><span style={{display:"inline-flex",width:24,height:24,borderRadius:"50%",alignItems:"center",justifyContent:"center",marginRight:12,border:`1px solid ${active?BRAND.GOLD:"rgba(247,244,238,.18)"}`,color:active?BRAND.GOLD:"rgba(247,244,238,.45)",fontSize:11}}>{String.fromCharCode(65+i)}</span>{opt.text}</button>})}</div>
    <button disabled={selected===null} onClick={next} style={{...buttonStyle,marginTop:24,opacity:selected===null?.45:1}}>{current+1===TASTER_QUESTIONS.length?"SEE MY DIRECTION →":"NEXT →"}</button>
  </div></div>;

  return <div style={overlayStyle}><div style={{...cardStyle,maxWidth:760}}>
    <div style={eyebrow}>VALU INDEX · TASTER COMPLETE</div><h1 style={titleStyle}>{name}, here is your <em style={{color:BRAND.GOLD}}>directional read.</em></h1>
    <p style={leadStyle}>This is an early signal across all five PRIME clusters. It is not your full VALU Index score.</p>
    <div style={{display:"grid",gap:12,margin:"26px 0"}}>{sortedScores.map(([id,score])=><div key={id}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontFamily:BRAND.FONT_UI,fontSize:13}}><span><b style={{color:CLUSTER_COLORS[id]}}>{id}</b> · {CLUSTER_NAMES[id]}</span><span style={{color:CLUSTER_COLORS[id]}}>{score}</span></div><div style={{height:6,background:"rgba(255,255,255,.06)",borderRadius:3}}><div style={{height:"100%",width:`${score}%`,background:CLUSTER_COLORS[id],borderRadius:3}}/></div></div>)}</div>
    <div style={{padding:20,background:`${CLUSTER_COLORS[results.strongest.id]}12`,border:`1px solid ${CLUSTER_COLORS[results.strongest.id]}40`,borderRadius:8,marginBottom:12}}><div style={{...eyebrow,color:CLUSTER_COLORS[results.strongest.id]}}>YOUR STRONGEST CLUSTER</div><div style={{fontSize:25,fontFamily:BRAND.FONT_UI,fontWeight:400,marginTop:6}}>{results.strongest.name}</div><p style={leadStyle}>This is the capability signal to build from.</p></div>
    <div style={{padding:20,background:"rgba(255,255,255,.025)",border:"1px solid rgba(201,168,76,.16)",borderRadius:8,marginBottom:24}}><div style={{...eyebrow,color:BRAND.GOLD}}>YOUR BIGGEST OPPORTUNITY</div><div style={{fontSize:25,fontFamily:BRAND.FONT_UI,fontWeight:400,marginTop:6}}>{results.weakest.name}</div><p style={leadStyle}>This is the capability area with the clearest development opportunity in this taster.</p></div>
    <button onClick={onComplete} style={buttonStyle} disabled={saving}>{saving?"SAVING YOUR READ…":"TAKE THE FULL VALU INDEX →"}</button>
    <p style={finePrint}>The full VALU Index starts fresh. Your nine taster answers are not carried into the 54-question assessment.</p>
  </div></div>;
}
