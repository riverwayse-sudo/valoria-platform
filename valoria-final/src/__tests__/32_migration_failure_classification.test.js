/**
 * Regression test for the migration-failure classifier.
 *
 * The classifier turns "112 migrations failed" into a cause breakdown. That
 * breakdown drives what gets fixed and what gets reported as a harness
 * limitation, so a wrong classification is worse than no classification: it
 * sends the next person to fix the wrong thing, or to dismiss a real gap as
 * infrastructure.
 *
 * Two specific errors this locks out, both of which occurred while writing it:
 *
 *   1. A view was not counted as a creator. marketplace_public_roster and
 *      marketplace_professionals are views, so the classifier reported them as
 *      baseline gaps even though a tracked migration creates them. That inflated
 *      the gap set from 7 objects to 9.
 *   2. A creator that exists but failed earlier in the same run was classified as
 *      a baseline gap, which inflated the gap count and hid how much of the chain
 *      is one failure propagating.
 *
 * The test runs the real classifier against a synthetic fixture, so it asserts
 * the classification logic rather than a copy of it.
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..', '..')
const classifier = path.join(repoRoot, 'scripts', 'classify-migration-failures.mjs')

function buildFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'valoria-classify-'))
  const migrations = path.join(dir, 'migrations')
  fs.mkdirSync(path.join(migrations, 'platform'), { recursive: true })
  fs.mkdirSync(path.join(migrations, 'site'), { recursive: true })

  // A creator that FAILS (it needs the absent `baseline_only`).
  fs.writeFileSync(
    path.join(migrations, 'platform', '20260102_creates_failing.sql'),
    'create table public.failing_creator (id uuid);\n'
  )
  // Needs `failing_creator` -> cascade, because its creator failed.
  fs.writeFileSync(
    path.join(migrations, 'platform', '20260103_needs_failing.sql'),
    'alter table public.failing_creator add column x int;\n'
  )
  // Needs `shared_ok`, which succeeded but later (20260109 > 20260104) -> ordering.
  fs.writeFileSync(
    path.join(migrations, 'platform', '20260104_needs_ok_later.sql'),
    'select * from public.shared_ok;\n'
  )
  // Creates a VIEW over an absent table -> the view is a creator that fails.
  fs.writeFileSync(
    path.join(migrations, 'platform', '20260105_creates_view.sql'),
    'create view public.roster_view as select 1;\n'
  )
  // Needs the view -> cascade (creator failed), NOT a baseline gap.
  fs.writeFileSync(
    path.join(migrations, 'platform', '20260106_needs_view.sql'),
    'select * from public.roster_view;\n'
  )
  // Needs an object nothing creates -> baseline gap.
  fs.writeFileSync(
    path.join(migrations, 'platform', '20260107_needs_gap.sql'),
    'select * from public.baseline_only;\n'
  )
  // Needs `shared_ok` created at 20260109, i.e. AFTER this file -> ordering.
  fs.writeFileSync(
    path.join(migrations, 'site', '20260108_needs_ok_much_later.sql'),
    'select * from public.shared_ok;\n'
  )
  fs.writeFileSync(
    path.join(migrations, 'site', '20260109_creates_ok_late.sql'),
    'create table public.shared_ok (id uuid);\n'
  )
  // Supabase infrastructure -> must be classed infra, never a gap.
  fs.writeFileSync(
    path.join(migrations, 'site', '20260110_needs_cron.sql'),
    'select cron.schedule();\n'
  )
  // The private-schema cascade.
  fs.writeFileSync(
    path.join(migrations, 'site', '20260111_needs_private.sql'),
    'select private.thing();\n'
  )

  const failures = [
    { file: 'platform:20260102_creates_failing.sql', code: '42P01', message: 'relation "public.baseline_only" does not exist' },
    { file: 'platform:20260103_needs_failing.sql', code: '42P01', message: 'relation "public.failing_creator" does not exist' },
    { file: 'platform:20260104_needs_ok_later.sql', code: '42P01', message: 'relation "public.shared_ok" does not exist' },
    { file: 'platform:20260105_creates_view.sql', code: '42P01', message: 'relation "public.baseline_only" does not exist' },
    { file: 'platform:20260106_needs_view.sql', code: '42P01', message: 'relation "public.roster_view" does not exist' },
    { file: 'platform:20260107_needs_gap.sql', code: '42P01', message: 'relation "public.baseline_only" does not exist' },
    { file: 'site:20260108_needs_ok_much_later.sql', code: '42P01', message: 'relation "public.shared_ok" does not exist' },
    { file: 'site:20260110_needs_cron.sql', code: '3F000', message: 'schema "cron" does not exist' },
    { file: 'site:20260111_needs_private.sql', code: '3F000', message: 'schema "private" does not exist' },
  ]
  const failuresPath = path.join(dir, 'failures.json')
  fs.writeFileSync(failuresPath, JSON.stringify(failures, null, 2))
  return { dir, migrations, failuresPath, out: path.join(dir, 'register.md') }
}

function classify(fixture) {
  execFileSync('node', [
    classifier,
    `--failures=${fixture.failuresPath}`,
    `--out=${fixture.out}`,
    `--migrations=${fixture.migrations}`,
  ], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'inherit'] })
  return fs.readFileSync(fixture.out, 'utf8')
}

describe('migration failure classifier', () => {
  let fixture
  let md

  beforeAll(() => {
    fixture = buildFixture()
    md = classify(fixture)
  })

  afterAll(() => {
    if (fixture) fs.rmSync(fixture.dir, { recursive: true, force: true })
  })

  // The ordering and baseline sections have two-column rows, so parse the full
  // four-column failure list specifically.
  function classOf(file) {
    const section = md.split('## Full failure list')[1]
    const line = section.split('\n').find((l) => l.startsWith(`| \`${file}\` |`))
    if (!line) throw new Error(`no register row for ${file}`)
    return line.split('|')[3].trim().replace(/`/g, '')
  }

  test('an object no migration creates is a baseline gap', () => {
    expect(classOf('platform:20260107_needs_gap.sql')).toBe('baseline-gap')
    expect(classOf('platform:20260102_creates_failing.sql')).toBe('baseline-gap')
  })

  test('a view is treated as a creator, so its dependent is a cascade not a gap', () => {
    // The regression: omitting `create view` from the creator patterns reported
    // roster_view as a baseline gap.
    expect(classOf('platform:20260106_needs_view.sql')).toBe('cascade-creator-failed')
  })

  test('an object whose creator failed earlier is a cascade, not a gap', () => {
    expect(classOf('platform:20260103_needs_failing.sql')).toBe('cascade-creator-failed')
  })

  test('an object whose creator succeeded later is an ordering defect', () => {
    expect(classOf('platform:20260104_needs_ok_later.sql')).toBe('ordering-late')
    expect(classOf('site:20260108_needs_ok_much_later.sql')).toBe('ordering-late')
  })

  test('supabase infrastructure is classified separately, never as a gap', () => {
    expect(classOf('site:20260110_needs_cron.sql')).toBe('infra')
  })

  test('the private-schema failure is its own class', () => {
    expect(classOf('site:20260111_needs_private.sql')).toBe('private-cascade')
  })

  test('the baseline-gap list names only objects nothing creates', () => {
    const section = md.split('## Baseline gaps')[1].split('## Ordering')[0]
    const objects = [...section.matchAll(/^\| `([a-z0-9_]+)` \|/gm)].map((m) => m[1])
    expect(objects).toContain('baseline_only')
    // Neither of these is a gap: both have tracked creators.
    expect(objects).not.toContain('roster_view')
    expect(objects).not.toContain('failing_creator')
    expect(objects).not.toContain('shared_ok')
  })

  test('infrastructure is reported separately from the defect count', () => {
    const section = md.split('Supabase-infrastructure')[1].split('## Cascade')[0]
    expect(section).toContain('cron')
    const summary = md.split('## Summary')[1].split('## Baseline gaps')[0]
    // The infra row must carry the "not a defect" wording.
    expect(summary).toMatch(/infra.*Harness limitation, not a defect/s)
  })
})
