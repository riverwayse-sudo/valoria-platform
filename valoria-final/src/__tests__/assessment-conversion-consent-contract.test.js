const fs = require('fs')
const path = require('path')

function read(relative) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8')
}

describe('assessment conversion and visibility consent contracts', () => {
  test('the legacy full assessment never exposes question counts', () => {
    const source = read('src/PRIMEAssessment.jsx')
    expect(source).not.toMatch(/55 questions|Questions.{0,20}55/i)
    expect(source).not.toMatch(/of \{TOTAL\}|currentQ \+ 1\} of/)
    expect(source).toContain('VALU INDEX')
    expect(source).toContain('Your saved responses are ready to resume.')
  })

  test('the taster has a clear intro, accessible progress and previous-response review without count labels', () => {
    const source = read('src/VALUIndexV4GateNext.jsx')
    expect(source).toContain("phase==='intro'")
    expect(source).toContain('valu-assessment-intro')
    expect(source).toContain('role="progressbar"')
    expect(source).toContain('aria-label="Taster progress"')
    expect(source).toContain('valu-assessment-back')
    expect(source).toContain("phase==='registration'")
    expect(source).toContain("action:'register'")
    expect(source).toContain('privacy_acknowledged:privacyAcknowledged')
    expect(source).toContain('marketing_consent:marketingConsent')
    expect(source).not.toMatch(/of 9|1 of 9|Question \$\{[^}]+\} of/)
  })

  test('the full assessment uses a percentage progress bar and answer review, not a question counter', () => {
    const source = read('src/FullVALUAssessment.jsx')
    expect(source).toContain('role="progressbar"')
    expect(source).toContain('aria-label="Assessment progress"')
    expect(source).toContain('valu-assessment-back')
    expect(source).toContain('Your responses are saved automatically.')
    expect(source).not.toContain('answeredTotal} /')
  })

  test('the public platform showcase uses the consent-gated homepage RPC and same-tab profile links', () => {
    const source = read('src/VALUIndexV4Gate.jsx')
    expect(source).toContain('get_homepage_professional_previews_v2')
    expect(source).not.toContain("from('professional_profiles')")
    expect(source).not.toContain('target="_blank"')
  })

  test('assessment app and legacy static page are not indexable', () => {
    expect(read('index.html')).toContain('noindex, nofollow')
    const legacy = read('public/Index.html')
    expect(legacy).toContain('noindex, nofollow')
    expect(legacy).toContain('location.replace(destination)')
  })

  test('Marketplace visibility consent is owner-authenticated and records a fixed acknowledgement', () => {
    const migration = read('supabase/migrations/20261107130000_set_marketplace_public_listing_consent_rpc.sql')
    expect(migration).toMatch(/SECURITY DEFINER/i)
    expect(migration).toMatch(/SET search_path = ''/i)
    expect(migration).toContain('auth.uid()')
    expect(migration).toContain("'marketplace_public_listing'")
    expect(migration).toContain("'marketplace-public-listing-v1-2026-11-07'")
    expect(migration).toContain('professional_profile_acknowledgements')
    expect(migration).toContain("visibility = 'public'")
    expect(migration).toContain("visibility = 'registered_only'")
    expect(migration).toMatch(/GRANT EXECUTE[\s\S]*TO authenticated/i)
    expect(migration).not.toMatch(/GRANT EXECUTE[\s\S]*TO anon/i)
  })
})
