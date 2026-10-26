#!/usr/bin/env node
// Derives, from tracked migrations only, the contract each untracked table must
// satisfy. This is the input needed to author a correct baseline, and it is
// extracted mechanically rather than inferred from handler code.
//
// WHY THIS EXISTS
// A clean provision of this repository fails: the tracked migration sequence
// references tables no migration creates. Phase 4 identified two of them; the
// real number is larger, and each has its own set of expected columns,
// constraints and indexes. Authoring a baseline by reading application code
// would guess at that shape. This script reads the migrations themselves, which
// state it explicitly — `alter table X add column Y ...` is a migration telling
// you it expects Y to exist.
//
// Output is evidence, not a schema. It never emits CREATE TABLE. It records what
// the tracked migrations require and leaves the authoritative definition to the
// live-database capture (scripts/capture-staging-schema.mjs).
//
// USAGE
//   node scripts/derive-required-schema-contract.mjs
//
// Writes docs/engineering/untracked-table-contracts.md and .schema-capture/required-contracts.json

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const REPOS = [
  { name: 'valoria-platform', dir: path.join(root, 'supabase', 'migrations') },
  { name: 'valoria-site', dir: '/workspace/project/valoria-site/supabase/migrations' },
]

// Tables the migrations reference but never create. Confirmed by
// scripts/verify-migration-reproducibility.mjs, which fails at migration 2.
const UNTRACKED = [
  'professional_profiles',
  'valu_assessments',
  'taster_sessions',
  'valoria_journey_events',
  'professional_standard_event_registrations',
  'assessment_sessions',
  'opportunity_invites',
  'valoria_reentry_links',
  'rate_limits',
  'marketplace_profiles',
]

