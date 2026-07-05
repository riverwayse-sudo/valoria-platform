// PRIMEAssessment.jsx — v2.3
// Changes from v2.2:
//  - BREAKING: computeResults, seededShuffle, CLUSTERS, DESIGNATIONS, SKILL_MAX_RAW
//    now imported from ./scoringEngine.js — no longer defined inline.
//    This eliminates the score divergence category of bug permanently.
//  - assessmentLock.js computeFingerprint and isLockActive now re-exported
//    from lockEngine.js — single source of truth enforced.
//  - computeResults call signature updated: now passes QUESTIONS as 4th arg
//    to match scoringEngine.js canonical signature.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  computeFingerprint,
  isLockActive,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "./assessmentLock.js";

// ── CANONICAL SCORING IMPORTS — do not redefine these anywhere ────────────
import {
  CLUSTERS,
  DESIGNATIONS,
  SKILL_MAX_RAW,
  seededShuffle,
  computeResults as _computeResults,
} from "./scoringEngine.js";

// ── CANONICAL QUESTION BANK — do not redefine this anywhere ───────────────
// Shared with api/submit-assessment.js so client and server always score
// against the exact same question set.
import { QUESTIONS } from "./questions.js";

// Wrap to inject QUESTIONS (defined later in this file after question bank).
// This keeps the scoringEngine pure (no direct import of ALL_QUESTIONS).
// Called identically by both client and any future server/DB function.
function computeResults(answers, timings, shuffleMap) {
  return _computeResults(answers, timings, shuffleMap, QUESTIONS);
}

// ── FONT INJECTION — once at module level ─────────────────────────────────
if (typeof document !== "undefined") {
  const FONT_ID = "vi-fonts-raleway";
  if (!document.getElementById(FONT_ID)) {
    const s = document.createElement("style");
    s.id = FONT_ID;
    s.textContent = `@import url('https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,200;0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Mono:wght@400&display=swap');
    *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    input, select, textarea { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
    input::placeholder { color: rgba(247,244,238,0.2) !important; }
    input:focus { outline: none; border-color: rgba(201,168,76,0.5) !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.08) !important; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
    @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pulse { 0%,80%,100% { opacity:0.2; transform:scale(0.8); } 40% { opacity:1; transform:scale(1); } }
    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
    @keyframes checkIn { from { transform:scale(0) rotate(-10deg); opacity:0; } to { transform:scale(1) rotate(0deg); opacity:1; } }
    @keyframes optionSelect { 0% { transform:scale(1); } 50% { transform:scale(0.985); } 100% { transform:scale(1); } }`;
    document.head.appendChild(s);
  }
}

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────
const T = {
  dark:      "#0F0F1A",
  midnight:  "#1A1A2E",
  parchment: "#F7F4EE",
  gold:      "#C9A84C",
  amber:     "#BA7517",
  coral:     "#D85A30",
  text: {
    primary:   "rgba(247,244,238,1)",
    secondary: "rgba(247,244,238,0.65)",
    tertiary:  "rgba(247,244,238,0.45)",
    muted:     "rgba(247,244,238,0.30)",
    ghost:     "rgba(247,244,238,0.15)",
  },
  size: {
    display: 48,
    h1:      28,
    h2:      20,
    body:    14,
    small:   12,
    caption: 10,
    micro:   11,
  },
  radius: {
    pill: 9999,
    card: 12,
    chip: 6,
  },
  font: {
    display: "'Raleway', sans-serif",
    body:    "'Raleway', sans-serif",
    label:   "'Raleway', sans-serif",
    mono:    "'DM Mono', monospace",
  },
  cluster: {
    P: "#1D9E75",
    R: "#378ADD",
    I: "#7F77DD",
    M: "#BA7517",
    E: "#D85A30",
  },
};

// ── SHARED STYLE HELPERS ───────────────────────────────────────────────────
const inputBase = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(247,244,238,0.1)",
  borderRadius: T.radius.chip,
  padding: "13px 16px",
  color: T.parchment,
  fontSize: T.size.body,
  fontFamily: T.font.body,
  transition: "border-color 0.25s, box-shadow 0.25s",
};
const labelBase = {
  display: "block",
  fontSize: T.size.micro,
  fontWeight: 700,
  color: "rgba(201,168,76,0.5)",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  marginBottom: 8,
  fontFamily: T.font.label,
};
const pillBtn = (variant = "primary") => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 28px",
  borderRadius: T.radius.pill,
  fontSize: T.size.caption,
  fontWeight: 700,
  letterSpacing: "0.16em",
  fontFamily: T.font.body,
  cursor: "pointer",
  transition: "background 0.2s, color 0.2s, box-shadow 0.2s, transform 0.1s",
  border: "none",
  ...(variant === "primary" && {
    background: T.gold,
    color: T.dark,
    boxShadow: "0 4px 20px rgba(201,168,76,0.25)",
  }),
  ...(variant === "ghost" && {
    background: "transparent",
    color: T.text.tertiary,
    border: "1px solid rgba(247,244,238,0.15)",
  }),
  ...(variant === "gold-ghost" && {
    background: "rgba(201,168,76,0.08)",
    color: T.gold,
    border: "1px solid rgba(201,168,76,0.25)",
  }),
  ...(variant === "danger" && {
    background: "rgba(216,90,48,0.12)",
    color: T.coral,
    border: "1px solid rgba(216,90,48,0.35)",
  }),
  ...(variant === "disabled" && {
    background: "rgba(201,168,76,0.12)",
    color: "rgba(201,168,76,0.25)",
    border: "1px solid rgba(201,168,76,0.15)",
    cursor: "not-allowed",
  }),
});

// ── PAGE NUMBER ────────────────────────────────────────────────────────────
function PageNumber({ current, total }) {
  return (
    <div style={{
      fontFamily: T.font.label,
      fontStyle: "italic",
      fontWeight: 300,
      fontSize: T.size.body,
      color: T.text.muted,
      letterSpacing: "0.04em",
      whiteSpace: "nowrap",
      userSelect: "none",
    }}>
      {current} <span style={{ color: T.text.ghost }}>/ {total}</span>
    </div>
  );
}

// ── NOISE GRAIN ────────────────────────────────────────────────────────────
function Grain() {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.06,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundSize: "256px",
    }} />
  );
}

// ── AMBIENT GLOW ──────────────────────────────────────────────────────────
function AmbientGlow({ color = "rgba(201,168,76,0.09)" }) {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
      background: `radial-gradient(ellipse 100% 50% at 50% 0%, ${color} 0%, transparent 60%)`,
    }} />
  );
}

// ── CLUSTER CONFIG ─────────────────────────────────────────────────────────
// NOTE: CLUSTERS and DESIGNATIONS are now imported from scoringEngine.js above.
// The color/theme/name display properties are added here for UI rendering only.
// The weight and maxRaw values in scoringEngine.js are the canonical source.
const CLUSTER_UI = {
  P: { theme: "How you show up",  color: T.cluster.P },
  R: { theme: "How you connect",  color: T.cluster.R },
  I: { theme: "How you think",    color: T.cluster.I },
  M: { theme: "How you deliver",  color: T.cluster.M },
  E: { theme: "How you create",   color: T.cluster.E },
};

// Merge UI properties into CLUSTERS for rendering
const CLUSTERS_UI = CLUSTERS.map(c => ({ ...c, ...CLUSTER_UI[c.id] }));

// ── QUESTION BANK — imported from ./questions.js (see import above) ──────
const TOTAL = QUESTIONS.length;

const SKILL_CLUSTER = {
  "Communication":                        "P",
  "Negotiation":                          "P",
  "Personal Brand & Executive Presence":  "P",
  "Emotional Intelligence":               "R",
  "Conflict Resolution":                  "R",
  "People Development":                   "R",
  "Stakeholder Management":               "R",
  "Critical Thinking":                    "I",
  "Strategic Thinking":                   "I",
  "Business Acumen":                      "I",
  "Managing Ambiguity":                   "I",
  "AI Fluency":                           "I",
  "Execution & Accountability":           "M",
  "Resilience & Self-Leadership":         "M",
  "Adaptability":                         "M",
  "Commercial Creativity":                "E",
  "Influence Without Authority":          "E",
  "Human-AI Collaboration":              "E",
};

// ── SESSION STORAGE CHECKPOINT ─────────────────────────────────────────────
const SESSION_KEY = "vi_session_v2";
function saveCheckpoint(data) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch {}
}
function loadCheckpoint() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearCheckpoint() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

// ── PENDING REPORT (localStorage) ─────────────────────────────────────────
const PENDING_KEY = "valu_pending_report_v2";
function setPendingReport(payload) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("setPendingReport: could not write to localStorage:", e.message);
  }
}
function getPendingReport() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearPendingReport() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

// ── SUPABASE HELPERS ───────────────────────────────────────────────────────

/**
 * submitAssessment — sends raw answers (never the computed score) to the
 * server, which recomputes the result itself and is the only writer of
 * valu_assessments. This is what makes the VALU Index tamper-resistant:
 * the number an employer sees always comes from a server-side recompute
 * against the canonical question bank, never from a value the browser sent.
 */
async function submitAssessment({ name, role, answers, timings, shuffleMap }, attempt = 0) {
  const res = await fetch("/api/submit-assessment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, role, answers, timings, shuffleMap }),
  });
  if (!res.ok) {
    const err = await res.text();
    if (attempt === 0 && res.status >= 500) {
      await new Promise(r => setTimeout(r, 1200));
      return submitAssessment({ name, role, answers, timings, shuffleMap }, 1);
    }
    let msg = err;
    try { const p = JSON.parse(err); msg = p.error || err; } catch {}
    throw new Error(`Score could not be saved. Please contact info@valoriainstitute.com with your result. (${res.status}) ${msg}`);
  }
  return res.json();
}

async function updateAssessmentByFingerprint(fingerprint, fields, attempt = 0) {
  const res = await fetch("/api/update-assessment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity_hash: fingerprint, fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    if (attempt === 0 && res.status >= 500) {
      await new Promise(r => setTimeout(r, 1200));
      return updateAssessmentByFingerprint(fingerprint, fields, 1);
    }
    throw new Error(`Update failed (${res.status}): ${err}`);
  }
}

async function signUpWithSupabase(email, password, name, role) {
  const redirectTo = encodeURIComponent(window.location.origin + "/");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup?redirect_to=${redirectTo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password, data: { full_name: name, role } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || "Signup failed.");
  return data;
}

async function joinWaitlist({ name, email, role }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({ name, email, type: "professional", role }),
  });
  if (!res.ok && res.status !== 409) throw new Error(await res.text());
}

