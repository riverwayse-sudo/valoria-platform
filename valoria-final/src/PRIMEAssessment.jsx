import { useState, useEffect, useRef } from "react";
import { CLUSTERS, DESIGNATIONS, computeResults as _computeResults } from "./scoringEngine.js";
import { QUESTIONS } from "./questions.js";

const GOLD = "#C9A84C";
const DARK = "#1A1A2E";
const MID  = "#2E2E4A";
const PARCHMENT = "#F7F4EE";
const ACCENT = "#EDE8DC";
const AMBER = "#E8A020";
const BODY = "#2C2C2C";

const EXPERIENCE_BANDS = [
  { id:"0-3", label:"0 – 3 years", desc:"Early career" },
  { id:"4-8", label:"4 – 8 years", desc:"Mid career" },
  { id:"9-15", label:"9 – 15 years", desc:"Senior" },
  { id:"15+", label:"15+ years", desc:"Executive / Director" },
];

const CLUSTER_UI = {
  P: { theme:"How you show up", color:"#1D9E75" },
  R: { theme:"How you connect", color:"#378ADD" },
  I: { theme:"How you think", color:"#7F77DD" },
  M: { theme:"How you deliver", color:"#BA7517" },
  E: { theme:"How you create", color:"#D85A30" },
};
const CLUSTERS_UI = CLUSTERS.map(c => ({ ...c, ...CLUSTER_UI[c.id] }));
const TOTAL = QUESTIONS.length;

async function submitAssessment({ name, role, experience, answers, timings, shuffleMap = {} }, attempt = 0) {
  const res = await fetch("/api/submit-assessment", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ name, role, experience: experience || null, answers, timings, shuffleMap }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (attempt === 0 && res.status >= 500) {
      await new Promise(r => setTimeout(r, 1200));
      return submitAssessment({ name, role, experience, answers, timings, shuffleMap }, 1);
    }
    let message = text;
    try { message = JSON.parse(text).error || text; } catch {}
    throw new Error(message || `Score could not be saved (${res.status}).`);
  }
  return res.json();
}

async function saveTasterSession({ name, role, experience, tasterAnswers, tasterResults }) {
  const res = await fetch("/api/save-taster", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      name,
      role,
      experience: experience || null,
      tasterAnswers,
      clusterScores:tasterResults.normalisedScores,
      strongestCluster:tasterResults.strongest.id,
      weakestCluster:tasterResults.weakest.id,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try { message = JSON.parse(text).error || text; } catch {}
    throw new Error(message || `Taster could not be saved (${res.status}).`);
  }
  return res.json();
}

