# Phase 5 — remediation, regression testing, staging certification

Date: 2026-10-23
Status: **BLOCKED** on the database baseline (B1) and on Deployment Protection
(B4). Every code-level criterion is PASS. Neither PR is merged. `main` is
untouched in both repositories.

This report states what was verified, what was fixed, and what could not be
verified. Where a claim rests on a test or a script, the artifact is named and its
current output quoted. Where a claim could not be established, it is marked
BLOCKED rather than assumed. Nothing here is claimed on the basis that it
compiled or deployed.

## 1. Revision state

Verified against the remote with `git ls-remote`, not from local refs.

| Repository | `main` | staging branch | PR |
| --- | --- | --- | --- |
| `valoria-platform` | `745883116698` | `c162473be6f3` | #62, open, **draft** |
| `valoria-site` | `84693eecb533` | `631310424596` | #133, open, **draft** |

Both `main` refs are byte-identical to their Phase 4 values. No history was
rewritten, no force-push was performed, and no production promotion occurred.

## 2. Acceptance criteria

| # | Criterion | Status | Basis |
| --- | --- | --- | --- |
| 1 | Assessment page and asset loading correct at the root cause | PASS | `verify:deployment-routing` 19/19; `24_deployment_config_integrity`; §3.1 |
| 2 | Registration and auth handoff within this repo's responsibility | PASS | `handoff-wire-contract` (site, 11); `27_handoff_wire_contract` (platform, 8); §3.4 |
| 3 | Final submit control accessible and validating | PASS | `25_submit_control_contract` (12); §3.2 |
| 4 | Responses and results persist; safe duplicate and retry | PASS | `verify:concurrent-submission` 16/16; `26_progress_persistence_contract` (9); §3.3 |
| 5 | Canonical 58-question scoring and approved points display | PASS | `verify:scoring-parity`: 58 questions, 190 fields identical |
| 6 | Snapshot/taster vs full assessment distinction preserved | PASS | `20_assessment_dedup_contract`; `getValuTier` requires `level === 'full'` |
| 7 | Resume, error, loading, completion states | PASS | §3.3; `03_state_paths`; `journey-integrity-contract` |
| 8 | Regression tests for each repair and security-sensitive operation | PASS | §4 |
| — | Staging end-to-end certification | **BLOCKED** | Deployment Protection SSO, §6 |
| — | Clean-database provisioning from source | **BLOCKED** | B1, §5 |

## 3. What was fixed in this phase

Five commits, all on the staging branches. Each is a root-cause fix with a
mutation-verified guard.

### 3.1 A dead routing config that contradicted the live one (platform)

The repository carried two `vercel.json` files. Vercel reads exactly one, from
the project root. `public/vercel.json` was copied by Vite into `dist/`, where
Vercel never looks. It was therefore inert — but not harmless: it contained a
complete catch-all `/(.*)` → `/index.html` with no exclusions, which is precisely
the fallback already fixed at the root because it served `index.html` for missing
assets. That is the reported asset/MIME failure. The next person debugging a 404
opens the config sitting next to the build output, and it tells them to
reintroduce the defect. Deleted.

`scripts/verify-deployment-routing.mjs` closes the gap between "the config looks
right" and "every path the browser requests resolves to a real file with the
right content type". It applies Vercel's documented rewrite order to the real
`dist/` tree. It runs offline, so it works while the previews are SSO-gated.

Same script, same build, both configurations:

| Configuration | Result |
| --- | --- |
| pre-fix (naive catch-all, stray config present) | **12/19** — assets and the assessment API both answered by the fallback |
| fixed | **19/19** |

The seven pre-fix failures are the incident, reproduced and then closed.

### 3.2 The final submit control did not work (platform)

`submitAssessment()` returns early unless a live handoff token is present. The
button was rendered whenever the last question was on screen and disabled only
when that question was unanswered — it did not reflect the token. A participant
whose handoff had lapsed saw a fully styled, enabled SUBMIT button, clicked it,
and nothing happened: no request, no error, no state change. Every guard in that
handler returned silently.

Readiness now covers every precondition the handler enforces and drives both
`disabled` and `aria-disabled`, so the state is announced rather than only
dimmed. The handler no longer returns silently: a lapsed handoff and an
unanswered final question each set an error naming the problem, and the render
adds a hint under the control for the disabled cases, including how many
questions are outstanding.

Retry behaviour is unchanged: the re-entrancy guard is kept, `finally {
setSaving(false) }` re-enables the control after a failure, and the token is
cleared only on a terminal outcome, so a retry after a network failure reuses the
same handoff.

### 3.3 The footer claimed progress was saved when the save had failed (platform)

The footer told every participant "Progress is saved automatically." Both
persistence paths caught their errors and discarded them — the debounced autosave
ended in `.catch(() => {})`, and `persistCheckpoint()` acted only on handoff
errors. A participant whose session had expired, or who had lost connectivity,
answered questions under a footer promising their work was safe, and could close
the tab on an assessment the server had never received. Resume reads the server
row, so the work was gone.

