# valu_assessments baseline — required contract and the missing definition

Status: **UNRESOLVED — schema not reproducible from tracked artifacts.**
This document records what is *required* of the table, derived only from tracked
migrations and code. It deliberately does **not** contain a `CREATE TABLE`, because
the authoritative definition was never established. Writing one would invent a
baseline and risk encoding a shape that disagrees with the live database.

Recorded 2026-10-23 by an OpenHands agent on behalf of the repository owner.

## 1. The finding

`public.valu_assessments` is the central record of the full VALU Index
assessment. It is read and written by both repositories and is the target of
foreign keys from three tables. **No tracked migration in either repository
creates it.**

Evidence:

| Check | Result |
| --- | --- |
| `create table … valu_assessments` in platform `supabase/migrations/**` | none |
| `create table … valu_assessments` in site `supabase/migrations/**` | none |
| Same search across full platform history (851 commits, all refs) | none |
| GitHub code search, both repositories | no `CREATE`; only `REFERENCES` and DML |
| Tracked tables in platform migrations | 21 (listed below) |
| Tracked tables in site migrations | 23 (listed below) |

`valu_assessments` is absent from both lists. So is `taster_sessions`, the
snapshot table it depends on and which its `BEFORE INSERT` trigger reads.

Tracked tables, platform: `api_rate_limits`, `cv_assessments`,
`facilitation_engagements`, `facilitation_history`, `introduction_capability_rules`,
`introduction_request_events`, `introduction_requests`, `marketplace_governance_events`,
`organization_capabilities`, `organization_profiles`, `platform_roles`,
`professional_capabilities`, `professional_documents`, `professional_listing_controls`,
`professional_listing_events`, `professional_readiness_refresh_queue`,
`speaking_engagements`, `speaking_history`, `taster_identity_candidates`,
`taster_progress`, `private.valu_reconciliation_health_snapshots`.

Tracked tables, site: `assessment_identity_links`, `career_applications`,
`coaching_requests`, `employer_profiles`, `identity_reconciliation_reviews`,
`lead_automation_configs`, `lead_captures`, `meta_lead_events`, `opportunities`,
`opportunity_applications`, `opportunity_messages`, `opportunity_submission_rate_limits`,
`opportunity_submissions`, `placement_cases`, `platform_audit_events`,
`professional_certificates`, `professional_event_attendance`, `professional_events`,
`professional_journey`, `professional_match_preferences`, `professional_outcome_events`,
`professional_value_activation`, `rate_limit_buckets`,
`private.marketplace_showcase_approvals`.

The table therefore originates in out-of-band DDL — created by hand in the
Supabase SQL editor or by an external provisioning step that was never captured.
The remaining candidates, which this environment cannot inspect, are the Supabase
project's own SQL history and any infrastructure-as-code outside these two
repositories.

## 2. Why this is a defect, not a documentation gap

A tracked migration already hardens the table on the assumption that it exists:

```sql
-- supabase/migrations/20261020201342_secure_valu_report_token_20261020.sql
ALTER TABLE public.valu_assessments
  ALTER COLUMN report_token SET NOT NULL;
```

That is coherent only if `report_token` was already present. It was — but with a
`DEFAULT`, which is what `NOT NULL` relies on. **No tracked artifact defines that
default.** So the column's usability depends on untracked DDL in every database
that runs the handler.

The consequence was a release-blocking defect: the submission handler relied on
the database to supply `report_token`, and nothing in either repository
guaranteed it would. Where the default was absent, every first-time submission
failed with `23502` and the participant saw *"Could not save your result."* The
handler now generates the token itself (`randomUUID()`), which removes the
runtime dependency — but it does not make the schema reproducible.

The second defect from the same root cause is the duplicate-submission race,
closed by `20261023130000_unique_full_assessment_per_snapshot.sql`. That
migration is **additive and safe on any shape** of the table, because it only
adds a partial unique index over two columns the handler already queries.