// ── TASTER QUESTIONS (9 — one per key skill, chosen for maximum resonance) ─
const TASTER_QUESTIONS = [
  { id:"P1b", cluster:"P", skill:"Communication", tasterInsight:"how you communicate under pressure", q:"You are presenting a recommendation to leadership. Halfway through, you sense they have already made up their minds differently. What do you do?", options:[
    {text:"Finish the presentation as planned — the information needs to be heard.", score:1},
    {text:"Speed up and land the key points before you lose the room entirely.", score:2},
    {text:"Stop, name what you are sensing, and ask what their current thinking is before continuing.", score:3},
    {text:"Pivot immediately to the one thing that could shift their position, then invite the disagreement directly.", score:4},
  ]},
  { id:"R1a", cluster:"R", skill:"Emotional Intelligence", tasterInsight:"how you read and respond to people", q:"You are in a high-pressure meeting and someone says something that genuinely irritates you. What actually happens next?", options:[
    {text:"I respond directly — suppressing a genuine reaction makes things worse, not better.", score:1},
    {text:"I stay quiet and address it after the meeting when things are calmer.", score:2},
    {text:"I notice the irritation, make a conscious decision not to act on it in the moment, and decide later whether it needs addressing.", score:3},
    {text:"I notice it, name — internally — what triggered it, regulate before responding, and make a deliberate choice about whether and how to address it based on what is actually useful.", score:4},
  ]},
  { id:"R4a", cluster:"R", skill:"Stakeholder Management", tasterInsight:"how you manage relationships across power structures", q:"You are about to lead a significant new initiative that will require the support of people across multiple functions. Where do you start?", options:[
    {text:"Start the work and bring stakeholders in as they become relevant.", score:1},
    {text:"Brief the key stakeholders and make sure they know what is happening.", score:2},
    {text:"Map who needs to be involved, understand what each person cares about, and sequence conversations accordingly before work begins.", score:3},
    {text:"Build a stakeholder influence map — interests, concerns, level of support needed — then create a deliberate alignment sequence that builds momentum before I need it.", score:4},
  ]},
  { id:"I2a", cluster:"I", skill:"Strategic Thinking", tasterInsight:"how you connect your work to the bigger picture", q:"You are given a task that is clearly important to your manager. Before starting, what goes through your mind?", options:[
    {text:"How to do it well and on time.", score:1},
    {text:"How this connects to the team's current priorities.", score:2},
    {text:"How this fits into the broader goal, who will use the output, and what success actually looks like beyond task completion.", score:3},
    {text:"How this task connects to the longer-term direction, what decisions it will enable or constrain, what the second-order consequences are, and whether this is actually the right task to be doing.", score:4},
  ]},
  { id:"I3b", cluster:"I", skill:"Business Acumen", tasterInsight:"how commercially fluent you are", q:"You are proposing a new initiative that will require investment. A finance leader asks you to walk them through the commercial case. How prepared are you?", options:[
    {text:"I can explain what the initiative does and why it is important.", score:1},
    {text:"I can explain the cost and the expected benefit at a high level.", score:2},
    {text:"I can present the cost, projected return, key assumptions, and the timeline to value.", score:3},
    {text:"I can present a fully worked commercial case — cost, return, assumptions with ranges, downside scenarios, payback period, and the metrics I would use to track whether it is working.", score:4},
  ]},
  { id:"M1b", cluster:"M", skill:"Execution & Accountability", tasterInsight:"how you handle pressure and accountability", q:"A deadline you committed to is at serious risk — partly because of factors outside your control, partly because of your own planning. What do you do?", options:[
    {text:"Focus everything on delivery and explain what happened afterwards.", score:1},
    {text:"Flag the risk early, explain the external factors, and ask for an extension.", score:2},
    {text:"Flag the risk early, take ownership of your part in it, propose a specific revised plan, and deliver against the new commitment.", score:3},
    {text:"Flag the risk at the earliest signal — not when it is certain — own your contribution without defensiveness, present options with trade-offs, get alignment on the path forward, and build the lesson into how you plan next time.", score:4},
  ]},
  { id:"M2b", cluster:"M", skill:"Resilience & Self-Leadership", tasterInsight:"how you respond to setbacks", q:"A project you led publicly failed — the outcome was visible, the impact was real, and people noticed. How do you respond?", options:[
    {text:"I focus on moving forward — dwelling on failure is not useful.", score:1},
    {text:"I do a debrief, understand what went wrong, and try not to repeat it.", score:2},
    {text:"I do a thorough analysis of what failed and why, take clear accountability for my role in it, and make specific changes to how I work.", score:3},
    {text:"I treat it as signal-rich data — rigorous analysis of what happened and why, clear accountability for what was mine, specific changes to practice, and deliberate use of the experience to build credibility by showing how I handle failure.", score:4},
  ]},
  { id:"E2a", cluster:"E", skill:"Influence Without Authority", tasterInsight:"how you lead without formal power", q:"You need the cooperation of someone who does not report to you — and they are currently not prioritising what you need. How do you approach it?", options:[
    {text:"Escalate to someone with authority over them.", score:1},
    {text:"Make the request clearly and explain why it matters.", score:2},
    {text:"Take time to understand what they are prioritising and find a way to connect my need to something they care about.", score:3},
    {text:"Invest in the relationship before I need something, understand their priorities and pressures, frame my request in terms of their interests, and make it easy for them to say yes.", score:4},
  ]},
  { id:"E1a", cluster:"E", skill:"Commercial Creativity", tasterInsight:"how creatively you approach constraints", q:"You are asked to achieve the same outcome with significantly fewer resources than last time. What is your instinct?", options:[
    {text:"Push back — the ask is not realistic and delivering poorly serves nobody.", score:1},
    {text:"Accept the constraint and find ways to reduce scope to match the budget.", score:2},
    {text:"Accept the constraint and look for ways to redesign the approach so it delivers more value with less resource.", score:3},
    {text:"Treat the constraint as a design brief — challenge every assumption about how the outcome is achieved, then find a materially better route through the constraint.", score:4},
  ]},
];

const TASTER_TOTAL = TASTER_QUESTIONS.length;

