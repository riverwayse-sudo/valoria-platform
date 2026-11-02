const PRODUCTION_SITE_ORIGIN = 'https://valoriainstitute.com'

export function getValoriaDashboardUrl(env = process.env) {
  const configured = String(env.VALU_SITE_ORIGIN || env.VITE_VALU_SITE_ORIGIN || '').trim()
  const isPreview = env.VERCEL_ENV === 'preview'
    || env.CF_WORKERS_PREVIEW === '1'
    || env.VALU_PREVIEW === '1'
  const origin = configured || (env.VERCEL_ENV === 'production' ? PRODUCTION_SITE_ORIGIN : '')
  if (!origin) return null

  try {
    const url = new URL(origin)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (isPreview && ['valoriainstitute.com', 'www.valoriainstitute.com'].includes(url.hostname)) return null
    return new URL('/login?returnTo=%2Fdashboard', url.origin).toString()
  } catch {
    return null
  }
}
