#!/usr/bin/env node
// Executes supabase/migrations/20261023130000_unique_full_assessment_per_snapshot.sql
// against a real PostgreSQL engine and asserts the guarantees the retry
// requirement depends on.
//
// WHY THIS IS NOT A JEST SUITE
// The repo's Jest suites are static. Proving this migration works needs a real
// SQL engine, and the only one installable without root here is PGlite
// (PostgreSQL compiled to WASM). Adding a WASM database to devDependencies for
// one migration is not a trade worth making in a remediation PR, so this script
// provisions PGlite on demand with `--no-save` into its own directory and leaves
// package.json untouched.
//
//   node scripts/verify-assessment-dedup-migration.mjs
//
// Exits 0 on success, 1 on any failed assertion.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const MIGRATION = 'supabase/migrations/20261023130000_unique_full_assessment_per_snapshot.sql'
const root = process.cwd()
const CACHE_DIR = path.join(root, '.pglite-verify')
const ENTRY = path.join(CACHE_DIR, 'node_modules', '@electric-sql', 'pglite', 'dist', 'index.js')

async function loadPGlite() {
  if (!fs.existsSync(ENTRY)) {
    console.log('PGlite not present; provisioning into .pglite-verify (package.json is not modified)...')
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    execFileSync(
      'npm',
      ['install', '--no-save', '--no-audit', '--no-fund', '--prefix', CACHE_DIR, '@electric-sql/pglite'],
      { cwd: root, stdio: 'inherit' }
    )
  }
  if (!fs.existsSync(ENTRY)) throw new Error(`PGlite installed but its entry point is missing at ${ENTRY}`)
  const mod = await import(pathToFileURL(ENTRY).href)
  return mod.PGlite || mod.default?.PGlite
}

const results = []
function check(label, ok, detail = '') {
  results.push({ label, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const TASTER_A = '11111111-1111-4111-8111-111111111111'
const TASTER_B = '33333333-3333-4333-8333-333333333333'
const USER = '22222222-2222-4222-8222-222222222222'

// A faithful stand-in for public.valu_assessments covering the columns the
// submission path touches. The table is created by NO tracked migration in
// either repository, so this stands in for the untracked production DDL and
// includes the unique index on report_token that a tracked migration does assert.
const SCHEMA = `
  create table public.valu_assessments (
    id uuid primary key default gen_random_uuid(),
    name text, role text, identity_hash text, total_score integer, designation text,
    completed_at timestamptz, taster_id uuid, user_id uuid, report_token text not null
  );
  create unique index valu_assessments_report_token_uidx on public.valu_assessments (report_token);
`

const insert = (db, { tasterId = TASTER_A, identityHash = 'fp-1', token }) => db.query(`
  insert into public.valu_assessments
    (name, role, identity_hash, total_score, designation, completed_at, taster_id, user_id, report_token)
  values ('Ada', 'Engineer', $1, 61, 'Proficient', now(), $2, $3, $4)
`, [identityHash, tasterId, USER, token])

const PGlite = await loadPGlite()
const sql = fs.readFileSync(path.join(root, MIGRATION), 'utf8')

console.log('\n1. the migration applies to a clean database')
let db = new PGlite()
await db.exec(SCHEMA)
let applied = true
try {
  await db.exec(sql)
} catch (err) {
  applied = false
  check('migration applies', false, err.message)
}
if (applied) check('migration applies', true)

const idx = await db.query(`select indexdef from pg_indexes where indexname = 'valu_assessments_taster_identity_uidx'`)
check('the unique index exists', idx.rows.length === 1)
check(
  'the index is unique on (taster_id, identity_hash)',
  /CREATE UNIQUE INDEX/i.test(idx.rows[0]?.indexdef || '') &&
    /taster_id/.test(idx.rows[0]?.indexdef || '') &&
    /identity_hash/.test(idx.rows[0]?.indexdef || '')
)

console.log('\n2. a duplicate assessment is now impossible')
await insert(db, { token: '11111111-1111-4111-8111-aaaaaaaaaaaa' })
let rejected = false
let code = null
try {
  // The exact race the application-level lookup cannot prevent: both retries
  // saw no existing row, so both reach the insert. Distinct report tokens, so
  // the report_token unique index does not stop this.
  await insert(db, { token: '11111111-1111-4111-8111-bbbbbbbbbbbb' })
} catch (err) {
  rejected = true
  code = err.code
}
check('the second submission for the same snapshot and identity is rejected', rejected)
check('the rejection is 23505, which PostgREST reports as HTTP 409', code === '23505', String(code))
const count = await db.query(`select count(*)::int as n from public.valu_assessments`)
check('exactly one row remains', count.rows[0].n === 1, `${count.rows[0].n} rows`)

console.log('\n3. legitimate distinct submissions are still allowed')
let distinctTasterOk = true
try {
  await insert(db, { tasterId: TASTER_B, token: '11111111-1111-4111-8111-dddddddddddd' })
} catch (err) {
  distinctTasterOk = false
  check('a different snapshot may hold its own assessment', false, err.message)
}
if (distinctTasterOk) check('a different snapshot may hold its own assessment', true)

let distinctIdentityOk = true
try {
  await insert(db, { identityHash: 'fp-2', token: '11111111-1111-4111-8111-eeeeeeeeeeee' })
} catch (err) {
  distinctIdentityOk = false
  check('a different identity may hold its own assessment', false, err.message)
}
if (distinctIdentityOk) check('a different identity may hold its own assessment', true)

console.log('\n4. legacy rows without a snapshot are not constrained against each other')
// Historical rows may predate snapshot linking. The index is partial so these
// do not collide with one another and cannot block the migration.
let legacyOk = true
for (const token of ['11111111-1111-4111-8111-ffffffffffff', '11111111-1111-4111-8111-000000000000']) {
  try {
    await db.query(
      `insert into public.valu_assessments (name, role, identity_hash, total_score, completed_at, taster_id, user_id, report_token)
       values ('Legacy', 'Engineer', null, 50, now(), null, $1, $2)`,
      [USER, token]
    )
  } catch (err) {
    legacyOk = false
    check('two unlinked legacy rows can coexist', false, err.message)
    break
  }
}
if (legacyOk) check('two unlinked legacy rows can coexist', true)

console.log('\n5. an already-dirty database is reported, not failed opaquely')
// If duplicates exist the index cannot be built. The migration must say which
// rows are the problem so an operator can reconcile them, rather than emitting
// "could not create unique index".
db = new PGlite()
await db.exec(SCHEMA)
await insert(db, { token: '11111111-1111-4111-8111-aaaaaaaaaaaa' })
await insert(db, { token: '11111111-1111-4111-8111-bbbbbbbbbbbb' })
let blocked = false
let message = ''
try {
  await db.exec(sql)
} catch (err) {
  blocked = true
  message = err.message
}
check('the migration refuses to run over existing duplicates', blocked)
check('it names the duplicate group', /duplicate \(taster_id, identity_hash\)/i.test(message))
check('it identifies the offending pair', /fp-1/.test(message))
check('it gives a reconciliation instruction', /reconcile/i.test(message))
const untouched = await db.query(`select count(*)::int as n from public.valu_assessments`)
check('the failed migration changed no data', untouched.rows[0].n === 2, `${untouched.rows[0].n} rows`)

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) {
  console.error('Failed checks:', failed.map(f => f.label).join('; '))
  process.exit(1)
}
console.log('All checks passed.')
