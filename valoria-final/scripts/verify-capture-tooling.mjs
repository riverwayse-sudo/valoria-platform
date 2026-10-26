#!/usr/bin/env node
// Proves the staging-capture instrument works, against a disposable fixture.
//
// WHY THIS EXISTS
// `capture-staging-schema.mjs` is the only way to obtain the evidence the
// migration-collision register is blocked on: which of two same-version files
// actually ran, and the live body of the functions the collisions define. Its
// production-host guard has been tested, but it has never had a real target, and
// its collision-evidence queries have never executed against a database.
//
// An instrument that fails on first use wastes the access window it was built for.
// This runs it end to end against a fixture that has the shape staging is expected
// to have, and asserts it captures the collision evidence correctly.
//
// WHAT THIS IS NOT
// This is not staging verification and not a substitute for it. The fixture is
// synthetic: it is a schema this script builds to exercise the capture, not a
// claim about what staging contains. Passing here means the tool is ready; it does
// not mean the blockers are cleared. Staging evidence still requires authorized
// access.
//
// USAGE
//   node scripts/verify-capture-tooling.mjs
//
// Exits 0 when the capture behaves correctly, 1 otherwise.

import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import os from 'node:os'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const CACHE_DIR = path.join(root, '.pg-verify')
const PG_VERSION = '18.4.0-beta.17'

const checks = []
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `  (${detail})` : ''}`)
}

function resolveBinaries() {
  const binDir = path.join(CACHE_DIR, 'node_modules', '@embedded-postgres', 'linux-x64', 'native', 'bin')
  if (!fs.existsSync(path.join(binDir, 'initdb'))) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    if (!fs.existsSync(path.join(CACHE_DIR, 'package.json'))) {
      fs.writeFileSync(path.join(CACHE_DIR, 'package.json'), '{"name":"pg-verify","private":true}\n')
    }
    execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--prefix', CACHE_DIR,
      `@embedded-postgres/linux-x64@${PG_VERSION}`, 'pg'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
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
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valoria-capture-'))
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valoria-capture-out-'))
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

// The fixture: the shape staging is expected to have, including the objects the
// collisions define and a Supabase-style migration table with applied SQL.
const FIXTURE = `
create schema if not exists private;
create schema if not exists supabase_migrations;

create table public.valu_assessments (
  id uuid primary key default gen_random_uuid(),
  taster_id uuid, user_id uuid, identity_hash text, name text, role text,
  total_score int, designation text, completed_at timestamptz, expires_at timestamptz,
  report_token text, report_status text, report_attempts int, report_locked_at timestamptz,
  report_idempotency_key text, report_failure_code text, assessment_version text,
  scoring_version text, rubric_version text, linked_at timestamptz,
  reminder_count int, last_reminder_at timestamptz, skill_scores jsonb
);

-- The handoff columns collision 20260908150000 is about.
create table public.taster_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, linked_at timestamptz, reminder_count int, last_reminder_at timestamptz
);

create or replace function public.link_taster_to_profile() returns trigger
  language plpgsql security definer set search_path = public, private as $$
begin
  update public.taster_sessions set linked_at = now() where id = new.id;
  return new;
end $$;

create trigger trg_link_taster_to_profile after insert on public.taster_sessions
  for each row execute function public.link_taster_to_profile();

-- Collision 20260921121500's object that no later migration redefines. Its live
-- body is the only record of which copy ran.
create or replace function private.sync_professional_capability() returns void
  language plpgsql security definer set search_path = public, private as $$
begin
  -- fixture marker: platform-copy
  perform 1;
end $$;

create table supabase_migrations.schema_migrations (
  version text primary key, name text, inserted_at timestamptz default now(),
  statements text[]
);

insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20260908150000', 'valu_teaser_profile_handoff',
   array['alter table public.taster_sessions add column if not exists user_id uuid',
         'create trigger trg_link_taster_to_profile after insert on public.taster_sessions']),
  ('20260921121500', 'close_signup_profile_capability_listing_drift',
   array['create or replace function private.sync_professional_capability() returns void language plpgsql as $f$ begin perform 1; end $f$']),
  ('20260921124500', 'lock_capability_governance_mutations', array['select 1']),
  ('20260921130000', 'guard_professional_platform_fields_on_insert', array['select 1']);
