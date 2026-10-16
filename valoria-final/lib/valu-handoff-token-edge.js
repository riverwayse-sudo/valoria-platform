const AUDIENCE = 'valu-full-assessment';

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = globalThis.atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function verifyValuHandoffTokenEdge(token, expectedTasterId) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || typeof token !== 'string' || !expectedTasterId) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  try {
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(parts[1]),
      new TextEncoder().encode(parts[0])
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const now = Math.floor(Date.now() / 1000);
    if (payload?.v !== 1
      || payload?.aud !== AUDIENCE
      || typeof payload?.sub !== 'string'
      || !payload.sub
      || payload?.taster_id !== expectedTasterId
      || !Number.isInteger(payload?.iat)
      || !Number.isInteger(payload?.exp)
      || payload.iat > now + 60
      || payload.exp <= now
      || payload.exp - payload.iat > 4 * 60 * 60
      || typeof payload?.jti !== 'string'
      || payload.jti.length < 16) return null;
    return payload;
  } catch {
    return null;
  }
}