This is the same class of defect as §3.2: the interface asserted something untrue
about the user's data. Both paths now record an outcome and the footer reports
what happened, announced via `role="status"`. The two failure kinds are
distinguished: an expired handoff is recoverable by reopening from the account,
so it keeps its `account_required` transition, while a transport failure is
reported as a save problem.

The local mirror is untouched and still written independently of the server save,
so an in-progress assessment survives a refresh even when the server write fails.
The test asserts it stays unconditional.

### 3.4 The handoff wire format had only one end tested (both)

The site → platform handoff is a cross-repository wire format with no shared
schema. The site already asserted it puts the token in the fragment; nothing
asserted the shape of what it puts there, and the platform had no assertion that
it reads the token from the fragment. Moving the token to the query string — or
changing the reader to look there — would leave both suites green while the
handoff broke for every participant, and would leak the token into server logs
and `Referer` headers.

Each repository now pins its own end against the contract in
`docs/PLATFORM_INTEGRATION_CONTRACT.md`: token in the fragment, identity in the
query string, destination from `VALU_ASSESSMENT_URL` and never a hardcoded
preview host, fragment cleared after capture, token kept in session storage not
local storage, and the token exchanged for server confirmation before the
assessment becomes usable.

### 3.5 A migration that cannot apply to a clean database (platform, B1)

`20260827_marketplace_governance_v4.sql` declared `language plpgsql` on a wrapper
whose body is a bare `select ...`. PostgreSQL rejects this. It had not surfaced
because the migration was applied live through another path; only a clean-server
replay reaches it. Changed to `language sql`. Guarded in both repositories by
`23_migration_language_contract.test.js` (8) and
`migration-language-contract.test.js` (8).

## 4. Regression and verification results

### 4.1 Suites

| Repository | Suites | Tests | Block-scope findings |
| --- | --- | --- | --- |
| `valoria-platform` | 37 passed | 520 passed | 0 |
| `valoria-site` | 19 passed | 374 passed | 0 |

Both builds succeed. Site `npm run build` runs `design:check` and
`excellence:check` in `prebuild` and completes.

### 4.2 Verifiers

| Command | Repository | Result |
| --- | --- | --- |
| `verify:deployment-routing` | platform | 19/19 |
| `verify:concurrent-submission` | platform | 16/16 |
| `verify:assessment-dedup-migration` | platform | 14/14 |
| `verify:schema-contract` | platform | 10 untracked tables, contracts derived, no `CREATE TABLE` |
| `verify:scoring-parity` | site | 58 questions, 190 fields, identical |
| `verify:rate-limit-migration` | site | 21/21 |
| `verify:rate-limit-concurrency` | site | 22/22 |

### 4.3 Mutation testing

Every new guard was mutation-tested: the target defect was reintroduced and the
guard confirmed to fail. A guard that passes against the defective code would be
decorative, so this is the check that the guard has force.

| Guard | Mutation | Result |
| --- | --- | --- |
| `24_deployment_config_integrity` | restore stray config | 1 fail |
| `24_deployment_config_integrity` | widen fallback | 8 fail |
| `25_submit_control_contract` | restore silent return | 1 fail |
| `25_submit_control_contract` | revert to partial disabled check | 1 fail |
| `26_progress_persistence_contract` | restore silent swallow | 1 fail |
| `27_handoff_wire_contract` | read token from query string | 1 fail |
| `27_handoff_wire_contract` | stop clearing the fragment | 1 fail |
| `handoff-wire-contract` (site) | token into query string | 1 fail |
| `handoff-wire-contract` (site) | hardcode preview host | 1 fail |
| `23_migration_language_contract` | restore `plpgsql` | 2 fail |
| `migration-language-contract` (site) | inject a defective migration | 1 fail |

One guard was found weak by this process and strengthened: the first version of
the silent-return assertion matched only the guard's presence, not its absence of
a message, and did not fail on the mutation. It now rejects any blocking guard
that returns without setting an error, except the re-entrancy guard.

## 5. BLOCKED — B1, the `valu_assessments` / `taster_sessions` baseline

`npm run verify:migration-reproducibility` on a clean server:

```
84 migrations found
applied 12/84
23 distinct root cause(s)
36 migrations reference valu_assessments or taster_sessions
valu_assessments: ABSENT
taster_sessions:  ABSENT
NOT REPRODUCIBLE: the chain stops at 20260816_admin_governance_transitions.sql
```

Neither table is created by any tracked migration in either repository, yet both
are referenced by application code, foreign keys and triggers. This is the B1
blocker and it is not resolvable from the source trees.

The migration-language defect in §3.5 was one cause among the 23 and is now
fixed. The remaining 22 are consequences of the absent baseline: once the tables
exist, the migrations that reference them can apply. Fixing them individually
would be treating symptoms.

**A `CREATE TABLE` was deliberately not authored.** Writing one from handler
assumptions would produce a file that looks authoritative while silently
disagreeing with the live database — worse than the gap, because it would be
trusted. The resolution is to capture the real schema, which is what
`scripts/capture-staging-schema.mjs` does.

