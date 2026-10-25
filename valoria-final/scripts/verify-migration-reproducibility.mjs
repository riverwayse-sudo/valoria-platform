#!/usr/bin/env node
// Replays the tracked migration sequence on a fresh PostgreSQL database, so the
// claim "a clean environment can be provisioned from source" is tested rather
// than assumed.
//
// WHY THIS EXISTS
// Phase 4 established that `valu_assessments` and `taster_sessions` are created
// by no tracked migration, yet 36 of the 84 tracked migrations reference them.
// The consequence is that replaying the migrations on an empty database cannot
// succeed. This script measures exactly how far the chain gets and where it
// stops, which is the evidence needed to author the missing baseline.
//
// It also accepts a candidate baseline. Applying one and re-running must take the
// chain to completion — that is the acceptance test for the fix, and it is how a
// speculative baseline can be rejected rather than merged on inspection.
//
// USAGE
//   node scripts/verify-migration-reproducibility.mjs
//   node scripts/verify-migration-reproducibility.mjs --baseline=supabase/migrations/<file>.sql
//   node scripts/verify-migration-reproducibility.mjs --compare=.schema-capture/capture.json
//   node scripts/verify-migration-reproducibility.mjs --shared --site=/path/to/valoria-site
//
// Exits 0 when the full chain applies, 1 otherwise. A failure is a result, not an
// error: it is the measurement this script exists to produce.
//
// --shared replays BOTH repositories into one database, which is the real
// provisioning path: the two repositories share a single Supabase project
// (AGENTS.md: "Shared database with valoria-site"), and each writes part of the
// schema. Replaying only this repository's migrations cannot succeed, because 47
// of them alter tables the site repository creates — `professional_certificates`,
// `assessment_identity_links`, `identity_reconciliation_reviews` and others. The
// default single-repository run is still the right measurement for "is THIS
// repository self-sufficient", but it is not the provisioning question, and
// reporting it as one would understate what actually works.

import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import os from 'node:os'
import { execFileSync, spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const MIGRATIONS_DIR = path.join(root, 'supabase', 'migrations')
const SHIM = path.join(root, 'supabase', 'verify', 'supabase-platform-shim.sql')
const CACHE_DIR = path.join(root, '.pg-verify')
const PG_VERSION = '18.4.0-beta.17'

const TARGET_TABLES = ['valu_assessments', 'taster_sessions']

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}
const baselinePath = argValue('baseline')
const comparePath = argValue('compare')

// --shared merges the site repository's migrations into the replay. The two
// repositories share one database, so the provisioning path is the union of
// their sequences, not either one alone.
const sharedMode = process.argv.includes('--shared')
const siteRoot = argValue('site') || '/workspace/project/valoria-site'
const SITE_MIGRATIONS_DIR = path.join(siteRoot, 'supabase', 'migrations')

function npmInstall(...pkgs) {
  execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--prefix', CACHE_DIR, ...pkgs], {
    cwd: root,
    stdio: 'inherit',
  })
}

function resolveBinaries() {
  const binDir = path.join(CACHE_DIR, 'node_modules', '@embedded-postgres', 'linux-x64', 'native', 'bin')
  const need = ['initdb', 'postgres']
  const pgEntry = path.join(CACHE_DIR, 'node_modules', 'pg', 'lib', 'index.js')
  if (need.some((b) => !fs.existsSync(path.join(binDir, b))) || !fs.existsSync(pgEntry)) {
    console.log('Provisioning real PostgreSQL into .pg-verify (package.json is not modified)...')
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    npmInstall(`@embedded-postgres/linux-x64@${PG_VERSION}`, 'pg')
  }
  for (const b of need) {
    if (!fs.existsSync(path.join(binDir, b))) throw new Error(`PostgreSQL binary missing: ${path.join(binDir, b)}`)
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
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valoria-repro-'))
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

// Applies a file inside its own transaction so a failure cannot leave a
// half-applied migration behind and confuse the next one.
async function applyFile(client, file, label) {
  const sql = fs.readFileSync(file, 'utf8')
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    return { ok: true, file: label }
  } catch (err) {
    await client.query('rollback').catch(() => {})
    return {
      ok: false,
      file: label,
      message: err.message.split('\n')[0],
      code: err.code || null,
    }
  }
}

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

// Supabase records an applied migration by its version — the leading numeric
// prefix of the filename — and refuses to apply a second file with a version it
// has already seen. Two files sharing a version therefore cannot both be part of
// a provisioned database: whichever is applied first wins, and the other is
// skipped silently. That is a defect in a shared database, because a table or
// trigger the skipped file was supposed to create never exists, and no error is
// raised anywhere.
//
// Returns the full list of { file, dir, label, version, repo } in version order,
// plus the collisions, so the caller can report rather than hide them.
function collectSharedMigrations() {
  const entries = []
  const add = (dir, repo) => {
    if (!fs.existsSync(dir)) return
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
      const m = file.match(/^(\d+)_/)
      entries.push({ file, dir, label: `${repo}:${file}`, version: m ? m[1] : file, repo })
    }
  }
  add(MIGRATIONS_DIR, 'platform')
  add(SITE_MIGRATIONS_DIR, 'site')

  // Same version, different content, across the two repositories. Ordering by
  // label keeps platform before site for an equal version, which is the order
  // the versions imply but does not determine — hence the collision report.
  entries.sort((a, b) => (a.version === b.version ? a.label.localeCompare(b.label) : a.version.localeCompare(b.version)))

  const byVersion = new Map()
  for (const e of entries) {
    if (!byVersion.has(e.version)) byVersion.set(e.version, [])
    byVersion.get(e.version).push(e)
  }
  const collisions = []
  for (const [version, list] of byVersion) {
    if (list.length < 2) continue
    const bodies = list.map((e) => fs.readFileSync(path.join(e.dir, e.file), 'utf8'))
    const identical = bodies.every((b) => b === bodies[0])
    collisions.push({ version, entries: list, identical })
  }
  return { entries, collisions }
}

