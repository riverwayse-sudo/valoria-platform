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

## A preview deployment must not write to production

`lib/environment-guard.js` refuses a privileged write from a non-production
deployment. Before it existed, Vercel's preview environment carried the same
Supabase URL and service-role key as production and no handler checked
`VERCEL_ENV`, so a preview built from any branch could write real participant
data. That is why the staging acceptance suite was never run: running it would
have written to production.

The decision is a pure function (`decideWriteAllowed`) so every environment
combination is testable without a deployment. A privileged write needs the runtime
identity **and** the target database positively identified; nothing is allowed by
default:

* `VERCEL_ENV=production` -> target must match `PRODUCTION_SUPABASE_PROJECT_REF`.
* `VERCEL_ENV` set to anything else -> target must match `STAGING_SUPABASE_PROJECT_REF`.
* `VERCEL_ENV` unset/empty -> refused unless `ALLOW_LOCAL_PRIVILEGED_WRITES` is
  exactly `true`, and then the target must still match the staging ref.

The first version of this guard allowed an unset `VERCEL_ENV` outright, reasoning
that Vercel always sets it. That is a hole, not a convenience: a deployment whose
`VERCEL_ENV` failed to propagate, or any runtime Vercel does not manage, was
treated as local development and could write with production credentials. Do not
reintroduce a bare "not on Vercel, so allow" branch. The local-development path is
opt-in through a named variable and is still pinned to the declared project, so it
cannot reach production without someone declaring the production ref as the
staging ref.

Every branch fails closed with a 503 naming the reason.

Two more properties, both found by adversarial tests rather than by reading the code:

* A non-production runtime may not target production, however it is labelled. If
  `STAGING_SUPABASE_PROJECT_REF` names the production project, a non-production
  runtime is refused. Without this, a misspelled `VERCEL_ENV` plus a staging
  declaration naming production would reach production — the failure this guard
  exists to prevent.
* A declared ref is trimmed and lowercased; a target never is. The declaration is
  operator-managed, so a copy-paste slip must not lock a deployment out of its own
  database. Normalising a declaration cannot widen access: it maps a declaration
  onto the same project, never onto a different one.

Test the guard against a target that merely *contains* the ref, not only against an
unrelated one. `evil-<ref>.supabase.co`, `<ref>.supabase.co.evil.example` and
`<ref>.pooler.supabase.com` must all deny; a regex that searched for the ref
anywhere would have accepted them.

All 20 handlers that hold the service-role key and write call it. Put the call on
the **write path**, not at the top of the handler: `assessment-progress.js` serves
a read-only resume GET and a write POST, and `notifications.js` reads on GET and
writes on PATCH. A top-of-handler guard breaks the read.

Count the writers with a script, not by eye. Grepping for `method: 'POST'` with
single quotes found 12; the real number is 20, because some files use double
quotes and some write through `/auth/v1/admin` instead. The test that asserts
completeness accepts either quote style for that reason. The site has the same
shape and a harder edge: five `/api` routes plus `/journey/continue` write inside
their **GET** handler, so the site guard treats a listed path as a write whatever
the method. `src/__tests__/environment-write-guard.test.js` fails if a writing GET
route is added without listing it.

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

Mutate the **wrapper**, not only the pure function. A mutation of
`privilegedWriteAllowed`'s `=== 'true'` check survived the first version of the
environment-guard suite, because every test passed `allowLocalWrites` straight to
`decideWriteAllowed` and never exercised the environment parsing. The fix was a
test that drives the wrapper through `process.env`. Parsing code is part of the
guard; if no test touches it, it is unverified.

## Migration collisions in a shared database

The two repositories share one database, and each holds migrations the other does
not, so the shared sequence is the union — 135 migrations — and no single
repository can reproduce it. `docs/engineering/migration-collision-register.md`
records every version collision with evidence.

Two cross-repository collisions differ in kind and must not be treated alike:

