# Migration version collision register

Two repositories share one Supabase database. Supabase records an applied
migration by the numeric version prefix of its filename and will not apply a
second file with a version it has already recorded. So when both repositories
contain a file with the same version, **one of the two is never applied**, and
nothing reports it. No CI step applies migrations, so the database is the only
place this is visible.

This register records every collision, the evidence, and what each one actually
changes. It is source-only: the applied history has not been read from the
database (see *Unresolved* at the end), and no resolution here is final until it
has been compared against the recorded versions.

Measured 2026-10-23 against platform `ad2c3165` and site `454b1aed`; corrected the
same day against both platform migration directories.

## Correction, 2026-10-23: this register was incomplete

The first version of this register scanned one platform migrations directory,
`valoria-final/supabase/migrations`. The platform has a **second** migrations
directory at the repository root, `supabase/migrations`, holding six files. Four of
them share a version with valoria-site, so four collisions were missing from the
summary below. Re-measured against both directories:

| Version | Platform file | Site file | Kind |
| --- | --- | --- | --- |
| `20260921123000` | `supabase/migrations/…_canonical_lead_pipeline.sql` | same name | **was divergent; now fixed** |
| `20260921131500` | `supabase/migrations/…_lead_meeting_automation.sql` | same name | byte-identical |
| `20260921133500` | `supabase/migrations/…_configure_session_02_meeting_link.sql` | same name | byte-identical |

The fourth root file, `20261008120000`, `20261008123000` and `20261008143000`, have
no site counterpart.

### `20260921123000` was not merely divergent — it could not apply at all

The platform root copy carried a truncated dollar-quote delimiter: `do $` … `$;`
where `do $$` … `$$;` was meant. PostgreSQL rejects a bare `$` delimiter with
`syntax error at or near "$"`, so this file could never have applied to any
database, and the lead-pipeline work it performs (the
`trg_capture_event_registration_lead` trigger and the `valoria-sync-leads-to-brevo`
/ `valoria-process-meta-leads` cron jobs) never ran from this file. The site copy
of the same version used `$$` correctly.

It survived every guard for one reason: `src/__tests__/28_dollar_quote_integrity.test.js`
exists specifically to catch this defect class — its header names `as $` where
`as $$` was meant — but it scanned only `valoria-final/supabase/migrations`. The
same defect, in the sibling directory, was invisible to it.

**Resolved.** The delimiter is corrected and the file is now byte-identical to the
site copy (`e8c1e88b0aa29f03`). Both migration guards now scan both platform
directories, and reintroducing the defect fails `28_dollar_quote_integrity`.

## Summary

| Version | Kind | Severity | Status |
| --- | --- | --- | --- |
| `20260908150000` | cross-repo, divergent, **different objects** | **high** | unresolved |
| `20260921121500` | cross-repo, divergent SQL, same object names | medium | unresolved |
| `20260921123000` | cross-repo; truncated delimiter made it inapplicable | **high** | **fixed** |
| `20260921124500` | cross-repo, byte-identical | none | harmless |
| `20260921130000` | cross-repo, byte-identical | none | harmless |
| `20260921131500` | cross-repo, byte-identical | none | harmless |
| `20260921133500` | cross-repo, byte-identical | none | harmless |
| `20260816` (×17), `20260827` (×9), `20260828` (×2) | within platform, date-only | low | pinned |

## 1. `20260908150000` — divergent objects (high)

The same version, two different files, doing different work.

| | Platform | Site |
| --- | --- | --- |
| File | `20260908150000_valu_teaser_profile_handoff.sql` | `20260908150000_fix_taster_profile_handoff_trigger.sql` |
| SHA-256 (first 16) | `b31c484e84fbcf61` | `8f07975b9c48ed35` |
| `alter table … add column` | **4** | 0 |
| `create trigger` | **1** | 0 |
| `create function` | 1 | 1 |

The platform file adds four columns to `public.taster_sessions` and creates the
trigger that uses them:

```sql
alter table public.taster_sessions add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.taster_sessions add column if not exists linked_at timestamptz;
alter table public.taster_sessions add column if not exists reminder_count integer not null default 0;
alter table public.taster_sessions add column if not exists last_reminder_at timestamptz;

drop trigger if exists trg_link_taster_to_profile on public.taster_sessions;
create trigger trg_link_taster_to_profile before update of user_id on public.taster_sessions
  for each row when (new.user_id is not null and old.user_id is distinct from new.user_id)
  execute function public.link_taster_to_profile();
```

The site file defines `link_taster_to_profile()` and does neither.

**Why this is not a body difference.** This is not two implementations of one
object. Whichever file is applied, the *other file's* work is skipped entirely.
If the site's file is applied first, the four columns and the trigger are never
created, and the taster→profile handoff has no mechanism at all. That is a broken
provisioning outcome, not a style disagreement.

**No later migration restores the gap.** The site's `20261010110000` redefines
`link_taster_to_profile()`, but it does not add the columns and does not create
the trigger. So the later redefinition does not repair a lost trigger.

**Resolution requires the database.** Whether staging has these columns and this
trigger decides the correct fix:

- if present → the platform file was applied; the site file's version should be
  renumbered so it is not a silent duplicate.
- if absent → the site file was applied; the platform file must be renumbered so
  its column and trigger work actually runs, and a follow-up must add them to any
  database provisioned the other way.

Renumbering is a human decision and is not taken here. See *Proposed resolution*.

## 2. `20260921121500` — divergent SQL, same object names (medium)

