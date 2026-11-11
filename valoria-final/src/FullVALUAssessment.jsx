import React, { useEffect, useMemo, useRef, useState } from 'react';
import VALUAssessmentJourney from './VALUAssessmentJourney.jsx';
const API_BASE = (() => {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  // The assessment UI and API are served by the same Worker. Prefer its own
  // origin on workers.dev so assessment POSTs do not depend on cross-origin
  // preflight to the custom domain.
  if (host === 'valoria-assessment.riverwayse.workers.dev') return window.location.origin;

  const configuredOrigin = String(import.meta.env.VITE_VALU_API_ORIGIN || '').trim().replace(/\/$/, '');
  if (configuredOrigin) return configuredOrigin;

  // Serverless API routes live at the deployment root, even though Vite
  // serves the assessment UI under the legacy /valu/assessment/ asset base.
  // Never derive API paths from BASE_URL: that creates /valu/assessment/api/*
  // and Vercel serves index.html with 405 for POST requests.
  if (host === 'valoriainstitute.com' || host === 'www.valoriainstitute.com' || host === 'assessment.valoriainstitute.com') {
    return 'https://assessment.valoriainstitute.com';
  }

  // Preview deployments should call their own root-level API functions.
  return typeof window !== 'undefined'
    ? window.location.origin
    : '';
})();

const SITE_BASE = (() => {
  // Preserve the exact dashboard origin that issued the handoff. Supabase
  // browser sessions are origin-scoped; www and apex must not be mixed.
  if (typeof window !== 'undefined') {
    try {
      const requested = new URLSearchParams(window.location.search).get('site_origin');
      const parsed = new URL(requested || '');
      if (parsed.protocol === 'https:' && ['valoriainstitute.com', 'www.valoriainstitute.com'].includes(parsed.hostname)) {
        window.sessionStorage.setItem('valu-site-origin', parsed.origin);
        return parsed.origin;
      }
      const saved = new URL(window.sessionStorage.getItem('valu-site-origin') || '');
      if (saved.protocol === 'https:' && ['valoriainstitute.com', 'www.valoriainstitute.com'].includes(saved.hostname)) return saved.origin;
    } catch {}
  }
  const configuredOrigin = String(import.meta.env.VITE_VALU_SITE_ORIGIN || '').trim().replace(/\/$/, '');
  if (configuredOrigin) return configuredOrigin;
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  if (host === 'assessment.valoriainstitute.com') return 'https://valoriainstitute.com';
  if (host === 'valoriainstitute.com' || host === 'www.valoriainstitute.com') return 'https://valoriainstitute.com';
  // Preview deployments must be explicitly configured with their paired site
  // origin. Never silently send a preview user into production authentication.
  return '';
})();

import { QUESTIONS } from './questions.js';
import {
  ASSESSMENT_ORDER,
  TOTAL_QUESTIONS,
  nextPlaceToAnswer,
} from './assessmentJourney.js';

const T = { dark:'#1A1A2E', parchment:'#F7F4EE', gold:'#C9A84C', dim:'rgba(247,244,238,.52)', faint:'rgba(247,244,238,.24)' };
const CLUSTER_NAMES = { P:'Presence', R:'Relationships', I:'Intelligence', M:'Mastery', E:'Enterprise' };
const EXPERIENCE_OPTIONS = [
  { value:'0-3', label:'0–3 years' },
  { value:'4-8', label:'4–8 years' },
  { value:'9-15', label:'9–15 years' },
  { value:'15+', label:'15+ years' },
];
const isValidExperience = value => EXPERIENCE_OPTIONS.some(option => option.value === value);

function readHandoffCode() {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('handoff_code') || '';
  } catch {
    return '';
  }
}

