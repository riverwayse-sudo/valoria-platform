import React, { useEffect, useMemo, useRef, useState } from "react";
const API_BASE = (() => {
  const configuredOrigin = String(import.meta.env.VITE_VALU_API_ORIGIN || '').trim().replace(/\/$/, '');
  if (configuredOrigin) return configuredOrigin;

  // Serverless API routes live at the deployment root, not under Vite's
  // /valu/assessment/ asset base. The latter produces POSTs to a path that
  // falls through to index.html and returns 405.
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  if (host === 'staging.valoriainstitute.com') return 'https://assessment-staging.valoriainstitute.com';
  if (host === 'assessment-staging.valoriainstitute.com') return typeof window !== 'undefined' ? window.location.origin : '';
  if (host === 'valoriainstitute.com' || host === 'www.valoriainstitute.com' || host === 'assessment.valoriainstitute.com') {
    return 'https://assessment.valoriainstitute.com';
  }

  // Preview deployments call their own root-level API functions.
  return typeof window !== 'undefined' ? window.location.origin : '';
})();

import { BRAND } from "./assessmentLock.js";
import { EXPERIENCE_BANDS, TASTER_QUESTIONS, computeTasterResult, VALU_VERSION } from "./valuTaster.js";

const CLUSTERS={P:"Presence",R:"Relationships",I:"Intelligence",M:"Mastery",E:"Enterprise"};
const COLORS={P:"#C9A84C",R:"#D4C9A8",I:"#EDE8DC",M:"#F7F4EE",E:"#C9A84C"};
const shell={position:"fixed",inset:0,zIndex:1000,overflowY:"auto",background:BRAND.DARK,color:BRAND.PARCHMENT,fontFamily:BRAND.FONT_BODY,padding:"clamp(28px,6vw,72px) 20px 64px"};
const wrap={width:"100%",maxWidth:720,margin:"0 auto"};
const eyebrow={fontSize:10,fontWeight:700,letterSpacing:".20em",color:"rgba(201,168,76,.72)"};
const input={width:"100%",boxSizing:"border-box",padding:"13px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(247,244,238,.12)",borderRadius:6,color:BRAND.PARCHMENT,fontFamily:BRAND.FONT_UI,fontSize:14,outline:"none"};
const button={width:"100%",border:0,borderRadius:6,padding:"16px 20px",background:BRAND.GOLD,color:BRAND.DARK,fontWeight:700,letterSpacing:".12em",fontSize:12,cursor:"pointer",fontFamily:BRAND.FONT_UI};