A note on that index, because its own comment previously overstated its role.
The predicate `where taster_id is not null and identity_hash is not null` is not
what stops null-keyed rows colliding: PostgreSQL treats NULLs as distinct in a
unique index by default, so a plain index would not collide them either. The
predicate's real value is scope — it constrains only the rows the application
queries and keeps the index small. Verified on a real server (16/16 checks,
including a probe that inserts two `(null, null)` rows through a plain unique
index and confirms both are accepted). The comment has been corrected.

## 3. Contract required by tracked artifacts

Derived from migrations, handler code, and the site's foreign keys. This is the
minimum a database must satisfy for the shipped code to work.

### Columns referenced

| Column | Evidence | Required shape |
| --- | --- | --- |
| `id` | FK target from site `platform_foundation`, `value_activation`; `select=id` | `uuid`, primary key |
| `taster_id` | `BEFORE INSERT` guard raises `23514` when null; dedup index | `uuid`, not null for new rows |
| `user_id` | guard back-fills from snapshot, raises on mismatch; `add column if not exists user_id uuid references auth.users(id) on delete set null` | `uuid` → `auth.users(id)` |
| `identity_hash` | dedup index; `?identity_hash=eq.` lookups in four handlers | `text` |
| `name`, `role` | guard compares both against the snapshot | `text` |
| `total_score` | readiness trigger `update of total_score` | numeric |
| `designation` | insert body | `text` |
| `completed_at` | readiness trigger; "completed" semantics | `timestamptz` |
| `expires_at` | readiness trigger `update of … expires_at` | `timestamptz` |
| `report_token` | `SET NOT NULL`; unique index; opaque UUID validated by `api/generate-and-send-report.js` | `text not null`, unique |
| `report_status` | `add column if not exists report_status text not null default 'PENDING'` | `text not null default 'PENDING'` |
| `report_attempts` | `add column if not exists report_attempts integer not null default 0` | `integer not null default 0` |
| `report_locked_at` | `add column if not exists report_locked_at timestamptz` | `timestamptz` |
| `report_idempotency_key` | `add column if not exists report_idempotency_key text`; unique index | `text` |
| `report_failure_code` | `ADD COLUMN IF NOT EXISTS report_failure_code text` | `text` |
| `assessment_version` | `ALTER COLUMN assessment_version SET NOT NULL` | `text not null` |
| `scoring_version` | `add column if not exists scoring_version text not null default 'VALU-v4.0'` | `text not null default 'VALU-v4.0'` |
| `rubric_version` | `add column if not exists rubric_version text not null default 'PRIME-v4'` | `text not null default 'PRIME-v4'` |
| `linked_at` | `add column if not exists linked_at timestamptz` | `timestamptz` |
| `reminder_count` | `add column if not exists reminder_count integer not null default 0` | `integer not null default 0` |
| `last_reminder_at` | `add column if not exists last_reminder_at timestamptz` | `timestamptz` |
| `confirmation_email_sent_at`, `profile_reminder_sent_at` | PATCHed by `resend-confirmation.js`, `send-profile-reminder.js` | `timestamptz` |
| `skill_scores` | insert body | jsonb or text[] |

The `add column if not exists` lines prove the columns were added *after* the
table existed, by tracked migrations, on top of an untracked base.

### Constraints

- Primary key on `id`.
- Unique on `report_token`.
- Partial unique on `report_idempotency_key` where not null.
- Partial unique on `(taster_id, identity_hash)` — added by
  `20261023130000_unique_full_assessment_per_snapshot.sql`.
- Foreign keys *into* `valu_assessments(id)` from
  `assessment_identity_links.assessment_id` (`on delete restrict`),
  `professional_journey.current_assessment_id`, and one column in
  `value_activation_and_outcome_engine.sql` (`on delete set null`).

### Triggers

| Trigger | Definition | Contract |
| --- | --- | --- |
| `trg_00_require_owned_taster_for_valu_assessment` | `BEFORE INSERT`, `20261016231256` | requires a completed, owned snapshot; raises `23514`/`23503`; back-fills `user_id` |
| `trg_prevent_completed_assessment_mutation` | `20260816_lock_completed_assessment_core_fields.sql` | blocks mutation of completed rows |
| `trg_valu_assessment_readiness_refresh` | `AFTER INSERT OR UPDATE OF total_score, completed_at, expires_at OR DELETE`, `20260827_consolidate_readiness_triggers.sql` | queues readiness refresh |

