import { useState, useEffect, useRef, useMemo } from "react";
import {
  computeFingerprint,
  isLockActive,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  BRAND,
} from "./assessmentLock.js";
async function saveToSupabase(data) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase save error:", err);
    }
  } catch(e) {
    console.error("Supabase save failed:", e);
  }
}
// ── SIGNUP / WAITLIST / EMAIL-CONFIRMATION HELPERS ─────────────────────────
const PENDING_REPORT_KEY = "valu_pending_report_v1";

async function signUpWithSupabase(email, password, name, role) {
  const redirectTo = encodeURIComponent(window.location.origin + "/");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup?redirect_to=${redirectTo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password, data: { full_name: name, role } }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.msg || data.error_description || data.error || "Signup failed.");
  }
  return data;
}

async function joinWaitlist({ name, email, role }) {
  try {
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
    if (!res.ok && res.status !== 409) {
      console.error("Waitlist insert failed:", await res.text());
    }
  } catch (e) {
    console.error("Waitlist insert failed:", e);
  }
}

function setPendingReport(payload) {
  try { localStorage.setItem(PENDING_REPORT_KEY, JSON.stringify(payload)); } catch {}
}
function getPendingReport() {
  try {
    const raw = localStorage.getItem(PENDING_REPORT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearPendingReport() {
  try { localStorage.removeItem(PENDING_REPORT_KEY); } catch {}
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

// ── CLUSTER CONFIG ─────────────────────────────────────────────────────────
const CLUSTERS = [
  { id:"P", name:"Presence",      theme:"How you show up",  color:"#1D9E75", weight:0.20, maxRaw:36 },
  { id:"R", name:"Relationships", theme:"How you connect",  color:"#378ADD", weight:0.25, maxRaw:48 },
  { id:"I", name:"Intelligence",  theme:"How you think",    color:"#7F77DD", weight:0.25, maxRaw:60 },
  { id:"M", name:"Mastery",       theme:"How you deliver",  color:"#BA7517", weight:0.20, maxRaw:36 },
  { id:"E", name:"Enterprise",    theme:"How you create",   color:"#D85A30", weight:0.10, maxRaw:36 },
];
const DESIGNATIONS = [
  { min:80, name:"Force to Align With",    color:BRAND.GOLD,      bg:"rgba(201,168,76,0.12)",  desc:"Operating at the highest expression of professional capability. You are recognised on the platform as a priority professional." },
  { min:65, name:"Emerging Force",         color:"#378ADD", bg:"rgba(55,138,221,0.10)",  desc:"Strong foundations with clear areas of excellence. You are on the trajectory — deliberate development will complete the picture." },
  { min:50, name:"Developing Professional",color:"#1D9E75", bg:"rgba(29,158,117,0.10)",  desc:"Genuine capability with uneven development. Your PRIME pathway is shown on your profile." },
  { min:35, name:"Building Foundations",   color:"#BA7517", bg:"rgba(186,117,23,0.10)",  desc:"Early-stage professional architecture. A PRIME Sprint is your recommended next step." },
  { min:0,  name:"At the Starting Point",  color:"#888888", bg:"rgba(136,136,136,0.10)", desc:"Not yet listed on the candidate platform. Complete a PRIME Sprint to qualify for listing." },
];
