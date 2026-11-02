import { getValoriaDashboardUrl } from '../lib/valoria-dashboard-origin.js'

describe('Valoria dashboard origin resolution', () => {
  test('Cloudflare production uses the configured canonical dashboard origin', () => {
    expect(getValoriaDashboardUrl({
      VITE_VALU_SITE_ORIGIN: 'https://www.valoriainstitute.com',
    })).toBe('https://www.valoriainstitute.com/login?returnTo=%2Fdashboard')
  })

  test('Cloudflare preview has no production fallback', () => {
    expect(getValoriaDashboardUrl({
      CF_WORKERS_PREVIEW: '1',
      VALU_PREVIEW: '1',
    })).toBeNull()
  })

  test('Cloudflare preview rejects a configured production origin', () => {
    expect(getValoriaDashboardUrl({
      CF_WORKERS_PREVIEW: '1',
      VITE_VALU_SITE_ORIGIN: 'https://www.valoriainstitute.com',
    })).toBeNull()
  })

  test('Vercel production retains the canonical fallback', () => {
    expect(getValoriaDashboardUrl({
      VERCEL_ENV: 'production',
    })).toBe('https://valoriainstitute.com/login?returnTo=%2Fdashboard')
  })
})
