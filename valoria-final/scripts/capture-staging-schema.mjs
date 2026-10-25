#!/usr/bin/env node
// Captures the authoritative schema of the staging database, so the
// `valu_assessments` / `taster_sessions` baseline can be authored from evidence
// instead of inferred from handler code.
//
// WHY THIS EXISTS
// Phase 4 established that neither table is created by any tracked migration in
// either repository, yet both are referenced by application code, foreign keys
// and triggers. A `CREATE TABLE` written from handler assumptions would look
// authoritative while silently disagreeing with the live database, so no
// speculative baseline was authored. This script produces the evidence needed
// to author one correctly.
//
// It is READ ONLY. Every statement is a SELECT against catalog views. It creates
// nothing, alters nothing, and writes only local files.
//
// USAGE
//   STAGING_DATABASE_URL='postgresql://...' \
//     node scripts/capture-staging-schema.mjs --expect-host=<db-host>
//
// `--expect-host` is required. The connection is refused unless the URL's host
// matches it, so a production connection string cannot be used by mistake. The
// password is never printed or written to any output file.
//
// OUTPUT (git-ignored directory)
//   .schema-capture/capture.json      machine-readable full capture
//   .schema-capture/drift-report.md   live schema vs tracked migrations vs contract
//
// Exit 0 on a successful capture, 1 on refusal or error.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const TARGET_TABLES = ['valu_assessments', 'taster_sessions']
const root = process.cwd()
const OUT_DIR = path.join(root, '.schema-capture')
const CACHE_DIR = path.join(root, '.pg-verify')

// The contract Phase 4 derived from tracked migrations and handler code. The
// drift report checks the live schema against it, so a live column that is
// absent here, or a required column missing live, is reported rather than
// passed over.
const REQUIRED_COLUMNS = {
  valu_assessments: [
    'id', 'taster_id', 'user_id', 'identity_hash', 'name', 'role', 'total_score',
    'designation', 'completed_at', 'expires_at', 'report_token', 'report_status',
    'report_attempts', 'report_locked_at', 'report_idempotency_key',
    'report_failure_code', 'assessment_version', 'scoring_version', 'rubric_version',
    'linked_at', 'reminder_count', 'last_reminder_at', 'skill_scores',
  ],
}

const MIGRATION_DIRS = [
  path.join(root, 'supabase', 'migrations'),
  '/workspace/project/valoria-site/supabase/migrations',
]

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

function hostOf(connectionString) {
  try {
    return new URL(connectionString).hostname
  } catch {
    return null
  }
}

function loadPg() {
  const entry = path.join(CACHE_DIR, 'node_modules', 'pg', 'lib', 'index.js')
  if (!fs.existsSync(entry)) {
    console.log('Installing the pg client into .pg-verify (package.json is not modified)...')
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--prefix', CACHE_DIR, 'pg'], {
      cwd: root,
      stdio: 'inherit',
    })
  }
  return import(pathToFileURL(entry).href).then((m) => m.default || m)
}

const connectionString =
  process.env.STAGING_DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
const expectHost = argValue('expect-host')

if (!connectionString) {
  console.error(
    'Refusing to run: no connection string.\n' +
      'Set STAGING_DATABASE_URL to the STAGING database connection string.\n' +
      'This script is read-only, but it must not be pointed at production by accident.'
  )
  process.exit(1)
}
if (!expectHost) {
  console.error(
    'Refusing to run: --expect-host=<db-host> is required.\n' +
      'It is checked against the connection string so a production host cannot be used by mistake.\n' +
      'Example: --expect-host=db.abcdefghijkl.supabase.co'
  )
  process.exit(1)
}
const actualHost = hostOf(connectionString)
if (actualHost !== expectHost) {
  console.error(`Refusing to run: connection host "${actualHost}" does not match --expect-host="${expectHost}".`)
  process.exit(1)
}

