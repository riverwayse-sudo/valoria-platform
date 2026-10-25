# Staging access request — what is blocked and exactly what unblocks it

Phase 7 cannot be completed without three authorized access changes. They are not
code problems, and no amount of code work substitutes for them. This records the
precise change each one needs, who has to authorize it, and which acceptance
criteria each one blocks, so the request can be actioned without a follow-up
round-trip.

Nothing here has been applied. No shared or production configuration was changed.

## 1. Preview deployment access (Vercel)

**Observed.** Both preview deployments for the current branch head return a
redirect to Vercel SSO instead of the application:

| Deployment | Commit | Response |
| --- | --- | --- |
| `valoria-final-kr7c5cva0-…vercel.app` | `f4ae32f` (platform) | `302 → vercel.com/sso-api` |
| `valoria-site-rn631y09f-…vercel.app` | `454b1ae` (site) | `302 → vercel.com/sso-api` |

Both are deployment-scoped preview hosts (`kr7c5cva0`, `rn631y09f`), so they are
previews, not production. The redirect happens before any application code runs, so
the assessment page, its assets and its MIME types cannot be checked against a live
deployment from here.

**Required, in order of preference:**

1. **Protection Bypass for Automation.** Vercel → Project → Settings → Deployment
   Protection → "Protection Bypass for Automation" → Generate Secret. The secret is
   then sent as a header (`x-vercel-protection-bypass`) or a query parameter. This
   leaves protection on for everyone else. This is the preferred option.
2. If (1) is not acceptable: set Vercel Authentication to "Only Production
   Deployments", so previews are reachable while production stays protected.

**Not acceptable:** disabling deployment protection entirely, or promoting a
preview to production to make it reachable. Neither is authorized and both weaken
the boundary this branch is required to preserve.

**Authorizer:** the Vercel project owner for the `valoria-institute-s-projects`
team.

**Blocks:** browser-based staging acceptance (directive step 6, items 1–11) in
full; the staging authentication and callback verification (step 5); and any claim
that the assessment journey works end to end.

## 2. Read-only staging database access (Supabase)

**Observed.** No staging connection string is available in the execution
environment, and it cannot be obtained: the GitHub secrets API returns
`403 Resource not accessible by integration` for both repositories, and the
organization secrets endpoint returns `404`. The only credential present is
`GITHUB_TOKEN`.

**Required:** a **read-only** connection string for the staging database, supplied
as the `STAGING_DATABASE_URL` secret, plus the expected host to pass to
`--expect-host`. Read-only is sufficient and is what the capture uses: every
statement it issues is a `SELECT` against catalog views.

The capture refuses to run without `--expect-host`, and refuses if the connection
host does not match it, so a production string cannot be used by mistake. Output
goes to `.schema-capture/`, which is git-ignored, and the password is never written
to any output file.

**Command, once the secret exists:**

```bash
STAGING_DATABASE_URL='<staging connection string>' \
  node scripts/capture-staging-schema.mjs --expect-host=<staging db host>
```

**What that single run answers** — the four questions the migration-collision
register is blocked on:

1. which version is recorded for each collision, i.e. which of two same-version
   files actually ran (from `supabase_migrations.schema_migrations.statements`);
2. whether `taster_sessions` has `user_id`, `linked_at`, `reminder_count`,
   `last_reminder_at` and whether `trg_link_taster_to_profile` exists;
3. the live body of `private.sync_professional_capability`;
4. whether any of the date-only files were applied by version or by hand.

It also produces the schema capture the seven-table baseline must be authored from.
**The baseline will not be written from assumptions.** A `CREATE TABLE` guessed
from handler code would look authoritative while silently disagreeing with the live
database, which is the failure this phase exists to prevent.

If a full connection string cannot be granted, the equivalent minimum is the output
of these two queries run by someone with access, returned as text:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('valu_assessments','taster_sessions','professional_profiles',
                      'valoria_journey_events','assessment_sessions',
                      'professional_standard_event_registrations','users')
 order by table_name, ordinal_position;
