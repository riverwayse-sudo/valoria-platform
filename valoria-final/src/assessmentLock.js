// ── BRAND CONSTANTS — single source of truth for all components ───────────
// These are the only approved values per VI-WDS-2026-001.
// Do NOT override these anywhere else in the codebase.
export const BRAND = {
  DARK:      '#0F0F1A',
  MID:       '#1A1A2E',
  GOLD:      '#C9A84C',
  PARCHMENT: '#F7F4EE',
  ACCENT:    '#EDE8DC',
  AMBER:     '#BA7517',
  BODY:      '#F7F4EE',
  CLUSTER: {
    P: '#1D9E75',
    R: '#378ADD',
    I: '#7F77DD',
    M: '#BA7517',
    E: '#D85A30',
  },
  FONT_DISPLAY: "'Raleway', sans-serif",
  FONT_BODY:    "'Raleway', 'DM Sans', sans-serif",
  FONT_UI:      "'Raleway', sans-serif",
  FONT_MONO:    "'DM Mono', monospace",
  EMAIL: 'info@valoriainstitute.com',
  RADIUS_PILL: '9999px',
  RADIUS_CARD: '12px',
  RADIUS_SM:   '8px',
};

// ── LOCK ENGINE — single source of truth ───────────────────────────────────
export { computeFingerprint, isLockActive, buildLockRecord } from './lockEngine.js';
import { isLockActive as _isLockActive, computeFingerprint as _computeFingerprint } from './lockEngine.js';

// ── LOCK STORAGE ──────────────────────────────────────────────────────────
const LOCK_KEY = 'valu_assessment_lock_v1';

const env = typeof import.meta !== 'undefined' ? import.meta.env : {};
// Never ship a project URL/key fallback. These values are configuration, not
// source-code constants. A missing value must fail closed instead of silently
// connecting the client to an unintended Supabase project.
export const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';

export function getAssessmentLock() {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.fingerprint || !parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAssessmentLock({ fingerprint, expiresAt, completedAt }) {
  localStorage.setItem(
    LOCK_KEY,
    JSON.stringify({ fingerprint, expiresAt, completedAt })
  );
}

/** Server-side lock: active assessment row for this identity within validity window. */
export async function fetchServerLock(fingerprint) {
  if (!fingerprint || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const now = new Date().toISOString();
    const params = new URLSearchParams({
      identity_hash: `eq.${fingerprint}`,
      expires_at: `gt.${now}`,
      select: 'expires_at,completed_at',
      order: 'completed_at.desc',
      limit: '1',
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments?${params}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length) return null;
    return {
      fingerprint,
      expiresAt: rows[0].expires_at,
      completedAt: rows[0].completed_at,
    };
  } catch {
    return null;
  }
}

export async function resolveLockForIdentity(name, role) {
  if (!name?.trim() || !role?.trim()) return null;
  const fingerprint = _computeFingerprint(name, role);
  const serverLock = await fetchServerLock(fingerprint);
  if (serverLock && _isLockActive(serverLock, fingerprint)) {
    setAssessmentLock(serverLock);
    return serverLock;
  }
  const localLock = getAssessmentLock();
  if (localLock && _isLockActive(localLock, fingerprint)) {
    return localLock;
  }
  return null;
}
