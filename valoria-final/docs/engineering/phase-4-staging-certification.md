# Phase 4 — submission integrity, database reproducibility, staging certification

Date: 2026-10-23
Status: **BLOCKED** on database reproducibility; all code-level criteria PASS.
Neither PR is merged. `main` is untouched in both repositories.

This report records what was verified, what was fixed, and what could not be
verified. Where a claim rests on a test, the test is named. Where a claim could
not be established, it is marked BLOCKED rather than assumed.

## 1. Revision state

Verified against the remote with `git ls-remote`, not from local refs.

| Repository | `main` | staging branch | PR |
| --- | --- | --- | --- |
| `valoria-platform` | `745883116698` (pinned, unchanged) | `c6e49da7f852` | #62, open, **draft**, 31 commits |
| `valoria-site` | `84693eecb533` (pinned, unchanged) | `54e292fb5a3d` | #133, open, **draft**, 29 commits |

No history was rewritten. Both `main` refs are byte-identical to their
pre-existing values. No production promotion was performed.

## 2. Acceptance criteria

| # | Criterion | Status | Basis |
| --- | --- | --- | --- |
| 1 | Assessment page and asset loading correct at the root cause | PASS | `vercel.json` rewrite excludes `api/` and extension-bearing paths; 404 for missing assets. Covered by `19_vercel_routing_contract` |
| 2 | Registration and auth handoff within this repo's responsibility | PASS | site origin resolved per-environment; no hardcoded production redirect; `14_site_url_resolution` |
| 3 | Final submit control accessible and validating | PASS | `09_submit_assessment_runtime`; handler rejects incomplete payloads before insert |
| 4 | Responses and results persist; safe duplicate and retry | PASS | Dedup index + handler 409 recovery; proven under real concurrency (16/16) |
| 5 | Canonical 58-question scoring and approved points display | PASS | `verify:scoring-parity`: 58 questions, 190 fields, identical to platform engine |
| 6 | Snapshot/taster vs full assessment distinction preserved | PASS | `20_assessment_dedup_contract`; `alreadyCompleted` semantics |
| 7 | Resume, error, loading, completion states | PASS | suite coverage; `journey/continue` continuation paths |
| 8 | Regression tests for each repair and security-sensitive operation | PASS | see §4 |

## 3. What was fixed in this phase

Four commits, all on the staging branches. Two are corrections to my own
earlier work, recorded because they changed a stated conclusion.

### 3.1 Concurrency proof for duplicate submission (platform)

The earlier dedup proof ran PGlite, a **single-connection** engine. With one
connection, transactions cannot overlap, so the race the index exists to close
was unreachable. The guarantee was asserted, not demonstrated.

`scripts/verify-concurrent-submission.mjs` starts a real multi-process
PostgreSQL server and drives 8 connections through the handler's exact
read-then-insert sequence with a barrier between the two.

- All 8 observe no existing row (the race is real).
- Exactly 1 commits; the other 7 fail with `23505` on
  `valu_assessments_taster_identity_uidx`.
- **Mutation:** with the index removed, 8/8 commit, producing 8 duplicate rows.
  This is what establishes the index is the thing closing the race.

Control cases guard against over-constraining, which would be worse than the
bug: a different snapshot may still hold its own assessment, a different
identity on the same snapshot stays distinct, and unlinked rows with a null
`taster_id` coexist.

Result: 16/16 checks pass.

### 3.2 Concurrency proof for the rate limiter (site)

Same single-connection limitation in the existing PGlite verifier. The
limiter's own comment claims two simultaneous requests cannot both be allowed;
that was untestable there.

`scripts/verify-rate-limit-concurrency.mjs` sends 16 simultaneous first
requests for one new key at a limit of 5: exactly 5 allowed, 11 refused, stored
counter stops at 5, no caller raises. The **first-request** case is the one that
matters, because without the function's `on conflict do nothing` every
concurrent first caller finds no bucket and attempts the insert.

- **Mutation:** the naive `select ... for update` + `if not found then insert`
  shape, driven from JavaScript with an explicit barrier, produces 15
  duplicate-key violations. On the two fail-closed routes that is a 503 on a
  participant's first request.

Result: 22/22 checks pass.

### 3.3 Correction — the dedup index comment overstated its role (platform)

The predicate `where taster_id is not null and identity_hash is not null` was
documented as what stops null-keyed rows colliding. **That is not true.**
PostgreSQL treats NULLs as distinct in a unique index by default, so a plain
index would not collide them either.

This was found by mutation-testing the verifier: removing the predicate from
the index definition was caught only by the index-shape check, **not** by the
null-coexistence control — because that control passes with a plain index too.
A probe now records the real reason for the predicate (scope: constrain only
the rows the application queries, and keep the index small) so the comment is
not relied on for a property the database provides.

Behaviour is unchanged. Comment, baseline document, and verifier only.

### 3.4 Correction — verifier provisioning was broken (both)

The `npm install` call passed two packages as one argv element, so `pg` was
never installed. The platform verifier had been run only with a manually
pre-populated scratch directory, so the defect never surfaced; the site
verifier was the first clean run and failed immediately. Both fixed, and both
verifiers re-run from a clean scratch directory to prove the provisioning path.

