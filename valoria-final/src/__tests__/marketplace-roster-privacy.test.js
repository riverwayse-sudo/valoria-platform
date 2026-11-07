const fs = require('fs')
const path = require('path')

describe('public marketplace roster privacy', () => {
  test('anonymous roster reads are restricted to visible, listed, non-test profiles', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261107090000_restrict_public_marketplace_roster_visibility.sql'),
      'utf8'
    )
    expect(migration).toMatch(/DROP POLICY IF EXISTS marketplace_public_read/i)
    expect(migration).toMatch(/visibility IN \('public', 'marketplace'\)/i)
    expect(migration).toMatch(/listing_status IN \('listed', 'active'\)/i)
    expect(migration).toMatch(/COALESCE\(pp\.is_test, false\) = false/i)
    expect(migration).toMatch(/TO anon, authenticated/i)
    expect(migration).not.toMatch(/registered_only/i)
  })
})
