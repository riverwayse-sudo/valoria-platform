# Contracts required of untracked tables

Derived mechanically from tracked migrations in both repositories by
`scripts/derive-required-schema-contract.mjs`. This is the input for authoring a
baseline migration; it is **not** a schema definition and contains no `CREATE TABLE`.

The authoritative shape can only come from the live staging database — see
`scripts/capture-staging-schema.mjs` and `valu-assessments-schema-baseline.md`.

A clean provision currently fails at migration 2 of 84 because these tables are
referenced but never created. Proven by `scripts/verify-migration-reproducibility.mjs`.

## Summary

| table | files referencing | added columns | altered columns | indexes | policies | triggers | FKs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `professional_profiles` | 67 | 7 | 0 | 1 | 0 | 16 | 19 |
| `valu_assessments` | 44 | 4 | 2 | 4 | 0 | 9 | 3 |
| `taster_sessions` | 28 | 6 | 0 | 4 | 0 | 4 | 3 |
| `valoria_journey_events` | 10 | 0 | 0 | 0 | 2 | 0 | 0 |
| `professional_standard_event_registrations` | 4 | 1 | 0 | 1 | 0 | 2 | 0 |
| `assessment_sessions` | 2 | 1 | 0 | 1 | 1 | 1 | 0 |
| `opportunity_invites` | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| `valoria_reentry_links` | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `rate_limits` | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `marketplace_profiles` | 1 | 0 | 0 | 0 | 0 | 0 | 0 |

## `professional_profiles`

### Columns the migrations add (so the table must already exist)

| column | definition | first evidence |
| --- | --- | --- |
| `eligible_for_listing` | `boolean not null default false` | valoria-platform/20260816_listing_governance_protocol.sql |
| `listing_status` | `text not null default '' check (listing_status in ('','','',''))` | valoria-platform/20260816_listing_governance_protocol.sql |
| `availability_status` | `text not null default '' check (availability_status in ('','',''))` | valoria-platform/20260816_listing_governance_protocol.sql |
| `listed_at` | `timestamptz` | valoria-platform/20260816_listing_governance_protocol.sql |
| `revoked_at` | `timestamptz` | valoria-platform/20260816_listing_governance_protocol.sql |
| `revoked_by` | `uuid` | valoria-platform/20260816_listing_governance_protocol.sql |
| `revocation_reason` | `text` | valoria-platform/20260816_listing_governance_protocol.sql |

### Inbound foreign keys

- `(id)` on delete cascade  
  valoria-platform/20260816_professional_capability_evidence.sql
- `(id)` on delete cascade  
  valoria-platform/20260816_professional_capability_evidence.sql
- `(id)` on delete cascade  
  valoria-platform/20260816_professional_capability_evidence.sql
- `(id)` on delete cascade  
  valoria-platform/20260816_professional_capability_evidence.sql
- `(id)` on delete cascade  
  valoria-platform/20260816_professional_capability_evidence.sql
- `(id)` on delete cascade  
  valoria-platform/20260816_professional_capability_evidence.sql
- `(id)` on delete cascade  
  valoria-platform/20260827_readiness_refresh_queue_v2.sql
- `(id)` on delete cascade  
  valoria-platform/20260827_readiness_refresh_triggers.sql
- `(id)` on delete cascade  
  valoria-platform/20260828_assessment_versioning_and_governance_hardening.sql
- `(id)` on delete cascade  
  valoria-site/20260928170000_coaching_placement_communication.sql
- `(id)` on delete set null  
  valoria-site/20260928170000_coaching_placement_communication.sql
- `(id)` on delete cascade  
  valoria-site/20260928170000_coaching_placement_communication.sql
- `(id)` on delete cascade  
  valoria-site/20260928170000_coaching_placement_communication.sql
- `(id)` on delete set null  
  valoria-site/20260928_platform_foundation.sql
- `(id)` on delete cascade  
  valoria-site/20260929100000_event_attendance_certificates.sql
- `(id)` on delete cascade  
  valoria-site/20260929100000_event_attendance_certificates.sql
- `(id)` on delete cascade  
  valoria-site/20260929170000_value_activation_and_outcome_engine.sql
- `(id)` on delete cascade  
  valoria-site/20260929170000_value_activation_and_outcome_engine.sql
- `(id)` on delete cascade  
  valoria-site/20261011001500_restore_approved_marketplace_showcase_profiles.sql

### Indexes the migrations create on it

- `professional_profiles_marketplace_visibility_idx` on (listing_status, availability_status)  
  valoria-platform/20260816_listing_governance_protocol.sql

### Triggers

