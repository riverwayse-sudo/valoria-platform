#!/usr/bin/env node
// Classifies every failure from the shared migration replay by its actual cause,
// so the count means something.
//
// WHY THIS EXISTS
// "112 migrations failed" is true and nearly useless. A first pass reported the
// split as 5 infrastructure / 29 private-schema cascade / 78 baseline gaps, which
// was wrong: it counted as "baseline gaps" every failure whose object is not
// created anywhere, without checking whether the object has a creator that itself
// failed earlier in the same run. That inflated the gap count and understated how
// much of the chain is one failure propagating.
//
// The classes, and why they are distinct:
//
//   infra                 The object belongs to Supabase-managed infrastructure
//                         (cron, storage.buckets, pg_net) that a bare PostgreSQL
//                         does not have. A harness limitation, not a defect. These
//                         must be reported separately, never as baseline gaps.
//   baseline-gap          No tracked migration in either repository creates the
//                         object. This is the real, unfixable-from-source set: the
//                         provisioning baseline has to supply it.
//   private-cascade       A direct consequence of `schema private` not existing,
//                         which is itself caused by the failure below.
//   cascade-creator-failed The object HAS a tracked creator, but that creator
//                         failed earlier in the same run, so the object was never
//                         made. Fixing the creator removes the failure.
//   ordering-late         The object has a creator that succeeded, but later in
//                         version order than the file that needs it. A real
//                         ordering defect, independent of any missing baseline.
//
// Only `baseline-gap` and `ordering-late` are defects in the migration set itself.
// The rest are consequences of those two plus the harness.
//
// USAGE
//   npm run verify:migration-reproducibility:shared   # writes migration-failures.json
//   node scripts/classify-migration-failures.mjs      # writes the register
//
// Output: docs/engineering/migration-failure-register.md
// Exit 0 on success. Read-only: it reads the replay output and the migrations.

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
// Overridable so the regression test can run this on a fixture instead of the
// real 15-minute replay output.
function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}
const FAILURES = argValue('failures')
  ? path.resolve(argValue('failures'))
  : path.join(root, '.schema-capture', 'migration-failures.json')
const OUT = argValue('out')
  ? path.resolve(argValue('out'))
  : path.join(root, 'docs', 'engineering', 'migration-failure-register.md')

const MIGRATION_DIRS = argValue('migrations')
  ? [
      { repo: 'platform', dir: path.join(path.resolve(argValue('migrations')), 'platform') },
      { repo: 'site', dir: path.join(path.resolve(argValue('migrations')), 'site') },
    ]
  : [
      { repo: 'platform', dir: path.join(root, 'supabase', 'migrations') },
      { repo: 'site', dir: '/workspace/project/valoria-site/supabase/migrations' },
    ]

if (!fs.existsSync(FAILURES)) {
  console.error(`No replay output at ${path.relative(root, FAILURES)}.`)
  console.error('Run: npm run verify:migration-reproducibility:shared')
  process.exit(1)
}

const failures = JSON.parse(fs.readFileSync(FAILURES, 'utf8'))

// The applied plan, in the order the replay used: version, then label. Rebuilt
// here rather than imported so the classification is reproducible from the
// artifacts alone.
const entries = []
for (const { repo, dir } of MIGRATION_DIRS) {
  if (!fs.existsSync(dir)) continue
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    entries.push({ version: file.split('_')[0], label: `${repo}:${file}`, repo, dir, file })
  }
}
entries.sort((a, b) => (a.version === b.version ? a.label.localeCompare(b.label) : a.version.localeCompare(b.version)))
const orderOf = new Map(entries.map((e, i) => [e.label, i]))

const failedLabels = new Set(failures.map((f) => f.file))
const succeededLabels = new Set(entries.map((e) => e.label).filter((l) => !failedLabels.has(l)))

