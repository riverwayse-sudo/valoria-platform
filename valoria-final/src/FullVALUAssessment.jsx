import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QUESTIONS } from './questions.js';

const T = { dark:'#0F0F1A', parchment:'#F7F4EE', gold:'#C9A84C', dim:'rgba(247,244,238,.52)', faint:'rgba(247,244,238,.24)' };
const CLUSTER_NAMES = { P:'Presence', R:'Relationships', I:'Intelligence', M:'Mastery', E:'Enterprise' };

function parseQuery() {
  const p = new URLSearchParams(window.location.search);
  return { tasterId:p.get('taster_id') || '', name:p.get('name') || '', role:p.get('role') || '', experience:p.get('experience') || '' };
}

export default function FullVALUAssessment() {
  const identity = useMemo(parseQuery, []);
  const [current,setCurrent] = useState(0);
  const [answers,setAnswers] = useState({});
  const [startedAt,setStartedAt] = useState(Date.now());
  const [timings,setTimings] = useState([]);
  const [saving,setSaving] = useState(false);
  const [result,setResult] = useState(null);
  const [error,setError] = useState('');
  const question = QUESTIONS[current];
  const progress = Math.round(((current + 1) / QUESTIONS.length) * 100);
  const canUse = identity.tasterId && identity.name && identity.role && identity.experience;

  useEffect(() => setStartedAt(Date.now()), [current]);

  async function choose(optionIndex) {
    if (saving || result) return;
    const elapsed = Math.max(250, Date.now() - startedAt);
    const nextAnswers = { ...answers, [current]: optionIndex };
    const nextTimings = [...timings, elapsed];
    setAnswers(nextAnswers);
    setTimings(nextTimings);
    if (current < QUESTIONS.length - 1) {
      window.setTimeout(() => setCurrent(v => v + 1), 180);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const scoreRes = await fetch('/api/submit-assessment', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          name: identity.name,
          role: identity.role,
          experience: identity.experience,
          answers: nextAnswers,
          timings: nextTimings,
          shuffleMap: {},
        }),
      });
      const scoreData = await scoreRes.json().catch(() => ({}));
      if (!scoreRes.ok) throw new Error(scoreData.error || 'The assessment could not be scored.');

      const linkRes = await fetch('/api/link-assessment-to-taster', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ taster_id:identity.tasterId, identity_hash:scoreData.identity_hash }),
      });
      const linkData = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok) throw new Error(linkData.error || 'The score was saved but could not be attached to your profile.');

      setResult(scoreData.results);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!canUse) return <Shell><h1 style={S.h1}>Full VALU assessment unavailable.</h1><p style={S.p}>This assessment must be opened from your completed VALU teaser account journey.</p><a href="https://assessment.valoriainstitute.com/" style={S.button}>RETURN TO VALU →</a></Shell>;

  if (result) {
    const score = result.valuIndex ?? result.total_score ?? result.score;
    const designation = result.desig?.name || result.designation || 'VALU Index';
    return <Shell>
      <div style={S.eyebrow}>OFFICIAL VALU INDEX</div>
      <h1 style={S.h1}>Your official standard is set.</h1>
      <div style={S.scoreCard}><div style={S.score}>{score}</div><div style={S.outOf}>/ 100</div><div style={S.designation}>{designation}</div></div>
      <p style={S.p}>Your full assessment is now attached to your Valoria professional profile. Your profile can move from <strong style={{color:T.gold}}>Basic · Incomplete</strong> to complete once the required professional profile information is finished.</p>
      <a href="https://valoriainstitute.com/profile/setup" style={S.button}>COMPLETE MY PROFILE →</a>
      <a href="https://valoriainstitute.com/profile/setup" style={S.secondary}>OPEN PROFILE SETUP</a>
    </Shell>;
  }

  return <Shell>
    <div style={S.top}><div style={S.eyebrow}>FULL VALU · {current + 1} / {QUESTIONS.length}</div><div style={S.progressText}>{progress}%</div></div>
    <div style={S.progress}><div style={{...S.progressFill,width:`${progress}%`}} /></div>
    <div style={S.cluster}>{question.cluster} · {CLUSTER_NAMES[question.cluster]}</div>
    <h1 style={S.question}>{question.q}</h1>
    <div style={S.options}>
      {question.options.map((option,i)=><button key={i} disabled={saving} onClick={()=>choose(i)} style={S.option}><span style={S.optionLetter}>{String.fromCharCode(65+i)}</span><span>{option.text}</span></button>)}
    </div>
    <div style={S.footer}><span>{Object.keys(answers).length} answered</span><span>One answer per question</span></div>
    {error && <div style={S.error}>{error}<button onClick={()=>setError('')} style={S.dismiss}>Dismiss</button></div>}
    {saving && <div style={S.saving}>Scoring and attaching your official VALU Index…</div>}
  </Shell>;
}

