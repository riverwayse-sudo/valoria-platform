#!/usr/bin/env node
// Proves the duplicate-submission guarantee under GENUINE CONCURRENCY against a
// real PostgreSQL server with multiple simultaneous connections.
//
// WHY THIS EXISTS SEPARATELY FROM THE PGLITE VERIFIER
// scripts/verify-assessment-dedup-migration.mjs runs PGlite, which is a
// single-connection embedded engine. It can prove the index exists and that a
// *sequential* second insert is rejected. It cannot prove anything about
// concurrency: with one connection, transactions cannot overlap, so the very
// race this fix exists to close cannot be reproduced. This script starts a real
// multi-process PostgreSQL server and drives N separate connections through the
// application's read-then-insert sequence with a barrier between the check and
// the insert, so every connection has completed its existence check before any
// of them commits. That is the race the handler's application-level guard
// cannot close on its own.
//
// Provisioning matches the other verifiers: dependencies are installed with
// `--no-save` into a git-ignored scratch directory, so package.json is not
// modified. The server is started on a private data directory under /tmp and
// shut down on exit.
//
//   node scripts/verify-concurrent-submission.mjs
//
// Exits 0 on success, 1 on any failed assertion.

import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import os from 'node:os'
import { execFileSync, spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const MIGRATION = 'supabase/migrations/20261023130000_unique_full_assessment_per_snapshot.sql'
const root = process.cwd()
const CACHE_DIR = path.join(root, '.pg-verify')
const PG_VERSION = '18.4.0-beta.17'

const results = []
function check(label, ok, detail = '') {
  results.push({ label, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}
function section(title) {
  console.log(`\n${title}`)
}

function npmInstall(...pkgs) {
  execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--prefix', CACHE_DIR, ...pkgs], {
    cwd: root,
    stdio: 'inherit',
  })
}

// Locates the real server binaries, provisioning them if absent.
//
// Both packages are installed in a single npm invocation on purpose: a second
// `npm install --prefix` call prunes the first package's tree, because npm
// treats the scratch directory as a project with its own (empty) manifest.
function resolveBinaries() {
  const pkgDir = path.join(CACHE_DIR, 'node_modules', '@embedded-postgres', 'linux-x64')
  const binDir = path.join(pkgDir, 'native', 'bin')
  const need = ['initdb', 'postgres', 'pg_ctl']
  const pgEntry = path.join(CACHE_DIR, 'node_modules', 'pg', 'lib', 'index.js')
  const missing = need.filter((b) => !fs.existsSync(path.join(binDir, b)))
  if (missing.length || !fs.existsSync(pgEntry)) {
    console.log('Provisioning real PostgreSQL into .pg-verify (package.json is not modified)...')
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    npmInstall(`@embedded-postgres/linux-x64@${PG_VERSION}`, 'pg')
    // `pg` must be installed in the same npm call as the server package.
  }
  for (const b of need) {
    if (!fs.existsSync(path.join(binDir, b))) {
      throw new Error(`PostgreSQL binary missing after install: ${path.join(binDir, b)}`)
    }
  }
  if (!fs.existsSync(pgEntry)) throw new Error(`pg client missing after install: ${pgEntry}`)
  return binDir
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function loadPg() {
  const entry = path.join(CACHE_DIR, 'node_modules', 'pg', 'lib', 'index.js')
  const mod = await import(pathToFileURL(entry).href)
  return mod.default || mod
}

// Faithful stand-in for public.valu_assessments, which is created by NO tracked
// migration in either repository. Includes the report_token unique index the
// live table is known to carry and the report_idempotency_key column, so the
// "a uniqueness error might be a different constraint" question can be tested.
const SCHEMA = `
  create table public.valu_assessments (
    id uuid primary key default gen_random_uuid(),
    name text,
    role text,
    identity_hash text,
    total_score integer,
    designation text,
    completed_at timestamptz,
    taster_id uuid,
    user_id uuid,
    report_token text not null,
    report_idempotency_key text
  );
  create unique index valu_assessments_report_token_uidx on public.valu_assessments (report_token);
  create unique index valu_assessments_report_idempotency_key_uidx
    on public.valu_assessments (report_idempotency_key) where report_idempotency_key is not null;
`

const TASTER_A = '11111111-1111-4111-8111-111111111111'
const TASTER_B = '33333333-3333-4333-8333-333333333333'
const USER = '22222222-2222-4222-8222-222222222222'
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const binDir = resolveBinaries()
const Pg = await loadPg()
const port = await freePort()
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valoria-pg-'))
const logFile = path.join(dataDir, 'server.log')

console.log(`Starting real PostgreSQL (port ${port}, data dir ${dataDir})`)
execFileSync(path.join(binDir, 'initdb'), ['-D', dataDir, '-U', 'valoria', '--auth=trust', '-E', 'UTF8'], {
  stdio: ['ignore', 'ignore', 'pipe'],
})

const server = spawn(
  path.join(binDir, 'postgres'),
  ['-D', dataDir, '-p', String(port), '-c', 'listen_addresses=127.0.0.1', '-c', 'fsync=off'],
  { stdio: ['ignore', 'ignore', fs.openSync(logFile, 'w')] }
)

async function connect() {
  const client = new Pg.Client({ host: '127.0.0.1', port, user: 'valoria', database: 'postgres' })
  await client.connect()
  return client
}

// Waits for the server to accept connections.
async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      const c = await connect()
      await c.end()
      return
    } catch {
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  throw new Error(`server did not become ready; see ${logFile}`)
}

async function shutdown() {
  try {
    server.kill('SIGQUIT')
    await new Promise((r) => setTimeout(r, 400))
    if (!server.killed) server.kill('SIGKILL')
  } catch {
    /* best effort */
  }
  try {
    fs.rmSync(dataDir, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
}

// The application's insert, as api/submit-assessment.js performs it: a fresh
// report_token per attempt, so the report_token unique index never catches a
// duplicate submission.
function insertSql() {
  return `insert into public.valu_assessments
            (name, role, identity_hash, total_score, designation, completed_at, taster_id, user_id, report_token)
          values ('Ada', 'Engineer', $1, 61, 'Proficient', now(), $2, $3, $4)`
}

let exitCode = 0
try {
  await waitReady()

  const setup = await connect()
  await setup.query(SCHEMA)
  const migrationSql = fs.readFileSync(path.join(root, MIGRATION), 'utf8')

  section('1. the migration applies to a real PostgreSQL server')
  try {
    await setup.query(migrationSql)
    check('migration applies', true)
  } catch (err) {
    check('migration applies', false, err.message)
  }
  const idx = await setup.query(`select indexdef from pg_indexes where indexname = 'valu_assessments_taster_identity_uidx'`)
  check('the unique index exists', idx.rows.length === 1)
  check(
    'it is unique on (taster_id, identity_hash) with the partial predicate',
    /create unique index/i.test(idx.rows[0]?.indexdef || '') &&
      /taster_id/.test(idx.rows[0]?.indexdef || '') &&
      /identity_hash/.test(idx.rows[0]?.indexdef || '') &&
      /where/i.test(idx.rows[0]?.indexdef || '')
  )

  section('2. N concurrent first submissions for one snapshot produce exactly one row')
  // Every connection performs the existence check before any connection
  // inserts, which is the race the handler's application-level guard cannot
  // close: all of them legitimately observe "no existing row".
  const N = 8
  const clients = await Promise.all(Array.from({ length: N }, () => connect()))
  let released
  const barrier = new Promise((resolve) => {
    released = resolve
  })

  const attempts = clients.map(async (client, i) => {
    await client.query('begin')
    const seen = await client.query(
      `select id from public.valu_assessments where taster_id = $1 and identity_hash = $2`,
      [TASTER_A, 'fp-1']
    )
    // Held here until every connection has also observed zero rows.
    await barrier
    try {
      await client.query(insertSql(), ['fp-1', TASTER_A, USER, uuid(i + 1)])
      await client.query('commit')
      return { ok: true, sawEmpty: seen.rows.length === 0 }
    } catch (err) {
      await client.query('rollback')
      return { ok: false, code: err.code, constraint: err.constraint, sawEmpty: seen.rows.length === 0 }
    }
  })

  // Give every connection time to reach the barrier, then release them together.
  await new Promise((r) => setTimeout(r, 300))
  released()
  const outcomes = await Promise.all(attempts)
  await Promise.all(clients.map((c) => c.end()))

  const winners = outcomes.filter((o) => o.ok)
  const losers = outcomes.filter((o) => !o.ok)
  check(
    'every connection observed no existing row (the race is real)',
    outcomes.every((o) => o.sawEmpty),
    `${outcomes.filter((o) => o.sawEmpty).length}/${N}`
  )
  check('exactly one connection won', winners.length === 1, `${winners.length} won`)
  check('all others were rejected', losers.length === N - 1, `${losers.length} rejected`)
  check(
    'every rejection is 23505 on the dedup constraint',
    losers.every((l) => l.code === '23505' && l.constraint === 'valu_assessments_taster_identity_uidx'),
    [...new Set(losers.map((l) => `${l.code}/${l.constraint}`))].join(', ')
  )
  const afterRace = await setup.query(`select count(*)::int as n from public.valu_assessments`)
  check('exactly one row exists', afterRace.rows[0].n === 1, `${afterRace.rows[0].n} rows`)

  section('3. control — two legitimate distinct submissions both succeed')
  // Without this, the guarantee could be "satisfied" by a constraint that
  // rejects everything, which would be worse than the bug.
  const ctrlA = await connect()
  const ctrlB = await connect()
  await ctrlA.query(insertSql(), ['fp-1', TASTER_B, USER, uuid(101)])
  await ctrlB.query(insertSql(), ['fp-2', TASTER_A, USER, uuid(102)])
  await ctrlA.end()
  await ctrlB.end()
  const afterControl = await setup.query(`select count(*)::int as n from public.valu_assessments`)
  check('a different snapshot may hold its own assessment', afterControl.rows[0].n === 3, `${afterControl.rows[0].n} rows`)
  const distinctIdentity = await setup.query(
    `select count(*)::int as n from public.valu_assessments where taster_id = $1`,
    [TASTER_A]
  )
  check('a different identity on the same snapshot is distinct', distinctIdentity.rows[0].n === 2)

  section('4. null and absent identifiers do not collide')
  for (const n of [201, 202, 203]) {
    await setup.query(
      `insert into public.valu_assessments (name, role, identity_hash, total_score, completed_at, taster_id, user_id, report_token)
       values ('Legacy', 'Engineer', null, 50, now(), null, $1, $2)`,
      [USER, uuid(n)]
    )
  }
  const legacy = await setup.query(
    `select count(*)::int as n from public.valu_assessments where taster_id is null`
  )
  check('unlinked rows coexist rather than colliding', legacy.rows[0].n === 3, `${legacy.rows[0].n} rows`)

  section('5. a uniqueness error names its constraint, so recovery can be scoped')
  // The handler recovers by looking the dedup key up again rather than assuming
  // any 409 is its own duplicate. This shows the database distinguishes the
  // cases, which is what makes that recovery safe: a report_token collision
  // reports a different constraint name.
  const tokenCollision = await setup.query(
    `insert into public.valu_assessments (name, role, identity_hash, total_score, completed_at, taster_id, user_id, report_token)
     values ('Ada', 'Engineer', 'fp-9', 61, now(), $1, $2, $3)`,
    [uuid(900), USER, uuid(101)]
  ).then(
    () => ({ ok: true }),
    (err) => ({ ok: false, code: err.code, constraint: err.constraint })
  )
  check('a duplicate report_token is rejected', tokenCollision.ok === false)
  check(
    'and it reports the report_token constraint, not the dedup one',
    tokenCollision.constraint === 'valu_assessments_report_token_uidx',
    String(tokenCollision.constraint)
  )

  section('6. mutation — without the index the race produces duplicates')
  // This is what establishes that the index is the thing closing the race,
  // rather than something else in the sequence. The same concurrent procedure
  // is repeated with the constraint removed.
  await setup.query(`drop index public.valu_assessments_taster_identity_uidx`)
  await setup.query(`delete from public.valu_assessments`)

  const mClients = await Promise.all(Array.from({ length: N }, () => connect()))
  let mReleased
  const mBarrier = new Promise((resolve) => {
    mReleased = resolve
  })
  const mAttempts = mClients.map(async (client, i) => {
    await client.query('begin')
    await client.query(`select id from public.valu_assessments where taster_id = $1 and identity_hash = $2`, [
      TASTER_A,
      'fp-1',
    ])
    await mBarrier
    try {
      await client.query(insertSql(), ['fp-1', TASTER_A, USER, uuid(500 + i)])
      await client.query('commit')
      return true
    } catch {
      await client.query('rollback')
      return false
    }
  })
  await new Promise((r) => setTimeout(r, 300))
  mReleased()
  const mOutcomes = await Promise.all(mAttempts)
  await Promise.all(mClients.map((c) => c.end()))

  const mutatedRows = await setup.query(`select count(*)::int as n from public.valu_assessments`)
  check(
    'without the index, concurrent first submissions all commit (duplicates)',
    mutatedRows.rows[0].n > 1,
    `${mutatedRows.rows[0].n} rows from ${mOutcomes.filter(Boolean).length} commits`
  )
  check('confirming the race is real and not an artefact of the test', mutatedRows.rows[0].n === N, `${mutatedRows.rows[0].n}/${N}`)

  section('7. why the index predicate exists — it is not the NULL-collision guard')
  // The migration comment implies the partial predicate is what stops null-keyed
  // rows colliding. That is not accurate: PostgreSQL treats NULLs as distinct in
  // a unique index by default (NULLS DISTINCT), so a plain index would not
  // collide them either. This check records the real reason the predicate is
  // there — a partial index over only the rows the application actually queries
  // is smaller and excludes legacy/unlinked rows from the constraint's scope —
  // so the comment is not relied on for a property the database provides.
  await setup.query(`create table public.predicate_probe (a text, b text)`)
  await setup.query(`create unique index predicate_probe_plain on public.predicate_probe (a, b)`)
  let nullsCollide = false
  try {
    await setup.query(`insert into public.predicate_probe values (null, null)`)
    await setup.query(`insert into public.predicate_probe values (null, null)`)
    nullsCollide = false
  } catch {
    nullsCollide = true
  }
  const probeRows = await setup.query(`select count(*)::int as n from public.predicate_probe`)
  check(
    'a plain unique index already treats null keys as distinct',
    nullsCollide === false && probeRows.rows[0].n === 2,
    `${probeRows.rows[0].n} null rows accepted, collision=${nullsCollide}`
  )
  await setup.query(`drop table public.predicate_probe`)

  await setup.end()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.error('Failed checks:', failed.map((f) => f.label).join('; '))
    exitCode = 1
  } else {
    console.log('All checks passed.')
  }
} catch (err) {
  console.error('\nverifier error:', err?.message || err)
  exitCode = 1
} finally {
  await shutdown()
}

process.exit(exitCode)