let exitCode = 0
try {
  await waitReady()
  const client = await connect()

  console.log('\n1. applying the Supabase platform shim (test fixture, not a migration)')
  const shim = await applyFile(client, SHIM, 'supabase-platform-shim.sql')
  if (!shim.ok) {
    console.error(`   shim failed to apply: ${shim.message}`)
    exitCode = 1
  } else {
    console.log('   shim applied')
  }

  if (baselinePath) {
    const abs = path.isAbsolute(baselinePath) ? baselinePath : path.join(root, baselinePath)
    if (!fs.existsSync(abs)) {
      console.error(`\n--baseline file not found: ${abs}`)
      exitCode = 1
    } else {
      console.log(`\n2. applying candidate baseline ${path.relative(root, abs)}`)
      const res = await applyFile(client, abs, path.basename(abs))
      if (res.ok) {
        console.log('   baseline applied')
      } else {
        console.error(`   baseline FAILED: ${res.message}`)
        exitCode = 1
      }
    }
  }

  console.log(`\n${baselinePath ? '3' : '2'}. replaying the tracked migration sequence`)
  const files = migrationFiles()

  // In shared mode the replay is the union of both repositories' migrations, in
  // version order, because that is the sequence a single database receives.
  let plan
  if (sharedMode) {
    const { entries, collisions } = collectSharedMigrations()
    plan = entries
    console.log(`   ${entries.length} migrations found across both repositories`)
    console.log(`   (platform ${files.length}, site ${entries.length - files.length})`)
    if (collisions.length) {
      console.log(`\n   ${collisions.length} version collision(s) — Supabase applies one per version, so the other is skipped silently:`)
      for (const c of collisions) {
        console.log(`     ${c.version}${c.identical ? ' (identical content, harmless)' : ''}`)
        for (const e of c.entries) console.log(`       ${e.repo}: ${e.file}`)
      }
    } else {
      console.log('   no version collisions')
    }
  } else {
    plan = files.map((f) => ({ file: f, dir: MIGRATIONS_DIR, label: f, repo: 'platform' }))
    console.log(`   ${files.length} migrations found`)
  }

  const applied = []
  const failures = []
  for (const entry of plan) {
    const res = await applyFile(client, path.join(entry.dir, entry.file), entry.label)
    if (res.ok) applied.push(entry.label)
    else failures.push(res)
  }
  const firstFailure = failures[0] || null

  console.log(`   applied ${applied.length}/${plan.length}`)
  if (failures.length) {
    console.log(`\n   ${failures.length} migration(s) failed. The first is ${firstFailure.file}:`)
    console.log(`     ${firstFailure.message}`)
    if (firstFailure.code) console.log(`     sqlstate ${firstFailure.code}`)
    // Group the failures by their error message so the distinct root causes are
    // visible rather than one line per dependent migration.
    const byMessage = new Map()
    for (const f of failures) {
      const key = f.message
      if (!byMessage.has(key)) byMessage.set(key, [])
      byMessage.get(key).push(f.file)
    }
    console.log(`\n   ${byMessage.size} distinct root cause(s):`)
    for (const [message, files2] of [...byMessage.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`     (${files2.length}) ${message}`)
      console.log(`         e.g. ${files2[0]}`)
    }
    fs.writeFileSync(
      path.join(root, '.schema-capture', 'migration-failures.json'),
      JSON.stringify(failures, null, 2)
    )
    console.log(`\n   wrote .schema-capture/migration-failures.json`)
  } else {
    console.log('   the full chain applied')
  }

  // Which migrations reference the target tables? Those are the ones that
  // cannot work until a baseline exists, so the failure point should sit at or
  // before the earliest of them.
  const referencing = plan.filter((e) => {
    const sql = fs.readFileSync(path.join(e.dir, e.file), 'utf8')
    return /valu_assessments|taster_sessions/.test(sql)
  })
  const earliest = referencing[0]
  console.log(`\n   ${referencing.length} migrations reference ${TARGET_TABLES.join(' or ')}`)
  console.log(`   earliest is ${earliest ? earliest.label : 'none'}`)
  if (firstFailure && earliest && firstFailure.file > earliest.label) {
    console.log('   NOTE: the chain failed after the earliest reference, which is unexpected')
  }

  console.log('\n4. target tables present after the replay')
  for (const t of TARGET_TABLES) {
    const r = await client.query(`select to_regclass($1) is not null as present`, [`public.${t}`])
    console.log(`   ${t}: ${r.rows[0].present ? 'present' : 'ABSENT'}`)
  }

  if (comparePath && fs.existsSync(comparePath)) {
    console.log(`\n5. schema equivalence against ${comparePath}`)
    const capture = JSON.parse(fs.readFileSync(comparePath, 'utf8'))
    const live = await client.query(
      `select table_name, column_name, data_type, is_nullable, column_default
         from information_schema.columns
        where table_schema = 'public' and table_name = any($1)
        order by table_name, ordinal_position`,
      [TARGET_TABLES]
    )
    const differences = []
    for (const table of TARGET_TABLES) {
      const capturedCols = (capture.queries?.columns || []).filter((c) => c.table_name === table)
      if (capturedCols.length === 0) continue
      const liveCols = live.rows.filter((c) => c.table_name === table)
      const liveNames = new Set(liveCols.map((c) => c.column_name))
      const capturedNames = new Set(capturedCols.map((c) => c.column_name))
      for (const c of capturedCols) {
        if (!liveNames.has(c.column_name)) differences.push(`${table}.${c.column_name}: in staging, missing from the migrated schema`)
        else {
          const l = liveCols.find((x) => x.column_name === c.column_name)
          if (l.data_type !== c.data_type) differences.push(`${table}.${c.column_name}: type staging=${c.data_type} migrated=${l.data_type}`)
          if (l.is_nullable !== c.is_nullable) differences.push(`${table}.${c.column_name}: nullability staging=${c.is_nullable} migrated=${l.is_nullable}`)
        }
      }
      for (const l of liveCols) {
        if (!capturedNames.has(l.column_name)) differences.push(`${table}.${l.column_name}: in migrated schema, not in staging`)
      }
    }
    if (differences.length === 0) {
      console.log('   no column-level differences against the captured staging schema')
    } else {
      console.log(`   ${differences.length} difference(s):`)
      for (const d of differences) console.log(`     - ${d}`)
      exitCode = 1
    }
  }

  await client.end()

  console.log('\n─── result ───')
  if (firstFailure) {
    console.log(`NOT REPRODUCIBLE: the chain stops at ${firstFailure.file} (${applied.length}/${plan.length} applied).`)
    console.log('A clean environment cannot be provisioned from source until a baseline for the')
    console.log('tables the migrations assume is added. This is expected given the Phase 4 finding.')
    exitCode = 1
  } else {
    console.log(`REPRODUCIBLE: all ${plan.length} migrations applied to an empty database.`)
    exitCode = 0
  }
  if (sharedMode) {
    const { collisions } = collectSharedMigrations()
    const real = collisions.filter((c) => !c.identical)
    if (real.length) {
      console.log(`\n${real.length} version collision(s) with differing content: a database receives only`)
      console.log('one file per version, so the other is never applied and the objects it defines')
      console.log('never exist. Each is reported above.')
      exitCode = 1
    }
  }
} catch (err) {
  console.error('\nharness error:', err?.message || err)
  exitCode = 1
} finally {
  try {
    server.kill('SIGQUIT')
    await new Promise((r) => setTimeout(r, 400))
  } catch {
    /* best effort */
  }
  try {
    fs.rmSync(dataDir, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
}

process.exit(exitCode)
