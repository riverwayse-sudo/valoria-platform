const fs = require('fs')
const path = require('path')

describe('Marketplace enquiry privacy consent', () => {
  test('enquiries store explicit consent without retroactively consenting existing records', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261107091500_enquiry_privacy_consent.sql'),
      'utf8'
    )
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS privacy_consent boolean NOT NULL DEFAULT false/i)
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz/i)
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS privacy_notice_version text/i)
    expect(migration).not.toMatch(/UPDATE public\.enquiries SET privacy_consent = true/i)
  })
})