// Every query below is a SELECT. Grouped so the JSON output is self-describing.
const QUERIES = {
  server: `select version() as version, current_database() as database, current_user as role,
                  (select count(*)::int from pg_extension) as extension_count`,

  extensions: `select extname as name, extversion as version, n.nspname as schema
                 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
                order by extname`,

  all_public_tables: `select c.relname as table_name, c.relkind as kind,
                             c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
                             pg_catalog.obj_description(c.oid, 'pg_class') as comment
                        from pg_class c join pg_namespace n on n.oid = c.relnamespace
                       where n.nspname = 'public' and c.relkind in ('r','p','v','m')
                       order by c.relkind, c.relname`,

  all_public_sequences: `select c.relname as sequence_name
                           from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where n.nspname = 'public' and c.relkind = 'S'
                          order by c.relname`,

  columns: `select table_name, ordinal_position, column_name, data_type, udt_name,
                   is_nullable, column_default, is_identity, identity_generation,
                   is_generated, generation_expression,
                   character_maximum_length, numeric_precision, numeric_scale
              from information_schema.columns
             where table_schema = 'public' and table_name = any($1)
             order by table_name, ordinal_position`,

  constraints: `select c.relname as table_name, con.conname as constraint_name,
                       con.contype as type,
                       pg_get_constraintdef(con.oid, true) as definition,
                       case con.contype when 'f' then (
                         select format('%s.%s', fn.nspname, fc.relname)
                           from pg_class fc join pg_namespace fn on fn.oid = fc.relnamespace
                          where fc.oid = con.confrelid) end as references_table,
                       con.condeferrable as deferrable, con.convalidated as validated
                  from pg_constraint con join pg_class c on c.oid = con.conrelid
                  join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = any($1)
                 order by c.relname, con.contype, con.conname`,

  indexes: `select tablename as table_name, indexname as index_name, indexdef as definition
              from pg_indexes where schemaname = 'public' and tablename = any($1)
             order by tablename, indexname`,

  triggers: `select c.relname as table_name, t.tgname as trigger_name,
                    pg_get_triggerdef(t.oid, true) as definition,
                    t.tgenabled as enabled,
                    p.proname as function_name,
                    pg_get_functiondef(p.oid) as function_source
               from pg_trigger t join pg_class c on c.oid = t.tgrelid
               join pg_namespace n on n.oid = c.relnamespace
               join pg_proc p on p.oid = t.tgfoid
              where n.nspname = 'public' and c.relname = any($1) and not t.tgisinternal
              order by c.relname, t.tgname`,

  rls_policies: `select c.relname as table_name, p.polname as policy_name,
                        case p.polcmd when 'r' then 'select' when 'a' then 'insert'
                             when 'w' then 'update' when 'd' then 'delete' else 'all' end as command,
                        p.polpermissive as permissive,
                        pg_get_expr(p.polqual, p.polrelid) as using_expression,
                        pg_get_expr(p.polwithcheck, p.polrelid) as check_expression,
                        coalesce((select array_agg(r.rolname order by r.rolname)
                                    from pg_roles r where r.oid = any(p.polroles)), '{}') as roles
                   from pg_policy p join pg_class c on c.oid = p.polrelid
                   join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname = any($1)
                  order by c.relname, p.polname`,

  table_privileges: `select table_name, grantee, privilege_type, is_grantable
                       from information_schema.role_table_grants
                      where table_schema = 'public' and table_name = any($1)
                      order by table_name, grantee, privilege_type`,

  column_privileges: `select table_name, column_name, grantee, privilege_type
                        from information_schema.column_privileges
                       where table_schema = 'public' and table_name = any($1)
                       order by table_name, column_name, grantee, privilege_type`,

  sequences_owned: `select s.relname as sequence_name, c.relname as table_name, a.attname as column_name
                      from pg_class s
                      join pg_depend d on d.objid = s.oid and d.deptype in ('a','i')
                      join pg_class c on c.oid = d.refobjid
                      join pg_attribute a on a.attrelid = c.oid and a.attnum = d.refobjsubid
                      join pg_namespace n on n.oid = s.relnamespace
                     where n.nspname = 'public' and s.relkind = 'S'
                     order by s.relname`,

  inbound_fks: `select c.relname as referencing_table, con.conname as constraint_name,
                       pg_get_constraintdef(con.oid, true) as definition
                  from pg_constraint con join pg_class c on c.oid = con.conrelid
                  join pg_class fc on fc.oid = con.confrelid
                  join pg_namespace n on n.oid = c.relnamespace
                 where con.contype = 'f' and n.nspname = 'public' and fc.relname = any($1)
                 order by c.relname, con.conname`,

  dependent_views: `select distinct v.relname as view_name, 'view' as kind
                      from pg_depend d
                      join pg_rewrite rw on rw.oid = d.objid
                      join pg_class v on v.oid = rw.ev_class
                      join pg_class t on t.oid = d.refobjid
                      where t.relname = any($1) and v.relkind in ('v','m')
                    order by v.relname`,

  dependent_functions: `select distinct p.proname as function_name, n.nspname as schema
                          from pg_depend d
                          join pg_proc p on p.oid = d.objid
                          join pg_namespace n on n.oid = p.pronamespace
                          join pg_class t on t.oid = d.refobjid
                         where t.relname = any($1) and n.nspname = 'public'
                         order by p.proname`,

  // Supabase records applied migrations in this schema. Reading it shows which
  // tracked migrations the staging database believes it has run, which is how
  // the untracked DDL can be located in the project's own history.
  migration_history: `select version, name, inserted_at
                        from supabase_migrations.schema_migrations
                       order by version`,

  // Any table the live database has that no tracked migration creates. This is
  // the general form of the Phase 4 finding, not limited to the two tables.
  untracked_candidates: `select c.relname as table_name
                           from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where n.nspname = 'public' and c.relkind = 'r'
                          order by c.relname`,
}

// Table names created by tracked migrations in either repository.
function trackedTableNames() {
  const names = new Set()
  for (const dir of MIGRATION_DIRS) {
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8')
      for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.|private\.)?"?([a-z0-9_]+)"?/gi)) {
        names.add(m[1].toLowerCase())
      }
    }
  }
  return names
}

const Pg = await loadPg()
const client = new Pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

const capture = { captured_at: new Date().toISOString(), host: actualHost, queries: {}, errors: {} }

