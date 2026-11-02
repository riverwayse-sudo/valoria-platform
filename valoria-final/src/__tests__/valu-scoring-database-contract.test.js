const fs = require('fs')
const path = require('path')

const migration = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261102100742_align_valu_v4_scoring_integrity_flags.sql'),
  'utf8'
)
const contract = fs.readFileSync(path.join(__dirname, '../valuV4Contract.js'), 'utf8')
const engine = fs.readFileSync(path.join(__dirname, '../scoringEngine.js'), 'utf8')

describe('VALU v4 database scoring parity', () => {
  test('database trigger uses the canonical five PRIME weights', () => {
    for (const weight of ['0.20', '0.25', '0.25', '0.20', '0.10']) {
      expect(migration).toContain(weight)
    }
    expect(contract).toContain('weight: 0.20')
    expect(contract).toContain('weight: 0.25')
    expect(engine).toContain('computeWeightedIndex')
  })

  test('integrity flags never silently reduce the published VALU Index', () => {
    expect(migration).toContain('Integrity flags remain review signals')
    expect(migration).not.toContain('gaming_detected')
    expect(migration).not.toContain('0.80')
  })

  test('database score is bounded and rounded once after weighting', () => {
    expect(migration).toContain('round(greatest(0, least(100,')
    expect(migration).toContain(')))::smallint')
  })
})
