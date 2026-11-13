const AUDIENCE = 'valu-taster-start';
const EXPERIENCE_BANDS = new Set(['0-3', '4-8', '9-15', '15+']);
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = globalThis.atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function verifyTasterStartTokenEdge(token, onFailure) {
  const reject = reason => {
    try { if (typeof onFailure === 'function') onFailure(reason); } catch {}
    return null;
  };
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return reject('verifier_secret_unavailable');
  if (typeof token !== 'string' || !token) return reject('token_missing');
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return reject('token_malformed');
  try {
    const key = await globalThis.crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await globalThis.crypto.subtle.verify(
      'HMAC', key, decodeBase64Url(parts[1]), new TextEncoder().encode(parts[0])
    );
    if (!valid) return reject('signature_invalid');
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const now = Math.floor(Date.now() / 1000);
    if (payload?.v !== 1) return reject('token_version_invalid');
    if (payload?.typ !== 'taster_start_session') return reject('token_type_invalid');
    if (payload?.aud !== AUDIENCE) return reject('token_audience_invalid');
    if (typeof payload?.sub !== 'string' || !USER_ID_PATTERN.test(payload.sub)) return reject('token_subject_invalid');
    if (typeof payload?.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return reject('token_email_invalid');
    if (typeof payload?.display_name !== 'string' || !payload.display_name.trim() || payload.display_name.length > 200) return reject('token_name_invalid');
    if (typeof payload?.role !== 'string' || !payload.role.trim() || payload.role.length > 160) return reject('token_role_invalid');
    if (!EXPERIENCE_BANDS.has(payload?.experience)) return reject('token_experience_invalid');
    if (payload?.privacy_acknowledged !== true) return reject('token_privacy_acknowledgement_missing');
    if (!Number.isInteger(payload?.iat) || !Number.isInteger(payload?.exp)) return reject('token_timestamps_invalid');
    if (payload.iat > now + 60 || payload.exp <= now || payload.exp - payload.iat > 4 * 60 * 60) return reject('token_expired_or_ttl_invalid');
    if (typeof payload?.jti !== 'string' || payload.jti.length < 16) return reject('token_id_invalid');
    return payload;
  } catch {
    return reject('token_decode_or_crypto_error');
  }
}
