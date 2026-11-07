const fs = require('fs')
const path = require('path')

describe('public marketplace roster privacy', () => {
  test('anonymous roster reads are restricted to visible, listed, non-test profiles', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261107090000_restrict_public_marketplace_roster_visibility.sql'),
      'utf8'
    )
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.is_marketplace_profile_public/i)
    expect(migration).toMatch(/SECURITY DEFINER/i)
    expect(migration).toMatch(/SET search_path = ''/i)
    expect(migration).toMatch(/visibility IN \('public', 'marketplace'\)/i)
    expect(migration).toMatch(/listing_status IN \('listed', 'active'\)/i)
    expect(migration).toMatch(/COALESCE\(pp\.is_test, false\) = false/i)
    expect(migration).toMatch(/USING \(public\.is_marketplace_profile_public\(professional_id\)\)/i)
    expect(migration).toMatch(/TO anon, authenticated/i)
    expect(migration).not.toMatch(/registered_only/i)
  })
})