- `trg_guard_professional_platform_fields` before update  
  valoria-platform/20260816_harden_user_and_profile_managed_fields.sql
- `trg_profile_refresh_talent_listing` after update of profile_complete,active_tracks  
  valoria-platform/20260817_cv_assessment_live_foundation.sql
- `trg_professional_profile_readiness_refresh` after update of profile_complete,display_name,bio,active_tracks,visibility,valu_index,assessment_completed_at,assessment_expires_at  
  valoria-platform/20260827_assessment_profile_readiness_refresh.sql
- `trg_professional_profile_readiness_refresh` after update of profile_complete,display_name,bio,active_tracks,visibility,valu_index,assessment_completed_at,assessment_expires_at  
  valoria-platform/20260827_consolidate_readiness_triggers.sql
- `trg_sync_profile_capability_paths` after insert or update of active_tracks  
  valoria-platform/20260910004800_synchronize_profile_capability_paths.sql
- `trg_professional_profile_readiness_refresh` after update of profile_complete, display_name, bio, photo_url, active_tracks, visibility, valu_index, assessment_completed_at, assessment_expires_at  
  valoria-platform/20260916134934_queue_readiness_on_avatar_changes.sql
- `trg_enforce_valu_profile_lifecycle` before insert or update of display_name,headline,bio,photo_url,active_tracks,industry,username,phone, current_job_title,location,languages,cv_url,valu_index,assessment_completed_at, assessment_expires_at,pro  
  valoria-platform/20260921121500_close_signup_profile_capability_listing_drift.sql
- `trg_guard_professional_platform_fields` before update  
  valoria-platform/20260921121500_close_signup_profile_capability_listing_drift.sql
- `trg_professional_profile_readiness_refresh` after update of display_name,headline,bio,photo_url,active_tracks,industry,username,phone,current_job_title, location,languages,cv_url,visibility,valu_index,assessment_completed_at,assessment_expires_at, to  
  valoria-platform/20260921121500_close_signup_profile_capability_listing_drift.sql
- `trg_guard_professional_platform_fields` before insert or update  
  valoria-platform/20260921130000_guard_professional_platform_fields_on_insert.sql
- `trg_enforce_valu_profile_lifecycle` before insert or update of profile_complete, valu_index, assessment_completed_at  
  valoria-site/20260908143000_align_valu_teaser_basic_listing_flow.sql
- `trg_enforce_valu_profile_lifecycle` before insert or update of display_name,headline,bio,photo_url,active_tracks,industry,username,phone, current_job_title,location,languages,cv_url,valu_index,assessment_completed_at, assessment_expires_at,pro  
  valoria-site/20260921121500_close_signup_profile_capability_listing_drift.sql
- `trg_guard_professional_platform_fields` before update  
  valoria-site/20260921121500_close_signup_profile_capability_listing_drift.sql
- `trg_professional_profile_readiness_refresh` after update of display_name,headline,bio,photo_url,active_tracks,industry,username,phone,current_job_title, location,languages,cv_url,visibility,valu_index,assessment_completed_at,assessment_expires_at, to  
  valoria-site/20260921121500_close_signup_profile_capability_listing_drift.sql
- `trg_guard_professional_platform_fields` before insert or update  
  valoria-site/20260921130000_guard_professional_platform_fields_on_insert.sql
- `trg_valoria_profile_continuity` after insert or update of profile_complete  
  valoria-site/20260929101821_phase2_entry_point_continuity.sql

### Columns written by tracked migrations

`id`, `display_name`, `headline`, `listing_status`, `profile_complete`, `visibility`, `active_tracks`, `eligible_for_listing`, `availability_status`, `created_at`, `updated_at`, `valu_index`, `cluster_scores`, `designation`, `assessment_completed_at`


## `valu_assessments`

### Columns the migrations add (so the table must already exist)

| column | definition | first evidence |
| --- | --- | --- |
| `report_status` | `text not null default '', add column if not exists report_attempts integer not null default 0, add column if not exists report_locked_at timestamptz, add column if not exists report_idempotency_key text` | valoria-platform/20260816_report_state_protocol.sql |
| `scoring_version` | `text not null default '', add column if not exists rubric_version text not null default ''` | valoria-platform/20260828_assessment_versioning_and_governance_hardening.sql |
| `report_failure_code` | `text` | valoria-platform/20261021124718_add_report_failure_diagnostics.sql |
| `profile_reminder_count` | `integer not null default 0, add column if not exists last_profile_reminder_at timestamptz` | valoria-site/20260929114500_valu_completion_no_abandonment.sql |

### Columns the migrations alter (present before these migrations)

- `report_token` — SET NOT NULL  
  valoria-platform/20261020201342_secure_valu_report_token_20261020.sql
