const fs = require('fs')
const path = require('path')

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20261107230000_multi_model_data_foundation.sql'),
  'utf8'
)
const architecture = fs.readFileSync(
  path.join(process.cwd(), 'docs/MULTI_MODEL_DATA_ARCHITECTURE.md'),
  'utf8'
)

describe('multi-model data foundation', () => {
  test('uses private Postgres key-value and graph structures', () => {
    expect(migration).toContain('create table if not exists private.platform_kv')
    expect(migration).toContain('create table if not exists private.professional_relationships')
    expect(migration).toContain('private.traverse_professional_network')
  })

  test('keeps new structures inaccessible to public API roles', () => {
    expect(migration).toContain('alter table private.platform_kv enable row level security')
    expect(migration).toContain('alter table private.professional_relationships enable row level security')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('to service_role')
  })

  test('documents existing JSONB, Storage and pgvector capabilities without a new paid database', () => {
    expect(architecture).toContain('pgvector')
    expect(architecture).toContain('Supabase Storage')
    expect(architecture).toContain('No separate wide-column, key-value, graph or vector database is provisioned.')
    expect(architecture).toContain('the table is currently empty')
  })
})