```

That is less complete than the capture, but it answers questions 1, 2 and 4 and
unblocks the collision resolution.

**Authorizer:** the Supabase project owner.

**Blocks:** the baseline (clean provisioning), the migration-collision resolutions,
and every acceptance criterion that depends on the database being reproducible.

## 3. Supabase Auth URL configuration (staging only)

**Required:** add the staging site origin and the staging platform origin to the
Supabase Auth redirect allowlist, and point the confirmation email template's
redirect at the agreed dashboard journey, for the **staging project only**.

The contract these URLs must satisfy is documented in
`docs/engineering/cross-repository-callback-contract.md`. The specific values are
environment-specific and must not be hardcoded to a preview host, because preview
hosts change on every deployment.

**Not acceptable:** changing the production allowlist, or hardcoding a preview
deployment host as a permanent destination.

**Authorizer:** the Supabase project owner, with sign-off on the template change.

**Blocks:** registration, email confirmation, callback and dashboard handoff on
staging (directive step 5 and step 6 items 2–3, 7).

## What is not blocked

The code-level work is complete and verified independently of the above: the
regression suites, the deterministic verifiers, the schema-rollback behaviour, the
collision register, and the object-coverage guard all run without credentials and
all pass. The capture instrument is ready and self-tested. What cannot be done is
any claim that the database is reproducible or that the live journey works, because
neither has been observed.

## Status

| Acceptance criterion | Status | Blocked by |
| --- | --- | --- |
| Branch, draft PR, `main` untouched | PASS | — |
| Collision register, evidence-based | PASS | — |
| Guard against destructive collision resolution | PASS | — |
| Root causes of the replay failure classified | PASS | — |
| Schema-rollback mechanism verified | PASS | — |
| Capture instrument ready and self-tested | PASS | — |
| Clean provisioning reproducible from source | BLOCKED | §2 |
| Migration-version conflicts resolved | BLOCKED | §2 |
| Registration / confirmation on staging | BLOCKED | §1, §3 |
| Assessment journey, submit, persistence, resume, scoring on staging | BLOCKED | §1, §2 |

Release status remains **CONDITIONALLY VERIFIED — NOT RELEASE-READY**.

## Decision record — three outstanding owner decisions

No decision below has been made. This record exists so each one can be actioned and
closed in place, and so the release blocker has a single visible cause. Each row was
re-verified this round by checking the secrets API, the environment, and the preview
hosts directly — not carried over from a previous round.

| # | Decision | State | Authorizer | Re-verified |
| --- | --- | --- | --- | --- |
| D1 | Read-only staging database access (or a designated operator to run the queries) | **OUTSTANDING** | Supabase project owner | secrets API `403` both repos; `STAGING_DATABASE_URL` absent |
| D2 | Approved access to both protected preview deployments | **OUTSTANDING** | Vercel project owner | both hosts `302 → vercel.com/sso-api` |
| D3 | Staging-only Supabase Auth allowlist update | **OUTSTANDING** | Supabase project owner | not requested until D2 confirms the origins |

### D1 — read-only staging database access

Approve **one** of:

- [ ] A read-only connection string, supplied as `STAGING_DATABASE_URL`, plus the
      expected host. Read-only is sufficient: the capture issues only `SELECT`s.
- [ ] Or: an authorized operator runs the two queries in §2 and returns their output
      as text. This answers three of the register's four questions.

### D2 — protected preview access

Approve **one** of:

- [ ] A Protection Bypass for Automation secret (preferred — leaves protection on
      for everyone else).
- [ ] Or: set Vercel Authentication to "Only Production Deployments".

Not acceptable, and not requested: disabling deployment protection entirely, or
promoting a preview to production.

### D3 — staging-only Auth allowlist

- [ ] Authorize adding the staging site and platform origins to the Supabase Auth
      redirect allowlist and pointing the confirmation template at the agreed
      dashboard journey, for the **staging project only**.

Production allowlist explicitly out of scope. The callback contract is in
`cross-repository-callback-contract.md`; the values are environment-specific and
must not be hardcoded to a preview host.

## What happens when each decision lands

Nothing further is needed from the owner beyond the decision; the work is ready.

| On | Immediate next action | Instrument |
| --- | --- | --- |
| D1 | Capture schema + applied migration history; resolve the 7 collisions; confirm the 3 ordering defects | `capture-staging-schema.mjs` (22/22 self-tested) |
| D2 | Run the browser journey against the preview | — |
| D3 | Verify registration, confirmation and handoff | — |

## Stopping condition

Per the Phase 9 directive, no further code-only work is proposed while D1–D3 are
outstanding. Source-level findings cannot resolve the applied migration history,
prove clean provisioning, or verify the user journey, and none of them is
represented as doing so. The release stays blocked until the decisions above are
made and the resulting evidence is collected.