| | Platform | Site |
| --- | --- | --- |
| File | `20260921121500_close_signup_profile_capability_listing_drift.sql` | same filename |
| SHA-256 (first 16) | `0ca3e43b211f741e` | `740825a1a8b51bcc` |
| Lines | 283 | 258 |

Both files create or replace the same seven objects, with different bodies:

`private.valu_assessment_is_current`, `public.enforce_valu_profile_lifecycle`,
`public.guard_professional_platform_fields`,
`private.evaluate_professional_capability`,
`private.sync_professional_capability`,
`private.evaluate_professional_readiness`,
`private.sync_professional_listing_status`, plus four triggers.

The site's copy is stricter in two places — its readiness gate also requires a
non-empty `cv_url` and calls `private.valu_assessment_is_current(new.id)` — so the
two are not interchangeable: one admits profiles the other rejects.

**This one is largely superseded in a shared database.** Every function except
`sync_professional_capability` is redefined by a later version, and those later
versions live in *different repositories*:

| Function | Effective definition in a shared database | Held by |
| --- | --- | --- |
| `enforce_valu_profile_lifecycle` | `20261008140000` | site |
| `evaluate_professional_capability` | `20261008140000` | site |
| `evaluate_professional_readiness` | `20261008140000` | site |
| `sync_professional_listing_status` | `20260929113000` | site |
| `valu_assessment_is_current` | `20260929100500` | site |
| `sync_professional_capability` | `20260921121500` | **whichever was applied** |

So for six of the seven objects the collision changes only which intermediate
version ran, and the final state is the same either way. The exception is
`sync_professional_capability`, which is defined by this version and by nothing
later — its body is the one in whichever file was applied, and the two bodies
differ. Because the platform file is the only holder of several later versions
(`20260925160000`) and the site is the only holder of others (`20260929100500`,
`20260929113000`, `20261008140000`), the shared sequence cannot be reproduced from
either repository alone. That is the finding that matters here.

## 3. `20260921124500` and `20260921130000` — byte-identical (harmless)

| Version | Platform SHA-256 | Site SHA-256 | Result |
| --- | --- | --- | --- |
| `20260921124500` | `06133a2928c83277` | `06133a2928c83277` | identical |
| `20260921130000` | `060442e42dda3f8a` | `060442e42dda3f8a` | identical |

Applying either produces the same database. The duplication is untidy — one file
is skipped — but no object is missing and no definition differs. Not a defect.

## 4. Within-repository duplicates (low)

Platform holds 28 files across three date-only versions, which cannot be unique
per file:

| Version | Files |
| --- | --- |
| `20260816` | 17 |
| `20260827` | 9 |
| `20260828` | 2 |

These are date-only, so they were almost certainly applied by hand through the SQL
editor rather than by version. They are pinned by
`src/__tests__/29_cross_repo_migration_versions.test.js` so a new duplicate fails
rather than joining them unnoticed.

## Proposed resolution

Not applied. Each needs the database evidence below first.

| Collision | Proposed action | Blocked on |
| --- | --- | --- |
| `20260908150000` | Renumber the losing file to a free version; if the columns and trigger are absent from the database, add a migration that creates them. | Reading `taster_sessions` columns and `trg_link_taster_to_profile` from the database. |
| `20260921121500` | Renumber the site's copy to a free version so both bodies are applied in a defined order, then confirm which `sync_professional_capability` body the database should hold. | Reading `pg_get_functiondef('private.sync_professional_capability')`. |
| `20260921124500`, `20260921130000` | Delete one copy from one repository, or accept the duplicate. | An owner decision on which repository owns them. |
| Within-repo date-only versions | Leave as-is; pinned by the regression test. | Nothing. |

## Unresolved — requires database access

Everything above is derived from source. The following cannot be answered without
reading the database, and no resolution should be applied until they are:

1. Which version is recorded for each collision — that is, which file actually ran.
2. Whether `taster_sessions` has `user_id`, `linked_at`, `reminder_count`,
   `last_reminder_at`, and whether `trg_link_taster_to_profile` exists. This
   decides collision 1 outright.
3. The body of `private.sync_professional_capability` as the database holds it.
4. Whether any of the 28 date-only files were applied by version or by hand.

The minimum access required is a read-only connection to the staging database with
`STAGING_DATABASE_URL` and `--expect-host`, which is what
`scripts/capture-staging-schema.mjs` already enforces.

## The capture instrument is ready; it has no target

The four questions above are answered by a single run of
`scripts/capture-staging-schema.mjs`. That script now reads, in addition to the
schema shape:

- `collision_applied_sql` — the SQL Supabase recorded at apply time for each
  colliding version (`supabase_migrations.schema_migrations.statements`). This
  answers question 1 directly: match the applied SQL against the candidate files.
  On Supabase versions without that column the capture records the error and
  continues rather than aborting.
- `collision_function_bodies` — the live `pg_get_functiondef` of the objects the
  collisions define. This answers question 3, and question 2 in part.
- `private_functions` — every function in the `private` schema.

The instrument is exercised end to end against a disposable fixture by
`scripts/verify-capture-tooling.mjs`, which runs in CI: 22 checks covering the host
guard, the applied-SQL capture, the live function bodies, the handoff columns and
trigger, and the degrade-don't-abort path. Writing that test found a real defect —
binding a single `$2` placeholder against an array of `[null, …]` fails with
`could not determine data type of parameter $1` — so the instrument would have
failed on its first real use. Every query now takes one placeholder.

Passing the self-test means the tool is ready. It is not staging evidence. The
blockers below remain open until the capture runs against the real database.

