# Valoria Excellence Standard

Version: 1.0

This document is the release and operating standard for Valoria. Excellence is not declared by feature count; every gate must be evidenced by an automated check, an auditable record, or a documented institutional control.

## Gates

1. Security — authentication, authorization, RLS, privileged functions, secrets, abuse controls.
2. Assessment Integrity — question registry, PRIME mapping, scoring/version integrity, immutable completion evidence.
3. Journey Integrity — canonical lifecycle states, legal transitions, recovery, idempotency and next action.
4. Marketplace Integrity — capability-level eligibility, profile/listing separation, governance and revocation.
5. Measurement — canonical events, funnel instrumentation, abandonment/recovery and outcome signals.
6. Experience — accessibility, responsive behavior, design tokens, interaction consistency and performance.
7. QA — unit, integration, browser, regression, accessibility and production smoke checks.
8. Governance — audit trail, change control, incident response, release gates and evidence retention.

## Release rule

A production release is blocked when a Critical gate fails. High findings require an owner and a remediation plan. Informational findings do not block release but remain visible in the audit report.

## Evidence rule

A claim is not considered complete until its implementation is verified against the live system or an automated test. Documentation alone is not evidence.

## Canonical journey

Visitor → Signed up → Taster started → Taster completed → Full VALU started → Full VALU completed → Marketplace profile → Profile complete → Capability → Eligibility → Marketplace listing → Opportunity → Outcome → Reassessment.

## Canonical measurement events

valu_snapshot_started, valu_snapshot_completed, account_created, valu_full_started, valu_question_answered, valu_full_completed, valu_score_generated, assessment_abandoned, assessment_resumed, marketplace_profile_created, profile_completed, capability_created, eligibility_granted, marketplace_listing_created, notification_sent, notification_seen, email_sent, email_clicked, marketplace_viewed, enquiry_created, opportunity_created, placement_started, placement_completed, reassessment_started, reassessment_completed.

Every event must identify the relevant user/assessment where applicable, include a timestamp, and use versioned metadata rather than changing the meaning of an existing event key.

## Non-negotiable invariants

- A taster score is never treated as the canonical full VALU score.
- A full assessment completion is persisted before downstream placement/communication actions are considered successful.
- A professional has one identity/profile and may have multiple capabilities.
- Eligibility is not equivalent to listing; listing remains governed by explicit controls.
- Completion-triggered notifications/email are idempotent.
- An abandoned assessment can resume without creating a second canonical assessment.
- Historical assessment scores are never overwritten by a later scoring version.
- Public marketplace data must never expose private assessment answers, reports, contact data, or internal governance fields.
