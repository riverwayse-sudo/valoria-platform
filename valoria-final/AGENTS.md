# valoria-platform (valoria-final) — working notes

Shared database with `valoria-site`. Cross-repository contracts are documented in
`valoria-site/docs/PLATFORM_INTEGRATION_CONTRACT.md`; staging operator actions in
`valoria-site/docs/STAGING_UNBLOCK_CHECKLIST.md`. Keep both in sync when the
handoff changes.

## Layout

`api/` Vercel serverless handlers · `src/` the Vite assessment SPA ·
`supabase/migrations/` tracked DDL · `scripts/` offline checkers.

## Commands

```
npm run test:all                       # block-scope check + jest
npm run check:block-scope              # static: vars read outside their block
npm run verify:assessment-dedup-migration   # executes a migration on real PostgreSQL
npm run build
```

## Untracked database objects

A route calling `supabase.rpc('name', ...)` or inserting a column proves nothing
about whether `name` or that column exists in any deployed database.

`public.valu_assessments` is created by **no tracked migration in either
repository**. Its columns, defaults and indexes exist only as DDL applied by hand
to whichever database the submission path was first tested against. Two shipped
defects came from this single root cause:

* `api/submit-assessment.js` never set `report_token`, which is `NOT NULL` with a
  unique index and has no tracked default. Every submission depended on an
  untracked `DEFAULT`; where it was absent the insert failed with `23502` and the
  participant saw "Could not save your result." The handler now generates the
  token itself (`randomUUID()`, `node:crypto`) and must keep doing so.
* Nothing enforced uniqueness on the dedup key `(taster_id, identity_hash)`. The
  handler's read-then-write guard cannot be correct alone: two retries that both
  look up before either insert both insert. `20261023130000_unique_full_assessment_per_snapshot.sql`
  adds the missing partial unique index. The loser gets `23505`, which PostgREST
  reports as `409` — the branch the handler already recovers through. Either half
  without the other is broken.

Before trusting a column, default or constraint, check that a migration in
`supabase/migrations/` (here or in the site repo) actually creates it. The proper
fix for this class is capturing the live schema as a tracked baseline migration,
which needs read access to the deployed database.

## Proving SQL

Static assertions over a migration file cannot show that it executes or that its
constraints behave. `scripts/verify-assessment-dedup-migration.mjs` runs the SQL
against a real PostgreSQL engine (PGlite) and checks behaviour, including the
refusal path over pre-existing duplicates. It provisions PGlite into
`.pglite-verify/` (git-ignored) rather than node_modules, and leaves
`package.json` untouched.

## Handler correctness

`api/submit-assessment.js` shipped a bug that a substring assertion could not
catch: a `const` declared inside a `try` and read after it threw `ReferenceError`
on every first-time submission *after* the row was written, so participants were
charged an assessment and shown a save failure. Runtime coverage that executes the
real handler with only `global.fetch` stubbed is the standard here
(`09_submit_assessment_runtime.test.js`); do not rely on text assertions alone.
`npm run check:block-scope` guards that specific shape across `api`, `src`, `lib`.

## Environment

Never hardcode `https://valoriainstitute.com` as a functional link. Use
`lib/site-url.js` `resolveSiteUrl()` (`VALORIA_SITE_URL` → `SITE_ORIGIN` →
`NEXT_PUBLIC_SITE_URL` → production). `VERCEL_URL` is excluded on purpose: the two
projects deploy separately, so it names *this* deployment, not the site, and the
site's `/auth/callback` route does not exist here. Branding (logo, `mailto:`,
bare-domain footer text) stays canonical; navigation links must not.