### The precise access required

```
STAGING_DATABASE_URL='postgresql://<user>:<password>@<staging-db-host>:5432/<db>' \
  node scripts/capture-staging-schema.mjs --expect-host=<staging-db-host>
```

`--expect-host` is required and the connection is refused unless the URL host
matches, so a production connection string cannot be used by mistake. The script
is read-only: every statement is a `SELECT` against catalog views. It creates
nothing, alters nothing, and writes only to the git-ignored `.schema-capture/`
directory. The password is never printed or written to any output file.

From that capture the baseline is authored and verified offline with
`verify:migration-reproducibility --baseline=<file> --compare=.schema-capture/capture.json`,
which must take the chain from 12/84 to 84/84 with no column-level differences.
No production database read or write is required or requested.

## 6. BLOCKED — B4, staging end-to-end certification

Both previews are behind Vercel Deployment Protection. Verified again this phase:

| Preview | Response |
| --- | --- |
| `valoria-final-git-remediati-28f871-…` | `302` → `https://vercel.com/sso-api?url=…` |
| `valoria-site-git-remediatio-b16efb-…` | `302` → `https://vercel.com/sso-api?url=…` |

A bogus `x-vercel-protection-bypass` header does not help. No automated request
can reach the running application, so registration, confirmation, assessment
progression, submission, persistence, refresh/resume and score calculation
**cannot be exercised end-to-end on staging**. They are verified at the unit,
contract and offline-routing layers only, and are not claimed as end-to-end
verified.

Unblocking requires one of, from the project owner:

1. A **Protection Bypass for Automation** secret (Vercel → Project Settings →
   Deployment Protection → Generate Secret), supplied to this session; or
2. Deployment Protection set to **Only Production Deployments** for the preview
   environment; or
3. An explicit instruction that end-to-end staging verification is out of scope
   for this phase.

The design decision that made §3.1 verifiable despite this block is worth
recording: routing correctness was moved into an offline check against the real
build output, so the most important incident of this phase has before/after
evidence without needing a reachable host.

## 7. Cross-repository integration contract

The full contract is in `valoria-site/docs/PLATFORM_INTEGRATION_CONTRACT.md`. The
parts that matter to this repository:

### site → platform handoff (producer: site, consumer: platform)

| Element | Location | Value |
| --- | --- | --- |
| destination | query | `VALU_ASSESSMENT_URL` (env-specific) |
| `full` | query | `1` |
| `taster_id`, `name`, `role`, `experience` | query | snapshot identity |
| `handoff_token` | **fragment** | signed, time-limited, 14400s |

The token is in the fragment so browsers do not send it to the server. Moving it
to the query string is a security regression. The platform verifies it with
`action:'verify-handoff'` before the assessment becomes usable and discards it on
rejection.

### platform → site redirects (producer: platform, consumer: site)

| Element | Variable | Notes |
| --- | --- | --- |
| site origin | `VALORIA_SITE_URL` | **build-time**; inlined by Vite `define` as `__SITE_ORIGIN__` |
| site callback | `{site-origin}/auth/callback` | email confirmation |
| password reset | `{site-origin}/reset-password` | recovery |

Because the platform inlines the origin at build time, `VALORIA_SITE_URL` must be
present in the Preview **build** scope. Setting it at runtime only will not change
the links baked into the bundle.

### Environment variables required on staging

| Project | Scope | Variable | Value |
| --- | --- | --- | --- |
| platform | Preview (build) | `VALORIA_SITE_URL` | staging site origin |
| site | Preview | `NEXT_PUBLIC_SITE_URL` | the **same** staging site origin |
| site | Preview | `VALU_ASSESSMENT_URL` | staging assessment origin |
| site | Preview | `VALU_UPSTREAM_ORIGIN` | staging assessment origin (origin only, no path) |

All four must agree on one staging origin. None may be set to the production
domain to make a test pass; that is the exact defect `lib/site-url.js` and
`src/lib/site-url.js` exist to prevent.

### Supabase Auth — required action, not performed

The staging origin must be added to the Auth **redirect URL allowlist**, and the
confirmation templates must point at `{staging-origin}/auth/callback`. **No shared
production configuration was altered**, and none of the above was applied. These
are operator actions listed in `docs/STAGING_UNBLOCK_CHECKLIST.md` §2–§3.

## 8. What is not claimed

* No fix is claimed complete on the basis that it compiled or deployed.
* Staging end-to-end behaviour is **not** verified. §6 states why.
* Clean-database provisioning is **not** achieved. §5 states why.
* The `valu_assessments` baseline was **not** invented. §5 states why.
* No production configuration, database, or deployment was read, written, or
  promoted.
* No participant identity, historical taster result, full assessment, or
  canonical score was deleted or modified. Every change is to code, tests, and
  documentation; the migration edit changes a language declaration on a wrapper
  function and alters no data.
* Both PRs remain **draft and unmerged**.