## 4. Regression and verification results

Run on the staging branches at the revisions in §1.

| Check | Result |
| --- | --- |
| Platform `test:all` | 32 suites, 466 tests, 0 findings — PASS |
| Platform `build` | PASS |
| Platform `verify:concurrent-submission` | 16/16 — PASS |
| Site `jest --ci` | 17 suites, 355 tests — PASS |
| Site `build` | PASS |
| Site `verify:scoring-parity` | 58 questions, 190 fields, identical — PASS |
| Site `verify:rate-limit-migration` (PGlite) | 21/21 — PASS |
| Site `verify:rate-limit-concurrency` | 22/22 — PASS |
| Block-scope audit (both) | 0 findings — PASS |
| Secret scan (both) | no hardcoded credentials — PASS |

## 5. BLOCKED — `valu_assessments` has no tracked definition

This is the one criterion that cannot be certified, and it blocks the claim
that the database setup is reproducible.

`public.valu_assessments` — the central record of the full assessment, read and
written by both repositories, and the target of foreign keys from three tables —
is **created by no tracked migration in either repository.**

| Check | Result |
| --- | --- |
| `create table … valu_assessments` in platform migrations | none |
| Same in site migrations | none |
| Same across full platform history (851 commits, all refs) | none |
| GitHub code search, both repositories | no `CREATE`; only `REFERENCES` and DML |
| Tracked tables in platform migrations | 21 — `valu_assessments` absent |
| Tracked tables in site migrations | 23 — `valu_assessments` absent |

`taster_sessions`, the snapshot table it depends on and which its `BEFORE
INSERT` trigger reads, has the same gap.

The table therefore originates in out-of-band DDL. The remaining candidates are
the Supabase project's own SQL history and any infrastructure-as-code outside
these two repositories; neither is inspectable from here.

A tracked migration already hardens the table on the assumption it exists
(`ALTER COLUMN report_token SET NOT NULL`), and several tracked migrations add
columns with `add column if not exists` — which is only meaningful on a table
that already exists. That is proof the base is untracked, not a documentation
gap.

**Consequence.** The shipped code-level fixes are verified independently, but a
new environment cannot be provisioned from these repositories: the two most
important tables would not exist. Full release certification is therefore
blocked.

**What is required.** A read-only inspection of the confirmed staging database
(queries in `docs/engineering/valu-assessments-schema-baseline.md` §4), turned
into a tracked baseline migration and diffed against the required contract
recorded in the same document. That contract is derived from tracked artifacts
only; **no speculative `CREATE TABLE` was authored**, because a baseline
invented from handler assumptions would look authoritative while silently
disagreeing with production.

## 6. Cross-repository integration contract

### Callback and redirect contract

`valoria-site` owns `/auth/callback`. `valoria-platform` must never build an
auth callback against its own deployment host.

- Site origin is resolved by `lib/site-url.js`, in order:
  `VALORIA_SITE_URL` → `SITE_ORIGIN` → `NEXT_PUBLIC_SITE_URL` → production.
- `VERCEL_URL` is deliberately **excluded**: it names the platform's own
  deployment (`valoria-final-*`), not the site. Using it would build
  `https://valoria-final-<hash>.vercel.app/auth/callback` — a route that does
  not exist there, on an ephemeral host, behind Deployment Protection.
- On a non-production deployment with no origin configured, the resolver warns
  loudly rather than silently mailing a production link.
- The journey email's CTA is asserted on its **rendered** destination
  (`/profile/edit` on the resolved origin), not on the presence of a variable.

### Environment variables required

| Variable | Where | Purpose |
| --- | --- | --- |
| `VALORIA_SITE_URL` | platform, per environment | site origin for auth redirects and journey links |

### Supabase Auth URL allowlist — required action, not performed

Staging confirmation links will not resolve until the staging site origin is
added to the Supabase Auth redirect allowlist and the confirmation template's
`redirect_to` is permitted. **This was not changed.** It is shared production
configuration and requires authorization. Setting `VALORIA_SITE_URL` alone is
insufficient.

## 7. Unresolved blockers and configuration dependencies

| # | Blocker | Owner action required |
| --- | --- | --- |
| B1 | `valu_assessments` and `taster_sessions` have no tracked `CREATE` | Capture the staging schema (baseline doc §4) and commit a baseline migration |
| B2 | Supabase Auth allowlist does not include the staging origin | Add it, and permit `redirect_to` in the confirmation template |
| B3 | `VALORIA_SITE_URL` must be set on the staging platform deployment | Set it; without it, staging mails production links |
| B4 | Preview deployments are Deployment-Protection gated | Provide a bypass secret or disable protection for previews, or staging E2E cannot be driven |

## 8. What is not claimed

- Not claimed: that the database is reproducible. It is not (§5).
- Not claimed: that a fix is complete because it compiled or deployed. Every
  fix above rests on an executed test; the concurrency claims rest on
  mutation-tested runs against a real multi-process server.
- Not claimed: that staging end-to-end registration and confirmation were
  exercised. They are blocked by B1–B4. The verifications performed are
  unit, contract, and real-database integration tests.
- Neither PR is merged, no deployment was promoted, and `main` is unchanged.