- `20260908150000` is a provisioning gap. The platform file adds four
  `taster_sessions` handoff columns and creates the trigger that uses them; the
  site file of the same version does neither, and nothing later restores them. So
  whichever file loses, the other's work is silently skipped. The tempting
  "resolution" — delete the losing file — would remove the only creator of the
  handoff mechanism. `src/__tests__/31_shared_database_object_coverage.test.js`
  guards the objects rather than the versions, because a version check cannot see
  this: the version exists in both repositories either way.
- `20260921121500` is mostly superseded. Six of its seven objects are redefined by
  later versions, which live in *different repositories*; only
  `sync_professional_capability` is defined here and nowhere later.

Resolution needs the recorded versions from the database. Do not renumber from
source, do not delete a file to silence the guard, and do not mark a migration
applied to get past an error.

## The `private` schema cascade

29 of the 112 failures in the shared replay are one rollback. `schema private` is
created only by `20260827_marketplace_governance_v4.sql`, which then fails on a
missing table, so the schema rolls back with it and every later consumer fails on
`schema "private" does not exist`. `scripts/verify-schema-rollback.mjs` measures
this on a real PostgreSQL: a schema created inside a failing transaction is lost,
one created in an earlier committed transaction survives. That is why the fix is
to create the schema once, early, on its own — and why attributing those 29
failures to missing tables would be wrong.

A failure count is never a defect count. Classify before acting: Supabase-managed
infrastructure (`cron`, `storage.buckets`, `pg_net`) is absent from a bare
PostgreSQL and is a harness limitation, not a defect.

## Verifier placement in CI

Verifiers are split by what they actually need. `verify:ci` runs without a build
(block-scope, dedup, concurrency, schema rollback); `verify:build` runs in the
build job because it reads the built `dist/` tree. Check the dependency rather
than guessing from a grep: `verify-assessment-dedup-migration` and
`verify-concurrent-submission` both match `dist`, but only as the pglite module
path, not the build output. Putting them in a build job would be a mistake, and
putting `verify:deployment-routing` in a job without a build fails CI — as it did
once.

## The staging capture instrument

`scripts/capture-staging-schema.mjs` is the only way to answer the questions the
collision register is blocked on: which of two same-version files actually ran
(from `supabase_migrations.schema_migrations.statements`), and the live body of
the objects the collisions define (`pg_get_functiondef`). It is read-only, and it
refuses to run without `--expect-host` matching the connection host.

`scripts/verify-capture-tooling.mjs` exercises it against a disposable fixture and
runs in CI. Keep that test passing: an instrument that fails on first use wastes the
access window it was built for. Writing it found a real defect — a query using only
`$2` bound against `[null, …]` fails with `could not determine data type of
parameter $1`, because pg cannot infer the type of an unused positional parameter.
**Give every query a single `$1` and bind by name**, rather than padding gaps.

The fixture is synthetic. Passing the self-test is tool readiness, not staging
evidence, and the script says so on success. Never present it as verification of
staging.

## Access blockers are not code problems

Preview SSO and the missing staging credentials cannot be worked around in code.
`docs/engineering/staging-access-request.md` records the exact change each blocker
needs, the authorizer, and the criteria each unblocks. Do not disable deployment
protection, promote a preview, or point the capture at a host that is not staging to
make a check pass.

## Summarise the migration replay by cause, not by count

`npm run verify:migration-reproducibility:shared` reports "112 migrations failed",
which is true and nearly useless. `node scripts/classify-migration-failures.mjs`
turns it into a cause breakdown and writes
`docs/engineering/migration-failure-register.md`. Run it after every replay.

Summarising by hand got it wrong twice, so the classification is a script with a
mutation-verified test (`src/__tests__/32_migration_failure_classification.test.js`):

- Do not call a failure a "baseline gap" until you have checked whether the object
  has a creator that itself failed earlier in the same run. Those are cascades.
- A creator can be a **view**, not only a table. `marketplace_public_roster` and
  `marketplace_professionals` are views; scanning only for `create table` reported
  them as gaps.
- Supabase infrastructure (`cron`, `storage.buckets`, `pg_net`) must be reported
  separately from the defect count. A bare PostgreSQL has none of it, so those
  failures say nothing about the migration set.

Corrected split: 49 baseline gaps + 3 ordering defects = 52 real defects, not 83.