// Strip comments and string literals so prose and data cannot be mistaken for DDL.
function clean(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

function files() {
  const out = []
  for (const repo of REPOS) {
    // Fail loudly rather than silently reporting zero references: a wrong path
    // here would make site-only tables look unreferenced, which is how the
    // `marketplace_profiles` and `valoria_reentry_links` entries were initially
    // misreported.
    if (!fs.existsSync(repo.dir)) {
      throw new Error(`migrations directory not found for ${repo.name}: ${repo.dir}`)
    }
    for (const f of fs.readdirSync(repo.dir).filter((x) => x.endsWith('.sql')).sort()) {
      out.push({ repo: repo.name, file: f, sql: clean(fs.readFileSync(path.join(repo.dir, f), 'utf8')) })
    }
  }
  return out
}

const all = files()
const contracts = {}

for (const table of UNTRACKED) {
  const c = {
    table,
    referenced_in_files: [],
    added_columns: {},
    altered_columns: [],
    foreign_keys: [],
    indexed_columns: [],
    policies: [],
    triggers: [],
    privileges: [],
    insert_columns: [],
    check_constraints: [],
  }
  const t = `(?:public\\.|private\\.)?"?${table}"?`

  for (const { repo, file, sql } of all) {
    if (!new RegExp(`\\b${table}\\b`).test(sql)) continue
    c.referenced_in_files.push(`${repo}/${file}`)

    // alter table X add column Y <type ...>  — the strongest signal: the
    // migration is stating it expects Y to already exist.
    const addCol = new RegExp(
      `alter\\s+table\\s+(?:if\\s+exists\\s+)?${t}\\s+add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?"?([a-z0-9_]+)"?\\s+([^;]*?);`,
      'gi'
    )
    for (const m of sql.matchAll(addCol)) {
      const [, col, rest] = m
      const def = rest.trim().replace(/\s+/g, ' ')
      if (!c.added_columns[col]) {
        c.added_columns[col] = { definition: def, evidence: `${repo}/${file}` }
      }
    }

    // alter table X alter column Y ... — implies Y exists and its nullability,
    // type or default is being changed. The original definition is unknown here.
    const alterCol = new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?${t}\\s+alter\\s+column\\s+"?([a-z0-9_]+)"?\\s+([^;]*?);`, 'gi')
    for (const m of sql.matchAll(alterCol)) {
      c.altered_columns.push({ column: m[1], operation: m[2].trim().replace(/\s+/g, ' '), evidence: `${repo}/${file}` })
    }

    // references X(...) — an inbound foreign key from another tracked table.
    const fk = new RegExp(`references\\s+${t}\\s*\\(([^)]*)\\)([^,;]*)`, 'gi')
    for (const m of sql.matchAll(fk)) {
      c.foreign_keys.push({ columns: m[1].trim(), clause: m[2].trim().replace(/\s+/g, ' '), evidence: `${repo}/${file}` })
    }

    // create [unique] index ... on X (...)
    const idx = new RegExp(`create\\s+(?:unique\\s+)?index\\s+(?:if\\s+not\\s+exists\\s+)?([a-z0-9_"]+)\\s+on\\s+${t}\\s*(?:using\\s+\\w+\\s*)?\\(([^)]*)\\)`, 'gi')
    for (const m of sql.matchAll(idx)) {
      c.indexed_columns.push({ name: m[1], columns: m[2].replace(/\s+/g, ' ').trim(), evidence: `${repo}/${file}` })
    }

    // create policy <name> on X ...
    const pol = new RegExp(`create\\s+policy\\s+"?([a-z0-9_]+)"?\\s+on\\s+${t}([^;]*);`, 'gi')
    for (const m of sql.matchAll(pol)) {
      c.policies.push({ name: m[1], clause: m[2].replace(/\s+/g, ' ').trim().slice(0, 300), evidence: `${repo}/${file}` })
    }

    // create trigger <name> before|after ... on X
    const trg = new RegExp(`create\\s+trigger\\s+"?([a-z0-9_]+)"?\\s+(before|after|instead\\s+of)([^;]*?)\\s+on\\s+${t}`, 'gi')
    for (const m of sql.matchAll(trg)) {
      c.triggers.push({ name: m[1], timing: m[2], detail: m[3].replace(/\s+/g, ' ').trim().slice(0, 200), evidence: `${repo}/${file}` })
    }

    // grant/revoke ... on X
    const priv = new RegExp(`(grant|revoke)\\s+([^;]*?)\\s+on\\s+(?:table\\s+)?${t}\\b([^;]*);`, 'gi')
    for (const m of sql.matchAll(priv)) {
      c.privileges.push({ action: m[1].toLowerCase(), detail: `${m[2].trim()} ${m[3].trim()}`.replace(/\s+/g, ' '), evidence: `${repo}/${file}` })
    }

    // insert into X (col, col, ...) — the columns the application writes.
    const ins = new RegExp(`insert\\s+into\\s+${t}\\s*\\(([^)]*)\\)`, 'gi')
    for (const m of sql.matchAll(ins)) {
      for (const col of m[1].split(',').map((s) => s.trim().replace(/"/g, ''))) {
        if (/^[a-z0-9_]+$/i.test(col) && !c.insert_columns.includes(col)) c.insert_columns.push(col)
      }
    }

    // check constraints naming the table's columns.
    const chk = new RegExp(`add\\s+constraint\\s+"?([a-z0-9_]+)"?\\s+check\\s*\\(([^;]*?)\\)\\s*;`, 'gi')
    for (const m of sql.matchAll(chk)) {
      c.check_constraints.push({ name: m[1], expression: m[2].replace(/\s+/g, ' ').trim().slice(0, 200), evidence: `${repo}/${file}` })
    }
  }

  contracts[table] = c
}

fs.mkdirSync(path.join(root, '.schema-capture'), { recursive: true })
fs.writeFileSync(path.join(root, '.schema-capture', 'required-contracts.json'), JSON.stringify(contracts, null, 2))

const md = []
md.push('# Contracts required of untracked tables\n')
md.push('Derived mechanically from tracked migrations in both repositories by')
md.push('`scripts/derive-required-schema-contract.mjs`. This is the input for authoring a')
md.push('baseline migration; it is **not** a schema definition and contains no `CREATE TABLE`.')
md.push('')
md.push('The authoritative shape can only come from the live staging database — see')
md.push('`scripts/capture-staging-schema.mjs` and `valu-assessments-schema-baseline.md`.\n')
md.push('A clean provision currently fails at migration 2 of 84 because these tables are')
md.push('referenced but never created. Proven by `scripts/verify-migration-reproducibility.mjs`.\n')

md.push('## Summary\n')
md.push('| table | files referencing | added columns | altered columns | indexes | policies | triggers | FKs |')
md.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
for (const t of UNTRACKED) {
  const c = contracts[t]
  md.push(
    `| \`${t}\` | ${c.referenced_in_files.length} | ${Object.keys(c.added_columns).length} | ${c.altered_columns.length} | ${c.indexed_columns.length} | ${c.policies.length} | ${c.triggers.length} | ${c.foreign_keys.length} |`
  )
}
md.push('')

for (const t of UNTRACKED) {
  const c = contracts[t]
  md.push(`## \`${t}\`\n`)
  if (Object.keys(c.added_columns).length) {
    md.push('### Columns the migrations add (so the table must already exist)\n')
    md.push('| column | definition | first evidence |')
    md.push('| --- | --- | --- |')
    for (const [col, info] of Object.entries(c.added_columns)) md.push(`| \`${col}\` | \`${info.definition}\` | ${info.evidence} |`)
    md.push('')
  }
  if (c.altered_columns.length) {
    md.push('### Columns the migrations alter (present before these migrations)\n')
    const seen = new Set()
    for (const a of c.altered_columns) {
      const k = `${a.column}|${a.operation}`
      if (seen.has(k)) continue
      seen.add(k)
      md.push(`- \`${a.column}\` — ${a.operation}  \n  ${a.evidence}`)
    }
    md.push('')
  }
  if (c.foreign_keys.length) {
    md.push('### Inbound foreign keys\n')
    for (const f of c.foreign_keys) md.push(`- \`(${f.columns})\` ${f.clause}  \n  ${f.evidence}`)
    md.push('')
  }
  if (c.indexed_columns.length) {
    md.push('### Indexes the migrations create on it\n')
    for (const i of c.indexed_columns) md.push(`- \`${i.name}\` on (${i.columns})  \n  ${i.evidence}`)
    md.push('')
  }
  if (c.policies.length) {
    md.push('### Row-level security policies\n')
    for (const p of c.policies) md.push(`- \`${p.name}\` — ${p.clause}  \n  ${p.evidence}`)
    md.push('')
  }
  if (c.triggers.length) {
    md.push('### Triggers\n')
    for (const g of c.triggers) md.push(`- \`${g.name}\` ${g.timing} ${g.detail}  \n  ${g.evidence}`)
    md.push('')
  }
  if (c.privileges.length) {
    md.push('### Privilege changes\n')
    const seen = new Set()
    for (const p of c.privileges) {
      const k = `${p.action}|${p.detail}`
      if (seen.has(k)) continue
      seen.add(k)
      md.push(`- ${p.action} ${p.detail}  \n  ${p.evidence}`)
    }
    md.push('')
  }
  if (c.insert_columns.length) {
    md.push('### Columns written by tracked migrations\n')
    md.push(c.insert_columns.map((x) => `\`${x}\``).join(', ') + '\n')
  }
  md.push('')
}

md.push('## How to use this\n')
md.push('1. Capture the live staging schema (`capture-staging-schema.mjs`) — that is the')
md.push('   authoritative definition.')
md.push('2. Reconcile it against the contracts above. A column the migrations require but')
md.push('   the live table lacks is drift; a live column not required here is still real')
md.push('   data and must be preserved.')
md.push('3. Author the baseline from the capture, then verify with')
md.push('   `verify-migration-reproducibility.mjs --baseline=<file> --compare=<capture.json>`.')
md.push('   That must take the chain from failing at migration 2 to applying all 84, with no')
md.push('   column-level differences against the capture.')
md.push('4. Review grants, ownership and RLS explicitly. A baseline that reproduces the shape')
md.push('   but drops the lockdown would be a security regression.\n')

fs.writeFileSync(path.join(root, 'docs', 'engineering', 'untracked-table-contracts.md'), md.join('\n'))

console.log('Wrote docs/engineering/untracked-table-contracts.md')
console.log('Wrote .schema-capture/required-contracts.json\n')
for (const t of UNTRACKED) {
  const c = contracts[t]
  console.log(
    `  ${t.padEnd(46)} files=${String(c.referenced_in_files.length).padStart(2)} addedCols=${String(Object.keys(c.added_columns).length).padStart(2)} altered=${String(c.altered_columns.length).padStart(2)} idx=${String(c.indexed_columns.length).padStart(2)} pol=${String(c.policies.length).padStart(2)} trg=${String(c.triggers.length).padStart(2)} fk=${String(c.foreign_keys.length).padStart(2)}`
  )
}