- `assessment_version` — SET NOT NULL  
  valoria-platform/20261021145000_require_assessment_version_provenance.sql

### Inbound foreign keys

- `(id)` on delete restrict  
  valoria-site/20260928_platform_foundation.sql
- `(id)`   
  valoria-site/20260928_platform_foundation.sql
- `(id)` on delete set null  
  valoria-site/20260929170000_value_activation_and_outcome_engine.sql

### Indexes the migrations create on it

- `valu_assessments_report_idempotency_key_idx` on (report_idempotency_key)  
  valoria-platform/20260816_report_state_protocol.sql
- `valu_assessments_report_status_idx` on (report_status, report_locked_at)  
  valoria-platform/20260816_report_state_protocol.sql
- `valu_assessments_report_token_uidx` on (report_token)  
  valoria-platform/20261020201342_secure_valu_report_token_20261020.sql
- `valu_assessments_taster_identity_uidx` on (taster_id, identity_hash)  
  valoria-platform/20261023130000_unique_full_assessment_per_snapshot.sql

### Triggers

- `trg_prevent_completed_assessment_mutation` before update  
  valoria-platform/20260816_lock_completed_assessment_core_fields.sql
- `trg_valu_assessment_readiness_refresh` after insert or update of total_score,completed_at,expires_at or delete  
  valoria-platform/20260827_assessment_profile_readiness_refresh.sql
- `trg_valu_assessment_readiness_refresh` after insert or update of total_score,completed_at,expires_at or delete  
  valoria-platform/20260827_consolidate_readiness_triggers.sql
- `trg_prevent_completed_assessment_mutation` before update  
  valoria-platform/20260828_assessment_versioning_and_governance_hardening.sql
- `trg_00_require_owned_taster_for_valu_assessment` BEFORE INSERT  
  valoria-platform/20261016231256_require_owned_taster_for_new_valu_assessments.sql
- `trg_valoria_assessment_continuity` after insert or update of completed_at  
  valoria-site/20260929101821_phase2_entry_point_continuity.sql
- `trg_valu_assessments_sync_listing` after insert or update of completed_at,total_score,expires_at,user_id  
  valoria-site/20260929113000_valu_completion_listing_progression.sql
- `trg_valoria_assessment_report_continuity` after update of report_status,report_email_sent_at  
  valoria-site/20260929120500_report_continuity_events.sql
- `trg_set_valu_assessments_user_id` before insert or update of user_id, taster_id  
  valoria-site/20261014160000_assessment_taster_ownership_propagation.sql


## `taster_sessions`

### Columns the migrations add (so the table must already exist)

| column | definition | first evidence |
| --- | --- | --- |
| `user_id` | `uuid references auth.users(id) on delete set null` | valoria-platform/20260908150000_valu_teaser_profile_handoff.sql |
| `linked_at` | `timestamptz` | valoria-platform/20260908150000_valu_teaser_profile_handoff.sql |
| `reminder_count` | `integer not null default 0` | valoria-platform/20260908150000_valu_teaser_profile_handoff.sql |
| `last_reminder_at` | `timestamptz` | valoria-platform/20260908150000_valu_teaser_profile_handoff.sql |
| `submission_key` | `uuid` | valoria-platform/20261015130000_atomic_taster_submission.sql |
| `taster_version` | `text, add column if not exists taster_version_source text not null default ''` | valoria-site/20261014170000_taster_version_provenance.sql |

### Inbound foreign keys

- `(id)` on delete cascade  
  valoria-platform/20261015121016_taster_identity_candidate_evidence_layer.sql
- `(id)` ON DELETE SET NULL  
  valoria-platform/20261015130500_durable_taster_progress.sql
- `(id)` ON DELETE RESTRICT  
  valoria-platform/20261016231256_require_owned_taster_for_new_valu_assessments.sql

### Indexes the migrations create on it

- `idx_taster_sessions_user_id` on (user_id)  
  valoria-platform/20260908150000_valu_teaser_profile_handoff.sql
- `idx_taster_sessions_reminder_due` on (user_id, linked_at, last_reminder_at)  
  valoria-platform/20260908150000_valu_teaser_profile_handoff.sql
- `taster_sessions_submission_key_uidx` on (submission_key)  
  valoria-platform/20261015130000_atomic_taster_submission.sql
- `taster_sessions_version_created_idx` on (taster_version, created_at desc)  
  valoria-site/20261014170000_taster_version_provenance.sql

### Triggers

- `trg_link_taster_to_profile` before update of user_id  
  valoria-platform/20260908150000_valu_teaser_profile_handoff.sql
