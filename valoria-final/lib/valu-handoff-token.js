import { createHmac, timingSafeEqual } from 'node:crypto'

const AUDIENCE = 'valu-full-assessment'

function decodeBase64UrlStrict(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  const decoded = Buffer.from(value, 'base64url')
  return decoded.toString('base64url') === value ? decoded : null
}

export function verifyValuHandoffToken(token, expectedTasterId) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || typeof token !== 'string' || !expectedTasterId) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  try {
    const payloadBytes = decodeBase64UrlStrict(parts[0])
    const supplied = decodeBase64UrlStrict(parts[1])
    if (!payloadBytes || !supplied) return null
    const expected = createHmac('sha256', secret).update(parts[0]).digest()
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null

    const payload = JSON.parse(payloadBytes.toString('utf8'))
    const now = Math.floor(Date.now() / 1000)
    if (payload?.v !== 1
      || payload?.typ !== 'assessment_session'
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
      || payload.jti.length < 16) return null
    return payload
  } catch {
    return null
  }
}