### Privileges

`supabase/rls-lockdown.sql` drops anon insert/update policies, and
`20261020200659_revoke_unsafe_client_table_privileges_20261020.sql` revokes
client table privileges. The table is written only through `service_role`. No
tracked artifact grants `anon` or `authenticated` access.

## 4. What is required to close this

The authoritative definition can only come from the database itself. A read-only
inspection of the confirmed **staging** database is needed:

```sql
-- table, columns, types, nullability, defaults
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'valu_assessments'
 order by ordinal_position;

-- constraints and indexes
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.valu_assessments'::regclass;
select indexname, indexdef from pg_indexes
 where schemaname = 'public' and tablename = 'valu_assessments';

-- triggers and policies
select tgname, pg_get_triggerdef(oid) from pg_trigger
 where tgrelid = 'public.valu_assessments'::regclass and not tgisinternal;
select polname, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
  from pg_policy where polrelid = 'public.valu_assessments'::regclass;

-- grants
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'valu_assessments';
```

Once captured, the output should be turned into a tracked baseline migration
(including `taster_sessions`, which has the same gap) and diffed against the
required contract above. Any difference is itself a finding.

Until then: **do not author a speculative `CREATE TABLE`.** A baseline invented
from handler assumptions would be worse than the gap, because it would look
authoritative while silently disagreeing with production.

## 5. Measured scope, 2026-10-23 (Phase 6)

Phase 5 recorded two missing tables, `valu_assessments` and `taster_sessions`.
That was the pair found by reading handler code. Replaying the **shared** database
— both repositories into one database, which is the real provisioning path — shows
the gap is wider, and that most of the reported failure count is cascade rather
than independent defect.

`npm run verify:migration-reproducibility:shared`: 135 migrations (platform 84,
site 51), applied **22/135**.

**Tables that no tracked migration in either repository creates** (7):

| Table | Referenced by (migrations, both repos) | Owner by usage |
| --- | --- | --- |
| `valu_assessments` | 44 | platform |
| `professional_profiles` | 67 | platform |
| `taster_sessions` | 28 | platform |
| `valoria_journey_events` | 10 | platform |
| `assessment_sessions` | 2 | either |
| `professional_standard_event_registrations` | 4 | either |
| `users` | 9 | site |

`users` is a `public` mirror of `auth.users`, not a Supabase-provided object:
`20260919161200_reconcile_auth_user_and_profile_ownership.sql` inserts into it and
`20260916133933_complete_valu_pipeline_reconciliation.sql` puts a trigger on it.

**Two further objects are views, not tables** — `marketplace_professionals` and
`marketplace_public_roster`. A tracked migration already defines both, so they
need no baseline of their own; they only need their base tables to exist first.

**One failure is cascade, not defect.** `20260827_marketplace_governance_v4.sql`
is the only tracked migration that creates `schema private`. It fails partway
through on `relation "public.professional_profiles" does not exist`, so its
transaction rolls back and the schema is never created. The 20 migrations that
then fail on `schema "private" does not exist` are consequences of that single
rollback. Fixing the baseline without noticing this leaves 20 of the 35 root
causes unexplained.

So the baseline must create **7 tables plus the `private` schema**, and must do so
in an order that satisfies the foreign keys among them. The remaining failures in
the shared replay are the site repository's migrations running before their own
dependencies exist, which is the same class of gap.

## 6. Bearing on release

This does not block the code-level fixes, which are verified independently:

- the submission handler no longer depends on the untracked default;
- the dedup index is additive and applies to any shape of the table.

It **does** block the claim that the database setup is reproducible, and
therefore blocks full release certification. A new environment cannot be
provisioned from these repositories: seven tables, including the two most important, would not
exist.
