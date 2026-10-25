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
npm run verify:concurrent-submission        # proves the duplicate race is closed under real concurrency
npm run verify:deployment-routing           # applies Vercel rewrite order to the real dist/ tree
npm run build
```

## Deployment routing

Vercel reads `vercel.json` from the **project root** and nothing else. A
`public/vercel.json` is copied by Vite into `dist/`, where Vercel never looks, so
it is inert — but it will be read by whoever debugs a 404 next, and if it holds a
naive `/(.*)` → `/index.html` catch-all it tells them to reintroduce the asset/MIME
defect. Keep exactly one config, at the root. `24_deployment_config_integrity`
enforces this.

`verify:deployment-routing` checks routing **offline** against the real build
output, so it works while previews are SSO-gated. Run `npm run build` first. It
asserts that every asset referenced by `dist/index.html` exists at the path the
browser requests, that no asset-like path can be answered by the SPA fallback,
that application routes still are, and that the API prefixes resolve ahead of the
fallback. Before/after on the fixed config: 12/19 → 19/19.

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

PGlite is a single-connection engine, so it cannot exercise a race: with one
connection transactions cannot overlap. Where a constraint exists to make
concurrent writers safe, verify it with `scripts/verify-concurrent-submission.mjs`,
which starts a real multi-process PostgreSQL server and drives separate
connections through the handler's read-then-insert sequence with a barrier
between the two. It provisions binaries with `--no-save` into `.pg-verify/`
(git-ignored). A mutation run with the constraint removed must produce
duplicates; if it does not, the test is not exercising the race.

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

## Verification harnesses

`scripts/verify-migration-reproducibility.mjs` replays the tracked migrations
against a real PostgreSQL (embedded, `--no-save` into `.pg-verify/`, git-ignored).
Two modes:

- default — this repository's 84 migrations alone.
- `--shared` (`npm run verify:migration-reproducibility:shared`) — both
  repositories' migrations into one database, in version order, because that is
  the sequence a real database receives. This is the provisioning question; the
  default mode answers a different one ("is this repository self-sufficient").

Two things about this harness are easy to get wrong:

1. The shim sets `search_path` with `alter database`, which only applies to
   connections opened afterwards. The replay client is already connected when the
   shim runs, so `connect()` sets `search_path` per session. Without it, every
   unqualified pgcrypto call fails and the harness reports a migration defect that
   does not exist.
2. A failure count is not a defect count. `20260827_marketplace_governance_v4.sql`
   is the only tracked migration that creates `schema private`, and it fails
   partway through, so its transaction rolls back and the schema is gone. The 20
   migrations that then fail on `schema "private" does not exist` are one cascade.

The schema baseline is larger than handler-reading suggests: seven tables are
created by no tracked migration in either repository (see
`docs/engineering/valu-assessments-schema-baseline.md` §5).

## Cross-repository migration versions

The two repositories share one database, so a version used in both is applied
once and the other file is skipped silently. `src/__tests__/29_cross_repo_migration_versions.test.js`
pins the known collisions and fails on a new one rather than picking a winner —
resolving one means renumbering, which is a human decision. It skips the
cross-repository assertions when the sibling checkout is absent (CI), with a
warning; a check that cannot see the other repository must not report success.

## Testing asset serving

A missing asset and a mis-served asset look the same in the browser. The
dangerous one is a script request falling through the SPA catch-all and receiving
`index.html` as `text/html`; the browser reports a MIME type error, and a
status-200 check passes. `scripts/verify-asset-serving.mjs` serves the real
`dist/` through the real `vercel.json` rewrites and asserts the body is the asset.
It evaluates the config's `source` patterns as the regular expressions Vercel
compiles them to — reimplementing a pattern is how a test passes while the config
it checks has changed. Runs in the CI build job.

## Mutation-test every guard

Every guard added here has been checked by breaking the thing it guards and
confirming the test fails: the dollar-quote guards, the migration collision guard,
the capture script's `--expect-host` production guard, and the asset verifier. A
guard that has never failed has not been shown to work. The asset verifier's first
version passed 10/10 with the incident reintroduced; that is what prompted the
rewrite, and it is the reason the mutation step is not optional.