function Shell({children}) { return <main style={S.page}><div style={S.shell}>{children}</div></main> }

const S = {
  page:{minHeight:'100vh',background:T.dark,color:T.parchment,fontFamily:"'Raleway',sans-serif",padding:'clamp(26px,6vw,72px) 20px'},
  shell:{width:'100%',maxWidth:820,margin:'0 auto'},
  top:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:20},
  eyebrow:{fontSize:10,fontWeight:700,letterSpacing:'.18em',color:'rgba(201,168,76,.75)'},
  progressText:{fontSize:11,color:T.faint},
  progress:{height:3,background:'rgba(255,255,255,.06)',margin:'16px 0 40px'},
  progressFill:{height:'100%',background:T.gold,transition:'width .2s ease'},
  cluster:{fontSize:11,letterSpacing:'.12em',textTransform:'uppercase',color:T.gold,marginBottom:14},
  question:{fontSize:'clamp(28px,5vw,48px)',fontWeight:300,lineHeight:1.12,letterSpacing:'-.025em',margin:'0 0 32px',maxWidth:780},
  options:{display:'grid',gap:10},
  option:{display:'grid',gridTemplateColumns:'38px 1fr',gap:14,alignItems:'center',textAlign:'left',padding:'17px 18px',border:'1px solid rgba(247,244,238,.1)',borderRadius:8,background:'rgba(255,255,255,.025)',color:T.parchment,fontSize:14,lineHeight:1.55,cursor:'pointer'},
  optionLetter:{width:30,height:30,borderRadius:'50%',border:'1px solid rgba(201,168,76,.3)',display:'flex',alignItems:'center',justifyContent:'center',color:T.gold,fontSize:11},
  footer:{display:'flex',justifyContent:'space-between',gap:16,color:T.faint,fontSize:11,marginTop:18},
  saving:{marginTop:18,color:T.gold,fontSize:12},
  error:{marginTop:18,padding:12,border:'1px solid rgba(216,90,48,.3)',background:'rgba(216,90,48,.08)',color:'#F09595',fontSize:12,borderRadius:6},
  dismiss:{float:'right',background:'none',border:0,color:T.gold,cursor:'pointer'},
  h1:{fontSize:'clamp(34px,6vw,58px)',fontWeight:300,lineHeight:1.05,letterSpacing:'-.03em',margin:'0 0 20px'},
  p:{fontSize:14,lineHeight:1.75,color:T.dim,margin:'0 0 24px'},
  scoreCard:{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap',padding:'26px',border:'1px solid rgba(201,168,76,.22)',background:'rgba(201,168,76,.06)',borderRadius:10,margin:'24px 0'},
  score:{fontSize:70,fontWeight:300,color:T.gold,lineHeight:1},
  outOf:{fontSize:13,color:T.faint},
  designation:{width:'100%',fontSize:10,fontWeight:700,letterSpacing:'.14em',color:T.gold,textTransform:'uppercase'},
  button:{display:'block',padding:'15px 22px',background:T.gold,color:T.dark,borderRadius:999,textDecoration:'none',textAlign:'center',fontSize:11,fontWeight:700,letterSpacing:'.12em'},
  secondary:{display:'block',marginTop:10,padding:'14px 22px',border:'1px solid rgba(201,168,76,.25)',color:T.gold,borderRadius:999,textDecoration:'none',textAlign:'center',fontSize:11,letterSpacing:'.12em'},
}
