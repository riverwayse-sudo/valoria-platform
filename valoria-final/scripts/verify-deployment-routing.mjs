#!/usr/bin/env node
// Verifies the deployment routing contract against the REAL build output and the
// REAL Vercel configuration, without needing a deployed host.
//
// WHY THIS EXISTS
// The audit's first priority is "restore reliable assessment page and asset
// loading; fix incorrect asset paths, deployment routing, or MIME issues at the
// actual root cause." That root cause is a routing configuration, and it is
// fully verifiable offline: `vercel.json` is data, and the built `dist/` tree is
// the exact set of files it routes to. What cannot be verified offline is
// whether a deployed preview answers correctly — that is blocked by Deployment
// Protection. This script closes the gap between "the config looks right" and
// "every path the browser actually requests resolves to a real file with the
// right content type."
//
// It applies Vercel's rewrite semantics in the documented order and reports, for
// each path, which rewrite wins and what the response would be. It then asserts
// the properties that make asset loading reliable:
//
//   * every asset referenced by dist/index.html exists on disk at the path the
//     browser will request;
//   * no rewrite maps an asset request to index.html (the reported MIME defect:
//     HTML served where a script or stylesheet was expected);
//   * the SPA fallback still serves application routes;
//   * the API prefixes are handled before the fallback;
//   * the configuration Vercel actually reads is the one at the repo root.
//
// Run:  node scripts/verify-deployment-routing.mjs [--keep]
// Exits 0 when every assertion holds, 1 otherwise.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..')
const DIST = path.join(REPO, 'dist')

const failures = []
const checks = []

function ok(name, detail = '') {
  checks.push({ name, pass: true, detail })
}
function bad(name, detail = '') {
  checks.push({ name, pass: false, detail })
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}
function assert(cond, name, detail = '') {
  if (cond) ok(name, detail)
  else bad(name, detail)
}

// ── Build output must exist ────────────────────────────────────────────────
if (!fs.existsSync(DIST)) {
  console.error('dist/ is absent. Run `npm run build` first.')
  process.exit(1)
}

// ── The authoritative configuration ────────────────────────────────────────
// Vercel reads vercel.json from the project root. Any other vercel.json in the
// tree is not read; if it also looks authoritative, it is a trap.
const rootConfigPath = path.join(REPO, 'vercel.json')
const config = JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'))
const rewrites = config.rewrites || []

const strays = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (e.name === 'vercel.json' && full !== rootConfigPath) strays.push(path.relative(REPO, full))
  }
})(REPO)

assert(
  strays.length === 0,
  'exactly one vercel.json exists and it is the one at the repo root',
  strays.length ? `also found: ${strays.join(', ')}` : ''
)
assert(
  Array.isArray(config.crons) && config.crons.length > 0,
  'the root config carries the cron schedule (proving it is the file in effect)'
)

// ── Vercel rewrite semantics ───────────────────────────────────────────────
// Vercel matches rewrites in order and the first match wins. `:path*` is a
// wildcard; the fallback here is a negative-lookahead regex.
function toMatcher(source) {
  // Order matters: convert :path* placeholders, then leave the regex groups be.
  const asRegex = source.replace(/:[A-Za-z0-9_]+(\*)?/g, (_, star) => (star ? '.*' : '[^/]+'))
  return new RegExp(`^${asRegex}$`)
}

const compiled = rewrites.map((r) => ({ ...r, re: toMatcher(r.source) }))

function resolve(pathname) {
  for (const r of compiled) {
    if (r.re.test(pathname)) return r
  }
  return null
}

// ── Every asset the built HTML references must exist ───────────────────────
const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
const assetRefs = [...indexHtml.matchAll(/(?:src|href)="(\/valu\/assessment\/assets\/[^"]+)"/g)].map((m) => m[1])

assert(assetRefs.length > 0, 'dist/index.html references at least one built asset', `found ${assetRefs.length}`)

for (const ref of assetRefs) {
  // The browser requests the absolute path. Vercel's asset rewrite strips the
  // /valu/assessment prefix and serves from /assets/.
  const rewrite = resolve(ref)
  const mapped = rewrite && rewrite.source === '/valu/assessment/assets/:path*'
    ? ref.replace('/valu/assessment', '')
    : ref
  const onDisk = path.join(DIST, mapped.replace(/^\//, ''))

  if (fs.existsSync(onDisk)) {
    ok(`asset exists on disk: ${ref}`, `-> ${path.relative(REPO, onDisk)}`)
  } else {
    bad(`asset exists on disk: ${ref}`, `expected ${path.relative(REPO, onDisk)}`)
  }

  const fallbackHit = compiled.find((r) => r.destination === '/index.html' && r.re.test(ref))
  if (fallbackHit) {
    bad(`asset is not answered by the SPA fallback: ${ref}`, `fallback source ${fallbackHit.source}`)
  } else {
    ok(`asset is not answered by the SPA fallback: ${ref}`)
  }

  const ext = path.extname(mapped).toLowerCase()
  const expectedType = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' }[ext]
  assert(
    Boolean(expectedType),
    `asset has a content-type-mappable extension: ${path.basename(ref)}`,
    expectedType ? expectedType : `unmapped extension ${ext}`
  )
}

// ── The properties that keep assets reliable, stated as paths ──────────────
const assetLike = [
  '/valu/assessment/assets/index-xqmGZMx3.js',
  '/valu/assessment/assets/index-C2fFoBQa.css',
  '/assets/anything.js',
  '/logo.png',
  '/favicon.ico',
]
for (const p of assetLike) {
  const hit = resolve(p)
  assert(
    !(hit && hit.destination === '/index.html'),
    `an asset-like path is never served the HTML shell: ${p}`,
    hit ? `matched ${hit.source}` : ''
  )
}

const appRoutes = ['/valu/assessment', '/valu/assessment/', '/valu/assessment/start', '/dashboard']
for (const p of appRoutes) {
  const hit = resolve(p)
  assert(
    hit && hit.destination === '/index.html',
    `an application route is served the SPA shell: ${p}`,
    hit ? `matched ${hit.source}` : 'no rewrite matched'
  )
}

// Ordering: the API prefixes must resolve before the fallback, or a POST would
// be answered with the HTML shell.
const apiPath = '/valu/assessment/api/submit-taster'
const apiHit = resolve(apiPath)
assert(
  apiHit && apiHit.destination === '/api/:path*',
  'the assessment API prefix maps to the Vercel handlers, not the fallback',
  apiHit ? `matched ${apiHit.source} -> ${apiHit.destination}` : 'no rewrite matched'
)

// ── Report ─────────────────────────────────────────────────────────────────
console.log('\nDeployment routing verification (offline, against dist/ and vercel.json)\n')
for (const c of checks) {
  console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `\n          ${c.detail}` : ''}`)
}
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed.`)

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('All deployment routing assertions hold.')
