const LOCK_KEY = 'valu_assessment_lock_v1';
const env = typeof import.meta !== 'undefined' ? import.meta.env : {};

export const SUPABASE_URL = env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

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

export async function fetchServerLock(fingerprint) {
  if (!fingerprint || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const now = new Date().toISOString();
    const params = new URLSearchParams({
      identity_hash: `eq.${fingerprint}`,
      expires_at: `gt.${now}`,          // ← fixed: was assessment_expires_at
      select: 'expires_at,completed_at,total_score,designation',
      order: 'completed_at.desc',
      limit: '1',
    });
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/valu_assessments?${params}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length) return null;
    return {
      fingerprint,
      expiresAt: rows[0].expires_at,     // ← fixed: was assessment_expires_at
      completedAt: rows[0].completed_at,
      totalScore: rows[0].total_score,
      designation: rows[0].designation,
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
