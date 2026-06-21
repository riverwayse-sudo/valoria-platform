// ── BRAND CONSTANTS — single source of truth for all components ───────────
// These are the only approved values per VI-WDS-2026-001.
// Do NOT override these anywhere else in the codebase.
export const BRAND = {
  // Core palette
  DARK:      '#0F0F1A',   // primary background
  MID:       '#1A1A2E',   // secondary surface
  GOLD:      '#C9A84C',   // primary accent — never on linen (#EDE8DC)
  PARCHMENT: '#F7F4EE',   // primary text on dark
  ACCENT:    '#EDE8DC',   // linen — use sparingly, never paired with gold text
  AMBER:     '#BA7517',   // secondary warm — future-ready score, warnings
  BODY:      '#F7F4EE',   // body text on light backgrounds

  // Cluster colours
  CLUSTER: {
    P: '#1D9E75',
    R: '#378ADD',
    I: '#7F77DD',
    M: '#BA7517',
    E: '#D85A30',
  },

  // Typography (loaded in main.jsx)
  FONT_DISPLAY: "'Cormorant Garamond', Georgia, serif",
  FONT_BODY:    "'Raleway', 'DM Sans', sans-serif",
  FONT_UI:      "'Raleway', sans-serif",
  FONT_MONO:    "'DM Mono', monospace",

  // Contact — only approved address
  EMAIL: 'info@valoriainstitute.com',

  // Border radius — full pill only for primary CTAs
  RADIUS_PILL: '9999px',
  RADIUS_CARD: '12px',
  RADIUS_SM:   '8px',
};

// ── LOCK STORAGE ──────────────────────────────────────────────────────────
const LOCK_KEY = 'valu_assessment_lock_v1';

const env = typeof import.meta !== 'undefined' ? import.meta.env : {};
export const SUPABASE_URL =
  env.VITE_SUPABASE_URL || 'https://sbkgpisgkuhbalsxqkdr.supabase.co';
export const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2dwaXNna3VoYmFsc3hxa2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjI2NjEsImV4cCI6MjA5Mzg5ODY2MX0.iRPs_W6O6JkkHyVlH-9XkEgA1HNo8xtaMakoV5kwLEY';

export function computeFingerprint(name, role) {
  const normalized = `${(name || '').trim().toLowerCase()}|${(role || '').trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

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

export function isLockActive(lock, fingerprint) {
  if (!lock?.expiresAt || !lock?.fingerprint || !fingerprint) return false;
  if (lock.fingerprint !== fingerprint) return false;
  return new Date() < new Date(lock.expiresAt);
}

/** Server-side lock: active assessment row for this identity within validity window. */
export async function fetchServerLock(fingerprint) {
  if (!fingerprint) return null;
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
  const fingerprint = computeFingerprint(name, role);
  if (!name?.trim() || !role?.trim()) return null;
  const serverLock = await fetchServerLock(fingerprint);
  if (serverLock && isLockActive(serverLock, fingerprint)) {
    setAssessmentLock(serverLock);
    return serverLock;
  }
  const localLock = getAssessmentLock();
  if (localLock && isLockActive(localLock, fingerprint)) {
    return localLock;
  }
  return null;
}