function ExperienceSelect({value,onChange}){
 const [open,setOpen]=useState(false); const ref=useRef(null);
 useEffect(()=>{const outside=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};document.addEventListener("mousedown",outside);return()=>document.removeEventListener("mousedown",outside)},[]);
 const selected=EXPERIENCE_BANDS.find(x=>x.id===value);
 return <div ref={ref} style={{position:"relative"}}>
  <button type="button" onClick={()=>setOpen(x=>!x)} aria-expanded={open} style={{...input,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#171722",cursor:"pointer"}}><span style={{color:selected?BRAND.PARCHMENT:"rgba(247,244,238,.42)"}}>{selected?`${selected.label} · ${selected.desc}.`:"Select your experience."}</span><span>{open?"⌃":"⌄"}</span></button>
  {open&&<div role="listbox" style={{position:"absolute",zIndex:20,left:0,right:0,top:"calc(100% + 6px)",background:"#171722",border:"1px solid rgba(247,244,238,.14)",borderRadius:7,padding:6,boxShadow:"0 18px 40px rgba(0,0,0,.45)"}}>{EXPERIENCE_BANDS.map(x=><button key={x.id} type="button" onClick={()=>{onChange(x.id);setOpen(false)}} style={{width:"100%",border:0,borderRadius:5,padding:"11px 12px",background:x.id===value?"rgba(201,168,76,.12)":"transparent",color:x.id===value?BRAND.GOLD:BRAND.PARCHMENT,textAlign:"left",fontSize:13,cursor:"pointer",fontFamily:BRAND.FONT_UI}}>{x.label} · {x.desc}.</button>)}</div>}
 </div>;
}

/* Public profile proof is served only by the site's consent-verified server projection. */

export default function VALUIndexTasterFirst({onComplete}){
 const [phase,setPhase]=useState("intro"),[name,setName]=useState(""),[role,setRole]=useState(""),[email,setEmail]=useState(""),[experience,setExperience]=useState(""),[current,setCurrent]=useState(0),[answers,setAnswers]=useState({}),[selected,setSelected]=useState(null),[results,setResults]=useState(null),[saving,setSaving]=useState(false),[failed,setFailed]=useState(false),[privacyAcknowledged,setPrivacyAcknowledged]=useState(false),[marketingConsent,setMarketingConsent]=useState(false),[tasterId,setTasterId]=useState(""); const timer=useRef(null);
 const q=TASTER_QUESTIONS[current]; const canStart=!!(name.trim()&&role.trim()&&email.trim()&&experience&&privacyAcknowledged); const progress=Math.round(((current+1)/TASTER_QUESTIONS.length)*100); const scores=useMemo(()=>results?Object.entries(results.points||{}).sort((a,b)=>b[1]-a[1]):[],[results]);
 useEffect(()=>()=>timer.current&&clearTimeout(timer.current),[]);
 useEffect(()=>{
  let cancelled=false;
  async function restore(){
   let token='';try{token=localStorage.getItem("valu_taster_first_resume_token")||''}catch{}
   if(!token)return;
   try{
    const data=await postProgress({action:"load",resume_token:token});
    if(cancelled)return;
    const p=data.progress||{};
    setResumeToken(token);setName(p.name||'');setRole(p.role||'');setEmail(p.email||'');setExperience(p.experience||'');
    setAnswers(p.answers||{});setSubmissionKey(p.submission_key||'');
    if(p.status==="completed"&&p.taster_id){
     setTasterId(p.taster_id);setResults(computeTasterResult(p.answers||{}));setPhase("results");return;
    }
    setCurrent(Math.min(Number(p.current_question)||0,TASTER_QUESTIONS.length-1));setPhase("taster");
   }catch(error){setErrorMessage(error?.message||"Your saved Taster could not be restored.");}
  }
  restore();return()=>{cancelled=true};
 },[]);
 async function postProgress(body){const response=await fetch(API_BASE+"/api/taster-first-progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||"Your progress could not be saved.");return payload}
 const [resumeToken,setResumeToken]=useState(""); const [submissionKey,setSubmissionKey]=useState(""); const [errorMessage,setErrorMessage]=useState("");
 async function start(){if(!canStart||saving)return;setSaving(true);setErrorMessage("");try{const p=await postProgress({action:"start",name:name.trim(),role:role.trim(),email:email.trim().toLowerCase(),experience,privacy_acknowledged:true,marketing_consent:marketingConsent});setResumeToken(p.resume_token);setSubmissionKey(p.submission_key);try{localStorage.setItem("valu_taster_first_resume_token",p.resume_token)}catch{}setCurrent(0);setAnswers({});setSelected(null);setFailed(false);setPhase("taster");window.gtag?.("event","valu_taster_start",{journey:"valu_taster_first"})}catch(e){setErrorMessage(e.message||"Could not start the taster.")}finally{setSaving(false)}}
 async function answer(i){const next={...answers,[current]:i};setAnswers(next);setSaving(true);setErrorMessage("");try{await postProgress({action:"save",resume_token:resumeToken,answers:next,current_question:current+1,submission_key:submissionKey});if(current<TASTER_QUESTIONS.length-1){setTimeout(()=>{setCurrent(x=>x+1);setSelected(null);setSaving(false)},250);return}const payload=await postProgress({action:"complete",resume_token:resumeToken});if(!payload.taster_id)throw new Error("Your completed Taster could not be confirmed. Your answers are preserved.");const result=payload.results||computeTasterResult(next);try{localStorage.setItem("pending_taster_id",payload.taster_id);localStorage.setItem("pending_taster_name",name);localStorage.setItem("pending_taster_role",role);localStorage.setItem("pending_taster_experience",experience);localStorage.setItem("pending_taster_email",email.trim().toLowerCase());}catch{}setTasterId(payload.taster_id);setResults(result);setFailed(false);window.gtag?.("event","valu_taster_complete",{journey:"valu_taster_first"});setPhase("results")}catch(e){setErrorMessage(e.message||"Your answer could not be saved. Please retry.");setSelected(null)}finally{setSaving(false)}}
 function choose(i){if(selected!==null)return;setSelected(i);timer.current=setTimeout(()=>answer(i),120)}
 if(phase==="intro") return <div style={shell}><div style={wrap}>
  <div style={{textAlign:"center",maxWidth:620,margin:"0 auto"}}><div style={{...eyebrow,display:"inline-block",padding:"7px 10px",border:"1px solid rgba(201,168,76,.20)",borderRadius:4}}>VALORIA INSTITUTE · AFRICAN TALENT BUREAU</div><h1 style={{fontFamily:BRAND.FONT_DISPLAY,fontWeight:400,fontSize:"clamp(42px,7vw,66px)",lineHeight:1.02,letterSpacing:"-.035em",margin:"16px 0 12px"}}>The <em style={{color:BRAND.GOLD}}>VALU</em> Index</h1><p style={{fontSize:14,lineHeight:1.75,color:"rgba(247,244,238,.58)",margin:0}}>Find out where you stand — and where your professional capabilities take you.</p><p style={{fontSize:11,lineHeight:1.7,color:"rgba(247,244,238,.39)",maxWidth:560,margin:"12px auto 0"}}>A brief directional read on your professional capability.</p></div>
  <div style={{margin:"28px 0 18px",padding:"18px",borderRadius:7,border:"1px solid rgba(201,168,76,.35)",background:"rgba(201,168,76,.055)"}}><div style={{...eyebrow,fontSize:9,marginBottom:8}}>START HERE</div><div style={{fontSize:20,fontWeight:500,marginBottom:6}}>VALU Index Taster</div><div style={{fontSize:12,lineHeight:1.6,color:"rgba(247,244,238,.48)"}}>A first directional read on professional capability. Your result is immediate and can help guide your next step with Valoria.</div><div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:14}}>{["Directional result","Free"].map(x=><span key={x} style={{fontSize:9,letterSpacing:".08em",padding:"5px 7px",border:"1px solid rgba(247,244,238,.08)",borderRadius:4,color:"rgba(247,244,238,.38)"}}>{x}</span>)}</div></div>
  <div style={{borderTop:"1px solid rgba(247,244,238,.08)",paddingTop:24}}><div style={{...eyebrow,marginBottom:6}}>YOUR DETAILS</div><p style={{fontSize:12,lineHeight:1.7,color:"rgba(247,244,238,.5)",margin:"0 0 18px"}}>Tell us a little about yourself so we can contextualise your snapshot. These details do not change your result.</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}><label style={{...eyebrow,fontSize:9,display:"flex",flexDirection:"column",gap:7}}>FULL NAME<input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" style={input}/></label><label style={{...eyebrow,fontSize:9,display:"flex",flexDirection:"column",gap:7}}>CURRENT ROLE<input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Senior Marketing Manager" style={input}/></label><label style={{...eyebrow,fontSize:9,display:"flex",flexDirection:"column",gap:7,gridColumn:"1 / -1"}}>EMAIL ADDRESS<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={input}/></label><label style={{...eyebrow,fontSize:9,display:"flex",flexDirection:"column",gap:7,gridColumn:"1 / -1"}}>PROFESSIONAL EXPERIENCE<ExperienceSelect value={experience} onChange={setExperience}/></label></div>  <label style={{display:'flex',alignItems:'flex-start',gap:9,fontSize:11,lineHeight:1.6,color:'rgba(247,244,238,.55)',margin:'0 0 12px'}}><input type="checkbox" required checked={privacyAcknowledged} onChange={e=>setPrivacyAcknowledged(e.target.checked)} style={{marginTop:3,accentColor:BRAND.GOLD}}/><span>I acknowledge Valoria’s <a href="https://valoriainstitute.com/privacypolicy" target="_blank" rel="noreferrer" style={{color:BRAND.GOLD}}>Privacy Notice</a> and consent to processing my details to administer this assessment.</span></label><label style={{display:'flex',alignItems:'flex-start',gap:9,fontSize:11,lineHeight:1.6,color:'rgba(247,244,238,.45)',margin:'0 0 14px'}}><input type="checkbox" checked={marketingConsent} onChange={e=>setMarketingConsent(e.target.checked)} style={{marginTop:3,accentColor:BRAND.GOLD}}/><span>Send me relevant Valoria updates and opportunities by email. Optional.</span></label><button disabled={!canStart||saving} onClick={start} style={{...button,opacity:canStart&&!saving?1:.42,cursor:canStart&&!saving?"pointer":"not-allowed"}}>START THE VALU INDEX TASTER →</button><p style={{fontSize:11,lineHeight:1.6,color:"rgba(247,244,238,.27)",textAlign:"center",marginTop:16}}>VALU v{VALU_VERSION} · Your responses are saved securely. Create your account after completing the Taster.</p></div>
{errorMessage&&phase==="intro"&&<p role="alert" style={{color:"#E8A09A",fontSize:12,marginTop:12}}>{errorMessage}</p>}
 </div></div>;
 if(phase==="taster") return <div style={shell}><div style={{...wrap,maxWidth:760}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}><div style={eyebrow}>{q.cluster} · {CLUSTERS[q.cluster]}</div><div style={{fontFamily:BRAND.FONT_MONO,fontSize:12,color:"rgba(247,244,238,.35)"}}>VALU INDEX TASTER · IN PROGRESS</div></div><div style={{height:3,background:"rgba(255,255,255,.06)",marginBottom:30}}><div style={{height:"100%",width:`${progress}%`,background:COLORS[q.cluster]}}/></div><div style={{fontSize:11,color:"rgba(247,244,238,.42)",letterSpacing:".08em",marginBottom:14}}>{q.tasterInsight}</div><h2 style={{fontFamily:BRAND.FONT_DISPLAY,fontWeight:400,fontSize:"clamp(26px,4vw,40px)",lineHeight:1.15,margin:"0 0 30px",maxWidth:720}}>{q.q}</h2><div style={{display:"grid",gap:10}}>{q.options.map((o,i)=><button className="valu-option" key={i} type="button" disabled={selected!==null} onClick={()=>choose(i)} style={{appearance:"none",WebkitAppearance:"none",MozAppearance:"none",textAlign:"left",padding:"16px 18px",display:"grid",gridTemplateColumns:"28px 1fr",gap:12,alignItems:"start",borderRadius:7,border:`1px solid ${selected===i?BRAND.GOLD:"rgba(247,244,238,.10)"}`,background:selected===i?"rgba(201,168,76,.14)":"#2E2E4A",color:BRAND.PARCHMENT,cursor:"pointer",opacity:(selected!==null&&selected!==i)?0.62:1,fontFamily:BRAND.FONT_UI}}><span style={{display:"flex",width:28,height:28,borderRadius:"50%",alignItems:"center",justifyContent:"center",border:`1px solid ${selected===i?BRAND.GOLD:"rgba(247,244,238,.18)"}`,color:selected===i?BRAND.GOLD:"rgba(247,244,238,.45)"}}>{selected===i?"✓":String.fromCharCode(65+i)}</span><span style={{fontSize:14,lineHeight:1.6}}>{o.text}</span></button>)}</div><div style={{minHeight:28,marginTop:18,fontSize:12,color:"rgba(247,244,238,.35)"}}>Select the answer that feels most like you.</div>{errorMessage&&<p role="alert" style={{color:"#E8A09A",fontSize:12,marginTop:12}}>{errorMessage}</p>}{saving&&<p role="status" style={{color:BRAND.GOLD,fontSize:12,marginTop:8}}>Saving your progress…</p>}</div></div>;
 return <div style={shell}><div style={wrap}>
  <div style={eyebrow}>VALU INDEX TASTER · COMPLETE</div>
  <h1 style={{fontFamily:BRAND.FONT_DISPLAY,fontWeight:400,fontSize:"clamp(38px,7vw,62px)",lineHeight:1.05,margin:"16px 0"}}>Your first signal is <em style={{color:BRAND.GOLD}}>ready.</em></h1>
  <p style={{fontSize:14,lineHeight:1.75,color:"rgba(247,244,238,.58)"}}>Your Taster is saved. This is a directional read of the Intelligence dimension, separate from your full 58-question VALU Index.</p>
  {failed&&<div role="alert" style={{padding:14,margin:"18px 0",border:"1px solid rgba(201,168,76,.4)",borderRadius:7,fontSize:13}}>We could not save your Taster. Please retry before continuing.</div>}
  <div style={{padding:22,background:"rgba(201,168,76,.07)",border:"1px solid rgba(201,168,76,.28)",borderRadius:8,margin:"24px 0"}}>
   <div style={eyebrow}>INTELLIGENCE · VALU TASTER POINTS</div>
   <div style={{fontSize:48,fontWeight:600,color:BRAND.GOLD,marginTop:8}}>{results?.intelligenceScore ?? "—"} <span style={{fontSize:13,fontWeight:500,color:"rgba(247,244,238,.5)"}}>points</span></div>
  </div>
  <div style={{display:"grid",gap:10,margin:"20px 0 24px"}}>
   {Object.entries(results?.normalisedSkills||{}).map(([skill,score])=><div key={skill} style={{display:"flex",justifyContent:"space-between",gap:16,padding:"12px 14px",border:"1px solid rgba(247,244,238,.10)",borderRadius:6}}><span style={{fontSize:12,color:"rgba(247,244,238,.72)"}}>{skill.replace(" ★","")}</span><strong style={{fontSize:13,color:BRAND.GOLD}}>{score} points</strong></div>)}
  </div>
  <div style={{padding:18,border:"1px solid rgba(212,201,168,.18)",borderRadius:8,marginBottom:22}}>
   <div style={eyebrow}>A USEFUL NEXT STEP</div>
   <p style={{fontSize:13,lineHeight:1.7,color:"rgba(247,244,238,.6)",margin:"8px 0 0"}}>Create or connect your Valoria account to preserve this Taster in your professional journey. Your separate full VALU Index will be available from your dashboard.</p>
  </div>
  <button onClick={()=>{if(onComplete)onComplete({tasterId,name,role,experience,email:email.trim().toLowerCase()});}} disabled={saving||failed||!tasterId} style={{...button,opacity:(saving||failed||!tasterId)?0.55:1}}>{saving?"SAVING YOUR READ…":failed?"SAVE FAILED — RETRY REQUIRED":"CREATE MY VALORIA ACCOUNT →"}</button>
  <p style={{fontSize:11,lineHeight:1.6,color:"rgba(247,244,238,.27)",textAlign:"center",marginTop:16}}>Your saved responses remain separate from your full VALU Index.</p>
 </div></div>;
}
