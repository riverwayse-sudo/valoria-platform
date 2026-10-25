// valoria-final/scripts/verify-asset-serving.mjs
//
// Incident: the assessment page loaded no CSS or JS. The build emits assets under
// /valu/assessment/assets/, because vite.config.js sets `base`, and vercel.json
// rewrites that prefix back to /assets/. Two things can break this, and both
// present identically in the browser — an unstyled page and a console full of
//
//   Refused to execute script ... MIME type ('text/html') is not executable
//
// The first is a wrong path: the asset is requested somewhere the server does not
// serve it. The second is the more deceptive one: the request falls through the
// SPA fallback, which returns index.html with `text/html` for a request that
// expected JavaScript, and the MIME complaint is a symptom of the wrong *body*,
// not a wrong Content-Type header. A test that only checks status 200 passes on
// both. This checks the body is the asset, by content type and by shape.
//
// It serves the real dist/ through the real vercel.json rewrites, so it fails for
// the same reasons the deployment would.

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const root = process.cwd()
const distDir = path.join(root, 'dist')
const configPath = path.join(root, 'vercel.json')

const failures = []
let checks = 0

function check(name, ok, detail = '') {
  checks++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `\n          ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

if (!fs.existsSync(distDir)) {
  console.error('No dist/ directory. Run `npm run build` first, or pass --build.')
  process.exit(2)
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

// Turn Vercel's path patterns into matchers. Vercel compiles `source` to an
// anchored regular expression, substituting :params. The patterns here have no
// params, so the source is itself the expression — evaluated as one, rather than
// reimplemented. Reimplementing it is how a test passes while the configuration
// it is supposed to check has changed underneath it.
function compile(source) {
  if (source.includes(':path*')) {
    const prefix = source.slice(0, source.indexOf(':path*'))
    return { kind: 'prefix', prefix, capture: (p) => p.slice(prefix.length) }
  }
  return { kind: 'regex', re: new RegExp(`^${source}$`) }
}

const rewrites = config.rewrites.map((r) => ({ ...r, m: compile(r.source) }))

// Vercel applies rewrites in array order and the first match wins. Preserving
// that order matters: the catch-all is last, so the prefix rewrites take
// precedence, and a test that evaluated the catch-all first would report a
// different, wrong answer.
function resolve(pathname) {
  for (const r of rewrites) {
    if (r.m.kind === 'prefix' && pathname.startsWith(r.m.prefix)) {
      return r.destination.replace(':path*', r.m.capture(pathname))
    }
    if (r.m.kind === 'regex' && r.m.re.test(pathname)) return r.destination
  }
  return pathname
}

// The MIME types a browser will actually execute or apply. A .js served as
// text/html is refused; that is the failure this guards against.
const TYPES = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.ico': 'image/x-icon',
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const target = resolve(pathname)
  const file = path.join(distDir, target.replace(/^\/+/, ''))
  const rel = path.relative(distDir, file)

  if (rel.startsWith('..') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('not found')
    return
  }
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(fs.readFileSync(file))
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

async function get(p) {
  const res = await fetch(base + p, { redirect: 'manual' })
  const body = await res.text()
  return { status: res.status, type: res.headers.get('content-type') || '', body }
}

try {
  const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')

  // Every asset the built page asks for must come back as that asset, not as HTML.
  const refs = [...html.matchAll(/(?:src|href)="(\/valu\/assessment\/[^"]+)"/g)].map((m) => m[1])
  console.log(`\n1. the ${refs.length} build-referenced asset(s) under /valu/assessment/`)
  check('index.html references at least one asset', refs.length > 0, 'no asset references found')
  for (const ref of refs) {
    const r = await get(ref)
    const isHtml = r.type.includes('text/html')
    check(`${ref} served as an asset, not the SPA fallback`, r.status === 200 && !isHtml,
      `status ${r.status}, content-type ${r.type}`)
    // The body check: a fallback response is the index document, which contains
    // the mount point. A real asset does not.
    check(`${ref} body is not index.html`, !r.body.includes('<div id="root"'),
      'the body is the index document')
  }

  console.log('\n2. the entry document')
  const entry = await get('/valu/assessment/')
  check('/valu/assessment/ serves index.html', entry.status === 200 && entry.type.includes('text/html'),
    `status ${entry.status}, content-type ${entry.type}`)

  console.log('\n3. deep links fall back to the app, not to a 404')
  const deep = await get('/valu/assessment/results/example')
  check('a client route serves the app shell', deep.status === 200 && deep.type.includes('text/html'),
    `status ${deep.status}, content-type ${deep.type}`)

  console.log('\n4. a request for a script or stylesheet must never return the app shell')
  // This is the MIME incident in one line, and it needs care to test. A request
  // under /valu/assessment/assets/ is caught by the asset rewrite before the
  // catch-all sees it, so it can never reveal a bad catch-all. The revealing case
  // is a script or stylesheet *outside* that prefix — a lazily imported chunk, a
  // source map, a nested asset — which reaches the catch-all directly. There the
  // extension exclusion in the catch-all decides whether the request 404s or
  // receives index.html with `text/html`, which the browser then refuses to
  // execute. Checking only the assets prefix passes either way.
  for (const p of [
    '/valu/assessment/chunk-does-not-exist.js',
    '/valu/assessment/nested/chunk-does-not-exist.js',
    '/valu/assessment/theme-does-not-exist.css',
    '/valu/assessment/assets/does-not-exist.js',
  ]) {
    const r = await get(p)
    check(`${p} does not return the app shell`, r.status === 404,
      `status ${r.status}, content-type ${r.type}`)
    check(`${p} is not served as HTML`, !r.type.includes('text/html'),
      `content-type ${r.type}`)
  }

  console.log('\n5. the api prefix is rewritten away from the app shell')
  const api = await get('/valu/assessment/api/health')
  check('an api request does not receive index.html', !api.type.includes('text/html'),
    `status ${api.status}, content-type ${api.type}`)
} finally {
  server.close()
}

console.log(`\n${checks - failures.length}/${checks} checks passed`)
if (failures.length) {
  console.log('\nfailed:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('Asset serving matches the deployment configuration.')
