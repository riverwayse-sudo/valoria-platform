const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim().slice(0, 100);
  const realIp = req.headers?.['x-real-ip'] || req.headers?.['X-Real-IP'];
  return typeof realIp === 'string' ? realIp.trim().slice(0, 100) : 'unknown';
}

function hashKeyPart(value) {
  const input = String(value || 'unknown');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export async function enforceRateLimit(req, res, { namespace, limit, windowSeconds, subject }) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('rate-limit: missing Supabase server configuration');
    res.status(500).json({ error: 'Server misconfigured.' });
    return false;
  }

  const subjectValue = subject || getClientIp(req);
  const rateKey = `v1:${namespace}:${hashKeyPart(subjectValue)}`;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ p_rate_key: rateKey, p_limit: limit, p_window_seconds: windowSeconds }),
    });

    if (!response.ok) {
      console.error('rate-limit: RPC failed', response.status);
      res.status(503).json({ error: 'Request protection is temporarily unavailable.' });
      return false;
    }

    const rows = await response.json();
    const result = Array.isArray(rows) ? rows[0] : rows;
    if (!result?.allowed) {
      const retryAfter = Math.max(1, Number(result?.retry_after_seconds || windowSeconds));
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('Cache-Control', 'no-store');
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return false;
    }

    if (Number.isFinite(Number(result?.remaining))) {
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, Number(result.remaining))));
    }
    return true;
  } catch (error) {
    console.error('rate-limit: request failed', error);
    res.status(503).json({ error: 'Request protection is temporarily unavailable.' });
    return false;
  }
}

export { getClientIp };
