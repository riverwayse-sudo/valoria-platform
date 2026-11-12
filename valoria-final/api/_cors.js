// Shared CORS policy for public assessment endpoints.
//
// The VALU assessment UI is served from assessment.valoriainstitute.com and,
// during migration, proxied under valoriainstitute.com/valu/assessment/. Both
// surfaces call the API at the assessment deployment root, so those POSTs are
// cross-origin and require an explicit preflight response. Without it the
// browser blocks every taster request with a CORS error even though the handler
// itself would have succeeded.
const ALLOWED_ORIGINS = new Set([
  'https://valoriainstitute.com',
  'https://www.valoriainstitute.com',
  'https://assessment.valoriainstitute.com',
]);

function isAllowedOrigin(origin) {
  return typeof origin === 'string' && ALLOWED_ORIGINS.has(origin);
}

// Applies the CORS headers when the caller origin is allow-listed. Returns true
// when the origin is permitted (including same-origin requests that omit Origin).
function applyCors(req, res) {
  res.setHeader('Vary', 'Origin');
  const origin = req?.headers?.origin;
  if (origin === undefined || origin === null || origin === '') return true;
  if (!isAllowedOrigin(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}

// Completes an OPTIONS preflight. Returns true when the request was a preflight
// (handled or rejected) so the caller can return immediately.
function handlePreflight(req, res) {
  if (req.method !== 'OPTIONS') return false;
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers?.origin !== undefined && res.getHeader('Access-Control-Allow-Origin') === undefined) {
    res.status(403).json({ error: 'Origin not allowed.' });
    return true;
  }
  res.status(204).end();
  return true;
}

// Edge-runtime helpers. Edge handlers return Fetch API Response objects rather
// than using (req, res), so they need a matching shape.
function corsHeaders(origin) {
  if (origin === undefined || origin === null || origin === '') return { Vary: 'Origin' };
  if (!isAllowedOrigin(origin)) return null;
  return {
    Vary: 'Origin',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    'Access-Control-Max-Age': '600',
  };
}

function edgeJson(data, status, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

// Wraps an edge handler so every response carries the correct CORS headers and
// OPTIONS preflights are answered before the handler runs.
function withEdgeCors(handler) {
  return async (req, ...rest) => {
    const headers = corsHeaders(req?.headers?.get?.('origin'));
    if (req?.method === 'OPTIONS') {
      if (headers === null) return edgeJson({ error: 'Origin not allowed.' }, 403);
      return new Response(null, { status: 204, headers: { ...headers, 'Cache-Control': 'no-store' } });
    }
    if (headers === null) return edgeJson({ error: 'Origin not allowed.' }, 403);
    const response = await handler(req, ...rest);
    const merged = new Headers(response.headers);
    for (const [key, value] of Object.entries(headers)) merged.set(key, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
  };
}

export { ALLOWED_ORIGINS, applyCors, handlePreflight, isAllowedOrigin, corsHeaders, withEdgeCors };