function parseQuery() {
  // Identity and resume credentials are never accepted from public query
  // parameters. The dashboard handoff exchange supplies verified identity.
  return { tasterId:'', name:'', role:'', experience:'', resume:'' };
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
  const [resumeLoading,setResumeLoading] = useState(Boolean(queryIdentity.resume));
  const [resumeError,setResumeError] = useState('');
  const [remoteRestoreComplete,setRemoteRestoreComplete] = useState(false);
  const [handoffToken,setHandoffToken] = useState('');
  const [handoffStatus,setHandoffStatus] = useState('checking');
  const [handoffError,setHandoffError] = useState('');
  const mountedRef = useRef(true);
  const verifiedHandoffRef = useRef('');

  const resumeKey = useMemo(
    () => `valoria-valu-resume:${identity.tasterId}:${identity.name}:${identity.role}:${identity.experience}`,
    [identity.tasterId, identity.name, identity.role, identity.experience]
  );

  const question = QUESTIONS[ASSESSMENT_ORDER[current]];
  const answeredTotal = Object.keys(answers).length;
  const progress = Math.round((answeredTotal / TOTAL_QUESTIONS) * 100);
  // Experience is assessment metadata, not an authentication prerequisite.
  // Legacy snapshots may omit it or use an older label; let the participant
  // confirm a supported band instead of blocking the assessment shell.
  const canUse = Boolean(identity.tasterId && identity.name && identity.role);
  const hasValidExperience = isValidExperience(identity.experience);

  useEffect(() => { window.gtag?.("event", "valu_index_open", { assessment_type: "full" }); return () => { mountedRef.current = false; }; }, []);

  // Strip legacy identity/resume query parameters from the visible URL as soon
  // as the client hydrates. New links never include these values, but this
  // protects participants opening older bookmarked or emailed assessment URLs.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cleanParams = new URLSearchParams();
      if (params.get('full') === '1') cleanParams.set('full', '1');
      const cleanSearch = cleanParams.toString();
      const nextUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '') + window.location.hash;
      if (nextUrl !== window.location.pathname + window.location.search + window.location.hash) {
        window.history.replaceState({}, document.title, nextUrl);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let handoffCode = '';
    try {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      handoffCode = fragment.get('handoff_code') || '';
      if (handoffCode || fragment.has('handoff_token') || fragment.has('resume_token')) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    } catch {}

    let token = '';
    if (!handoffCode) {
      try {
        const saved = JSON.parse(window.sessionStorage.getItem('valu-handoff-session') || 'null');
        token = typeof saved?.token === 'string' ? saved.token : '';
      } catch {}
    }
    if (!handoffCode && !token) {
      setHandoffToken('');
      setHandoffError('Open your saved assessment from your Valoria dashboard.');
      setHandoffStatus('account_required');
      return;
    }

    if (!handoffCode && identity.tasterId && verifiedHandoffRef.current === `${identity.tasterId}:${token}`) {
      setHandoffToken(token);
      setHandoffStatus('ready');
      return;
    }

    setHandoffStatus('checking');
    setHandoffError('');
    let cancelled = false;
    const action = handoffCode ? 'exchange-dashboard-handoff' : 'verify-handoff';
    fetch(API_BASE + '/api/submit-assessment', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(handoffCode
        ? { action, handoff_code:handoffCode }
        : { action, handoff_token:token }),
      cache:'no-store',
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.identity?.taster_id) {
        throw new Error(data.error || 'The secure dashboard handoff could not be verified.');
      }
      const sessionToken = handoffCode ? data.session_token : token;
      if (typeof sessionToken !== 'string' || !sessionToken) {
        throw new Error('The assessment session could not be established. Return to your dashboard and try again.');
      }
      const verifiedIdentity = {
        tasterId:data.identity.taster_id,
        name:data.identity.name || '',
        role:data.identity.role || '',
        experience:data.identity.experience || '',
        resume:'',
      };
      try {
        window.sessionStorage.setItem('valu-handoff-session', JSON.stringify({
          token:sessionToken,
          identity:verifiedIdentity,
          savedAt:new Date().toISOString(),
        }));
      } catch {}
      verifiedHandoffRef.current = `${verifiedIdentity.tasterId}:${sessionToken}`;
      if (!cancelled) {
        setHandoffToken(sessionToken);
        if (!identity.tasterId) setIdentity(verifiedIdentity);
        setHandoffStatus('ready');
      }
    }).catch(error => {
      if (cancelled) return;
      try { window.sessionStorage.removeItem('valu-handoff-session'); } catch {}
      setHandoffToken('');
      setHandoffError(error?.message || 'This assessment session is no longer valid. Reopen it from your Valoria dashboard.');
      setHandoffStatus('account_required');
    });
    return () => { cancelled = true; };
  }, [identity.tasterId, identity.name, identity.role]);

  useEffect(() => {
    if (identity.resume || handoffStatus !== 'ready' || !handoffToken || !identity.tasterId) return;
    let cancelled = false;
    setRemoteRestoreComplete(false);
    fetch(API_BASE + '/api/assessment-progress', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        action:'restore',
        handoff_token:handoffToken,
        taster_id:identity.tasterId,
      }),
      cache:'no-store',
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not restore your saved VALU progress.');
      if (cancelled) return;
      const saved = data.progress;
      if (saved && !isValidExperience(identity.experience) && isValidExperience(saved.experience)) {
        setIdentity(previous => ({ ...previous, experience:saved.experience }));
      }
      if (saved && saved.status !== 'completed') {
        setSessionId(saved.session_id);
        setResumeToken(saved.resume_token || '');
        const restoredAnswers = saved.answers && typeof saved.answers === 'object' ? saved.answers : {};
        setAnswers(restoredAnswers);
        setTimings(Array.isArray(saved.timings) ? saved.timings : []);
        // The answer map is authoritative. Resume at the first unanswered
        // question even if a stale checkpoint pointer lags behind a saved answer.
        const nextPlace = nextPlaceToAnswer(restoredAnswers, 1);
        setCurrent(nextPlace ? nextPlace - 1 : ASSESSMENT_ORDER.length - 1);
      } else {
        // The taster is a separate record. Start the independent full
        // assessment at Question 1 with a fresh answer map.
        setAnswers({});
        setCurrent(0);
      }
      setRemoteRestoreComplete(true);
    }).catch(err => {
      if (cancelled) return;
      setResumeError(err?.message || 'Your saved VALU progress could not be restored. Please retry from your dashboard.');
      setRemoteRestoreComplete(true);
    });
    return () => { cancelled = true; };
  }, [identity.resume, handoffStatus, handoffToken, identity.tasterId]);

  useEffect(() => {
    if (!identity.resume) return;
    let cancelled = false;
    setResumeLoading(true);
    loadRemoteProgress(identity.resume)
      .then(saved => {
        if (cancelled) return;
        const restored = {
          tasterId: saved.taster_id || identity.tasterId,
          name: saved.name,
          role: saved.role,
          experience: saved.experience || identity.experience || '',
          resume: identity.resume,
        };
        setIdentity(restored);
        setSessionId(saved.session_id);
        setResumeToken(saved.resume_token);
        const restoredAnswers = saved.answers && typeof saved.answers === 'object' ? saved.answers : {};
        setAnswers(restoredAnswers);
        setTimings(Array.isArray(saved.timings) ? saved.timings : []);
        const nextPlace = nextPlaceToAnswer(restoredAnswers, 1);
        setCurrent(nextPlace ? nextPlace - 1 : ASSESSMENT_ORDER.length - 1);
        setResumeLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setResumeError(err.message);
        setResumeLoading(false);
      });
    return () => { cancelled = true; };
  }, [identity.resume]);

  useEffect(() => {
    // The authenticated server restore is the source of truth. Taster answers
    // are stored separately and are never seeded into this full-assessment map.
    if (identity.resume || !canUse || handoffStatus !== 'ready' || !remoteRestoreComplete) return;
    if (!sessionId) setSessionId(makeSessionId());
    setStartedAt(Date.now());
  }, [resumeKey, canUse, identity.resume, handoffStatus, remoteRestoreComplete, sessionId]);

  useEffect(() => {
    if (!canUse || !sessionId || result || handoffStatus !== 'ready') return;
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
  }, [resumeKey, canUse, sessionId, resumeToken, current, answers, timings, result, handoffStatus]);

  useEffect(() => {
    if (!canUse || !sessionId || result || handoffStatus !== 'ready' || (!identity.resume && !remoteRestoreComplete) || Object.keys(answers).length === 0) return;
    const timer = window.setTimeout(() => {
      saveProgress({
        action:'save',
        handoff_token:handoffToken,
        session_id:sessionId,
        resume_token:resumeToken || undefined,
        taster_id:identity.tasterId,
        identity_hash:identityHashFor(identity),
        name:identity.name,
        role:identity.role,
        experience:identity.experience,
        current_question:current,
        total_questions:TOTAL_QUESTIONS,
        answers,
        timings,
        session_seed:0,
      }).then(data => {
        if (data.resume_token && mountedRef.current) setResumeToken(data.resume_token);
      }).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [answers, timings, current, sessionId, canUse, result, identity.tasterId, identity.name, identity.role, resumeToken, handoffStatus]);

  async function persistCheckpoint(nextAnswers, nextTimings, nextCurrent) {
    if (!sessionId || handoffStatus !== 'ready' || (!identity.resume && !remoteRestoreComplete)) return;
    try {
      const data = await saveProgress({
        action:'save',
        handoff_token:handoffToken,
        session_id:sessionId,
        resume_token:resumeToken || undefined,
        taster_id:identity.tasterId,
        identity_hash:identityHashFor(identity),
        name:identity.name,
        role:identity.role,
        experience:identity.experience,
        current_question:nextCurrent,
        total_questions:TOTAL_QUESTIONS,
        answers:nextAnswers,
        timings:nextTimings,
        session_seed:0,
      });
      if (data.resume_token && mountedRef.current) setResumeToken(data.resume_token);
      return true;
    } catch (err) {
      if (String(err?.message || '').toLowerCase().includes('handoff')) {
        try { window.sessionStorage.removeItem('valu-handoff-session'); } catch {}
        setHandoffToken('');
        setHandoffStatus('account_required');
        setHandoffError(err?.message || 'Reopen the assessment from your Valoria account.');
      }
      return false;
    }
  }

  async function choose(optionIndex) {
    if (saving || result || handoffStatus !== 'ready') return;
    const position = ASSESSMENT_ORDER[current];
    const elapsed = Math.max(250, Date.now() - startedAt);
    const alreadyAnswered = Object.prototype.hasOwnProperty.call(answers, position);
    const nextAnswers = { ...answers, [position]: optionIndex };
    const nextTimings = alreadyAnswered ? timings : [...timings, elapsed];
    setAnswers(nextAnswers);
    setTimings(nextTimings);

    if (current < ASSESSMENT_ORDER.length - 1) {
      const nextCurrent = nextPlaceToAnswer(nextAnswers, current + 2) ?? current + 1;
      setCurrent(nextCurrent - 1);
      setStartedAt(Date.now());
      await persistCheckpoint(nextAnswers, nextTimings, nextCurrent - 1);
      return;
    }

    setError('');
    await persistCheckpoint(nextAnswers, nextTimings, ASSESSMENT_ORDER.length - 1);
  }

  async function submitAssessment() {
    if (saving || result || handoffStatus !== 'ready' || !handoffToken || !Object.prototype.hasOwnProperty.call(answers, ASSESSMENT_ORDER[ASSESSMENT_ORDER.length - 1])) return;
    setSaving(true);
    setError('');
    try {
      const checkpointSaved = await persistCheckpoint(answers, timings, ASSESSMENT_ORDER.length);
      if (!checkpointSaved) throw new Error('Your final responses could not be confirmed as saved. Please retry; your answers remain on this page.');
      const scoreRes = await fetch(API_BASE + '/api/submit-assessment', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          name:identity.name,
          role:identity.role,
          experience:identity.experience,
          answers,
          timings,
          shuffleMap:{},
          taster_id:identity.tasterId,
          handoff_token:handoffToken,
        }),
      });
      const scoreData = await scoreRes.json().catch(() => ({}));
      if (!scoreRes.ok) throw new Error(scoreData.error || 'The assessment could not be scored.');

      const completion = await saveProgress({
        action:'complete',
        handoff_token:handoffToken,
        session_id:sessionId,
        resume_token:resumeToken || undefined,
        taster_id:identity.tasterId,
        identity_hash:scoreData.identity_hash || identityHashFor(identity),
        name:identity.name,
        role:identity.role,
        experience:identity.experience,
        current_question:ASSESSMENT_ORDER.length,
        total_questions:TOTAL_QUESTIONS,
        answers,
        timings,
        session_seed:0,
      });
      if (completion?.ok !== true || completion?.status !== 'completed') {
        throw new Error('Your VALU score is saved, but we could not confirm the assessment completion state. Please retry from this page.');
      }

      const linkRes = await fetch(API_BASE + '/api/link-assessment-to-taster', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ taster_id:identity.tasterId, identity_hash:scoreData.identity_hash, handoff_token:handoffToken }),
      });
      const linkData = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok) throw new Error(linkData.error || 'The score was saved but could not be attached to your profile.');

      try {
        setReportStatus('Preparing your VALU report…');
        const reportRes = await fetch(API_BASE + '/api/generate-and-send-report', {
          method:'POST',
          headers:{'Content-Type':'application/json','Idempotency-Key':`full-valu-${scoreData.identity_hash}`},
          body:JSON.stringify({identity_hash:scoreData.identity_hash,report_token:scoreData.report_token}),
        });
        const reportData = await reportRes.json().catch(()=>({}));
        if (reportRes.ok && reportData.ready) setReportStatus('Your VALU report is ready. You can view it from your Valoria journey.');
        else if (reportRes.ok && (reportData.sent || reportData.alreadySent)) setReportStatus('Your VALU report is ready and has been sent to your email.');
        else setReportStatus('Your VALU Index is complete. Your report is being prepared and will follow automatically.');
      } catch {
        setReportStatus('Your VALU Index is complete. Your report is being prepared and will follow automatically.');
      }

      try { window.localStorage.setItem(resumeKey, JSON.stringify({ completed:true, completedAt:new Date().toISOString() })); } catch {}
      try { window.sessionStorage.removeItem('valu-handoff-session'); } catch {}
      window.gtag?.("event", "valu_index_complete", { assessment_type: "full" });
      setResult(scoreData.results);
    } catch (err) {
      if (String(err?.message || '').toLowerCase().includes('handoff')) {
        try { window.sessionStorage.removeItem('valu-handoff-session'); } catch {}
        setHandoffToken('');
        setHandoffStatus('account_required');
        setHandoffError(err?.message || 'Reopen the assessment from your Valoria account.');
      }
      setError(err?.message || 'Something went wrong. Your saved progress is intact.');
    } finally {
      setSaving(false);
    }
  }

  if (resumeLoading) return <Shell><div style={S.eyebrow}>VALU JOURNEY</div><h1 style={S.h1}>Restoring your saved assessment…</h1><p style={S.p}>Your progress is being retrieved securely.</p></Shell>;

  if (resumeError) return <Shell><div style={S.eyebrow}>VALU JOURNEY</div><h1 style={S.h1}>We could not restore this session.</h1><p style={S.p}>{resumeError}</p><a href={SITE_BASE ? SITE_BASE + '/dashboard' : undefined} style={S.button}>RETURN TO MY DASHBOARD →</a></Shell>;

  // The initial identity is intentionally empty until the dashboard handoff
  // is exchanged. Render verification first; otherwise the empty-identity
  // guard masks the real handoff response and falsely reports "unavailable".
  if (handoffStatus === 'checking') return <Shell><div style={S.eyebrow}>SECURE VALU JOURNEY</div><h1 style={S.h1}>Verifying your account…</h1><p style={S.p}>We are confirming that this assessment belongs to your Valoria account before you continue.</p></Shell>;

  if (handoffStatus !== 'ready') {
    return <Shell>
      <div style={S.eyebrow}>SECURE VALU JOURNEY</div>
      <h1 style={S.h1}>Return to your Valoria dashboard.</h1>
      <p style={S.p}>Assessment continuation is available only from your authenticated dashboard. Your saved taster and answers remain attached to your account. Return to your dashboard to continue securely; if your session has expired, Valoria will ask you to sign in there.</p>
      {handoffError && <div style={S.error}>{handoffError}</div>}
      <a href={SITE_BASE ? SITE_BASE + '/dashboard' : undefined} style={S.button}>RETURN TO MY DASHBOARD →</a>
    </Shell>;
  }

  if (!canUse) return <Shell><h1 style={S.h1}>Full VALU Index unavailable.</h1><p style={S.p}>The secure dashboard handoff was verified, but the saved assessment identity is incomplete. Return to your dashboard and contact Valoria support if this continues.</p><a href={SITE_BASE ? SITE_BASE + '/dashboard' : undefined} style={S.button}>RETURN TO MY DASHBOARD →</a></Shell>;

  if (!identity.resume && !remoteRestoreComplete) return <Shell><div style={S.eyebrow}>VALU JOURNEY</div><h1 style={S.h1}>Restoring your saved assessment…</h1><p style={S.p}>We are securely checking for previous answers so you can continue where you stopped.</p></Shell>;

  if (result) {
    const score = result.valuIndex ?? result.total_score ?? result.score;
    const designation = result.desig?.name || result.designation || 'VALU Index';
    return <Shell>
      <section style={S.resultWrap}>
        <div style={S.resultEyebrow}><span style={S.resultCheck}>✓</span> OFFICIAL VALU INDEX · ASSESSMENT COMPLETE</div>
        <h1 style={S.resultTitle}>Your VALU Index is complete.</h1>
        <p style={S.resultIntro}>Your professional assessment has been scored and attached to your Valoria profile. Your result is now part of your professional record.</p>

        <div style={S.resultCard}>
          <div style={S.resultScoreBlock}>
            <div style={S.resultScore}>{score}</div>
            <div style={S.resultScoreCaption}>VALU INDEX <span>·</span> POINTS</div>
          </div>
          <div style={S.resultDivider} />
          <div style={S.resultDesignationBlock}>
            <div style={S.resultLabel}>YOUR PROFESSIONAL DESIGNATION</div>
            <div style={S.resultDesignation}>{designation}</div>
            <div style={S.resultAttached}><span style={S.resultDot} /> Assessment attached to your profile</div>
          </div>
        </div>

        <div style={S.nextStepCard}>
          <div style={S.nextStepEyebrow}>YOUR NEXT STEP</div>
          <h2 style={S.nextStepTitle}>Complete your professional profile</h2>
          <p style={S.nextStepText}>Your Full VALU Index is complete. Your professional profile still needs the required information and evidence before it can be considered for public listing.</p>
          <a href={SITE_BASE ? SITE_BASE + '/profile/onboarding' : undefined} style={S.primaryAction}>COMPLETE MY PROFILE <span>→</span></a>
        </div>

        {reportStatus && <div style={S.reportStatus}>
          <div style={S.reportStatusLabel}>VALU REPORT</div>
          <p style={S.reportStatusText}>{reportStatus}</p>
          {reportStatus.includes('ready') && <a href={SITE_BASE ? SITE_BASE + '/report' : undefined} style={S.reportLink}>VIEW MY VALU REPORT →</a>}
        </div>}

        <div style={S.resultFooter}>
          <span>Keep building what matters.</span>
          <a href={SITE_BASE ? SITE_BASE + '/dashboard' : undefined} style={S.dashboardLink}>RETURN TO DASHBOARD <span>↗</span></a>
        </div>
      </section>
    </Shell>;
  }

  if (!hasValidExperience) {
    return <Shell>
      <div style={S.eyebrow}>VALU INDEX · ONE DETAIL</div>
      <h1 style={S.h1}>Confirm your experience band.</h1>
      <p style={S.p}>We need a current experience band to complete your assessment record. Choose the range that best reflects your total professional experience. This does not change your saved taster or its answers.</p>
      <div style={S.options}>
        {EXPERIENCE_OPTIONS.map(option => <button key={option.value} type="button" onClick={() => setIdentity(previous => ({ ...previous, experience:option.value }))} style={S.option}><span style={S.optionLetter}>→</span><span>{option.label}</span></button>)}
      </div>
      <a href={SITE_BASE ? SITE_BASE + '/dashboard' : undefined} style={S.secondary}>RETURN TO DASHBOARD</a>
    </Shell>;
  }

  return <Shell>
    <div className="valu-assessment-content" style={{position:'relative',zIndex:1}}>
      <VALUAssessmentJourney stage="full" />
      <div className="valu-full-heading">
        <div><div style={S.eyebrow}>YOUR VALU INDEX</div><p className="valu-full-prompt">A considered view of your professional capability.</p></div>
        <span className="valu-full-save"><span aria-hidden="true">✓</span> YOUR PROGRESS IS SAVED</span>
      </div>
      <div className="valu-full-progress" role="progressbar" aria-label="Assessment progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><div style={{...S.progressFill,width:`${progress}%`}} /></div>
      <div className="valu-full-context"><span>{question.cluster} · {CLUSTER_NAMES[question.cluster]}</span><span>SELECT THE RESPONSE THAT BEST REFLECTS YOU</span></div>
      <h1 style={S.question}>{question.q}</h1>
      <div style={S.options}>
        {question.options.map((option,i)=>{const selected=answers[ASSESSMENT_ORDER[current]]===i;return <button className="valu-option" key={i} type="button" aria-pressed={selected} disabled={saving} onClick={()=>choose(i)} style={{...S.option,borderColor:selected?'#C9A84C':'rgba(247,244,238,.1)',background:selected?'rgba(201,168,76,.14)':'#2E2E4A'}}><span style={S.optionLetter}>{String.fromCharCode(65+i)}</span><span>{option.text}</span></button>})}
      </div>
      <div className="valu-full-footer">
        {current>0?<button type="button" className="valu-assessment-back" disabled={saving} onClick={()=>{setCurrent(value=>Math.max(0,value-1));setStartedAt(Date.now());}}>← REVIEW PREVIOUS RESPONSE</button>:<span />}
        <span>Your responses are saved automatically.</span>
      </div>
      {current === ASSESSMENT_ORDER.length - 1 && <button type="button" onClick={submitAssessment} disabled={saving || !Object.prototype.hasOwnProperty.call(answers, ASSESSMENT_ORDER[ASSESSMENT_ORDER.length - 1])} style={{...S.button,opacity:(saving || !Object.prototype.hasOwnProperty.call(answers, ASSESSMENT_ORDER[ASSESSMENT_ORDER.length - 1]))?.55:1,cursor:saving?'wait':'pointer'}}>{saving?'SUBMITTING YOUR VALU INDEX…':'SUBMIT VALU INDEX →'}</button>}
      {error && <div style={S.error}>{error}<button onClick={()=>setError('')} style={S.dismiss}>Dismiss</button></div>}
      {saving && <div style={S.saving}>Scoring and attaching your official VALU Index…</div>}
    </div>
  </Shell>;
}

