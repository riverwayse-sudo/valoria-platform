import React, { useEffect, useMemo, useRef, useState } from 'react';
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

import { QUESTIONS } from './questions.js';

const T = { dark:'#1A1A2E', parchment:'#F7F4EE', gold:'#C9A84C', dim:'rgba(247,244,238,.52)', faint:'rgba(247,244,238,.24)' };
const CLUSTER_NAMES = { P:'Presence', R:'Relationships', I:'Intelligence', M:'Mastery', E:'Enterprise' };

function parseQuery() {
  const p = new URLSearchParams(window.location.search);
  return {
    tasterId:p.get('taster_id') || '',
    name:p.get('name') || '',
    role:p.get('role') || '',
    experience:p.get('experience') || '',
    resume:p.get('resume') || '',
  };
}

function makeSessionId() {
  try { return crypto.randomUUID(); } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 3 | 8);
      return v.toString(16);
    });
  }
}

function identityHashFor(identity) {
  return `valu_progress_${identity.tasterId || `${identity.name}::${identity.role}`.toLowerCase().replace(/[^a-z0-9:_-]/g,'_')}`;
}

async function saveProgress(payload) {
  const res = await fetch(API_BASE + '/api/assessment-progress', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
    keepalive:true,
  });
  if (!res.ok) throw new Error('Progress could not be saved.');
  return res.json();
}

async function loadRemoteProgress(token) {
  const res = await fetch(API_BASE + '/api/assessment-progress?resume=' + encodeURIComponent(token), { cache:'no-store' });
  if (!res.ok) throw new Error('This saved assessment is no longer available.');
  const data = await res.json();
  return data.progress;
}

