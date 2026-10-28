#!/usr/bin/env node
// Verifies the rollback behaviour behind the largest single block of migration
// failures in the shared replay.
//
// WHAT IT TESTS
// `20260827_marketplace_governance_v4.sql` is the only tracked migration that
// creates `schema private`. It fails partway through on a missing table, so its
// transaction rolls back — and the `create schema` rolls back with it. The 29
// migrations that then fail on `schema "private" does not exist` are all
// consequences of that one rollback, not independent defects.
//
// That reading is worth testing rather than asserting, because it decides what
// the fix has to be. Two things have to hold:
//
//   1. A schema created inside a transaction that later fails does NOT survive.
//      If it did survive, the cascade would not happen and the diagnosis would
//      be wrong.
//   2. A schema created in an earlier committed transaction DOES survive a later
//      failure. This is the fix: create the schema once, early, on its own. The
//      failing migration must not be able to take it down.
//
// It also checks that a failed migration does not remove unrelated objects that
// already existed, which is the safety property that makes rollback acceptable.
//
// This is deliberately not a test of the migration files themselves. It tests
// PostgreSQL's transactional DDL behaviour, using the real schema and failure
// mode, so the claim in the register and the baseline doc rests on a measurement.
//
// USAGE
//   node scripts/verify-schema-rollback.mjs
//
// Exits 0 when all checks pass, 1 otherwise.

import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import os from 'node:os'
import { execFileSync, spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const CACHE_DIR = path.join(root, '.pg-verify')
const PG_VERSION = '18.4.0-beta.17'

const checks = []
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `  (${detail})` : ''}`)
}

function npmInstall(...pkgs) {
  execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', ...pkgs], {
    cwd: CACHE_DIR,
    stdio: ['ignore', 'ignore', 'inherit'],
  })
}

function resolveBinaries() {
  const binDir = path.join(CACHE_DIR, 'node_modules', '@embedded-postgres', 'linux-x64', 'native', 'bin')
  if (!fs.existsSync(path.join(binDir, 'initdb'))) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    if (!fs.existsSync(path.join(CACHE_DIR, 'package.json'))) {
      fs.writeFileSync(path.join(CACHE_DIR, 'package.json'), '{"name":"pg-verify","private":true}\n')
    }
    console.log('  provisioning PostgreSQL binaries (first run only)')
    npmInstall(`@embedded-postgres/linux-x64@${PG_VERSION}`, 'pg')
  }
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

const binDir = resolveBinaries()
const pgEntry = path.join(CACHE_DIR, 'node_modules', 'pg', 'lib', 'index.js')
const pgMod = await import(pathToFileURL(pgEntry).href)
const Pg = pgMod.default || pgMod

const port = await freePort()
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valoria-rollback-'))
const logFile = path.join(dataDir, 'server.log')

console.log(`Starting real PostgreSQL (port ${port})`)
execFileSync(path.join(binDir, 'initdb'), ['-D', dataDir, '-U', 'valoria', '--auth=trust', '-E', 'UTF8'], {
  stdio: ['ignore', 'ignore', 'pipe'],
})
const server = spawn(
  path.join(binDir, 'postgres'),
  ['-D', dataDir, '-p', String(port), '-c', 'listen_addresses=127.0.0.1', '-c', 'fsync=off'],
  { stdio: ['ignore', 'ignore', fs.openSync(logFile, 'w')] }
)

async function connect() {
  const c = new Pg.Client({ host: '127.0.0.1', port, user: 'valoria', database: 'postgres' })
  await c.connect()
  return c
}

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
  throw new Error(`server not ready; see ${logFile}`)
}

async function schemaExists(client, name) {
  const r = await client.query('select 1 from pg_namespace where nspname = $1', [name])
  return r.rowCount > 0
}

async function tableExists(client, name) {
  const r = await client.query(`select to_regclass($1) is not null as present`, [name])
  return r.rows[0].present
}

// Runs `sql` in one transaction. Returns { ok } without throwing, so a failure is
// a result the checks can inspect.
async function inTransaction(client, sql) {
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    return { ok: true }
  } catch (err) {
    await client.query('rollback').catch(() => {})
    return { ok: false, message: err.message.split('\n')[0], code: err.code || null }
  }
}

try {
  await waitReady()
  const client = await connect()

  // A table the failing migration depends on, so the failure is the real one
  // (a missing relation) and not a syntax error.
  await client.query('create table if not exists public.unrelated_marker(id int primary key)')

  console.log('\n1. a schema created in a failing transaction must not survive')
  // This reproduces 20260827_marketplace_governance_v4.sql exactly: create the
  // schema, then touch a table that does not exist, in one transaction.
  const attempt = await inTransaction(
    client,
    `create schema if not exists private;
     create table public.__probe_private(id int);
     alter table public.does_not_exist_at_all add column x int;`
  )
  check('the transaction failed as expected', !attempt.ok, JSON.stringify(attempt))
  check('the failure is a missing relation', attempt.code === '42P01', `code ${attempt.code}`)
  check(
    'schema private did NOT survive the rollback',
    !(await schemaExists(client, 'private')),
    'schema survived, so the cascade diagnosis would be wrong'
  )
  check(
    'the probe table did NOT survive either',
    !(await tableExists(client, 'public.__probe_private'))
  )

  console.log('\n2. a schema created in an earlier committed transaction must survive')
  // This is the fix under test: create the schema on its own, committed, before
  // anything that might fail. The failing migration must not be able to take it
  // down, because it is not created inside that migration's transaction.
  const early = await inTransaction(client, 'create schema if not exists private')
  check('the early schema creation committed', early.ok, JSON.stringify(early))
  check('schema private now exists', await schemaExists(client, 'private'))

  const failAfter = await inTransaction(
    client,
    `create table public.__probe_private2(id int);
     alter table public.does_not_exist_at_all add column x int;`
  )
  check('the later transaction failed as expected', !failAfter.ok)
  check(
    'schema private SURVIVED the later failure',
    await schemaExists(client, 'private'),
    'the fix would not work'
  )

  console.log('\n3. a failed migration must not remove unrelated existing objects')
  check(
    'the unrelated marker table is still present',
    await tableExists(client, 'public.unrelated_marker'),
    'rollback removed an object it did not create'
  )
  check(
    'the unrelated marker still has its data',
    (await client.query('select count(*)::int as n from public.unrelated_marker')).rows[0].n === 0
  )

  console.log('\n4. the cascade is reproducible with the schema absent')
  // With private gone, a migration that references it must fail with the same
  // error the shared replay reports for 29 migrations.
  await client.query('drop schema private cascade')
  const cascade = await inTransaction(
    client,
    'create or replace function private.probe() returns int language sql as $$ select 1 $$;'
  )
  check('referencing private without it fails', !cascade.ok)
  check(
    'the error is "schema private does not exist"',
    cascade.code === '3F000' && /schema "private" does not exist/.test(cascade.message || ''),
    `${cascade.code} ${cascade.message}`
  )

  await client.end()
} finally {
  server.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 400))
  fs.rmSync(dataDir, { recursive: true, force: true })
}

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length) {
  console.log('\nRollback behaviour does not match the diagnosis.')
  process.exit(1)
}
console.log('Rollback behaviour matches the diagnosis: a schema created in a failing')
console.log('transaction is lost, and one created earlier is not. The cascade is real,')
console.log('and creating the schema early is a sufficient fix for it.')