function Shell({children}) { return <main id="main-content" tabIndex={-1} className="valu-assessment-page valu-assessment-full" style={S.page}><div className="valu-assessment-shell" style={S.shell}>{children}</div></main> }

const S = {
  page:{minHeight:'100dvh',height:'auto',background:T.dark,color:T.parchment,fontFamily:"'Raleway',sans-serif",padding:'22px 20px 32px',overflowX:'hidden',overflowY:'auto',display:'flex',alignItems:'flex-start'},
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
  resultWrap:{width:'100%',maxWidth:820,margin:'0 auto',padding:'clamp(20px,4vw,42px) 0 24px'},
  resultEyebrow:{display:'flex',alignItems:'center',gap:10,fontSize:9,fontWeight:800,letterSpacing:'.17em',color:'rgba(201,168,76,.9)'},
  resultCheck:{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:'50%',border:'1px solid rgba(201,168,76,.55)',fontSize:12,color:T.gold},
  resultTitle:{fontSize:'clamp(30px,5vw,48px)',fontWeight:400,lineHeight:1.12,letterSpacing:'-.035em',color:T.parchment,margin:'22px 0 12px',maxWidth:650},
  resultIntro:{fontSize:14,lineHeight:1.8,color:T.dim,maxWidth:650,margin:'0 0 30px'},
  resultCard:{display:'grid',gridTemplateColumns:'minmax(112px,.65fr) 1px minmax(0,1.35fr)',alignItems:'center',gap:'clamp(18px,4vw,36px)',padding:'clamp(22px,4vw,34px)',border:'1px solid rgba(201,168,76,.25)',borderRadius:12,background:'linear-gradient(120deg,rgba(201,168,76,.09),rgba(46,46,74,.42) 55%)',boxShadow:'0 18px 50px rgba(0,0,0,.12)'},
  resultScoreBlock:{minWidth:0},
  resultScore:{fontSize:'clamp(58px,9vw,82px)',fontWeight:300,lineHeight:.95,letterSpacing:'-.06em',color:T.gold},
  resultScoreCaption:{fontSize:9,fontWeight:700,letterSpacing:'.14em',color:T.dim,marginTop:12},
  resultDivider:{height:76,width:1,background:'rgba(201,168,76,.25)'},
  resultDesignationBlock:{minWidth:0},
  resultLabel:{fontSize:9,fontWeight:700,letterSpacing:'.14em',lineHeight:1.5,color:T.faint,marginBottom:10},
  resultDesignation:{fontSize:'clamp(17px,2.7vw,24px)',fontWeight:700,lineHeight:1.25,letterSpacing:'.015em',color:T.parchment,textTransform:'uppercase',overflowWrap:'anywhere'},
  resultAttached:{display:'flex',alignItems:'center',gap:8,fontSize:11,color:T.dim,marginTop:16},
  resultDot:{width:7,height:7,borderRadius:'50%',background:'#8FAE91',boxShadow:'0 0 0 4px rgba(143,174,145,.12)'},
  nextStepCard:{marginTop:22,padding:'clamp(22px,4vw,30px)',borderRadius:12,background:T.parchment,color:T.dark},
  nextStepEyebrow:{fontSize:9,fontWeight:800,letterSpacing:'.17em',color:'#8C7130',marginBottom:12},
  nextStepTitle:{fontSize:'clamp(21px,3.5vw,30px)',fontWeight:600,lineHeight:1.2,letterSpacing:'-.025em',margin:'0 0 10px'},
  nextStepText:{fontSize:13,lineHeight:1.75,color:'rgba(26,26,46,.72)',maxWidth:620,margin:'0 0 22px'},
  primaryAction:{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:18,minHeight:48,padding:'0 24px',borderRadius:999,background:T.gold,color:T.dark,textDecoration:'none',fontSize:10,fontWeight:800,letterSpacing:'.12em'},
  reportStatus:{marginTop:20,padding:'17px 20px',borderLeft:'2px solid '+T.gold,background:'rgba(247,244,238,.045)'},
  reportStatusLabel:{fontSize:9,fontWeight:800,letterSpacing:'.15em',color:T.gold,marginBottom:7},
  reportStatusText:{fontSize:12,lineHeight:1.7,color:T.dim,margin:0},
  reportLink:{display:'inline-block',fontSize:10,fontWeight:800,letterSpacing:'.1em',color:T.gold,textDecoration:'none',marginTop:10},
  resultFooter:{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14,marginTop:26,paddingTop:18,borderTop:'1px solid rgba(247,244,238,.1)',fontSize:10,color:T.faint},
  dashboardLink:{color:T.dim,textDecoration:'none',fontSize:9,fontWeight:800,letterSpacing:'.12em'},
};