try {
  await client.connect()
  console.log(`Connected to ${actualHost} (read-only capture).\n`)

  for (const [key, sql] of Object.entries(QUERIES)) {
    try {
      const params = /any\(\$1\)/.test(sql) ? [TARGET_TABLES] : []
      const res = await client.query(sql, params)
      capture.queries[key] = res.rows
      console.log(`  captured ${key} (${res.rows.length} rows)`)
    } catch (err) {
      // A missing catalog view (for example supabase_migrations on a non-Supabase
      // database) must not abort the whole capture.
      capture.errors[key] = err.message.split('\n')[0]
      console.log(`  skipped  ${key} — ${err.message.split('\n')[0]}`)
    }
  }
} catch (err) {
  console.error(`\nConnection failed: ${err.message.split('\n')[0]}`)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}

// ── drift analysis ───────────────────────────────────────────────────────────
const tracked = trackedTableNames()
const liveTables = (capture.queries.untracked_candidates || []).map((r) => r.table_name)
const untrackedLive = liveTables.filter((t) => !tracked.has(t))

const drift = []
for (const table of TARGET_TABLES) {
  const cols = (capture.queries.columns || []).filter((c) => c.table_name === table)
  if (cols.length === 0) {
    drift.push({ table, finding: 'NOT PRESENT in the captured database' })
    continue
  }
  const liveNames = new Set(cols.map((c) => c.column_name))
  const required = REQUIRED_COLUMNS[table] || []
  const missing = required.filter((c) => !liveNames.has(c))
  const extra = cols.map((c) => c.column_name).filter((c) => !required.includes(c) && required.length > 0)
  drift.push({
    table,
    column_count: cols.length,
    missing_vs_contract: missing,
    not_in_contract: extra,
    rls: (capture.queries.all_public_tables || []).find((t) => t.table_name === table)?.rls_enabled ?? null,
    trigger_count: (capture.queries.triggers || []).filter((t) => t.table_name === table).length,
    policy_count: (capture.queries.rls_policies || []).filter((p) => p.table_name === table).length,
  })
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'capture.json'), JSON.stringify(capture, null, 2))

const md = []
md.push('# Staging schema capture and drift report\n')
md.push(`Captured: ${capture.captured_at}`)
md.push(`Host: \`${actualHost}\``)
md.push(`Database: \`${capture.queries.server?.[0]?.database ?? 'unknown'}\``)
md.push(`Server: \`${(capture.queries.server?.[0]?.version ?? 'unknown').split(' ').slice(0, 2).join(' ')}\`\n`)
md.push('Read-only capture. No schema was modified. Credentials are not recorded here.\n')

md.push('## 1. Tables in the live database that no tracked migration creates\n')
if (untrackedLive.length === 0) {
  md.push('None — every live table is accounted for by a tracked migration.\n')
} else {
  md.push('These are the general form of the Phase 4 finding. Each is a table that exists in')
  md.push('staging but cannot be provisioned from source:\n')
  for (const t of untrackedLive) md.push(`- \`${t}\``)
  md.push('')
}

md.push('## 2. Target tables vs the contract derived from tracked artifacts\n')
for (const d of drift) {
  md.push(`### \`${d.table}\`\n`)
  if (d.finding) {
    md.push(`**${d.finding}**\n`)
    continue
  }
  md.push(`- columns: ${d.column_count}`)
  md.push(`- RLS enabled: ${d.rls}`)
  md.push(`- triggers: ${d.trigger_count}`)
  md.push(`- policies: ${d.policy_count}`)
  md.push(`- required by contract but absent live: ${d.missing_vs_contract.length ? d.missing_vs_contract.join(', ') : 'none'}`)
  md.push(`- present live, not in the contract: ${d.not_in_contract.length ? d.not_in_contract.join(', ') : 'none'}`)
  md.push('')
}

md.push('## 3. Applied-migration history\n')
const hist = capture.queries.migration_history
if (!hist) {
  md.push(`Not readable: ${capture.errors.migration_history ?? 'unavailable'}\n`)
} else {
  md.push(`${hist.length} migrations recorded as applied. The newest 10:\n`)
  md.push('| version | name | inserted_at |')
  md.push('| --- | --- | --- |')
  for (const m of hist.slice(-10)) md.push(`| ${m.version} | ${m.name} | ${m.inserted_at} |`)
  md.push('')
}

md.push('## 4. Next step\n')
md.push('Author the baseline migration from `capture.json`, not from this summary. The full')
md.push('column, constraint, index, trigger, policy and privilege definitions are there.')
md.push('Review grants, ownership and RLS before committing anything — a baseline that')
md.push('reproduces the shape but drops the lockdown would be a security regression.\n')

fs.writeFileSync(path.join(OUT_DIR, 'drift-report.md'), md.join('\n'))

console.log(`\nWrote ${path.relative(root, OUT_DIR)}/capture.json`)
console.log(`Wrote ${path.relative(root, OUT_DIR)}/drift-report.md`)
console.log(`\nTables live but untracked (${untrackedLive.length}): ${untrackedLive.join(', ') || 'none'}`)
console.log('Review the drift report before authoring any baseline migration.')
