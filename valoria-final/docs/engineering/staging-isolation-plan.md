# Staging isolation: current state and minimum setup

Produced by an AI agent (OpenHands) on behalf of the repository owner.

This document answers step 1 of the owner's sequence: does a dedicated staging
Supabase project exist, and if not, what is the minimum no-cost setup and what
owner actions are required. It contains no production configuration changes and
authorises none.

Every factual claim is marked **[verified]** (I observed it in this session) or
**[owner action]** (requires access I do not have).

---

## 1. Current state

**[verified] No dedicated staging Supabase project is referenced anywhere in
either repository.** Searching both `valoria-platform` and `valoria-site` for any
`https://<20 chars>.supabase.co` or `.supabase.in` host returns exactly one
result across all source, config and documentation files:

```
https://testprojectref000000.supabase.co
```

That is a placeholder used by tests (`09_taster_submission_payload_contract`,
`15_cron_gated_endpoints_runtime`, `33_environment_write_guard`). No real staging
project ref appears in any tracked file. The `.env.example` templates carry empty
values, so the staging ref has never been committed.

**[verified] GitHub environments exist, named `Preview` and `Production`,** with
no protection rules and no branch policy. Whether they hold environment-scoped
secrets or variables cannot be read with the available token (the secrets and
variables endpoints return 403). Environment *existence* does not imply the
Supabase variables inside them are correct or distinct.

**[verified] A Vercel project link exists** for the platform: `valoria-final`,
`projectId prj_…`, `orgId team_WNHL3GSlhevjZ7WEY9r9ALUw`. Preview deployments for
this project run the platform code, including the write handlers.

**[verified] The production Supabase project ref is `sbkgpisgkuhbalsxqkdr`,**
read from the publicly served production bundle. This establishes the project the
**client** is built against. It does **not** establish that
`PRODUCTION_SUPABASE_PROJECT_REF` is set in Vercel's Production scope — those are
separate facts and are kept separate here.

**[verified] The blast radius is the whole write surface, not one endpoint.**
PR #67 wires the guard into **21 of 23** API handlers. The two unguarded handlers
(`get-assessment-data`, `system-status`) are read-only. So if the guard ships
without the environment being correctly declared, essentially the entire API
stops with HTTP 503 — including signup, taster submission, assessment submission,
report generation and the cron sweeps.

### The consequence

Today, Preview and Production share one Supabase project (the only one that
exists). There is no second database to point Preview at. That is why the staging
acceptance suite has never been run: running it would write participant records
into the production database.

This is the single blocker behind the unverified 58-question journey. It is not a
code defect.

---

## 2. What "verified isolated" must mean

A Vercel Preview URL is not isolation. Isolation requires all of the following to
hold at once, each of which is a check rather than an assumption:

1. A separate Supabase project exists whose ref differs from `sbkgpisgkuhbalsxqkdr`.
2. Preview's `SUPABASE_URL` points at that project.
3. Preview's `SUPABASE_SERVICE_ROLE_KEY` is that project's key, not production's.
4. `PRODUCTION_SUPABASE_PROJECT_REF` is declared in Preview scope, so the guard can
   prove the target is not production.
5. `STAGING_SUPABASE_PROJECT_REF` is declared in Preview scope and names the staging
   project.
6. A write from the Preview deployment lands in the staging project and nowhere else.

`scripts/verify-environment-scope.mjs` checks 2–5 mechanically and refuses when any
is unsatisfied. Check 6 is the live confirmation and is the only one that needs a
deployment; it must be done **after** 1–5 pass, never before.

---

## 3. Minimum no-cost setup

Supabase's free tier allows a second project at no cost. The steps below are the
minimum to reach a verifiable staging environment.

| # | Step | Who |
| --- | --- | --- |
| 1 | Create a Supabase project for staging (free tier) | [owner action] |
| 2 | Apply the migrations to it, in the order recorded for production | [owner action] |
| 3 | Record the staging project ref (20 chars) | [owner action] |
| 4 | Set Preview-scope variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STAGING_SUPABASE_PROJECT_REF`, `PRODUCTION_SUPABASE_PROJECT_REF` | [owner action] |
| 5 | Set Production-scope `PRODUCTION_SUPABASE_PROJECT_REF` (inert until the guard ships) | [owner action] |
| 6 | Run the scope verifier against each scope and confirm it passes | agent, once access exists |
| 7 | Confirm a Preview write reaches staging only | agent, once 1–6 hold |

Steps 1–5 are the owner's because they create resources and touch configuration.
Steps 6–7 are verification and can be done by an agent with read-only access to
the environment, or by the owner running a command.

**A caution on step 2.** Applying migrations to staging is not free of decisions:
the production applied-migration history is itself in question, and the
divergence between the two repositories' migration sets has not been resolved.
Staging should be built from a migration set that is *known* to be correct, or the
first staging run will reproduce the divergence rather than reveal it. This is
the link between staging setup and the migration work, and it is why step 5 of the
owner's sequence (reassess PR #67 and migration divergence) comes after this
evidence rather than before.

---

## 4. Variables required, per scope

| Variable | Production scope | Preview scope | Secret? |
| --- | --- | --- | --- |
| `PRODUCTION_SUPABASE_PROJECT_REF` | `sbkgpisgkuhbalsxqkdr` (to confirm) | required, same value | No |
| `STAGING_SUPABASE_PROJECT_REF` | not required | the staging ref | No |
| `SUPABASE_URL` | production project URL | staging project URL | No |
| `SUPABASE_SERVICE_ROLE_KEY` | production key | staging key | **Yes** |
| `SUPABASE_ANON_KEY` | present | present | No (public by design) |
| `VALORIA_SITE_URL` | production origin | staging site origin | No |

`VALORIA_SITE_URL` matters more than it looks: it is read at **build** time by
`vite.config.js` and inlined into the assessment bundle. If it is unset on a
staging build, the assessment hands the participant back to the production site —
the account is created in the staging database and confirmed on production, and
the participant is stranded mid-journey. Any staging test that does not set it
will fail for a reason unrelated to the code under test.

---

## 5. Sequencing

The order matters because the guard fails closed and is all-or-nothing across the
API surface.

1. **Create staging and apply migrations** (owner). Nothing else can proceed.
2. **Set Preview variables** (owner). Until this is done, a Preview write is
   refused by the guard, which is safe but untestable.
3. **Set Production `PRODUCTION_SUPABASE_PROJECT_REF`** (owner). Inert while the
   guard is unmerged; required the moment it ships. Setting it before the guard
   ships carries no risk to current production behaviour because nothing reads it
   yet.
4. **Run the scope verifier** against both scopes; require zero failures.
5. **Merge PR #67** only after 1–4 hold and the verifier passes.
6. **Confirm live isolation**, then run the full journey.

Doing 5 before 1–3 would 503 the entire API on production. This is the specific
ordering hazard, and it is why the guard must not be merged on the strength of
passing tests alone: the tests exercise the decision function, not the deployed
configuration.

---

## 6. What remains unverified

- Whether the `Preview` and `Production` GitHub environments hold correct values.
- Whether a staging project exists at all (no evidence it does).
- Whether production's `PRODUCTION_SUPABASE_PROJECT_REF` is set.
- The full 58-question journey, end to end, with persisted data.
- Migration parity between the two repositories.

None of these can be closed without the owner actions above or authorised access.
