import { createHmac, timingSafeEqual } from 'node:crypto'

const AUDIENCE = 'valu-full-assessment'

export function verifyValuHandoffToken(token, expectedTasterId) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || typeof token !== 'string' || !expectedTasterId) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  try {
    const expected = createHmac('sha256', secret).update(parts[0]).digest()
    const supplied = Buffer.from(parts[1], 'base64url')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null

    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
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