function ResumeModal({ open, progress, onContinue, onClose }) {
  if (!open || !progress) return null;
  const answered = Object.keys(progress.answers || {}).length;
  const remaining = Math.max(0, progress.total_questions - answered);
  return (
    <div style={{position:'fixed',inset:0,zIndex:50,background:'rgba(10,10,20,.78)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{width:'100%',maxWidth:520,background:T.dark,border:'1px solid rgba(201,168,76,.25)',borderRadius:12,padding:'30px 28px',boxShadow:'0 24px 80px rgba(0,0,0,.4)'}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:'.18em',color:T.gold}}>VALU JOURNEY · SAVED PROGRESS</div>
        <h2 style={{fontSize:28,fontWeight:300,lineHeight:1.15,color:T.parchment,margin:'18px 0 12px'}}>You can continue where you stopped.</h2>
        <p style={{fontSize:13,color:T.dim,lineHeight:1.75,margin:'0 0 22px'}}>
          Your answers have been saved. You do not need to start the assessment again.
        </p>
        <div style={{padding:'16px 18px',border:'1px solid rgba(201,168,76,.16)',background:'rgba(201,168,76,.05)',borderRadius:7,marginBottom:22}}>
          <div style={{fontSize:10,letterSpacing:'.12em',color:T.gold,fontWeight:700}}>PROGRESS</div>
          <div style={{fontSize:24,color:T.parchment,marginTop:6}}>{answered} / {progress.total_questions}</div>
          <div style={{fontSize:11,color:T.faint,marginTop:4}}>{remaining} questions remaining</div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={S.secondary}>REVIEW LATER</button>
          <button onClick={onContinue} style={{...S.button,flex:1}}>CONTINUE MY ASSESSMENT →</button>
        </div>
      </div>
    </div>
  );
}

export default function FullVALUAssessment() {
  const queryIdentity = useMemo(parseQuery, []);
  const [identity,setIdentity] = useState(queryIdentity);
  const [current,setCurrent] = useState(0);
  const [answers,setAnswers] = useState({});
  const [startedAt,setStartedAt] = useState(Date.now());
  const [timings,setTimings] = useState([]);
  const [saving,setSaving] = useState(false);
  const [result,setResult] = useState(null);
  const [error,setError] = useState('');
  const [reportStatus,setReportStatus] = useState('');
  const [sessionId,setSessionId] = useState('');
  const [resumeToken,setResumeToken] = useState('');
  const [resumeProgress,setResumeProgress] = useState(null);
  const [resumeLoading,setResumeLoading] = useState(Boolean(queryIdentity.resume));
  const [resumeError,setResumeError] = useState('');
  const [resumePopup,setResumePopup] = useState(false);
  const mountedRef = useRef(true);

  const resumeKey = useMemo(
    () => `valoria-valu-resume:${identity.tasterId}:${identity.name}:${identity.role}:${identity.experience}`,
    [identity.tasterId, identity.name, identity.role, identity.experience]
  );

  const question = QUESTIONS[current];
  const progress = Math.round(((current + 1) / QUESTIONS.length) * 100);
  const canUse = Boolean(identity.tasterId && identity.name && identity.role && identity.experience);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    if (!queryIdentity.resume) return;
    let cancelled = false;
    loadRemoteProgress(queryIdentity.resume)
      .then(saved => {
        if (cancelled) return;
        const restored = {
          tasterId: saved.taster_id || queryIdentity.tasterId,
          name: saved.name,
          role: saved.role,
          experience: saved.experience || queryIdentity.experience || '',
          resume: '',
        };
        setIdentity(restored);
        setSessionId(saved.session_id);
        setResumeToken(saved.resume_token);
        setAnswers(saved.answers || {});
        setTimings(Array.isArray(saved.timings) ? saved.timings : []);
        setCurrent(Math.min(Math.max(saved.current_question || 0, 0), QUESTIONS.length - 1));
        setResumeProgress(saved);
        setResumePopup(true);
        setResumeLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setResumeError(err.message);
        setResumeLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryIdentity.resume]);

  useEffect(() => {
    if (queryIdentity.resume || !canUse) return;
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem(resumeKey) || 'null'); } catch {}
    const localSessionId = saved?.sessionId || makeSessionId();
    setSessionId(localSessionId);
    if (saved?.resumeToken) setResumeToken(saved.resumeToken);
    if (saved && !saved.completed) {
      if (saved.answers && typeof saved.answers === 'object') setAnswers(saved.answers);
      if (Array.isArray(saved.timings)) setTimings(saved.timings);
      if (Number.isInteger(saved.current) && saved.current >= 0 && saved.current < QUESTIONS.length) setCurrent(saved.current);
    }
    setStartedAt(Date.now());
  }, [resumeKey, canUse, queryIdentity.resume]);

  useEffect(() => {
    if (!canUse || !sessionId || result) return;
    try {
      window.localStorage.setItem(resumeKey, JSON.stringify({
        sessionId,
        resumeToken,
        current,
        answers,
        timings,
        updatedAt:new Date().toISOString(),
        completed:false,
      }));
    } catch {}
  }, [resumeKey, canUse, sessionId, resumeToken, current, answers, timings, result]);

  useEffect(() => {
    if (!canUse || !sessionId || result || Object.keys(answers).length === 0) return;
    const timer = window.setTimeout(() => {
      saveProgress({
        action:'save',
        session_id:sessionId,
        resume_token:resumeToken || undefined,
        taster_id:identity.tasterId,
        identity_hash:identityHashFor(identity),
        name:identity.name,
        role:identity.role,
        experience:identity.experience,
        current_question:current,
        total_questions:QUESTIONS.length,
        answers,
        timings,
        session_seed:0,
      }).then(data => {
        if (data.resume_token && mountedRef.current) setResumeToken(data.resume_token);
      }).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [answers, timings, current, sessionId, canUse, result, identity.tasterId, identity.name, identity.role, resumeToken]);

  async function persistCheckpoint(nextAnswers, nextTimings, nextCurrent) {
    if (!sessionId) return;
    try {
      const data = await saveProgress({
        action:'save',
        session_id:sessionId,
        resume_token:resumeToken || undefined,
        taster_id:identity.tasterId,
        identity_hash:identityHashFor(identity),
        name:identity.name,
        role:identity.role,
        current_question:nextCurrent,
        total_questions:QUESTIONS.length,
        answers:nextAnswers,
        timings:nextTimings,
        session_seed:0,
      });
      if (data.resume_token && mountedRef.current) setResumeToken(data.resume_token);
    } catch {}
  }

  async function choose(optionIndex) {
    if (saving || result) return;
    const elapsed = Math.max(250, Date.now() - startedAt);
    const nextAnswers = { ...answers, [current]: optionIndex };
    const nextTimings = [...timings, elapsed];
    setAnswers(nextAnswers);
    setTimings(nextTimings);

    if (current < QUESTIONS.length - 1) {
      const nextCurrent = current + 1;
      setCurrent(nextCurrent);
      setStartedAt(Date.now());
      await persistCheckpoint(nextAnswers, nextTimings, nextCurrent);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await persistCheckpoint(nextAnswers, nextTimings, QUESTIONS.length);
      const scoreRes = await fetch(API_BASE + '/api/submit-assessment', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          name:identity.name,
          role:identity.role,
          experience:identity.experience,
          answers:nextAnswers,
          timings:nextTimings,
          shuffleMap:{},
          taster_id:identity.tasterId,
        }),
      });
      const scoreData = await scoreRes.json().catch(() => ({}));
      if (!scoreRes.ok) throw new Error(scoreData.error || 'The assessment could not be scored.');

      await saveProgress({
        action:'complete',
        session_id:sessionId,
        resume_token:resumeToken || undefined,
        taster_id:identity.tasterId,
        identity_hash:scoreData.identity_hash || identityHashFor(identity),
        name:identity.name,
        role:identity.role,
        experience:identity.experience,
        current_question:QUESTIONS.length,
        total_questions:QUESTIONS.length,
        answers:nextAnswers,
        timings:nextTimings,
        session_seed:0,
      }).catch(() => {});

      const linkRes = await fetch(API_BASE + '/api/link-assessment-to-taster', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ taster_id:identity.tasterId, identity_hash:scoreData.identity_hash }),
      });
      const linkData = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok) throw new Error(linkData.error || 'The score was saved but could not be attached to your profile.');

      try {
        setReportStatus('Preparing your VALU report…');
        const reportRes = await fetch(API_BASE + '/api/generate-and-send-report', {
          method:'POST',
          headers:{'Content-Type':'application/json','Idempotency-Key':`full-valu-${scoreData.identity_hash}`},
          body:JSON.stringify({identity_hash:scoreData.identity_hash}),
        });
        const reportData = await reportRes.json().catch(()=>({}));
        if (reportRes.ok && reportData.ready) setReportStatus('Your VALU report is ready. You can view it from your Valoria journey.');
        else if (reportRes.ok && (reportData.sent || reportData.alreadySent)) setReportStatus('Your VALU report is ready and has been sent to your email.');
        else setReportStatus('Your VALU Index is complete. Your report is being prepared and will follow automatically.');
      } catch {
        setReportStatus('Your VALU Index is complete. Your report is being prepared and will follow automatically.');
      }

      try { window.localStorage.setItem(resumeKey, JSON.stringify({ completed:true, completedAt:new Date().toISOString() })); } catch {}
      setResult(scoreData.results);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Your saved progress is intact.');
    } finally {
      setSaving(false);
    }
  }

  if (resumeLoading) return <Shell><div style={S.eyebrow}>VALU JOURNEY</div><h1 style={S.h1}>Restoring your saved assessment…</h1><p style={S.p}>Your progress is being retrieved securely.</p></Shell>;

  if (resumeError) return <Shell><div style={S.eyebrow}>VALU JOURNEY</div><h1 style={S.h1}>We could not restore this session.</h1><p style={S.p}>{resumeError}</p><a href="/valu/assessment/" style={S.button}>RETURN TO VALU →</a></Shell>;

  if (!canUse) return <Shell><h1 style={S.h1}>Full VALU assessment unavailable.</h1><p style={S.p}>This assessment must be opened from your completed VALU teaser account journey.</p><a href="/valu/assessment/" style={S.button}>RETURN TO VALU →</a></Shell>;

  if (result) {
    const score = result.valuIndex ?? result.total_score ?? result.score;
    const designation = result.desig?.name || result.designation || 'VALU Index';
    return <Shell>
      <div style={S.eyebrow}>OFFICIAL VALU INDEX</div>
      <h1 style={S.h1}>Your official standard is set.</h1>
      <div style={S.scoreCard}><div style={S.score}>{score}</div><div style={S.outOf}>/ 100</div><div style={S.designation}>{designation}</div></div>
      <p style={S.p}>Your full assessment is now attached to your Valoria professional profile. Your profile can move from <strong style={{color:T.gold}}>Basic · Incomplete</strong> to complete once the required professional profile information is finished.</p>
      {reportStatus && <p style={{...S.p,color:T.gold}}>{reportStatus}</p>}
      {reportStatus.includes('ready') && <a href="https://valoriainstitute.com/report" style={S.button}>VIEW MY VALU REPORT →</a>}
      <a href="https://valoriainstitute.com/profile/onboarding" style={S.button}>COMPLETE MY PROFILE →</a>
      <a href="https://valoriainstitute.com/profile/onboarding" style={S.secondary}>OPEN PROFILE SETUP</a>
    </Shell>;
  }

  return <Shell>
    <ResumeModal open={resumePopup} progress={resumeProgress} onContinue={()=>setResumePopup(false)} onClose={()=>setResumePopup(false)} />
    <div className="valu-assessment-content" style={{position:'relative',zIndex:1}}>
      <div style={S.top}><div style={S.eyebrow}>FULL VALU · {current + 1} / {QUESTIONS.length}</div><div style={S.progressText}>{progress}%</div></div>
      <div style={S.progress}><div style={{...S.progressFill,width:`${progress}%`}} /></div>
      <div style={S.cluster}>{question.cluster} · {CLUSTER_NAMES[question.cluster]}</div>
      <h1 style={S.question}>{question.q}</h1>
      <div style={S.options}>
        {question.options.map((option,i)=><button className="valu-option" key={i} disabled={saving} onClick={()=>choose(i)} style={S.option}><span style={S.optionLetter}>{String.fromCharCode(65+i)}</span><span>{option.text}</span></button>)}
      </div>
      <div style={S.footer}><span>{Object.keys(answers).length} answered</span><span>Progress is saved automatically.</span></div>
      {error && <div style={S.error}>{error}<button onClick={()=>setError('')} style={S.dismiss}>Dismiss</button></div>}
      {saving && <div style={S.saving}>Scoring and attaching your official VALU Index…</div>}
    </div>
  </Shell>;
}