function computeTasterResult(answers) {
  const clusterScores = { P:0, R:0, I:0, M:0, E:0 };
  const clusterCounts = { P:0, R:0, I:0, M:0, E:0 };
  TASTER_QUESTIONS.forEach((q, idx) => {
    const chosen = answers[idx];
    if (chosen === undefined) return;
    const score = q.options[chosen].score;
    clusterScores[q.cluster] += score;
    clusterCounts[q.cluster]++;
  });
  const normalisedScores = {};
  CLUSTERS.forEach(c => {
    const count = clusterCounts[c.id] || 1;
    normalisedScores[c.id] = Math.round((clusterScores[c.id] / (count * 4)) * 100);
  });
  const sorted = [...CLUSTERS].sort((a,b) => normalisedScores[b.id] - normalisedScores[a.id]);
  const strongest = { ...sorted[0], ...CLUSTER_UI[sorted[0].id] };
  const weakest = { ...sorted[sorted.length - 1], ...CLUSTER_UI[sorted[sorted.length - 1].id] };
  const secondWeakest = sorted[sorted.length - 2];
  const insights = {
    P: { high:"Your Presence score is strong — the way you communicate and show up in high-stakes moments is a genuine asset. This is what makes you hard to ignore when it counts.", low:"Your Presence cluster shows the most room to grow. How you show up in key moments — in a pitch, in a leadership meeting, in a negotiation — is shaping how others assess your capability before they see the substance." },
    R: { high:"Your Relationships cluster is your strongest signal — you understand people, manage dynamics well, and know how to build the alliances that make things move.", low:"Your Relationships cluster is your biggest development opportunity. The gap between talent and progression is often relational — who backs you, who knows you, who trusts you to lead." },
    I: { high:"Your Intelligence cluster is where you shine — you think in systems, question assumptions, and make commercially grounded decisions. That is rare.", low:"Your Intelligence cluster has the most room to grow. Strategic thinking and commercial acumen are the skills that move professionals from execution to leadership — and they are learnable." },
    M: { high:"Your Mastery cluster is strong — you deliver, you hold yourself accountable, and you adapt when things change. That reliability is the foundation everything else is built on.", low:"Your Mastery cluster is your highest-leverage development area. Delivery, accountability, and resilience under pressure are what separate professionals who are trusted with bigger mandates from those who are not." },
    E: { high:"Your Enterprise cluster stands out — you influence without authority, you think creatively about constraints, and you are comfortable in the ambiguous space where new things get made.", low:"Your Enterprise cluster shows real development potential. The ability to move things without formal authority and to find creative paths through constraints is what distinguishes professionals who lead change from those who execute it." },
  };
  return { normalisedScores, strongest, weakest, secondWeakest, insights };
}

function computeResults(answers, timings, shuffleMap = {}) {
  return _computeResults(answers, timings, shuffleMap, QUESTIONS);
}