- `trg_valoria_taster_continuity` after insert or update of completed_at  
  valoria-site/20260929101821_phase2_entry_point_continuity.sql
- `trg_refresh_basic_taster_marketplace` after insert or update of user_id,completed_at  
  valoria-site/20261010110000_valu_points_basic_taster_marketplace_tiers.sql
- `trg_sync_valu_assessments_from_taster_owner` after update of user_id  
  valoria-site/20261014160000_assessment_taster_ownership_propagation.sql

### Columns written by tracked migrations

`name`, `role`, `experience`, `taster_answers`, `cluster_scores`, `strongest_cluster`, `weakest_cluster`, `taster_version`, `taster_version_source`, `submission_key`


## `valoria_journey_events`

### Row-level security policies

- `valoria_journey_events_owner_read` — for select to authenticated using ((select auth.uid()) = user_id or public.is_valoria_admin())  
  valoria-site/20260929101000_security_harden_journey_tables.sql
- `valoria_journey_events_owner_insert` — for insert to authenticated with check ((select auth.uid()) = user_id or public.is_valoria_admin())  
  valoria-site/20260929101000_security_harden_journey_tables.sql

### Columns written by tracked migrations

`user_id`, `event_key`, `source`, `source_id`, `metadata`


## `professional_standard_event_registrations`

### Columns the migrations add (so the table must already exist)

| column | definition | first evidence |
| --- | --- | --- |
| `brevo_last_attempt_at` | `timestamptz, add column if not exists brevo_attempt_count integer not null default 0, add column if not exists brevo_last_error text` | valoria-platform/20260919161300_canonicalize_event_registration_pipeline.sql |

### Indexes the migrations create on it

- `professional_standard_event_registrations_brevo_idx` on (brevo_synced,created_at)  
  valoria-platform/20260919161300_canonicalize_event_registration_pipeline.sql

### Triggers

- `trg_capture_event_registration_lead` after insert or update of full_name,email,whatsapp,role,organisation,session_id,consent  
  valoria-site/20260921123000_canonical_lead_pipeline.sql
- `trg_valoria_event_registration_continuity` after insert  
  valoria-site/20260929101821_phase2_entry_point_continuity.sql

### Columns written by tracked migrations

`session_id`, `full_name`, `email`, `role`, `organisation`, `created_at`, `whatsapp`, `consent`, `brevo_synced`, `confirmation_email_sent`


## `assessment_sessions`

### Columns the migrations add (so the table must already exist)

| column | definition | first evidence |
| --- | --- | --- |
| `user_id` | `uuid references auth.users(id) on delete set null, add column if not exists updated_at timestamptz not null default now()` | valoria-site/20261014153000_assessment_sessions_owner_read_contract.sql |

### Indexes the migrations create on it

- `assessment_sessions_user_updated_idx` on (user_id, updated_at desc)  
  valoria-site/20261014153000_assessment_sessions_owner_read_contract.sql

### Row-level security policies

- `assessment_sessions_owner_read` — for select to authenticated using ((select auth.uid()) = user_id)  
  valoria-site/20261014153000_assessment_sessions_owner_read_contract.sql

### Triggers

- `assessment_sessions_touch_updated_at` before update  
  valoria-site/20261014153000_assessment_sessions_owner_read_contract.sql

### Privilege changes

- grant select to authenticated  
  valoria-site/20261014153000_assessment_sessions_owner_read_contract.sql


## `opportunity_invites`

### Indexes the migrations create on it

- `idx_fk_opportunity_invites_invited_by` on (invited_by)  
  valoria-platform/20261011120000_supabase_security_performance_hardening.sql


## `valoria_reentry_links`

### Row-level security policies

- `valoria_reentry_links_admin_read` — for select to authenticated using (public.is_valoria_admin())  
  valoria-site/20260929101000_security_harden_journey_tables.sql


## `rate_limits`

### Row-level security policies

- `rate_limits_no_client_access` — for select to authenticated using (false)  
  valoria-platform/20260905_continuous_closeout_security_and_indexes.sql


## `marketplace_profiles`


## How to use this

1. Capture the live staging schema (`capture-staging-schema.mjs`) — that is the
   authoritative definition.
2. Reconcile it against the contracts above. A column the migrations require but
   the live table lacks is drift; a live column not required here is still real
   data and must be preserved.
3. Author the baseline from the capture, then verify with
   `verify-migration-reproducibility.mjs --baseline=<file> --compare=<capture.json>`.
   That must take the chain from failing at migration 2 to applying all 84, with no
   column-level differences against the capture.
4. Review grants, ownership and RLS explicitly. A baseline that reproduces the shape
   but drops the lockdown would be a security regression.