function Shell({children}) { return <main style={S.page}><div style={S.shell}>{children}</div></main> }

const S = {
  page:{minHeight:'100vh',height:'100vh',background:T.dark,color:T.parchment,fontFamily:"'Raleway',sans-serif",padding:'22px 20px',overflow:'hidden',display:'flex',alignItems:'center'},
  shell:{width:'100%',maxWidth:760,margin:'0 auto'},
  top:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:20},
  eyebrow:{fontSize:10,fontWeight:700,letterSpacing:'.18em',color:'rgba(201,168,76,.75)'},
  h1:{fontSize:'clamp(28px,4vw,40px)',fontWeight:300,lineHeight:1.15,margin:'16px 0',color:T.parchment},
  p:{fontSize:13,color:T.dim,lineHeight:1.8,margin:'0 0 22px'},
  progressText:{fontSize:11,color:T.faint},
  progress:{height:3,background:'rgba(255,255,255,.06)',margin:'12px 0 28px'},
  progressFill:{height:'100%',background:T.gold,transition:'width .2s ease'},
  cluster:{fontSize:9.5,letterSpacing:'.12em',textTransform:'uppercase',color:T.gold,marginBottom:10},
  question:{fontSize:'clamp(23px,3.2vw,34px)',fontWeight:300,lineHeight:1.14,letterSpacing:'-.025em',margin:'0 0 22px',maxWidth:720},
  options:{display:'grid',gap:8},
  option:{appearance:"none",WebkitAppearance:"none",MozAppearance:"none",display:'grid',gridTemplateColumns:'32px 1fr',gap:12,alignItems:'center',textAlign:'left',padding:'12px 15px',border:'1px solid rgba(247,244,238,.1)',borderRadius:7,background:'#2E2E4A',color:T.parchment,fontSize:12.5,lineHeight:1.4,cursor:'pointer',minHeight:52},
  optionLetter:{width:26,height:26,borderRadius:'50%',border:'1px solid rgba(201,168,76,.3)',display:'flex',alignItems:'center',justifyContent:'center',color:T.gold,fontSize:10},
  footer:{display:'flex',justifyContent:'space-between',gap:16,color:T.faint,fontSize:10,marginTop:14},
  saving:{marginTop:18,color:T.gold,fontSize:12},
  error:{marginTop:18,padding:12,border:'1px solid rgba(216,90,48,.3)',background:'rgba(216,90,48,.08)',color:'#F09595',fontSize:12,borderRadius:6},
  dismiss:{float:'right',background:'transparent',border:0,color:T.parchment,cursor:'pointer'},
  button:{display:'block',textAlign:'center',textDecoration:'none',background:T.gold,color:T.dark,padding:'14px 20px',borderRadius:999,fontSize:11,fontWeight:700,letterSpacing:'.12em',marginTop:10,border:0,cursor:'pointer'},
  secondary:{display:'block',flex:1,textAlign:'center',textDecoration:'none',background:'transparent',color:T.parchment,border:'1px solid rgba(247,244,238,.14)',padding:'13px 16px',borderRadius:999,fontSize:10,fontWeight:700,letterSpacing:'.1em',cursor:'pointer'},
  scoreCard:{display:'grid',gridTemplateColumns:'auto auto 1fr',alignItems:'baseline',gap:8,padding:'24px 0',borderTop:'1px solid rgba(201,168,76,.18)',borderBottom:'1px solid rgba(201,168,76,.18)',margin:'26px 0'},
  score:{fontSize:64,fontWeight:200,color:T.gold,lineHeight:1},
  outOf:{fontSize:14,color:T.faint},
  designation:{fontSize:12,color:T.parchment,letterSpacing:'.12em',textTransform:'uppercase',justifySelf:'end'},
};