function Radar({ scores, size = 200 }) {
  const cx = size/2, cy = size/2, r = size * 0.37, n = 5;
  const angle = i => (Math.PI*2*i/n) - Math.PI/2;
  const pt = (i, frac) => ({ x: cx + r*frac*Math.cos(angle(i)), y: cy + r*frac*Math.sin(angle(i)) });
  const gridPoly = frac => CLUSTERS_UI.map((_,i) => { const p=pt(i,frac); return `${p.x},${p.y}`; }).join(" ");
  const dataPts = CLUSTERS_UI.map((c,i) => pt(i, (scores[c.id]||0)/100));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible"}}>
      {[0.25,0.5,0.75,1].map(f => <polygon key={f} points={gridPoly(f)} fill="none" stroke={f===1?"rgba(201,168,76,0.4)":"rgba(201,168,76,0.15)"} strokeWidth={f===1?0.8:0.5}/>)}
      {CLUSTERS_UI.map((_,i) => { const p=pt(i,1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(201,168,76,0.2)" strokeWidth={0.5}/>; })}
      <polygon points={dataPts.map(p=>`${p.x},${p.y}`).join(" ")} fill="rgba(201,168,76,0.15)" stroke={GOLD} strokeWidth={1.5} style={{transition:"all 0.5s"}}/>
      {dataPts.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={CLUSTERS_UI[i].color} style={{transition:"all 0.5s"}}/>)}
      {CLUSTERS_UI.map((c,i) => { const lp=pt(i,1.22); return <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central" style={{fontSize:10,fontWeight:600,fill:c.color}}>{c.id}</text>; })}
    </svg>
  );
}

export default function PRIMEAssessment() {
  const [phase, setPhase] = useState("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [tasterAnswers, setTasterAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [timings, setTimings] = useState(Array(TOTAL).fill(0));
  const [qStartTime, setQStartTime] = useState(null);
  const [results, setResults] = useState(null);
  const [tasterResults, setTasterResults] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isTaster = phase === "taster";
  const question = isTaster ? TASTER_QUESTIONS[currentQ] : QUESTIONS[currentQ];
  const total = isTaster ? TASTER_TOTAL : TOTAL;
  const progress = Math.round((currentQ / total) * 100);
  const cluster = CLUSTERS_UI.find(c => c.id === question?.cluster);

  useEffect(() => {
    if (phase === "assessing" || phase === "taster") setQStartTime(Date.now());
  }, [currentQ, phase]);

  const liveScores = {};
  CLUSTERS.forEach(c => {
    const qs = QUESTIONS.filter((q,i) => q.cluster === c.id && answers[i] !== undefined);
    const raw = qs.reduce((s, q) => {
      const idx = QUESTIONS.indexOf(q);
      return s + (q.options[answers[idx]]?.score || 0);
    }, 0);
    liveScores[c.id] = Math.round((raw / c.maxRaw) * 100);
  });

  function handleSelect(optIdx) {
    if (transitioning || submitting) return;
    setSelected(optIdx);
    setSubmitError("");
  }

  function handleNext() {
    if (selected === null || submitting) return;
    const elapsed = qStartTime ? Date.now() - qStartTime : 0;
    if (isTaster) {
      const newAnswers = { ...tasterAnswers, [currentQ]: selected };
      setTasterAnswers(newAnswers);
      setTransitioning(true);
      setTimeout(() => {
        if (currentQ + 1 < TASTER_TOTAL) {
          setCurrentQ(currentQ + 1); setSelected(null); setTransitioning(false);
        } else {
          const r = computeTasterResult(newAnswers);
          setTasterResults(r); setPhase("taster_results"); setCurrentQ(0); setSelected(null); setTransitioning(false);
          saveTasterSession({ name, role, experience, tasterAnswers:newAnswers, tasterResults:r }).catch(err => console.warn("Taster persistence failed:", err.message));
        }
      }, 280);
      return;
    }

    const newTimings = [...timings];
    newTimings[currentQ] = elapsed;
    const newAnswers = { ...answers, [currentQ]: selected };
    setTimings(newTimings); setAnswers(newAnswers); setTransitioning(true);
    setTimeout(async () => {
      if (currentQ + 1 < TOTAL) {
        setCurrentQ(currentQ + 1); setSelected(null); setTransitioning(false); return;
      }
      setSubmitting(true); setSubmitError("");
      try {
        const payload = await submitAssessment({ name, role, experience, answers:newAnswers, timings:newTimings, shuffleMap:{} });
        setResults(payload.results); setPhase("results");
      } catch (err) {
        setSubmitError(err.message || "Could not save your result. Please try again.");
      } finally {
        setSubmitting(false); setTransitioning(false);
      }
    }, 280);
  }

  function handleBack() {
    if (currentQ === 0 || submitting) return;
    const prevAnswers = isTaster ? tasterAnswers : answers;
    setSelected(prevAnswers[currentQ - 1] ?? null);
    setCurrentQ(currentQ - 1);
  }

  function restart() {
    setPhase("intro"); setCurrentQ(0); setAnswers({}); setTasterAnswers({}); setSelected(null);
    setResults(null); setTasterResults(null); setName(""); setRole(""); setExperience("");
    setTimings(Array(TOTAL).fill(0)); setSubmitting(false); setSubmitError("");
  }

  function startFullAssessment() {
    setCurrentQ(0); setSelected(null); setAnswers({}); setTimings(Array(TOTAL).fill(0));
    setSubmitError(""); setSubmitting(false); setPhase("assessing");
  }

  const base = { minHeight:"100vh", background:DARK, color:PARCHMENT, fontFamily:"'Georgia', serif", position:"relative", overflow:"hidden" };
  const grain = { position:"fixed", inset:0, pointerEvents:"none", zIndex:0, opacity:0.03, backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` };

  if (phase === "intro") return (
    <div style={base}>
      <div style={grain}/>
      <div style={{position:"relative",zIndex:1,maxWidth:640,margin:"0 auto",padding:"48px 24px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:"0.2em",fontFamily:"sans-serif",marginBottom:14}}>VALU INDEX · PRIME FRAMEWORK</div>
          <h1 style={{fontSize:"clamp(30px,6vw,48px)",fontWeight:300,lineHeight:1.1,marginBottom:14}}>Know your <span style={{color:GOLD,fontStyle:"italic"}}>professional edge.</span></h1>
          <p style={{fontSize:14,color:"rgba(247,244,238,0.45)",lineHeight:1.7,fontFamily:"sans-serif",maxWidth:520,margin:"0 auto"}}>Start with a five-minute taster to get a directional read across the five PRIME capability clusters — or go straight to the full VALU Index.</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:28}}>
          <div style={{padding:"18px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:4,textAlign:"center"}}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:"0.15em",fontFamily:"sans-serif",marginBottom:10,fontWeight:700}}>TASTER</div>
            {[['9','Questions'],['~5','Minutes'],['Free','Always']].map(([n,l]) => <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid rgba(201,168,76,0.08)"}}><span style={{fontSize:12,color:"rgba(247,244,238,0.45)",fontFamily:"sans-serif"}}>{l}</span><span style={{fontSize:16,color:GOLD,fontWeight:300}}>{n}</span></div>)}
          </div>
          <div style={{padding:"18px 16px",background:"rgba(201,168,76,0.06)",border:`1px solid ${GOLD}`,borderRadius:4,textAlign:"center"}}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:"0.15em",fontFamily:"sans-serif",marginBottom:10,fontWeight:700}}>FULL VALU INDEX</div>
            {[['58','Questions'],['18–28','Minutes'],['12mo','Valid']].map(([n,l]) => <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid rgba(201,168,76,0.08)"}}><span style={{fontSize:12,color:"rgba(247,244,238,0.45)",fontFamily:"sans-serif"}}>{l}</span><span style={{fontSize:16,color:GOLD,fontWeight:300}}>{n}</span></div>)}
          </div>
        </div>

        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:6,padding:28,marginBottom:24}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:"0.15em",fontFamily:"sans-serif",marginBottom:20}}>YOUR DETAILS</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><label style={{fontSize:11,color:"rgba(247,244,238,0.4)",letterSpacing:"0.1em",display:"block",marginBottom:8,fontFamily:"sans-serif"}}>FULL NAME *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:3,padding:"13px 14px",color:PARCHMENT,fontSize:14}}/></div>
            <div><label style={{fontSize:11,color:"rgba(247,244,238,0.4)",letterSpacing:"0.1em",display:"block",marginBottom:8,fontFamily:"sans-serif"}}>CURRENT ROLE *</label><input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Marketing Director" style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:3,padding:"13px 14px",color:PARCHMENT,fontSize:14}}/></div>
            <div><label style={{fontSize:11,color:"rgba(247,244,238,0.4)",letterSpacing:"0.1em",display:"block",marginBottom:8,fontFamily:"sans-serif"}}>EXPERIENCE</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{EXPERIENCE_BANDS.map(b=><button type="button" key={b.id} onClick={()=>setExperience(b.id)} style={{padding:"12px 10px",background:experience===b.id?"rgba(201,168,76,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${experience===b.id?GOLD:"rgba(201,168,76,0.15)"}`,borderRadius:3,color:experience===b.id?PARCHMENT:"rgba(247,244,238,0.55)",cursor:"pointer",fontFamily:"sans-serif"}}><div style={{fontSize:12,fontWeight:700}}>{b.label}</div><div style={{fontSize:10,marginTop:3,color:"rgba(247,244,238,0.3)"}}>{b.desc}</div></button>)}</div></div>
          </div>
        </div>

        <button onClick={()=>setPhase("taster")} disabled={!name.trim()||!role.trim()} style={{width:"100%",padding:"17px",background:name.trim()&&role.trim()?GOLD:"rgba(201,168,76,0.15)",border:"none",borderRadius:3,color:name.trim()&&role.trim()?DARK:"rgba(201,168,76,0.4)",fontSize:12,fontFamily:"sans-serif",fontWeight:700,letterSpacing:"0.15em",cursor:name.trim()&&role.trim()?"pointer":"not-allowed",marginBottom:10}}>START THE TASTER — 5 MINUTES</button>
        <button onClick={startFullAssessment} disabled={!name.trim()||!role.trim()} style={{width:"100%",padding:"13px",background:"transparent",border:"1px solid rgba(201,168,76,0.25)",borderRadius:3,color:"rgba(247,244,238,0.5)",fontSize:11,fontFamily:"sans-serif",fontWeight:600,letterSpacing:"0.12em",cursor:name.trim()&&role.trim()?"pointer":"not-allowed"}}>SKIP TO FULL VALU INDEX (58 QUESTIONS)</button>
        <div style={{textAlign:"center",paddingTop:30,fontSize:10,color:"rgba(247,244,238,0.2)",fontFamily:"sans-serif",lineHeight:1.7}}>Your taster responses are never used in your full VALU Index score.</div>
      </div>
    </div>
  );

  if (phase === "taster" || phase === "assessing") {
    const isTasterPhase = phase === "taster";
    const clusterColor = cluster?.color || GOLD;
    const isAnchor = question?.cluster === "VA";
    return (
      <div style={base}>
        <div style={grain}/>
        <div style={{position:"relative",zIndex:1,maxWidth:680,margin:"0 auto",padding:"32px 24px 60px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><div style={{fontSize:11,color:GOLD,letterSpacing:"0.15em",fontFamily:"sans-serif"}}>{isTasterPhase?"VALU INDEX · TASTER":"PRIME FRAMEWORK · VALU INDEX"}</div><div style={{fontSize:11,color:"rgba(247,244,238,0.35)",fontFamily:"sans-serif"}}>{currentQ+1} / {total}</div></div>
          <div style={{height:2,background:"rgba(201,168,76,0.1)",marginBottom:32}}><div style={{height:"100%",width:`${Math.max(3,Math.round(((currentQ+1)/total)*100))}%`,background:GOLD,transition:"width 0.3s"}}/></div>
          {!isAnchor && cluster && <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}><div style={{width:34,height:34,background:"rgba(255,255,255,0.06)",border:`1px solid ${clusterColor}40`,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:clusterColor}}>{cluster.id}</div><div><div style={{fontSize:11,color:clusterColor,letterSpacing:"0.15em",marginBottom:2,fontFamily:"sans-serif"}}>{cluster.name.toUpperCase()}</div><div style={{fontSize:12,color:"rgba(247,244,238,0.4)",fontStyle:"italic",fontFamily:"sans-serif"}}>{cluster.theme}</div></div>{question?.futureReady&&<div style={{marginLeft:"auto",fontSize:10,color:AMBER,fontFamily:"sans-serif",letterSpacing:"0.1em"}}>FUTURE-READY</div>}</div>}
          <div style={{opacity:transitioning?0:1,transform:transitioning?"translateY(-8px)":"translateY(0)",transition:"all 0.28s ease"}}>
            <h2 style={{fontSize:"clamp(18px,3.2vw,24px)",fontWeight:300,color:PARCHMENT,lineHeight:1.45,marginBottom:32}}>{question?.q}</h2>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>{question?.options.map((opt,i)=>{const isSel=selected===i;return <button key={i} onClick={()=>handleSelect(i)} style={{textAlign:"left",padding:"16px 20px",background:isSel?"rgba(201,168,76,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${isSel?GOLD:"rgba(201,168,76,0.15)"}`,borderRadius:3,cursor:"pointer",transition:"all 0.2s",position:"relative"}}>{isSel&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:GOLD,borderRadius:"3px 0 0 3px"}}/><div style={{display:"flex",gap:14,alignItems:"flex-start"}}><div style={{width:20,height:20,borderRadius:"50%",flexShrink:0,border:`1.5px solid ${isSel?GOLD:"rgba(201,168,76,0.3)"}`,background:isSel?GOLD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",marginTop:1}}>{isSel&&<div style={{width:7,height:7,borderRadius:"50%",background:DARK}}/>}</div><span style={{fontSize:14,color:isSel?PARCHMENT:"rgba(247,244,238,0.65)",lineHeight:1.55,fontFamily:"sans-serif",fontWeight:isSel?400:300}}>{opt.text}</span></div></button>})}</div>
            {submitError&&!isTasterPhase&&<div style={{marginBottom:12,padding:"12px 14px",background:"rgba(216,90,48,0.10)",border:"1px solid rgba(216,90,48,0.35)",borderRadius:4,color:"#D85A30",fontSize:12,fontFamily:"sans-serif"}}>{submitError} Select the final answer again to retry.</div>}
            <div style={{display:"flex",gap:10,marginBottom:36}}>{currentQ>0&&<button onClick={handleBack} style={{padding:"12px 22px",background:"transparent",border:"1px solid rgba(201,168,76,0.2)",borderRadius:3,color:"rgba(247,244,238,0.45)",fontSize:12,fontFamily:"sans-serif",cursor:"pointer",letterSpacing:"0.1em"}}>BACK</button>}<button onClick={handleNext} disabled={selected===null||submitting} style={{flex:1,padding:"14px 24px",background:selected!==null?GOLD:"rgba(201,168,76,0.15)",border:"none",borderRadius:3,color:selected!==null?DARK:"rgba(201,168,76,0.4)",fontSize:12,fontFamily:"sans-serif",fontWeight:700,letterSpacing:"0.15em",cursor:selected!==null&&!submitting?"pointer":"not-allowed"}}>{submitting?"SAVING YOUR RESULT…":(isTasterPhase?(currentQ+1===TASTER_TOTAL?"SEE MY RESULT":"NEXT"):(currentQ+1===TOTAL?"COMPLETE ASSESSMENT":"NEXT"))}</button></div>
          </div>
          {!isTasterPhase&&<div style={{display:"flex",justifyContent:"center",paddingBottom:40,opacity:0.6}}><Radar scores={liveScores} size={150}/></div>}
        </div>
      </div>
    );
  }

  if (phase === "taster_results" && tasterResults) {
    const { normalisedScores, strongest, weakest, insights } = tasterResults;
    return <div style={base}><div style={grain}/><div style={{position:"relative",zIndex:1,maxWidth:640,margin:"0 auto",padding:"48px 24px 80px"}}>
      <div style={{marginBottom:32}}><div style={{fontSize:11,color:GOLD,letterSpacing:"0.2em",marginBottom:12,fontFamily:"sans-serif"}}>VALU INDEX · TASTER COMPLETE</div><h1 style={{fontSize:"clamp(24px,5vw,38px)",fontWeight:300,lineHeight:1.15,marginBottom:8}}> {name}, here is your <span style={{color:GOLD,fontStyle:"italic"}}>directional read.</span></h1><p style={{fontSize:14,color:"rgba(247,244,238,0.45)",fontStyle:"italic",fontFamily:"sans-serif"}}>Based on 9 questions across all five PRIME clusters.{experience&&` ${EXPERIENCE_BANDS.find(b=>b.id===experience)?.label} professional.`}</p></div>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:6,padding:24,marginBottom:24}}><div style={{fontSize:11,color:GOLD,letterSpacing:"0.2em",marginBottom:20,fontFamily:"sans-serif"}}>YOUR FIVE CLUSTERS</div>{CLUSTERS_UI.map(c=>{const score=normalisedScores[c.id],isStrongest=c.id===strongest.id,isWeakest=c.id===weakest.id;return <div key={c.id} style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,fontWeight:700,color:c.color,fontFamily:"sans-serif",width:16}}>{c.id}</span><span style={{fontSize:13,color:PARCHMENT,fontFamily:"sans-serif"}}>{c.name}</span><span style={{fontSize:10,color:"rgba(247,244,238,0.3)",fontStyle:"italic",fontFamily:"sans-serif"}}>{c.theme}</span>{isStrongest&&<span style={{fontSize:9,color:GOLD,border:`1px solid ${GOLD}40`,padding:"1px 6px",borderRadius:99,fontFamily:"sans-serif"}}>STRONGEST</span>}{isWeakest&&<span style={{fontSize:9,color:"rgba(247,244,238,0.4)",border:"1px solid rgba(247,244,238,0.15)",padding:"1px 6px",borderRadius:99,fontFamily:"sans-serif"}}>OPPORTUNITY</span>}</div><span style={{fontSize:16,fontWeight:300,color:c.color,fontFamily:"sans-serif"}}>{score}</span></div><div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${score}%`,background:c.color,borderRadius:3}}/></div></div>})}</div>
      <div style={{padding:"20px 24px",background:`${strongest.color}12`,border:`1px solid ${strongest.color}40`,borderRadius:6,marginBottom:16}}><div style={{fontSize:10,color:strongest.color,letterSpacing:"0.2em",marginBottom:8,fontFamily:"sans-serif",fontWeight:700}}>YOUR STRONGEST CLUSTER — {strongest.name.toUpperCase()}</div><p style={{fontSize:14,color:PARCHMENT,lineHeight:1.65,margin:0,fontFamily:"sans-serif"}}>{insights[strongest.id].high}</p></div>
      <div style={{padding:"20px 24px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:6,marginBottom:28}}><div style={{fontSize:10,color:GOLD,letterSpacing:"0.2em",marginBottom:8,fontFamily:"sans-serif",fontWeight:700}}>YOUR BIGGEST OPPORTUNITY — {weakest.name.toUpperCase()}</div><p style={{fontSize:14,color:PARCHMENT,lineHeight:1.65,margin:0,fontFamily:"sans-serif"}}>{insights[weakest.id].low}</p></div>
      <div style={{padding:"28px 24px",background:MID,border:`1px solid ${GOLD}`,borderRadius:6,marginBottom:16,textAlign:"center"}}><div style={{fontSize:12,color:GOLD,letterSpacing:"0.15em",marginBottom:12,fontFamily:"sans-serif"}}>THIS IS YOUR DIRECTION. YOUR SCORE IS NEXT.</div><p style={{fontSize:14,color:"rgba(247,244,238,0.65)",lineHeight:1.65,marginBottom:24,fontFamily:"sans-serif"}}>The full VALU Index gives you your score out of 100, your professional designation, a detailed radar chart across all five clusters, and your marketplace listing if your score qualifies. It takes 18 to 28 minutes.</p><button onClick={startFullAssessment} style={{width:"100%",padding:"18px 32px",background:GOLD,border:"none",borderRadius:3,color:DARK,fontSize:13,fontFamily:"sans-serif",fontWeight:700,letterSpacing:"0.15em",cursor:"pointer",marginBottom:10}}>TAKE THE FULL VALU INDEX →</button><p style={{fontSize:11,color:"rgba(247,244,238,0.3)",margin:0,fontFamily:"sans-serif"}}>Free · Valid for 12 months · Listed on platform if score ≥ 35</p></div>
      <button onClick={restart} style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid rgba(201,168,76,0.15)",borderRadius:3,color:"rgba(247,244,238,0.3)",fontSize:12,fontFamily:"sans-serif",cursor:"pointer"}}>START OVER</button>
    </div></div>;
  }

  if (phase === "results" && results) {
    const { valuIndex, clusterScores, desig, futureReadyScore, strongest, weakest, listed, pathway, speedFlag, gamingDetected, consistencyFlags } = results;
    const anyFlag = results.anyFlag ?? (speedFlag || gamingDetected || Object.keys(consistencyFlags||{}).length > 0);
    const expBand = EXPERIENCE_BANDS.find(b => b.id === experience);
    return <div style={base}><div style={grain}/><div style={{position:"relative",zIndex:1,maxWidth:660,margin:"0 auto",padding:"48px 24px 80px"}}>
      <div style={{marginBottom:36}}><div style={{fontSize:11,color:GOLD,letterSpacing:"0.2em",marginBottom:12,fontFamily:"sans-serif"}}>VALU INDEX · ASSESSMENT COMPLETE</div><h1 style={{fontSize:"clamp(26px,5vw,42px)",fontWeight:300,lineHeight:1.1,marginBottom:8}}> {name||"Your"} <span style={{color:GOLD,fontStyle:"italic"}}>PRIME Profile</span></h1>{role&&<p style={{fontSize:14,color:"rgba(247,244,238,0.4)",fontStyle:"italic",fontFamily:"sans-serif",margin:"0 0 4px"}}>{role}</p>}{expBand&&<p style={{fontSize:12,color:"rgba(247,244,238,0.25)",fontFamily:"sans-serif",margin:0}}>{expBand.label} · {expBand.desc}</p>}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:28}}><div style={{padding:"24px 20px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:6}}><div style={{fontSize:10,color:"rgba(247,244,238,0.4)",letterSpacing:"0.15em",marginBottom:10,fontFamily:"sans-serif"}}>VALU INDEX SCORE</div><div style={{fontSize:72,fontWeight:300,color:GOLD,lineHeight:1}}>{valuIndex}</div><div style={{fontSize:11,color:"rgba(247,244,238,0.3)",letterSpacing:"0.1em",marginBottom:16,fontFamily:"sans-serif"}}>OUT OF 100</div><div style={{padding:"10px 14px",background:desig.bg,border:`1px solid ${desig.color}40`,borderRadius:3,marginBottom:10}}><div style={{fontSize:11,color:desig.color,fontWeight:700,letterSpacing:"0.1em",fontFamily:"sans-serif"}}>{desig.name.toUpperCase()}</div></div><p style={{fontSize:13,color:"rgba(247,244,238,0.5)",lineHeight:1.6,fontStyle:"italic",margin:0,fontFamily:"sans-serif"}}>{desig.desc||"Your VALU Index profile reflects the canonical scoring engine."}</p></div><div style={{display:"flex",alignItems:"center",justifyContent:"center"}}><Radar scores={clusterScores} size={190}/></div></div>
      <div style={{padding:"14px 20px",background:listed?"rgba(29,158,117,0.1)":"rgba(136,136,136,0.1)",border:`1px solid ${listed?"#1D9E75":"#888888"}40`,borderRadius:6,marginBottom:20,fontFamily:"sans-serif"}}><div style={{fontSize:11,fontWeight:700,color:listed?"#1D9E75":"#888888",letterSpacing:"0.1em",marginBottom:4}}>{listed?"LISTED ON PLATFORM — EMPLOYER SEARCHABLE":"NOT YET LISTED — MINIMUM SCORE 35"}</div><div style={{fontSize:12,color:"rgba(247,244,238,0.5)"}}>{listed?"You are listed as an active professional on the Valoria Institute platform. Employers and recruiters can find and shortlist you.":"Complete a PRIME Sprint to build your score to 35 and qualify for listing."}</div></div>
      {anyFlag&&<div style={{padding:"14px 20px",background:"rgba(232,160,32,0.08)",border:`1px solid ${AMBER}40`,borderRadius:6,marginBottom:20,fontFamily:"sans-serif"}}><div style={{fontSize:11,fontWeight:700,color:AMBER,letterSpacing:"0.1em",marginBottom:4}}>ASSESSMENT NOTES</div><div style={{fontSize:12,color:"rgba(247,244,238,0.5)",lineHeight:1.6}}>{gamingDetected&&"Validity pattern detected — score adjusted. "}{speedFlag&&"Completion speed was noted. "}{Object.keys(consistencyFlags||{}).length>0&&`Consistency adjustment applied to: ${Object.keys(consistencyFlags).map(id=>CLUSTERS_UI.find(c=>c.id===id)?.name).join(", ")}.`} Your score reflects your most accurate profile based on your responses.</div></div>}
      <div style={{padding:"24px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:6,marginBottom:20}}><div style={{fontSize:11,color:GOLD,letterSpacing:"0.15em",marginBottom:10,fontFamily:"sans-serif"}}>CLUSTER PROFILE</div>{CLUSTERS_UI.map(c=><div key={c.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><span style={{width:20,fontSize:11,fontWeight:700,color:c.color,fontFamily:"sans-serif"}}>{c.id}</span><div style={{flex:1,height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${clusterScores[c.id]||0}%`,background:c.color}}/></div><span style={{width:36,textAlign:"right",fontSize:12,color:"rgba(247,244,238,0.5)",fontFamily:"sans-serif"}}>{clusterScores[c.id]||0}</span></div>)}</div>
      <div style={{padding:"24px",background:MID,border:"1px solid rgba(201,168,76,0.2)",borderRadius:6,marginBottom:24}}><div style={{fontSize:11,color:GOLD,letterSpacing:"0.15em",marginBottom:10,fontFamily:"sans-serif"}}>RECOMMENDED PRIME PATHWAY</div><p style={{fontSize:13,color:"rgba(247,244,238,0.65)",lineHeight:1.7,margin:0,fontFamily:"sans-serif"}}>Your strongest cluster is <span style={{color:strongest?.color||GOLD}}>{strongest?.name}</span>. Your highest-leverage development priority is <span style={{color:weakest?.color||GOLD}}>{weakest?.name}</span>. Your recommended starting point is the <span style={{color:GOLD}}>{pathway}</span>.</p></div>
      <div style={{textAlign:"center",fontSize:11,color:"rgba(247,244,238,0.2)",letterSpacing:"0.1em",fontFamily:"sans-serif",lineHeight:1.8}}>VALU INDEX v4 · PRIME FRAMEWORK · VALORIA INSTITUTE · (c) 2026</div>
    </div></div>;
  }
  return null;
}
