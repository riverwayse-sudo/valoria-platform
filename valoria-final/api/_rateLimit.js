const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getHeader(req, name) {
  if (req?.headers?.get) return req.headers.get(name) || '';
  return req?.headers?.[name] || req?.headers?.[name.toLowerCase()] || '';
}

function getClientIp(req) {
  const forwarded = getHeader(req, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 100);
  return getHeader(req, 'x-real-ip').trim().slice(0, 100) || 'unknown';
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

async function consume(namespace, limit, windowSeconds, subject) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('rate-limit configuration missing');
  const rateKey = `v1:${namespace}:${hashKeyPart(subject)}`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_rate_limit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ p_rate_key: rateKey, p_limit: limit, p_window_seconds: windowSeconds }),
  });
  if (!response.ok) throw new Error(`rate-limit RPC failed: ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function enforceRateLimit(req, res, { namespace, limit, windowSeconds, subject }) {
  try {
    const result = await consume(namespace, limit, windowSeconds, subject || getClientIp(req));
    if (!result?.allowed) {
      const retryAfter = Math.max(1, Number(result?.retry_after_seconds || windowSeconds));
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('Cache-Control', 'no-store');
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return false;
    }
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, Number(result?.remaining || 0))));
    return true;
  } catch (error) {
    console.error('rate-limit:', error.message);
    res.status(503).json({ error: 'Request protection is temporarily unavailable.' });
    return false;
  }
}

export async function checkRateLimit(req, { namespace, limit, windowSeconds, subject }) {
  try {
    const result = await consume(namespace, limit, windowSeconds, subject || getClientIp(req));
    if (result?.allowed) return { allowed: true, remaining: Number(result.remaining || 0) };
    const retryAfter = Math.max(1, Number(result?.retry_after_seconds || windowSeconds));
    return { allowed: false, response: new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) },
    }) };
  } catch (error) {
    console.error('rate-limit:', error.message);
    return { allowed: false, response: new Response(JSON.stringify({ error: 'Request protection is temporarily unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }) };
  }
}

export { getClientIp };
