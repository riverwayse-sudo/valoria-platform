const AUDIENCE = 'valu-full-assessment';
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function decodeBase64Url(value) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new TypeError('Invalid base64url input');
  }

  const output = new Uint8Array(Math.floor(value.length * 6 / 8));
  let accumulator = 0;
  let bits = 0;
  let offset = 0;

  for (let index = 0; index < value.length; index += 1) {
    const digit = BASE64URL.indexOf(value[index]);
    if (digit < 0) throw new TypeError('Invalid base64url character');
    accumulator = (accumulator << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[offset] = (accumulator >> bits) & 0xff;
      offset += 1;
      accumulator &= (1 << bits) - 1;
    }
  }

  // Base64url encoders must leave unused trailing bits clear.
  if (accumulator !== 0 || offset !== output.length) throw new TypeError('Non-canonical base64url input');
  return output;
}

export async function verifyValuHandoffTokenEdge(token, expectedTasterId, onFailure) {
  const reject = reason => {
    try {
      if (typeof onFailure === 'function') onFailure(reason);
    } catch {}
    return null;
  };

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return reject('verifier_secret_unavailable');
  if (typeof token !== 'string' || !token) return reject('token_missing');
  if (!expectedTasterId) return reject('snapshot_reference_missing');

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return reject('token_malformed');

  let signature;
  let payloadBytes;
  try {
    payloadBytes = decodeBase64Url(parts[0]);
    signature = decodeBase64Url(parts[1]);
    if (signature.length !== 32) return reject('signature_length_invalid');
  } catch {
    return reject('token_encoding_invalid');
  }

  let valid;
  try {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.subtle) return reject('webcrypto_unavailable');
    const key = await cryptoApi.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    valid = await cryptoApi.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(parts[0])
    );
  } catch (error) {
    // Keep diagnostics useful without logging secrets, token contents, or identity data.
    return reject(error?.name === 'NotSupportedError' ? 'webcrypto_algorithm_unsupported' : 'webcrypto_verification_error');
  }
  if (!valid) return reject('signature_invalid');

  let payload;
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes));
  } catch {
    return reject('payload_invalid');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload?.v !== 1) return reject('token_version_invalid');
  if (payload?.typ !== 'assessment_session') return reject('token_type_invalid');
  if (payload?.aud !== AUDIENCE) return reject('token_audience_invalid');
  if (typeof payload?.sub !== 'string' || !payload.sub) return reject('token_subject_invalid');
  if (payload?.taster_id !== expectedTasterId) return reject('snapshot_mismatch');
  if (!Number.isInteger(payload?.iat) || !Number.isInteger(payload?.exp)) return reject('token_timestamps_invalid');
  if (payload.iat > now + 60) return reject('token_issued_in_future');
  if (payload.exp <= now) return reject('token_expired');
  if (payload.exp - payload.iat > 4 * 60 * 60) return reject('token_ttl_invalid');
  if (typeof payload?.jti !== 'string' || payload.jti.length < 16) return reject('token_id_invalid');
  return payload;
}