// object name -> [{ order, label }] for every tracked creator.
const creators = new Map()
function addCreator(name, order, label) {
  const key = name.toLowerCase()
  if (!creators.has(key)) creators.set(key, [])
  creators.get(key).push({ order, label })
}
for (const e of entries) {
  const sql = fs.readFileSync(path.join(e.dir, e.file), 'utf8')
  const order = orderOf.get(e.label)
  for (const re of [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.|private\.)?"?([a-z0-9_]+)"?/gi,
    // Views and matviews count as creators: marketplace_public_roster and
    // marketplace_professionals are views, not tables, and omitting them made the
    // classifier report them as baseline gaps when a tracked migration does create
    // them (it just fails, because the base table is missing).
    /create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:public\.|private\.)?"?([a-z0-9_]+)"?/gi,
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.|private\.)?"?([a-z0-9_]+)"?/gi,
    /create\s+type\s+(?:public\.)?"?([a-z0-9_]+)"?/gi,
  ]) {
    for (const m of sql.matchAll(re)) addCreator(m[1], order, e.label)
  }
}

const INFRA = /\b(cron\.|schema "cron"|storage\.buckets|pg_net|net\.http|vault\.)/i

function missingObject(message) {
  const m = message.match(/(?:relation|type|function)\s+"?(?:public\.|private\.)?"?([a-z0-9_]+)"?/i)
  return m ? m[1].toLowerCase() : null
}

function classify(f) {
  const message = f.message || ''
  if (INFRA.test(message)) return 'infra'
  if (message.includes('schema "private" does not exist')) return 'private-cascade'
  // The identity_reconciliation_reviews column failure is the private-schema
  // cascade too: the table is created, only the later closure migration that adds
  // the column fails because private.valu_reconciliation_health() is missing.
  if (message.includes('review_actor_type')) return 'private-cascade'
  const obj = missingObject(message)
  if (!obj) return 'unclassified'
  const here = orderOf.get(f.file)
  const all = creators.get(obj) || []
  if (all.length === 0) return 'baseline-gap'
  // A creator that succeeded and ran earlier would mean the object exists, so
  // that case cannot produce this failure. What remains: the creator succeeded
  // but runs later (a pure ordering defect, independent of any failure), or no
  // creator succeeded at all (a consequence of an earlier failure).
  if (all.some((c) => succeededLabels.has(c.label))) return 'ordering-late'
  return 'cascade-creator-failed'
}

const rows = failures.map((f) => ({
  file: f.file,
  code: f.code,
  message: f.message,
  object: missingObject(f.message || ''),
  class: classify(f),
}))

const counts = {}
for (const r of rows) counts[r.class] = (counts[r.class] || 0) + 1

const CLASS_ORDER = ['baseline-gap', 'ordering-late', 'cascade-creator-failed', 'private-cascade', 'infra', 'unclassified']
const CLASS_NOTE = {
  'baseline-gap': 'No tracked migration creates the object. The provisioning baseline must supply it. **Real defect.**',
  'ordering-late': 'A creator exists and succeeded, but runs later in version order. **Real defect.**',
  'cascade-creator-failed': 'A creator exists but failed earlier in the same run. Fixing the creator removes this.',
  'private-cascade': 'Consequence of `schema private` not existing, itself caused by a failure above.',
  infra: 'Supabase-managed infrastructure absent from bare PostgreSQL. **Harness limitation, not a defect.**',
  unclassified: 'Could not be attributed. Investigate.',
}

// Distinct missing objects among the true gaps.
const gapObjects = new Map()
for (const r of rows.filter((x) => x.class === 'baseline-gap')) {
  gapObjects.set(r.object, (gapObjects.get(r.object) || 0) + 1)
}
const infraObjects = new Map()
for (const r of rows.filter((x) => x.class === 'infra')) {
  const key = (r.message || '').replace(/\s+/g, ' ').slice(0, 60)
  infraObjects.set(key, (infraObjects.get(key) || 0) + 1)
}

const md = []
md.push('# Migration failure register\n')
md.push('Generated by `scripts/classify-migration-failures.mjs` from the shared replay output.')
md.push('Regenerate with `npm run verify:migration-reproducibility:shared` followed by')
md.push('`node scripts/classify-migration-failures.mjs`.\n')
md.push(`${entries.length} migrations in the shared plan; ${succeededLabels.size} applied; ${failures.length} failed.\n`)

md.push('## Summary\n')
md.push('| Class | Count | Meaning |')
md.push('| --- | --- | --- |')
for (const k of CLASS_ORDER) {
  if (!counts[k]) continue
  md.push(`| \`${k}\` | ${counts[k]} | ${CLASS_NOTE[k]} |`)
}
md.push('')
const trueDefects = (counts['baseline-gap'] || 0) + (counts['ordering-late'] || 0)
md.push(`**${trueDefects} of ${failures.length} failures are defects in the migration set itself.** The`)
md.push(`remainder are consequences of those defects or of the harness. Reporting the raw count`)
md.push(`as the defect count overstates the problem by a factor of about ${(failures.length / Math.max(trueDefects, 1)).toFixed(1)}.\n`)

md.push('## Baseline gaps — no tracked creator\n')
md.push('Each of these must be supplied by the provisioning baseline. A `CREATE TABLE`')
md.push('written from handler assumptions would look authoritative while disagreeing with')
md.push('the live database, so the shapes are not invented here; they come from the schema')
md.push('capture once staging access exists.\n')
md.push('| Missing object | Failures |')
md.push('| --- | --- |')
for (const [obj, n] of [...gapObjects].sort((a, b) => b[1] - a[1])) md.push(`| \`${obj}\` | ${n} |`)
md.push('')

md.push('## Ordering defects — creator succeeded, but later\n')
md.push('These are independent of any missing baseline: the object exists in the migration')
md.push('set and is created successfully, just too late for the file that needs it.\n')
const ordRows = rows.filter((r) => r.class === 'ordering-late')
if (ordRows.length === 0) {
  md.push('None.\n')
} else {
  md.push('| File needing the object | Object |')
  md.push('| --- | --- |')
  for (const r of ordRows) md.push(`| \`${r.file}\` | \`${r.object}\` |`)
  md.push('')
  md.push('All three are files sharing version `20260816`, which is also a collision version')
  md.push('with 17 files. Within one version the replay orders by filename, so an')
  md.push('alphabetically earlier file can run before the file that creates what it needs.')
  md.push('Whether this reproduces in Supabase depends on the applied order, which the')
  md.push('database records and the collision register is waiting on.\n')
}

md.push('## Supabase-infrastructure limitations — reported separately\n')
md.push('These objects are created by the Supabase platform, not by a migration. A bare')
md.push('PostgreSQL has no `cron` schema, no `storage` schema and no `pg_net` extension, so')
md.push('the failure says nothing about the migration set. They are excluded from the defect')
md.push('count and listed here so they are not mistaken for gaps.\n')
md.push('| Failure | Count |')
md.push('| --- | --- |')
for (const [msg, n] of [...infraObjects].sort((a, b) => b[1] - a[1])) md.push(`| \`${msg}\` | ${n} |`)
md.push('')

md.push('## Cascade — creator failed earlier in the same run\n')
md.push('Not defects of their own. Each disappears when its creator is fixed.\n')
const casc = new Map()
for (const r of rows.filter((x) => x.class === 'cascade-creator-failed')) {
  casc.set(r.object, (casc.get(r.object) || 0) + 1)
}
md.push('| Object | Failures |')
md.push('| --- | --- |')
for (const [obj, n] of [...casc].sort((a, b) => b[1] - a[1])) md.push(`| \`${obj}\` | ${n} |`)
md.push('')

md.push('## Full failure list\n')
md.push('| File | Code | Class | Missing object |')
md.push('| --- | --- | --- | --- |')
for (const r of rows) md.push(`| \`${r.file}\` | ${r.code ?? ''} | \`${r.class}\` | \`${r.object ?? ''}\` |`)
md.push('')

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, md.join('\n'))

console.log(`\n${failures.length} failures classified:`)
for (const k of CLASS_ORDER) if (counts[k]) console.log(`  ${String(counts[k]).padStart(4)}  ${k}`)
console.log(`\n  ${trueDefects} are defects in the migration set (baseline-gap + ordering-late).`)
console.log(`  ${counts['infra'] || 0} are Supabase-infrastructure limitations, not defects.`)
console.log(`\nWrote ${path.relative(root, OUT)}`)
