const fs = require('fs')
const path = require('path')

describe('public marketplace roster privacy', () => {
  test('anonymous roster reads exclude private, test and revoked profiles', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261107090000_restrict_public_marketplace_roster_visibility.sql'),
      'utf8'
    )
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.is_marketplace_profile_public/i)
    expect(migration).toMatch(/SECURITY DEFINER/i)
    expect(migration).toMatch(/SET search_path = ''/i)
    expect(migration).toMatch(/visibility IN \('public', 'marketplace'\)/i)
    expect(migration).toMatch(/listing_status = 'listed'/i)
    expect(migration).toMatch(/COALESCE\(pp\.is_test, false\) = false/i)
    expect(migration).toMatch(/pp\.revoked_at IS NULL/i)
    expect(migration).toMatch(/ADMIN_REVOKED.*ADMIN_SUSPENDED/s)
    expect(migration).toMatch(/USING \(public\.is_marketplace_profile_public\(professional_id\)\)/i)
    expect(migration).toMatch(/TO anon, authenticated/i)
    const executableSql = migration.replace(/^\s*--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(executableSql).not.toMatch(/registered_only/i)
  })
})


describe('public roster eligibility and revocation boundary', () => {
  test('final private predicate preserves Basic taster and gates Full listings', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261107113000_harden_public_roster_eligibility_and_revocation_gates.sql'),
      'utf8'
    )
    expect(migration).toMatch(/private\.is_marketplace_profile_public/i)
    expect(migration).toMatch(/visibility IN \('public', 'marketplace'\)/i)
    expect(migration).toMatch(/private\.is_professional_listing_blocked\(pp\.id\)/i)
    expect(migration).toMatch(/roster\.assessment_access = 'basic'/i)
    expect(migration).toMatch(/taster_sessions AS t[\s\S]*t\.completed_at IS NOT NULL/i)
    expect(migration).toMatch(/roster\.assessment_access = 'full'/i)
    expect(migration).toMatch(/pp\.profile_complete IS TRUE/i)
    expect(migration).toMatch(/private\.valu_assessment_is_current\(pp\.id\)/i)
    expect(migration).toMatch(/capability\.eligible_for_listing IS TRUE/i)
    expect(migration).toMatch(/capability\.eligibility_status = 'listed'/i)
  })
})