async function fetchAssessmentByEmail(email) {
  try {
    const params = new URLSearchParams({
      email: `eq.${email}`,
      select: "name,role,total_score,cluster_scores,skill_scores",
      order: "completed_at.desc",
      limit: "1",
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length) return null;
    const row = rows[0];
    const valuIndex = row.total_score ?? 0;
    const clusterScores = row.cluster_scores ?? {};
    const sorted = [...CLUSTERS_UI].sort((a, b) => (clusterScores[b.id] ?? 0) - (clusterScores[a.id] ?? 0));
    return {
      name: row.name, role: row.role,
      results: {
        valuIndex, clusterScores, skillScores: row.skill_scores ?? {},
        desig: DESIGNATIONS.find(d => valuIndex >= d.min) || DESIGNATIONS[DESIGNATIONS.length - 1],
        futureReadyScore: Math.round(CLUSTERS_UI.reduce((s, c) => s + (clusterScores[c.id] ?? 0), 0) / CLUSTERS_UI.length),
        strongest: sorted[0], weakest: sorted[sorted.length - 1],
        consistencyFlags: {}, gamingDetected: false, anchorFlags: 0,
        speedFlag: false, uniformityFlag: false, anyFlag: false,
        listed: valuIndex >= 35,
        pathway: valuIndex >= 80 ? "PCP Certification" : valuIndex >= 65 ? "PRIME Programme" : valuIndex >= 50 ? "PRIME Cluster" : "PRIME Sprint",
        globalSD: 1,
      },
    };
  } catch { return null; }
}

async function fetchAssessmentByFingerprint(fingerprint) {
  try {
    const params = new URLSearchParams({
      identity_hash: `eq.${fingerprint}`,
      select: "name,role,total_score,cluster_scores,skill_scores,ai_report",
      order: "completed_at.desc",
      limit: "1",
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length) return null;
    const row = rows[0];
    const valuIndex = row.total_score ?? 0;
    const clusterScores = row.cluster_scores ?? {};
    const sorted = [...CLUSTERS_UI].sort((a, b) => (clusterScores[b.id] ?? 0) - (clusterScores[a.id] ?? 0));
    return {
      name: row.name, role: row.role,
      aiReport: row.ai_report || null,
      results: {
        valuIndex, clusterScores, skillScores: row.skill_scores ?? {},
        desig: DESIGNATIONS.find(d => valuIndex >= d.min) || DESIGNATIONS[DESIGNATIONS.length - 1],
        futureReadyScore: Math.round(CLUSTERS_UI.reduce((s, c) => s + (clusterScores[c.id] ?? 0), 0) / CLUSTERS_UI.length),
        strongest: sorted[0], weakest: sorted[sorted.length - 1],
        consistencyFlags: {}, gamingDetected: false, anchorFlags: 0,
        speedFlag: false, uniformityFlag: false, anyFlag: false,
        listed: valuIndex >= 35,
        pathway: valuIndex >= 80 ? "PCP Certification" : valuIndex >= 65 ? "PRIME Programme" : valuIndex >= 50 ? "PRIME Cluster" : "PRIME Sprint",
        globalSD: 1,
      },
    };
  } catch { return null; }
}

function parseAuthHash() {
  if (typeof window === "undefined" || !window.location.hash) return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const errorDescription = params.get("error_description");
  if (errorDescription) return { error: errorDescription.replace(/\+/g, " ") };
  const accessToken = params.get("access_token");
  const type = params.get("type");
  if (!accessToken) return null;
  let email = null;
  try { email = JSON.parse(atob(accessToken.split(".")[1])).email || null; } catch {}
  return { accessToken, type, email };
}

// ── RADAR CHART ────────────────────────────────────────────────────────────
function Radar({ scores, size = 200 }) {
  const cx = size/2, cy = size/2, r = size * 0.37, n = 5;
  const angle = i => (Math.PI*2*i/n) - Math.PI/2;
  const pt = (i, frac) => ({ x: cx + r*frac*Math.cos(angle(i)), y: cy + r*frac*Math.sin(angle(i)) });
  const gridPoly = frac => CLUSTERS_UI.map((_,i) => { const p=pt(i,frac); return `${p.x},${p.y}`; }).join(" ");
  const dataPts = CLUSTERS_UI.map((c,i) => pt(i, (scores[c.id]||0)/100));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible",display:"block"}}>
      {[0.25,0.5,0.75,1].map(f =>
        <polygon key={f} points={gridPoly(f)} fill="none"
          stroke={f===1?"rgba(201,168,76,0.4)":"rgba(201,168,76,0.15)"}
          strokeWidth={f===1?0.8:0.5}/>)}
      {CLUSTERS_UI.map((_,i) => { const p=pt(i,1); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(201,168,76,0.2)" strokeWidth={0.5}/>; })}
      <polygon points={dataPts.map(p=>`${p.x},${p.y}`).join(" ")}
        fill="rgba(201,168,76,0.15)" stroke={T.gold} strokeWidth={1.5}
        style={{transition:"all 0.5s"}}/>
      {dataPts.map((p,i) =>
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={CLUSTERS_UI[i].color}
          style={{transition:"all 0.5s"}}/>)}
      {CLUSTERS_UI.map((c,i) => {
        const lp=pt(i,1.28);
        return <text key={i} x={lp.x} y={lp.y} textAnchor="middle"
          dominantBaseline="central"
          style={{fontSize:10,fontWeight:600,fill:c.color,fontFamily:T.font.body}}>{c.id}</text>;
      })}
    </svg>
  );
}

// ── CLUSTER SCORE STRIP ────────────────────────────────────────────────────
function ClusterStrip({ clusterScores, skillScores, compact = false }) {
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
      {CLUSTERS_UI.map(c => {
        const clusterSkillList = Object.entries(skillScores || {})
          .filter(([s]) => SKILL_CLUSTER[s] === c.id)
          .sort(([,a],[,b]) => a - b);
        const weakestSkill = clusterSkillList[0];
        return (
          <div key={c.id} style={{
            padding: compact ? "7px 10px" : "8px 12px",
            background: `${c.color}10`,
            border: `1px solid ${c.color}30`,
            borderRadius: T.radius.chip,
            minWidth: compact ? 80 : 110,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom: weakestSkill && !compact ? 4 : 0 }}>
              <div style={{
                width:14, height:14, borderRadius: T.radius.chip,
                background:`${c.color}20`, border:`1px solid ${c.color}40`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:8, fontWeight:700, color:c.color, flexShrink:0,
                fontFamily: T.font.body,
              }}>{c.id}</div>
              <span style={{ fontSize:T.size.small, color:c.color, fontWeight:600, fontFamily:T.font.body }}>{clusterScores[c.id]}</span>
              <span style={{ fontSize:T.size.caption, color:T.text.ghost, fontFamily:T.font.body }}>/100</span>
            </div>
            {weakestSkill && !compact && (
              <div style={{ fontSize:T.size.caption, color:T.text.muted, lineHeight:1.4, fontFamily:T.font.body }}>
                Gap: {weakestSkill[0].split(" ")[0]} ({weakestSkill[1]})
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── DESIGNATION BADGE ──────────────────────────────────────────────────────
function DesignationBadge({ desig }) {
  return (
    <div style={{
      display:"inline-flex", alignItems:"center",
      padding:"8px 14px",
      background: desig.bg,
      border: `1px solid ${desig.color}40`,
      borderRadius: T.radius.chip,
    }}>
      <span style={{
        fontSize: T.size.caption, fontWeight:700,
        color: desig.color, letterSpacing:"0.1em",
        fontFamily: T.font.body,
      }}>{desig.name.toUpperCase()}</span>
    </div>
  );
}

// ── SCORE HEADER ──────────────────────────────────────────────────────────
function ScoreHeader({ name, role, valuIndex, clusterScores, skillScores, desig, futureReadyScore, sticky = false }) {
  return (
    <div style={{
      background: T.midnight,
      borderBottom: "1px solid rgba(201,168,76,0.12)",
      padding: "28px 24px",
      ...(sticky && { position:"sticky", top:0, zIndex:10 }),
    }}>
      <div style={{ maxWidth:720, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:T.size.caption, color:"rgba(201,168,76,0.45)", letterSpacing:"0.2em", marginBottom:4, fontFamily:T.font.body }}>
              VALU INDEX · {name?.toUpperCase()}
            </div>
            <div style={{ fontSize:T.size.caption, color:T.text.tertiary, fontFamily:T.font.body }}>{role}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:20 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:T.font.display, fontSize:T.size.display, fontWeight:300, color:T.gold, lineHeight:1 }}>{valuIndex}</div>
              <div style={{ fontSize:T.size.micro, color:T.text.ghost, letterSpacing:"0.1em", fontFamily:T.font.body }}>OUT OF 100</div>
            </div>
            <Radar scores={clusterScores} size={100} />
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <ClusterStrip clusterScores={clusterScores} skillScores={skillScores} compact={false} />
          <div style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"8px 12px",
            background:"rgba(186,117,23,0.08)",
            border:"1px solid rgba(186,117,23,0.2)",
            borderRadius: T.radius.chip,
          }}>
            <span style={{ fontSize:T.size.caption, color:T.amber, letterSpacing:"0.06em", fontFamily:T.font.body }}>FUTURE-READY</span>
            <span style={{ fontSize:T.size.small, color:T.amber, fontWeight:600, fontFamily:T.font.body }}>{futureReadyScore}</span>
          </div>
          <DesignationBadge desig={desig} />
        </div>
      </div>
    </div>
  );
}

// ── AI REPORT HELPERS ──────────────────────────────────────────────────────
const PROMPT_VERSION = "v2.3";
const PRIME_PROGRAMMES = {
  sprint:    { name:"PRIME Sprint",                       duration:"1 day",              price:"₦150,000–₦300,000" },
  cluster:   { name:"PRIME Cluster Programme",            duration:"6 weeks",            price:"₦500,000–₦1,200,000" },
  pcp:       { name:"PRIME Certified Professional (PCP)", duration:"6 months",           price:"₦200,000–₦400,000" },
  executive: { name:"Executive Immersion",                duration:"3 days residential", price:"₦800,000–₦2,000,000" },
};
const SKILL_ACTIONS = {
  "Communication": "Before your next important meeting, write down the one thing you need the room to leave believing — and build backwards from that, not from your slide order.",
  "Negotiation": "Before your next salary, contract, or vendor conversation, write down your walk-away position before you write down your opening ask.",
  "Personal Brand & Executive Presence": "Google yourself right now. What you find is what a hiring manager finds. Decide in the next 48 hours whether that is the profile you want representing you.",
  "Emotional Intelligence": "After your next meeting that frustrates you, write one sentence naming what you felt and one sentence naming what triggered it. Do this for two weeks.",
  "Conflict Resolution": "Name one unresolved tension in your team right now. Not a vague one — a specific one between specific people. Decide by end of week whether you are going to address it or not. Indecision is a decision.",
  "People Development": "Think of the person on your team with the most unrealised potential. Write down exactly what is blocking them. If you cannot name it precisely, that is the problem.",
  "Stakeholder Management": "Map the five people whose support or opposition most affects your current priority project. Next to each name, write whether they are aligned, neutral, or resistant. If you do not know, that is urgent information.",
  "Critical Thinking": "The next time someone presents data to support a recommendation you are inclined to agree with, force yourself to ask: what would have to be true for this to be wrong?",
  "Strategic Thinking": "Take the most important task on your plate right now. Write down what it enables or prevents — not just what it delivers. If you cannot do that in two sentences, you may be executing without understanding.",
  "Business Acumen": "Without looking anything up, write down how your organisation makes money, what the biggest cost is, and where the margin is actually generated. The gaps in your answer are exactly where your business acumen needs work.",
  "Managing Ambiguity": "Write down the most uncertain situation you are currently operating in. Next to it, write the three things you know for certain, the two things you are assuming, and the one decision you can make today that does not require the uncertainty to resolve first.",
  "AI Fluency": "List three tasks you did this week that took more than an hour. For each one, ask honestly: could AI have done 80% of this in ten minutes? If yes, you have a workflow redesign to make.",
  "Execution & Accountability": "List every commitment you have made in the last 30 days that is not yet complete. Put a date next to each one. If any are past due, contact the person it affects today — before they contact you.",
  "Resilience & Self-Leadership": "Name the last setback that knocked you off your game for more than a day. Write down what specifically about it affected you — not the event, but the belief the event triggered. That belief is where the work is.",
  "Adaptability": "Think of the last significant change at work you resisted. Write down what you were protecting. Usually what we resist change to protect is worth examining.",
  "Commercial Creativity": "Look at your current role and write down one thing you could propose in the next 30 days that would either save money, make money, or create an advantage. If nothing comes to mind immediately, that is worth noting.",
  "Influence Without Authority": "Name one thing you need to move forward that requires someone else's cooperation — someone who does not report to you. Have you started that conversation? If not, what is stopping you?",
  "Human-AI Collaboration": "Pick one routine deliverable from your job — a report, a brief, a summary. Use AI to produce a first draft this week. Your job is then to make it better. Notice where you add value and where you do not.",
};
const SKILL_PROGRAMME_MAP = {
  "Communication": "cluster", "Negotiation": "cluster",
  "Personal Brand & Executive Presence": "cluster", "Emotional Intelligence": "cluster",
  "Conflict Resolution": "cluster", "People Development": "cluster",
  "Stakeholder Management": "cluster", "Critical Thinking": "cluster",
  "Strategic Thinking": "cluster", "Business Acumen": "cluster",
  "Managing Ambiguity": "cluster", "AI Fluency": "sprint",
  "Execution & Accountability": "cluster", "Resilience & Self-Leadership": "cluster",
  "Adaptability": "cluster", "Commercial Creativity": "cluster",
  "Influence Without Authority": "cluster", "Human-AI Collaboration": "sprint",
};

function buildReportPrompt(scoreProfile) {
  const { name, role, valuIndex, clusterScores, skillScores, desig, futureReadyScore, strongest, weakest, pathway, listed, globalSD } = scoreProfile;
  const sortedSkills = Object.entries(skillScores || {}).filter(([s]) => s !== "Validity").sort(([,a],[,b]) => b - a);
  const topSkills    = sortedSkills.slice(0, 3);
  const bottomSkills = sortedSkills.slice(-3).reverse();
  const weakestClusterSkills = sortedSkills.filter(([s]) => SKILL_CLUSTER[s] === weakest?.id).sort(([,a],[,b]) => a - b);
  const primaryGapSkill   = weakestClusterSkills[0]?.[0] || bottomSkills[0]?.[0];
  const secondaryGapSkill = weakestClusterSkills[1]?.[0] || bottomSkills[1]?.[0];
  const primaryProgrammeKey = SKILL_PROGRAMME_MAP[primaryGapSkill] || "cluster";
  const primaryProgramme    = PRIME_PROGRAMMES[primaryProgrammeKey];
  const clusterSkillDetail = CLUSTERS_UI.map(c => {
    const skills = sortedSkills.filter(([s]) => SKILL_CLUSTER[s] === c.id);
    return `${c.name} (${clusterScores[c.id]}/100):\n` + skills.map(([s,sc]) => `  - ${s}: ${sc}/100`).join("\n");
  }).join("\n\n");
  return `You are writing a personalised professional development report for ${name}, a ${role} who just completed the VALU Index assessment.
YOUR WRITING RULES:
1. Write like a trusted senior colleague who tells the truth.
2. Use plain, direct language.
3. NEVER use: journey, leverage (as verb), holistic, impactful, synergy, empower, transformative, game-changer, paradigm, unlock, actionable.
4. Be specific. Name the actual skill. Name the actual consequence. Name the actual programme.
5. Short sentences. Maximum 20 words per sentence for the most important points.
6. No padding. Every sentence must earn its place.
7. Do not praise them for completing the assessment.
8. Speak directly to them as "you."
THEIR SCORE DATA:
VALU Index: ${valuIndex}/100 — ${desig.name}
Listed on platform: ${listed ? "Yes" : "No — needs score of 35+"}
Future-Ready score: ${futureReadyScore}/100
SKILL SCORES:\n${clusterSkillDetail}
THEIR STRONGEST SKILLS: ${topSkills.map(([s,sc]) => `${s} (${sc}/100)`).join(", ")}
THEIR WEAKEST SKILLS: ${bottomSkills.map(([s,sc]) => `${s} (${sc}/100)`).join(", ")}
PRIMARY GAP SKILL: ${primaryGapSkill} (${skillScores?.[primaryGapSkill]}/100)
SECONDARY GAP SKILL: ${secondaryGapSkill} (${skillScores?.[secondaryGapSkill]}/100)
RECOMMENDED PROGRAMME: ${primaryProgramme.name} (${primaryProgramme.duration}, ${primaryProgramme.price})
IMMEDIATE WEEKLY ACTION for ${primaryGapSkill}: "${SKILL_ACTIONS[primaryGapSkill] || "Start by naming the exact gap in your own words."}"
${!listed ? `IMPORTANT: ${name} scored ${valuIndex}/100 which is below the 35-point listing minimum. The PRIME Sprint is the direct path to getting listed.` : ""}
WRITE THE REPORT IN THESE EXACT SECTIONS:
---
## YOUR SCORE: ${valuIndex}/100 — ${desig.name.toUpperCase()}
## WHAT YOU ARE GOOD AT
## WHERE YOU ARE LOSING GROUND
## WHAT THIS COSTS YOU IN THE NEXT 12 MONTHS
## YOUR ONE ACTION FOR THIS WEEK
Give them EXACTLY: "${SKILL_ACTIONS[primaryGapSkill]}"
## THE PROGRAMME YOU NEED RIGHT NOW
Name: ${primaryProgramme.name} | Duration: ${primaryProgramme.duration} | Investment: ${primaryProgramme.price}
${!listed ? `\n## HOW TO GET LISTED` : ""}
## THE QUESTION TO SIT WITH
A single question in italics about ${primaryGapSkill}, specific to their role as a ${role}.
---
Start directly with ## YOUR SCORE. No introduction before it.`;
}

// ── RETAKE MODAL ───────────────────────────────────────────────────────────
function RetakeModal({ mode, onClose, onConfirm, expiryDateFormatted }) {
  if (!mode) return null;
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:999,
      background:"rgba(15,15,26,0.92)",
      backdropFilter:"blur(12px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:"24px",
    }}>
      <div style={{
        background: T.midnight, border:"1px solid rgba(201,168,76,0.2)",
        borderRadius: T.radius.card, padding:"36px 32px",
        maxWidth:460, width:"100%", position:"relative",
      }}>
        <button onClick={onClose} style={{
          position:"absolute", top:16, right:16,
          background:"none", border:"none", color:T.text.muted,
          fontSize:20, cursor:"pointer", lineHeight:1, fontFamily:T.font.body,
        }}>×</button>
        {mode === "locked" ? (
          <>
            <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.3)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke={T.gold} strokeWidth="1.5"/><path d="M7 11V7a5 5 0 0110 0v4" stroke={T.gold} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div style={{ fontFamily:T.font.display, fontSize:26, fontWeight:300, color:T.parchment, marginBottom:12, lineHeight:1.2 }}>Your VALU Index is still valid.</div>
            <p style={{ fontSize:T.size.body, color:T.text.tertiary, lineHeight:1.75, marginBottom:16 }}>You can retake the assessment on <strong style={{color:T.gold}}>{expiryDateFormatted}</strong>. Your score expires 12 months after your assessment date.</p>
            <p style={{ fontSize:T.size.small, color:T.text.muted, lineHeight:1.7, marginBottom:24 }}>If you believe there is an error, contact <span style={{color:T.gold}}>info@valoriainstitute.com</span> and a Valoria adviser will review your session.</p>
            <button onClick={onClose} style={{...pillBtn("gold-ghost"), width:"100%"}}>CLOSE</button>
          </>
        ) : (
          <>
            <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(216,90,48,0.1)", border:"1px solid rgba(216,90,48,0.3)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={T.coral} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontFamily:T.font.display, fontSize:26, fontWeight:300, color:T.parchment, marginBottom:12, lineHeight:1.2 }}>Are you sure you want to retake?</div>
            <p style={{ fontSize:T.size.body, color:T.text.tertiary, lineHeight:1.75, marginBottom:8 }}>Retaking permanently replaces your current result. Your VALU Index, cluster scores, and AI report will all be overwritten.</p>
            <p style={{ fontSize:T.size.small, color:T.text.muted, lineHeight:1.7, marginBottom:24 }}>The assessment is designed to be taken once every 12 months. Retaking it immediately is unlikely to produce a meaningfully different result.</p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onClose} style={{...pillBtn("ghost"), flex:1}}>KEEP MY RESULT</button>
              <button onClick={onConfirm} style={{...pillBtn("danger"), flex:1}}>YES, RETAKE</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN: INTRO
// ════════════════════════════════════════════════════════════════════════════
function IntroScreen({ onBegin, assessmentIsLocked, expiryDateFormatted, checkpoint, lockRecord }) {
  const [name, setName] = useState(checkpoint?.name || "");
  const [role, setRole] = useState(checkpoint?.role || "");
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width:1024px)").matches : false
  );
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevError, setPrevError]     = useState(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width:1024px)");
    const fn = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const canBegin = name.trim().length > 0 && role.trim().length > 0 && !assessmentIsLocked;
  const hasCheckpoint = checkpoint && checkpoint.currentQ > 0;

  async function handleViewPrevious() {
    if (!lockRecord?.fingerprint) {
      setPrevError("Could not locate your previous result. Contact info@valoriainstitute.com.");
      return;
    }
    setPrevLoading(true);
    setPrevError(null);
    try {
      const profile = await fetchAssessmentByFingerprint(lockRecord.fingerprint);
      if (!profile) {
        setPrevError("Your previous result could not be retrieved. Contact info@valoriainstitute.com.");
        return;
      }
      onBegin({ name: profile.name, role: profile.role, resume: false, previousProfile: profile });
    } catch {
      setPrevError("Something went wrong. Try again or contact info@valoriainstitute.com.");
    } finally {
      setPrevLoading(false);
    }
  }

  const fieldStyle = (filled) => ({
    ...inputBase,
    border: `1.5px solid ${filled ? "rgba(201,168,76,0.4)" : "rgba(247,244,238,0.1)"}`,
    borderRadius: T.radius.card,
    padding: "16px 18px",
    fontSize: 16,
  });

  return (
    <div style={{ minHeight:"100vh", background:T.dark, fontFamily:T.font.body, position:"relative", overflowX:"hidden" }}>
      <Grain />
      <AmbientGlow />
      <div style={{
        position:"relative", zIndex:1,
        maxWidth: isDesktop ? 1400 : 600,
        margin:"0 auto",
        padding: isDesktop ? "60px 48px" : "clamp(48px,10vw,72px) 20px clamp(40px,8vw,64px)",
        display:"flex",
        flexDirection: isDesktop ? "row" : "column",
        gap: isDesktop ? 80 : 0,
      }}>
        {isDesktop && (
          <div style={{ flex:1.2, paddingRight:20 }}>
            <div style={{ marginBottom:28 }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"5px 14px", background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:T.radius.pill, marginBottom:28 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:T.gold }} />
                <span style={{ fontSize:T.size.micro, fontWeight:600, color:T.gold, letterSpacing:"0.2em", fontFamily:T.font.label }}>FOUNDING COHORT — NOW OPEN</span>
              </div>
              <h1 style={{ fontFamily:T.font.display, fontSize:"clamp(48px,5vw,68px)", fontWeight:200, lineHeight:1, letterSpacing:"-0.02em", color:T.parchment, margin:"0 0 20px" }}>
                Know exactly<br/>where you <em style={{ fontStyle:"italic", color:T.gold }}>stand.</em>
              </h1>
              <p style={{ fontSize:16, fontWeight:300, color:T.text.tertiary, lineHeight:1.75, margin:"0 0 40px", maxWidth:460, fontFamily:T.font.body }}>
                55 questions across five PRIME clusters. Designed to surface what you genuinely do — not what you aspire to do.
              </p>
              <div style={{ display:"flex", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:T.radius.chip, overflow:"hidden", marginBottom:40, maxWidth:400 }}>
                {[{l:"Questions",v:"55"},{l:"Minutes",v:"18–28"},{l:"Always",v:"Free"}].map((s,i)=>(
                  <div key={i} style={{ flex:1, padding:"18px 8px", textAlign:"center", borderRight:i<2?"1px solid rgba(255,255,255,0.06)":"none" }}>
                    <div style={{ fontSize:22, fontWeight:700, color:T.gold, lineHeight:1, fontFamily:T.font.display }}>{s.v}</div>
                    <div style={{ fontSize:T.size.caption, color:T.text.ghost, marginTop:5, letterSpacing:"0.06em", fontFamily:T.font.body }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize:T.size.micro, color:"rgba(201,168,76,0.35)", letterSpacing:"0.18em", marginBottom:14, fontFamily:T.font.label }}>WHAT IS ASSESSED</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {CLUSTERS_UI.map(c=>(
                    <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"rgba(255,255,255,0.02)", border:`1px solid ${c.color}22`, borderRadius:T.radius.chip }}>
                      <div style={{ width:36, height:36, borderRadius:T.radius.chip, background:`${c.color}15`, border:`1px solid ${c.color}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:c.color, flexShrink:0, fontFamily:T.font.body }}>{c.id}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:T.size.body, color:T.parchment, fontWeight:500, fontFamily:T.font.body }}>{c.name}</div>
                        <div style={{ fontSize:T.size.caption+1, color:T.text.muted, fontStyle:"italic", fontFamily:T.font.body }}>{c.theme}</div>
                      </div>
                      <div style={{ fontSize:T.size.caption, color:`${c.color}70`, letterSpacing:"0.06em", fontFamily:T.font.mono }}>{Math.round(c.weight*100)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div style={{ flex:isDesktop ? 1 : "unset", width:isDesktop ? "auto" : "100%" }}>
          {!isDesktop && (
            <div style={{ marginBottom:28, animation:"fadeUp 0.7s ease 0.05s both" }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"4px 12px", background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:T.radius.pill, marginBottom:18 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:T.gold }} />
                <span style={{ fontSize:T.size.micro, fontWeight:600, color:T.gold, letterSpacing:"0.18em", fontFamily:T.font.label }}>FOUNDING COHORT — NOW OPEN</span>
              </div>
              <h1 style={{ fontFamily:T.font.display, fontSize:"clamp(34px,8vw,48px)", fontWeight:200, lineHeight:1.05, color:T.parchment, margin:"0 0 12px" }}>
                Know exactly<br/>where you <em style={{ fontStyle:"italic", color:T.gold }}>stand.</em>
              </h1>
              <p style={{ fontSize:T.size.body, color:T.text.tertiary, lineHeight:1.65, margin:"0 0 24px", fontFamily:T.font.body }}>55 questions across five PRIME clusters.</p>
              <div style={{ display:"flex", marginBottom:28, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:T.radius.chip, overflow:"hidden" }}>
                {[{l:"Questions",v:"55"},{l:"Minutes",v:"18–28"},{l:"Free",v:"Always"}].map((s,i)=>(
                  <div key={i} style={{ flex:1, padding:"12px 6px", textAlign:"center", borderRight:i<2?"1px solid rgba(255,255,255,0.06)":"none" }}>
                    <div style={{ fontSize:18, fontWeight:700, color:T.gold, fontFamily:T.font.display }}>{s.v}</div>
                    <div style={{ fontSize:T.size.micro, color:T.text.ghost, marginTop:4, fontFamily:T.font.body }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {hasCheckpoint && (
            <div style={{ marginBottom:16, padding:"14px 18px", background:"rgba(55,138,221,0.06)", border:"1px solid rgba(55,138,221,0.25)", borderRadius:T.radius.chip }}>
              <div style={{ fontSize:T.size.caption, fontWeight:700, color:"#378ADD", letterSpacing:"0.14em", marginBottom:6, fontFamily:T.font.body }}>SESSION IN PROGRESS</div>
              <p style={{ fontSize:T.size.small, color:T.text.tertiary, lineHeight:1.7, margin:"0 0 10px" }}>
                You have a session in progress at question {checkpoint.currentQ + 1} of {TOTAL}.
              </p>
              <button
                onClick={() => onBegin({ name: checkpoint.name, role: checkpoint.role, resume: true })}
                style={{...pillBtn("gold-ghost"), padding:"10px 20px", fontSize:T.size.caption}}>
                RESUME SESSION →
              </button>
            </div>
          )}
          {assessmentIsLocked && (
            <div style={{ marginBottom:20, padding:"16px 18px", background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.25)", borderRadius:T.radius.chip }}>
              <div style={{ fontSize:T.size.caption, fontWeight:700, color:T.gold, letterSpacing:"0.14em", marginBottom:8, fontFamily:T.font.body }}>ASSESSMENT LOCKED</div>
              <p style={{ fontSize:T.size.small, color:T.text.tertiary, lineHeight:1.7, margin:"0 0 14px" }}>
                You completed the VALU Index for this identity. Retake is available on <strong style={{color:T.gold}}>{expiryDateFormatted}</strong>.
              </p>
              {prevError && (
                <p style={{ fontSize:T.size.small, color:T.coral, margin:"0 0 10px", lineHeight:1.6 }}>{prevError}</p>
              )}
              <button
                onClick={handleViewPrevious}
                disabled={prevLoading}
                style={{...pillBtn(prevLoading ? "disabled" : "gold-ghost"), padding:"10px 20px", fontSize:T.size.caption}}>
                {prevLoading ? "RETRIEVING..." : "VIEW MY PREVIOUS REPORT →"}
              </button>
            </div>
          )}
          <div style={{ background:"rgba(22,22,36,0.7)", border:"1px solid rgba(201,168,76,0.12)", borderRadius:T.radius.card, padding:"clamp(24px,6vw,32px)", animation:"fadeUp 0.8s ease 0.35s both" }}>
            <div style={{ fontSize:T.size.caption, fontWeight:600, color:T.text.muted, letterSpacing:"0.14em", marginBottom:20, fontFamily:T.font.label }}>BEFORE YOU BEGIN</div>
            <div style={{ marginBottom:16 }}>
              <label style={labelBase}>Your Full Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" autoComplete="name" style={fieldStyle(name.trim())} />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={labelBase}>Your Current Role</label>
              <input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Director of Strategy" autoComplete="organization-title" style={fieldStyle(role.trim())} />
            </div>
            <button
              onClick={() => { if (canBegin) onBegin({ name, role, resume: false }); }}
              disabled={!canBegin}
              style={{ ...pillBtn(canBegin ? "primary" : "disabled"), width:"100%", padding:"18px 24px" }}
              onMouseEnter={e => { if (canBegin) e.currentTarget.style.background="#E2C97E"; }}
              onMouseLeave={e => { if (canBegin) e.currentTarget.style.background=T.gold; }}
            >
              BEGIN THE VALU INDEX
            </button>
            {!canBegin && (
              <p style={{ textAlign:"center", fontSize:T.size.caption, color:T.text.ghost, marginTop:12, lineHeight:1.5, fontFamily:T.font.body }}>
                {assessmentIsLocked ? "Assessment locked for 12 months for this identity." : "Enter your name and role to continue."}
              </p>
            )}
          </div>
          <div style={{ marginTop:16, padding:"14px 18px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:T.radius.chip, animation:"fadeUp 0.8s ease 0.45s both" }}>
            <div style={{ fontSize:T.size.small, color:T.text.muted, lineHeight:1.75, fontFamily:T.font.body }}>
              Answer based on what you <em style={{color:T.text.tertiary}}>actually do</em> — not what you aim to do. Consistent honest responses produce a more accurate result.
            </div>
          </div>
          {!isDesktop && (
            <div style={{ marginTop:28, animation:"fadeUp 0.8s ease 0.55s both" }}>
              <div style={{ fontSize:T.size.micro, color:"rgba(201,168,76,0.35)", letterSpacing:"0.18em", marginBottom:12, fontFamily:T.font.label }}>WHAT IS ASSESSED</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {CLUSTERS_UI.map(c=>(
                  <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"rgba(255,255,255,0.02)", border:`1px solid ${c.color}20`, borderRadius:T.radius.chip }}>
                    <div style={{ width:32, height:32, borderRadius:T.radius.chip, background:`${c.color}15`, border:`1px solid ${c.color}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:c.color, flexShrink:0, fontFamily:T.font.body }}>{c.id}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:T.size.small, color:T.parchment, fontWeight:500, fontFamily:T.font.body }}>{c.name}</div>
                      <div style={{ fontSize:T.size.caption, color:T.text.muted, fontStyle:"italic", fontFamily:T.font.body }}>{c.theme}</div>
                    </div>
                    <div style={{ fontSize:T.size.caption, color:`${c.color}70`, letterSpacing:"0.06em", flexShrink:0, fontFamily:T.font.mono }}>{Math.round(c.weight*100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop:32, paddingTop:24, borderTop:"1px solid rgba(201,168,76,0.08)", display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center" }}>
            {["Always free","18–28 minutes","NDPA 2023 compliant"].map(t=>(
              <div key={t} style={{ display:"flex", alignItems:"center", gap:6, fontSize:T.size.caption, color:T.text.ghost, fontFamily:T.font.body }}>
                <div style={{ width:3, height:3, borderRadius:"50%", background:"rgba(201,168,76,0.4)" }}/>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN: ASSESSMENT
// ════════════════════════════════════════════════════════════════════════════
function AssessmentScreen({ name, role, initialAnswers, initialTimings, initialQ, sessionSeed, onComplete }) {
  const [currentQ, setCurrentQ]     = useState(initialQ || 0);
  const [answers, setAnswers]       = useState(initialAnswers || {});
  const [selected, setSelected]     = useState(null);
  const [timings, setTimings]       = useState(initialTimings || Array(TOTAL).fill(0));
  const [qStartTime, setQStartTime] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [shuffleMap, setShuffleMap] = useState(() => {
    const q = QUESTIONS[initialQ || 0];
    if (!q || q.type === "anchor") return {};
    return { [initialQ || 0]: seededShuffle(q.options, sessionSeed + (initialQ || 0)) };
  });

  const question = QUESTIONS[currentQ];
  const cluster  = CLUSTERS_UI.find(c => c.id === question?.cluster);
  const progress = Math.round((currentQ / TOTAL) * 100);

  const displayedOptions = useMemo(() => {
    if (!question) return [];
    if (question.type === "anchor") return question.options;
    return shuffleMap[currentQ] || [];
  }, [currentQ, question, shuffleMap]);

  useEffect(() => {
    if (!question) return;
    setShuffleMap(prev => {
      const next = { ...prev };
      if (question.type !== "anchor" && !next[currentQ]) {
        next[currentQ] = seededShuffle(question.options, sessionSeed + currentQ);
      }
      const nextQ = QUESTIONS[currentQ + 1];
      if (nextQ && nextQ.type !== "anchor" && !next[currentQ + 1]) {
        next[currentQ + 1] = seededShuffle(nextQ.options, sessionSeed + currentQ + 1);
      }
      return next;
    });
  }, [currentQ, question, sessionSeed]);

  useEffect(() => {
    setQStartTime(Date.now());
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
    };
  }, [currentQ]);

  useEffect(() => {
    saveCheckpoint({ name, role, answers, timings, currentQ, sessionSeed });
  }, [answers, currentQ, name, role, sessionSeed]);

  const liveScores = {};
  CLUSTERS_UI.forEach(c => {
    const qs = QUESTIONS.filter((q, i) => q.cluster === c.id && answers[i] !== undefined);
    const raw = qs.reduce((s, q) => {
      const idx = QUESTIONS.indexOf(q);
      const opt = shuffleMap[idx] ? shuffleMap[idx][answers[idx]] : q.options[answers[idx]];
      return s + (opt?.score || 0);
    }, 0);
    liveScores[c.id] = Math.round((raw / c.maxRaw) * 100);
  });

  const autoAdvanceTimer = useRef(null);

  function handleSelect(optIdx) {
    if (transitioning) return;
    setSelected(optIdx);
    if (currentQ + 1 < TOTAL) {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => {
        handleContinueWithAnswer(optIdx);
      }, 300);
    }
  }

  function handleContinueWithAnswer(optIdx) {
    if (transitioning) return;
    const elapsed = qStartTime ? Date.now() - qStartTime : 0;
    const newTimings = [...timings];
    newTimings[currentQ] = elapsed;
    const newAnswers = { ...answers, [currentQ]: optIdx };
    setAnswers(newAnswers);
    setTimings(newTimings);
    setTransitioning(true);
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setTimeout(() => {
      if (currentQ + 1 < TOTAL) {
        setCurrentQ(currentQ + 1);
        setSelected(null);
        setTransitioning(false);
      } else {
        const r = computeResults(newAnswers, newTimings, shuffleMap);
        clearCheckpoint();
        // answers/timings passed through so ResultsScreen can send them to the
        // server for authoritative recomputation. `r` here is optimistic-UI
        // only and is never the value that gets persisted.
        onComplete({ name, role, results: r, shuffleMap, answers: newAnswers, timings: newTimings });
      }
    }, 220);
  }

  function handleContinue() {
    if (selected === null || transitioning) return;
    const elapsed = qStartTime ? Date.now() - qStartTime : 0;
    const newTimings = [...timings];
    newTimings[currentQ] = elapsed;
    const newAnswers = { ...answers, [currentQ]: selected };
    setAnswers(newAnswers);
    setTimings(newTimings);
    setTransitioning(true);
    setTimeout(() => {
      if (currentQ + 1 < TOTAL) {
        setCurrentQ(currentQ + 1);
        setSelected(null);
        setTransitioning(false);
      } else {
        const r = computeResults(newAnswers, newTimings, shuffleMap);
        clearCheckpoint();
        onComplete({ name, role, results: r, shuffleMap, answers: newAnswers, timings: newTimings });
      }
    }, 220);
  }

  function handleBack() {
    if (currentQ === 0) return;
    setSelected(answers[currentQ - 1] ?? null);
    setCurrentQ(currentQ - 1);
  }

  const pageNum = currentQ + 1;

  return (
    <div style={{ minHeight:"100vh", background:T.dark, display:"flex", flexDirection:"column", fontFamily:T.font.body }}>
      <Grain />
      <AmbientGlow color="rgba(201,168,76,0.06)" />
      <div style={{
        position:"fixed", top:59, left:0, right:0,
        padding:"14px 24px 12px",
        background:"rgba(26,26,46,0.97)",
        borderBottom:"1px solid rgba(201,168,76,0.1)",
        backdropFilter:"blur(12px)",
        zIndex:40,
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <div style={{ fontFamily:T.font.label, fontSize:T.size.caption, color:"rgba(201,168,76,0.6)", letterSpacing:"0.15em" }}>VALU INDEX</div>
        {cluster && (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:18, height:18, borderRadius: T.radius.chip, background:`${cluster.color}20`, border:`1px solid ${cluster.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:T.size.micro, fontWeight:700, color:cluster.color, fontFamily:T.font.body }}>{cluster.id}</div>
            <div style={{ fontSize:T.size.caption, color:cluster.color, letterSpacing:"0.08em", fontFamily:T.font.label }}>{cluster.name.toUpperCase()}</div>
          </div>
        )}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:2, background:"rgba(255,255,255,0.06)" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:T.gold, transition:"width 0.4s ease", borderRadius: T.radius.chip }} />
        </div>
      </div>
      <div style={{ flex:1, display:"flex", padding:"120px 20px 140px", maxWidth:700, margin:"0 auto", width:"100%", flexDirection:"column", justifyContent:"center" }}>
        {question.skill && question.cluster !== "VA" && (
          <div style={{ fontSize:T.size.caption, color:"rgba(201,168,76,0.4)", letterSpacing:"0.18em", marginBottom:16, textTransform:"uppercase", fontFamily:T.font.body }}>
            {question.skill} · {question.type}
          </div>
        )}
        <div style={{
          fontFamily: T.font.display,
          fontSize:"clamp(17px,2.5vw,22px)",
          fontWeight:300,
          color: T.parchment,
          lineHeight:1.55,
          marginBottom:28,
          opacity: transitioning ? 0 : 1,
          transition:"opacity 0.2s",
        }}>
          {question.q}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, opacity:transitioning?0:1, transition:"opacity 0.2s" }}>
          {displayedOptions.map((opt, displayIdx) => {
            const isSelected = selected === displayIdx;
            return (
              <button key={displayIdx} onClick={() => handleSelect(displayIdx)}
                style={{
                  padding:"16px 20px",
                  background: isSelected ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${isSelected ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: T.radius.chip,
                  textAlign:"left",
                  cursor:"pointer",
                  color: isSelected ? T.parchment : T.text.secondary,
                  fontSize: T.size.body,
                  lineHeight:1.55,
                  fontFamily: T.font.body,
                  transition:"all 0.2s cubic-bezier(0.22,1,0.36,1)",
                  outline:"none",
                  boxShadow: isSelected ? "0 4px 20px rgba(201,168,76,0.15)" : "none",
                  display:"flex",
                  alignItems:"flex-start",
                  gap:12,
                  animation: isSelected ? "optionSelect 0.25s ease" : "none",
                }}
                onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background="rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor="rgba(201,168,76,0.25)"; e.currentTarget.style.color=T.parchment; }}}
                onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background="rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; e.currentTarget.style.color=T.text.secondary; }}}
                onTouchStart={e => { e.currentTarget.style.transform="scale(0.98)"; }}
                onTouchEnd={e => { e.currentTarget.style.transform="scale(1)"; }}
              >
                <div style={{
                  width:18, height:18, borderRadius:"50%", flexShrink:0, marginTop:2,
                  border: `1.5px solid ${isSelected ? T.gold : "rgba(247,244,238,0.2)"}`,
                  background: isSelected ? T.gold : "transparent",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all 0.2s",
                }}>
                  {isSelected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" style={{animation:"checkIn 0.2s ease"}}>
                      <path d="M1 4L3.5 6.5L9 1" stroke={T.dark} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span>{opt.text}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        padding:"14px 24px",
        background:"rgba(26,26,46,0.97)",
        borderTop:"1px solid rgba(201,168,76,0.08)",
        backdropFilter:"blur(12px)",
        display:"flex", gap:10, alignItems:"center", justifyContent:"space-between",
        zIndex:40,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:100 }}>
          <PageNumber current={pageNum} total={TOTAL} />
          {currentQ > 0 && (
            <button onClick={handleBack}
              style={{ ...pillBtn("ghost"), padding:"10px 18px", fontSize:T.size.caption }}>
              BACK
            </button>
          )}
        </div>
        {currentQ + 1 === TOTAL ? (
          <button
            onClick={handleContinue}
            disabled={selected === null}
            style={{ ...pillBtn(selected !== null ? "primary" : "disabled"), padding:"13px 32px", minWidth:160 }}
            onMouseEnter={e => { if (selected !== null) e.currentTarget.style.background="#E2C97E"; }}
            onMouseLeave={e => { if (selected !== null) e.currentTarget.style.background=T.gold; }}
          >
            SEE MY RESULTS
          </button>
        ) : (
          <div style={{
            padding:"13px 32px", minWidth:160, textAlign:"center",
            fontSize: T.size.caption, letterSpacing:"0.12em",
            color: selected !== null ? "rgba(201,168,76,0.5)" : T.text.ghost,
            fontFamily: T.font.body,
            transition: "color 0.2s",
          }}>
            {selected !== null ? "ADVANCING..." : "SELECT AN OPTION"}
          </div>
        )}
        <div style={{ flexShrink:0 }}>
          <Radar scores={liveScores} size={100} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN: RESULTS
// ════════════════════════════════════════════════════════════════════════════
function ResultsScreen({ name, role, results, shuffleMap, answers, timings, onRetake, onSignupDone }) {
  const [signupEmail, setSignupEmail]       = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm]   = useState("");
  const [signupError, setSignupError]       = useState("");
  const [signupLoading, setSignupLoading]   = useState(false);
  const [signupDone, setSignupDone]         = useState(false);
  const [saveError, setSaveError]           = useState(null);
  const [retakeModal, setRetakeModal]       = useState(null);

  const { valuIndex, clusterScores, skillScores, desig, futureReadyScore, listed } = results;

  useEffect(() => {
    // IMPORTANT: we do NOT write the client-computed score directly to
    // Supabase anymore. Anyone with devtools open could otherwise POST an
    // arbitrary total_score/designation straight to the anon-key REST
    // endpoint and forge a credential. Instead we send the raw answers,
    // timings, and shuffle map to a server route which recomputes the score
    // itself (same scoringEngine + question bank) and is the only thing
    // allowed to write to valu_assessments (via the service-role key). RLS
    // must deny anon INSERT/UPDATE on this table — see api/submit-assessment.js.
    submitAssessment({ name, role, answers, timings, shuffleMap })
      .catch(err => setSaveError(err.message));
  }, []);

  async function handleSignup() {
    if (!signupEmail.trim() || !signupPassword) {
      setSignupError("A valid email address and password are required.");
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError("Your password must be at least 8 characters.");
      return;
    }
    if (signupPassword !== signupConfirm) {
      setSignupError("Passwords don't match — please check and try again.");
      return;
    }
    setSignupLoading(true);
    setSignupError("");
    try {
      const authData = await signUpWithSupabase(signupEmail.trim(), signupPassword, name, role);
      const userId = authData?.user?.id || null;
      setPendingReport({ name, role, email: signupEmail.trim(), results });
      const fp = computeFingerprint(name, role);
      await updateAssessmentByFingerprint(fp, {
        email: signupEmail.trim(),
        ...(userId ? { user_id: userId } : {}),
      }).catch(() => {});
      if (userId) {
        const tierMap = {
          "Elite Professional": "elite",
          "Distinguished Professional": "distinguished",
          "Proficient Professional": "proficient",
          "Developing Professional": "standard",
        };
        await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Prefer": "return=minimal,resolution=merge-duplicates",
          },
          body: JSON.stringify({
            id: userId,
            display_name: name,
            headline: role,
            user_type: "talent",
            valu_score: valuIndex,
            cluster_scores: clusterScores,
            valu_tier: tierMap[desig?.name] || "standard",
            assessment_completed_at: new Date().toISOString(),
            is_visible: false,
          }),
        }).catch(() => {});
      }
      await joinWaitlist({ name, email: signupEmail.trim(), role }).catch(() => {});
      setSignupDone(true);
      if (onSignupDone) onSignupDone(signupEmail.trim());
    } catch (e) {
      setSignupError(e.message || "Something prevented this from completing. Try again shortly.");
    } finally {
      setSignupLoading(false);
    }
  }

  const pageNum = TOTAL + 1;
  const sortedSkills = Object.entries(skillScores || {})
    .filter(([s]) => s !== "Validity")
    .sort(([,a],[,b]) => b - a);
  const topSkills    = sortedSkills.slice(0, 3);
  const bottomSkills = sortedSkills.slice(-3).reverse();

  return (
    <div style={{ minHeight:"100vh", background:T.dark, fontFamily:T.font.body }}>
      <Grain />
      <AmbientGlow />
      <ScoreHeader
        name={name} role={role}
        valuIndex={valuIndex} clusterScores={clusterScores}
        skillScores={skillScores} desig={desig}
        futureReadyScore={futureReadyScore}
        sticky={false}
      />
      <div style={{ maxWidth:720, margin:"0 auto", padding:"32px 24px 80px" }}>
        {saveError && (
          <div style={{ marginBottom:16, padding:"12px 16px", background:"rgba(216,90,48,0.08)", border:"1px solid rgba(216,90,48,0.3)", borderRadius:T.radius.chip, fontSize:T.size.small, color:T.coral, fontFamily:T.font.body }}>
            Score could not be saved: {saveError}. Contact info@valoriainstitute.com with your result ({valuIndex}/100).
          </div>
        )}
        <div style={{ marginBottom:24, padding:"24px", background:"rgba(22,22,36,0.6)", border:"1px solid rgba(201,168,76,0.1)", borderRadius:T.radius.card }}>
          <div style={{ fontSize:T.size.caption, fontWeight:700, color:T.gold, letterSpacing:"0.16em", marginBottom:12, fontFamily:T.font.label }}>YOUR RESULT SUMMARY</div>
          <div style={{ padding:"16px", background: desig.bg, border:`1px solid ${desig.color}30`, borderRadius:T.radius.chip, marginBottom:16 }}>
            <div style={{ fontSize:T.size.small, fontWeight:700, color:desig.color, letterSpacing:"0.1em", marginBottom:6, fontFamily:T.font.body }}>{desig.name.toUpperCase()}</div>
            <p style={{ fontSize:T.size.body, color:T.text.secondary, lineHeight:1.7, margin:0, fontFamily:T.font.body }}>{desig.desc}</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap", marginBottom:16 }}>
            <Radar scores={clusterScores} size={160} />
            <div style={{ flex:1, minWidth:200 }}>
              {CLUSTERS_UI.map(c => (
                <div key={c.id} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:T.size.small, color:c.color, fontFamily:T.font.body }}>{c.name}</span>
                    <span style={{ fontSize:T.size.small, color:c.color, fontWeight:600, fontFamily:T.font.mono }}>{clusterScores[c.id]}</span>
                  </div>
                  <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius: T.radius.chip, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${clusterScores[c.id]}%`, background:c.color, borderRadius: T.radius.chip, transition:"width 0.8s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <div style={{ fontSize:T.size.micro, color:"rgba(29,158,117,0.6)", letterSpacing:"0.14em", marginBottom:8, fontFamily:T.font.label }}>YOUR STRENGTHS</div>
              {topSkills.map(([s, sc]) => (
                <div key={s} style={{ display:"flex", justifyContent:"space-between", marginBottom:5, alignItems:"center" }}>
                  <span style={{ fontSize:T.size.small, color:T.text.secondary, fontFamily:T.font.body }}>{s}</span>
                  <span style={{ fontSize:T.size.caption, color:"#1D9E75", fontFamily:T.font.mono }}>{sc}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:T.size.micro, color:"rgba(216,90,48,0.6)", letterSpacing:"0.14em", marginBottom:8, fontFamily:T.font.label }}>DEVELOPMENT AREAS</div>
              {bottomSkills.map(([s, sc]) => (
                <div key={s} style={{ display:"flex", justifyContent:"space-between", marginBottom:5, alignItems:"center" }}>
                  <span style={{ fontSize:T.size.small, color:T.text.secondary, fontFamily:T.font.body }}>{s}</span>
                  <span style={{ fontSize:T.size.caption, color:T.coral, fontFamily:T.font.mono }}>{sc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {signupDone ? (
          <div style={{ background:"rgba(29,158,117,0.05)", border:"1px solid rgba(29,158,117,0.25)", borderRadius:T.radius.card, padding:"32px 28px" }}>
            <div style={{ fontSize:T.size.caption, fontWeight:700, color:"#1D9E75", letterSpacing:"0.16em", marginBottom:12, fontFamily:T.font.label }}>✦ ACCOUNT CREATED</div>
            <p style={{ fontSize:T.size.body, color:T.text.secondary, lineHeight:1.8, margin:"0 0 12px", fontFamily:T.font.body }}>
              A confirmation link has been sent to <strong style={{color:T.parchment}}>{signupEmail}</strong>.
            </p>
            <p style={{ fontSize:T.size.small, color:T.text.muted, lineHeight:1.7, margin:"0 0 24px", fontFamily:T.font.body }}>
              Confirm your email to unlock your full AI report — it generates immediately after confirmation. Your VALU Index of <strong style={{color:T.gold}}>{valuIndex}/100</strong> is saved and linked to your profile.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <a href="https://valoriainstitute.com/profile/edit" style={{ display:"block", textAlign:"center", padding:"14px 24px", background:T.gold, color:"#0F0F1A", fontFamily:T.font.body, fontSize:T.size.caption, fontWeight:700, letterSpacing:"0.14em", borderRadius:T.radius.pill, textDecoration:"none" }}>
                COMPLETE YOUR PROFILE →
              </a>
              <a href="https://valoriainstitute.com/dashboard" style={{ display:"block", textAlign:"center", padding:"14px 24px", background:"transparent", color:T.gold, fontFamily:T.font.body, fontSize:T.size.caption, fontWeight:700, letterSpacing:"0.14em", borderRadius:T.radius.pill, textDecoration:"none", border:"1px solid rgba(201,168,76,0.3)" }}>
                GO TO DASHBOARD
              </a>
            </div>
            <p style={{ fontSize:T.size.micro, color:T.text.ghost, lineHeight:1.6, marginTop:16, fontFamily:T.font.body }}>
              Check your spam folder if you don't see the confirmation email within a minute.
            </p>
          </div>
        ) : (
          <div style={{ background:"rgba(22,22,36,0.7)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:T.radius.card, padding:"32px 28px" }}>
            <div style={{ fontSize:T.size.caption, fontWeight:700, color:T.gold, letterSpacing:"0.16em", marginBottom:8, fontFamily:T.font.label }}>UNLOCK YOUR FULL AI REPORT</div>
            <p style={{ fontSize:T.size.body, color:T.text.tertiary, lineHeight:1.7, marginBottom:16, fontFamily:T.font.body }}>
              Your personalised development report — gap analysis, 12-month cost of inaction, recommended programme, and one immediate action — generates the moment you confirm your email.
            </p>
            <div style={{ fontSize:T.size.small, color:T.text.muted, marginBottom:20, fontFamily:T.font.body }}>
              Continuing as <strong style={{color:T.parchment}}>{name}</strong> · {role}
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={labelBase} htmlFor="signup-email">Email Address</label>
              <input id="signup-email" type="email" placeholder="you@example.com" value={signupEmail}
                onChange={e=>setSignupEmail(e.target.value)} style={inputBase}
                onFocus={e=>e.target.style.borderColor="rgba(201,168,76,0.4)"}
                onBlur={e=>e.target.style.borderColor="rgba(247,244,238,0.1)"} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={labelBase} htmlFor="signup-password">Create Password</label>
              <input id="signup-password" type="password" placeholder="Minimum 8 characters" value={signupPassword}
                onChange={e=>setSignupPassword(e.target.value)} style={inputBase}
                onFocus={e=>e.target.style.borderColor="rgba(201,168,76,0.4)"}
                onBlur={e=>e.target.style.borderColor="rgba(247,244,238,0.1)"} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={labelBase} htmlFor="signup-confirm">Confirm Password</label>
              <input id="signup-confirm" type="password" placeholder="Re-enter your password" value={signupConfirm}
                onChange={e=>setSignupConfirm(e.target.value)} style={{
                  ...inputBase,
                  borderColor: signupConfirm && signupConfirm !== signupPassword
                    ? "rgba(216,90,48,0.5)"
                    : signupConfirm && signupConfirm === signupPassword
                    ? "rgba(29,158,117,0.5)"
                    : "rgba(247,244,238,0.1)"
                }}
                onFocus={e=>e.target.style.borderColor="rgba(201,168,76,0.4)"}
                onBlur={e=>e.target.style.borderColor=signupConfirm && signupConfirm !== signupPassword ? "rgba(216,90,48,0.5)" : signupConfirm && signupConfirm === signupPassword ? "rgba(29,158,117,0.5)" : "rgba(247,244,238,0.1)"} />
            </div>
            {signupError && (
              <div style={{ fontSize:T.size.small, color:T.coral, marginBottom:14, padding:"10px 14px", background:"rgba(216,90,48,0.06)", borderLeft:`2px solid rgba(216,90,48,0.6)`, borderRadius:`0 ${T.radius.chip}px ${T.radius.chip}px 0`, fontFamily:T.font.body }}>
                {signupError}
              </div>
            )}
            <button onClick={handleSignup} disabled={signupLoading}
              style={{ ...pillBtn(signupLoading ? "disabled" : "primary"), width:"100%", padding:"16px" }}
              onMouseEnter={e=>{ if(!signupLoading) e.currentTarget.style.background="#E2C97E"; }}
              onMouseLeave={e=>{ if(!signupLoading) e.currentTarget.style.background=T.gold; }}>
              {signupLoading ? "CREATING YOUR ACCOUNT..." : "CONFIRM EMAIL & UNLOCK REPORT"}
            </button>
            <p style={{ fontSize:T.size.caption, color:T.text.ghost, lineHeight:1.7, marginTop:12, fontFamily:T.font.body }}>
              Your AI report generates only after email confirmation — this ensures it reaches the right inbox.
            </p>
          </div>
        )}
        <div style={{ marginTop:24, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <PageNumber current={pageNum} total={TOTAL + 2} />
          <button onClick={() => setRetakeModal("confirm")}
            style={{ ...pillBtn("ghost"), padding:"13px 24px", fontSize:T.size.caption }}>
            RETAKE ASSESSMENT
          </button>
        </div>
      </div>
      <div style={{ textAlign:"center", padding:"24px", fontSize:T.size.caption, color:T.text.ghost, letterSpacing:"0.1em", fontFamily:T.font.body }}>
        VALU INDEX v4.0 · PRIME FRAMEWORK · © 2026
      </div>
      <RetakeModal mode={retakeModal} onClose={() => setRetakeModal(null)} onConfirm={onRetake} expiryDateFormatted={null} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN: REPORT
// ════════════════════════════════════════════════════════════════════════════
function ReportScreen({ name, role, results, confirmedEmail, onRetake, initialReportText }) {
  const [reportText, setReportText]           = useState(initialReportText || "");
  const [reportStatus, setReportStatus]       = useState(initialReportText ? "complete" : "idle");
  const [reportError, setReportError]         = useState(null);
  const [saveReportError, setSaveReportError] = useState(null);
  const [emailStatus, setEmailStatus]         = useState("idle");
  const [retakeModal, setRetakeModal]         = useState(null);
  const reportRef  = useRef(null);
  const abortRef   = useRef(null);
  const bufferRef  = useRef("");
  const flushTimer = useRef(null);

  const { valuIndex, clusterScores, skillScores, desig, futureReadyScore, listed } = results;

  useEffect(() => {
    if (initialReportText) return;
    generateAIReport();
    return () => {
      abortRef.current?.abort();
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, []);

  async function persistWithReport(fullText) {
    const fp = computeFingerprint(name, role);
    await updateAssessmentByFingerprint(fp, {
      ai_report: fullText,
      ...(confirmedEmail ? { email: confirmedEmail } : {}),
    });
  }

  async function emailFullReport(fullText) {
    if (!confirmedEmail) return;
    setEmailStatus("sending");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: confirmedEmail,
          identity_hash: computeFingerprint(name, role),
          reportText: fullText,
        }),
      });
      setEmailStatus(res.ok ? "sent" : "failed");
    } catch {
      setEmailStatus("failed");
    }
  }

  async function generateAIReport() {
    setReportStatus("generating");
    setReportText("");
    bufferRef.current = "";
    const controller = new AbortController();
    abortRef.current = controller;

    flushTimer.current = setInterval(() => {
      if (bufferRef.current) {
        setReportText(prev => {
          const next = prev + bufferRef.current;
          bufferRef.current = "";
          return next;
        });
        if (reportRef.current) reportRef.current.scrollTop = reportRef.current.scrollHeight;
      }
    }, 80);

    try {
      const scoreProfile = { name, role, ...results };
      const fingerprint = computeFingerprint(name, role);
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildReportPrompt(scoreProfile), identity_hash: fingerprint }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "API request failed");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split("\n");
        streamBuffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              fullText += parsed.delta.text;
              bufferRef.current += parsed.delta.text;
            }
          } catch {}
        }
      }
      clearInterval(flushTimer.current);
      flushTimer.current = null;
      setReportText(fullText);
      setReportStatus("complete");
      persistWithReport(fullText).catch(err => setSaveReportError(err.message));
      await emailFullReport(fullText);
      clearPendingReport();
    } catch (err) {
      clearInterval(flushTimer.current);
      flushTimer.current = null;
      if (err.name === "AbortError") return;
      console.error("Report generation failed:", err);
      setReportError(err.message);
      setReportStatus("error");
    }
  }

  function renderReport(text) {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return (
        <div key={i} style={{ marginTop:32, marginBottom:12 }}>
          <div style={{ fontSize:T.size.caption, color:T.gold, letterSpacing:"0.2em", marginBottom:6, fontFamily:T.font.label }}>
            {line.replace("## ", "").toUpperCase()}
          </div>
          <div style={{ height:1, background:"rgba(201,168,76,0.15)" }} />
        </div>
      );
      if (line.startsWith("*") && line.endsWith("*") && line.length > 2) return (
        <div key={i} style={{ padding:"20px 24px", background:"rgba(201,168,76,0.05)", borderLeft:`3px solid ${T.gold}`, borderRadius:`0 ${T.radius.chip}px ${T.radius.chip}px 0`, margin:"16px 0" }}>
          <p style={{ fontFamily:T.font.display, fontSize:"clamp(15px,2.2vw,20px)", fontWeight:300, color:T.parchment, lineHeight:1.55, margin:0, fontStyle:"italic" }}>
            {line.slice(1,-1)}
          </p>
        </div>
      );
      if (line.trim() && !line.startsWith("#")) {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} style={{ fontSize:T.size.body, color:T.text.secondary, lineHeight:1.85, margin:"0 0 14px", fontFamily:T.font.body }}>
            {parts.map((part, pi) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={pi} style={{color:T.parchment, fontWeight:600}}>{part.slice(2,-2)}</strong>
                : part
            )}
          </p>
        );
      }
      return null;
    });
  }

  const pageNum = TOTAL + 2;

  return (
    <div style={{ minHeight:"100vh", background:T.dark, fontFamily:T.font.body }}>
      <Grain />
      <AmbientGlow color="rgba(216,90,48,0.07)" />
      <ScoreHeader
        name={name} role={role}
        valuIndex={valuIndex} clusterScores={clusterScores}
        skillScores={skillScores} desig={desig}
        futureReadyScore={futureReadyScore}
        sticky={true}
      />
      <div ref={reportRef} style={{ maxWidth:720, margin:"0 auto", padding:"32px 24px 80px" }}>
        {reportStatus === "generating" && (
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28, padding:"14px 18px", background:"rgba(201,168,76,0.06)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:T.radius.chip }}>
            <div style={{ display:"flex", gap:4 }}>
              {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:T.gold, animation:`pulse 1.4s ease-in-out ${i*0.2}s infinite` }}/>)}
            </div>
            <div style={{ fontSize:T.size.small, color:"rgba(201,168,76,0.7)", letterSpacing:"0.08em", fontFamily:T.font.body }}>
              {reportText.length === 0 ? "Analysing your profile..." : "Writing your report..."}
            </div>
          </div>
        )}
        {reportStatus === "error" && (
          <div style={{ padding:"20px 24px", background:"rgba(216,90,48,0.08)", border:"1px solid rgba(216,90,48,0.3)", borderRadius:T.radius.chip, marginBottom:24 }}>
            <div style={{ fontSize:T.size.caption, fontWeight:700, color:T.coral, letterSpacing:"0.1em", marginBottom:8, fontFamily:T.font.label }}>REPORT GENERATION FAILED</div>
            <p style={{ fontSize:T.size.small, color:T.text.tertiary, lineHeight:1.7, marginBottom:12, fontFamily:T.font.body }}>
              {reportError || "An error occurred. Your score has been saved."}
            </p>
            <p style={{ fontSize:T.size.small, color:T.text.muted, lineHeight:1.7, margin:0, fontFamily:T.font.body }}>
              Your VALU Index is <strong style={{color:T.gold}}>{valuIndex}/100</strong> — <strong style={{color:desig.color}}>{desig.name}</strong>. Contact info@valoriainstitute.com for your full report.
            </p>
            <button onClick={generateAIReport} style={{...pillBtn("gold-ghost"), marginTop:16, padding:"11px 24px", fontSize:T.size.caption}}>
              TRY AGAIN
            </button>
          </div>
        )}
        {reportText && <div style={{ lineHeight:1 }}>{renderReport(reportText)}</div>}
        {reportStatus === "generating" && reportText.length > 0 && (
          <span style={{ display:"inline-block", width:2, height:16, background:T.gold, marginLeft:2, animation:"blink 1s step-end infinite", verticalAlign:"text-bottom" }}/>
        )}
        {reportStatus === "complete" && (
          <>
            {saveReportError && (
              <div style={{ marginBottom:16, padding:"12px 16px", background:"rgba(216,90,48,0.08)", border:"1px solid rgba(216,90,48,0.3)", borderRadius:T.radius.chip, fontSize:T.size.small, color:T.coral, fontFamily:T.font.body }}>
                Your report could not be saved to the server: {saveReportError}. Your score is intact. Contact info@valoriainstitute.com if you need this resolved.
              </div>
            )}
            <div style={{ marginTop:32, padding:"20px 24px", background: listed ? "rgba(29,158,117,0.08)" : "rgba(136,136,136,0.08)", border:`1px solid ${listed ? "rgba(29,158,117,0.3)" : "rgba(136,136,136,0.25)"}`, borderRadius:T.radius.chip }}>
              <div style={{ fontSize:T.size.caption, fontWeight:700, color: listed ? "#1D9E75" : "#888888", letterSpacing:"0.12em", marginBottom:8, fontFamily:T.font.label }}>
                {listed ? "LISTED — YOUR PROFILE IS SEARCHABLE" : "NOT YET LISTED — SCORE BELOW 35"}
              </div>
              <p style={{ fontSize:T.size.small, color:T.text.tertiary, lineHeight:1.75, margin:0, fontFamily:T.font.body }}>
                {listed
                  ? `Your VALU Index of ${valuIndex} qualifies you for listing. Complete your profile to become searchable by employers and event organisers.`
                  : `A score of ${valuIndex} does not yet qualify for listing. The minimum is 35. A PRIME Sprint is designed to move your score into the listed range.`}
              </p>
            </div>
            {confirmedEmail && (
              <div style={{ marginTop:14, padding:"14px 18px", background:"rgba(201,168,76,0.05)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:T.radius.chip }}>
                <p style={{ fontSize:T.size.small, color:T.text.tertiary, lineHeight:1.7, margin:0, fontFamily:T.font.body }}>
                  {emailStatus === "sent" && <>A copy of this report was sent to <strong style={{color:T.gold}}>{confirmedEmail}</strong>.</>}
                  {emailStatus === "sending" && "Sending your report and welcome email..."}
                  {emailStatus === "failed" && <>The report could not be emailed. Contact <span style={{color:T.gold}}>info@valoriainstitute.com</span> for a copy.</>}
                </p>
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:22 }}>
              <a href="https://valoriainstitute.com/profile-page"
                style={{ display:"block", padding:"20px 28px", background:T.gold, borderRadius:T.radius.pill, textAlign:"center", cursor:"pointer", textDecoration:"none" }}
                onMouseEnter={e=>e.currentTarget.style.background="#E2C97E"}
                onMouseLeave={e=>e.currentTarget.style.background=T.gold}>
                <div style={{ fontSize:T.size.small, fontWeight:700, color:T.dark, letterSpacing:"0.16em", marginBottom:3, fontFamily:T.font.body }}>COMPLETE YOUR PROFILE</div>
                <div style={{ fontSize:T.size.small, color:"rgba(26,26,46,0.6)", fontFamily:T.font.body }}>Your account is confirmed — finish your profile on the platform</div>
              </a>
            </div>
          </>
        )}
        <div style={{ marginTop:28, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <PageNumber current={pageNum} total={TOTAL + 2} />
          <button onClick={() => setRetakeModal("confirm")}
            style={{ ...pillBtn("ghost"), padding:"13px 24px", fontSize:T.size.caption }}>
            RETAKE ASSESSMENT
          </button>
        </div>
      </div>
      <div style={{ textAlign:"center", padding:"24px", fontSize:T.size.caption, color:T.text.ghost, letterSpacing:"0.1em", fontFamily:T.font.body }}>
        VALU INDEX v4.0 · PRIME FRAMEWORK · © 2026
      </div>
      <RetakeModal mode={retakeModal} onClose={() => setRetakeModal(null)} onConfirm={onRetake} expiryDateFormatted={null} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT ORCHESTRATOR
// ════════════════════════════════════════════════════════════════════════════
export default function PRIMEAssessment({
  onComplete,
  onAssessmentSubmitted,
  onIdentityChange,
  onPhaseChange,
  assessmentLockRecord,
}) {
  const [phase, setPhase]                   = useState("intro");
  const [sessionData, setSessionData]       = useState(null);
  const [confirmedEmail, setConfirmedEmail] = useState(null);
  const [initialReportText, setInitialReportText] = useState(null);
  const [sessionSeed]                       = useState(() => Math.floor(Math.random() * 99999));

  const assessmentIsLocked = assessmentLockRecord
    ? isLockActive(assessmentLockRecord, assessmentLockRecord.fingerprint)
    : false;

  const lockExpiresAt = assessmentLockRecord?.expiresAt ?? null;
  const expiryDateFormatted = lockExpiresAt
    ? new Date(lockExpiresAt).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })
    : null;

  const checkpoint = loadCheckpoint();

  function goToPhase(p) {
    setPhase(p);
    if (onPhaseChange) onPhaseChange(p);
  }

  useEffect(() => {
    const auth = parseAuthHash();
    if (!auth) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (auth.error) return;
    const email = auth.email;
    const pending = getPendingReport();
    if (pending?.results) {
      setSessionData({ name: pending.name, role: pending.role, results: pending.results });
      setConfirmedEmail(email || pending.email);
      goToPhase("report");
    } else if (email) {
      fetchAssessmentByEmail(email).then(profile => {
        if (profile) {
          setSessionData({ name: profile.name, role: profile.role, results: profile.results });
          setConfirmedEmail(email);
          goToPhase("report");
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!onIdentityChange || !sessionData) return;
    const t = setTimeout(() => onIdentityChange(sessionData.name, sessionData.role), 400);
    return () => clearTimeout(t);
  }, [sessionData?.name, sessionData?.role]);

  function handleBegin({ name, role, resume, previousProfile }) {
    if (previousProfile) {
      setSessionData({ name: previousProfile.name, role: previousProfile.role, results: previousProfile.results });
      setInitialReportText(previousProfile.aiReport || null);
      goToPhase("report");
      return;
    }
    if (resume && checkpoint) {
      setSessionData({ name: checkpoint.name, role: checkpoint.role, results: null, shuffleMap: {} });
      goToPhase("assessing");
    } else {
      setSessionData({ name, role, results: null, shuffleMap: {} });
      goToPhase("assessing");
    }
  }

  function handleAssessmentComplete({ name, role, results, shuffleMap, answers, timings }) {
    const sd = { name, role, results, shuffleMap, answers, timings };
    setSessionData(sd);
    goToPhase("results");
    if (onAssessmentSubmitted) onAssessmentSubmitted({ name, role, completedAt: new Date().toISOString(), ...results });
  }

  function handleRetake() {
    clearCheckpoint();
    clearPendingReport();
    setSessionData(null);
    setConfirmedEmail(null);
    setInitialReportText(null);
    goToPhase("intro");
  }

  if (phase === "intro") {
    return (
      <IntroScreen
        onBegin={handleBegin}
        assessmentIsLocked={assessmentIsLocked}
        expiryDateFormatted={expiryDateFormatted}
        checkpoint={checkpoint}
        lockRecord={assessmentLockRecord}
      />
    );
  }

  if (phase === "assessing") {
    const resuming = !!(checkpoint && checkpoint.currentQ > 0);
    return (
      <AssessmentScreen
        name={resuming ? checkpoint.name : (sessionData?.name || "")}
        role={resuming ? checkpoint.role : (sessionData?.role || "")}
        initialAnswers={resuming ? checkpoint.answers : {}}
        initialTimings={resuming ? checkpoint.timings : Array(TOTAL).fill(0)}
        initialQ={resuming ? checkpoint.currentQ : 0}
        sessionSeed={resuming ? (checkpoint.sessionSeed || sessionSeed) : sessionSeed}
        onComplete={handleAssessmentComplete}
      />
    );
  }

  if (phase === "results" && sessionData?.results) {
    return (
      <ResultsScreen
        name={sessionData.name}
        role={sessionData.role}
        results={sessionData.results}
        shuffleMap={sessionData.shuffleMap}
        answers={sessionData.answers}
        timings={sessionData.timings}
        onRetake={handleRetake}
        onSignupDone={(email) => setConfirmedEmail(email)}
      />
    );
  }

  if (phase === "report" && sessionData?.results) {
    return (
      <ReportScreen
        name={sessionData.name}
        role={sessionData.role}
        results={sessionData.results}
        confirmedEmail={confirmedEmail}
        onRetake={handleRetake}
        initialReportText={initialReportText}
      />
    );
  }

  return null;
}