`

// cwd stays at the repository root: the capture resolves the pg client and the
// migration directories relative to it. Output goes to outDir.
function runCapture(env, outDir) {
  return spawnSync('node', ['scripts/capture-staging-schema.mjs', '--expect-host=127.0.0.1', '--no-ssl', `--out-dir=${outDir}`], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
}

try {
  await waitReady()
  const client = await connect()
  await client.query(FIXTURE)
  await client.end()

  console.log('\n1. the host guard still refuses a mismatched host')
  // Same host here, so it must NOT refuse; refusal is checked with a wrong
  // --expect-host instead.
  const wrongHost = spawnSync('node', ['scripts/capture-staging-schema.mjs', '--expect-host=elsewhere.example', '--no-ssl', `--out-dir=${workDir}`], {
    cwd: root,
    env: { ...process.env, STAGING_DATABASE_URL: `postgresql://valoria@127.0.0.1:${port}/postgres` },
    encoding: 'utf8',
  })
  check('a mismatched --expect-host is refused', wrongHost.status === 1 && /does not match/.test(wrongHost.stderr))
  check('nothing was captured on refusal', !fs.existsSync(path.join(workDir, 'capture.json')))

  console.log('\n2. the capture runs against the fixture')
  const res = runCapture({ STAGING_DATABASE_URL: `postgresql://valoria@127.0.0.1:${port}/postgres` }, workDir)
  check('capture exited 0', res.status === 0, `status ${res.status}: ${res.stderr?.slice(0, 200)}`)
  check('it connected to the expected host', /Connected to 127\.0\.0\.1/.test(res.stdout))

  const capturePath = path.join(workDir, 'capture.json')
  check('capture.json was written', fs.existsSync(capturePath))
  const capture = fs.existsSync(capturePath) ? JSON.parse(fs.readFileSync(capturePath, 'utf8')) : { queries: {}, errors: {} }

  console.log('\n3. the collision evidence the register is blocked on is captured')
  const applied = capture.queries.collision_applied_sql || []
  check('applied SQL captured for colliding versions', applied.length === 4, `got ${applied.length}`)
  const handoff = applied.find((r) => r.version === '20260908150000')
  check(
    'the 20260908150000 applied SQL is the platform body, not the site body',
    Boolean(handoff && /add column if not exists user_id/.test(handoff.applied_sql)),
    handoff ? handoff.applied_sql.slice(0, 60) : 'absent'
  )

  const bodies = capture.queries.collision_function_bodies || []
  const sync = bodies.find((b) => b.function_name === 'sync_professional_capability')
  check('the live sync_professional_capability body was captured', Boolean(sync))
  check(
    'the live body identifies which copy ran',
    Boolean(sync && /fixture marker: platform-copy/.test(sync.source)),
    sync ? sync.source.slice(0, 60) : 'absent'
  )

  const priv = capture.queries.private_functions || []
  check('private-schema functions were captured', priv.length >= 1, `got ${priv.length}`)

  console.log('\n4. the handoff columns and trigger are read from the database')
  const tasterCols = (capture.queries.columns || [])
    .filter((c) => c.table_name === 'taster_sessions')
    .map((c) => c.column_name)
  for (const col of ['user_id', 'linked_at', 'reminder_count', 'last_reminder_at']) {
    check(`taster_sessions.${col} captured`, tasterCols.includes(col))
  }
  const trg = (capture.queries.triggers || []).find((t) => t.trigger_name === 'trg_link_taster_to_profile')
  check('trg_link_taster_to_profile captured with its source', Boolean(trg && trg.function_source))

  console.log('\n5. a missing statements column degrades, it does not abort')
  // Some Supabase versions lack `statements`. The capture must record the error
  // and still produce everything else, or a schema capture on such a project
  // would yield nothing.
  const client2 = await connect()
  await client2.query('alter table supabase_migrations.schema_migrations drop column statements')
  await client2.end()
  const workDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'valoria-capture-out2-'))
  const res2 = runCapture({ STAGING_DATABASE_URL: `postgresql://valoria@127.0.0.1:${port}/postgres` }, workDir2)
  check('capture still exits 0', res2.status === 0, `status ${res2.status}`)
  const capture2 = JSON.parse(fs.readFileSync(path.join(workDir2, 'capture.json'), 'utf8'))
  check('the missing column is recorded as an error', Boolean(capture2.errors.collision_applied_sql))
  check('the schema capture still succeeded', (capture2.queries.columns || []).length > 0)
  check('the private functions were still captured', (capture2.queries.private_functions || []).length >= 1)
  fs.rmSync(workDir2, { recursive: true, force: true })

  console.log('\n6. the drift report is produced and names the collision evidence')
  const mdPath = path.join(workDir, 'drift-report.md')
  check('drift-report.md was written', fs.existsSync(mdPath))
  const md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : ''
  check('the report has a collision-evidence section', /## 4\. Collision evidence/.test(md))
  check('the report does not leak the connection string', !md.includes(String(port)) || !/postgresql:\/\//.test(md))
} finally {
  server.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 400))
  fs.rmSync(dataDir, { recursive: true, force: true })
  fs.rmSync(workDir, { recursive: true, force: true })
}

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length) {
  console.log('\nThe capture instrument is not ready. Do not use it for staging evidence.')
  process.exit(1)
}
console.log('\nThe capture instrument works against a fixture: it reads the applied SQL for')
console.log('colliding versions, the live bodies of the functions the collisions define, the')
console.log('handoff columns and trigger, and it degrades rather than aborts when the')
console.log('migration table lacks the applied-SQL column.')
console.log('This is tool readiness, not staging verification. The blockers remain open.')
