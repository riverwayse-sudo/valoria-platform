# Valoria Listing Governance Protocol

Valoria separates three concepts:

- `eligible_for_listing`: automated platform decision based on required trust and assessment conditions.
- `listing_status`: governed marketplace state (`NOT_LISTED`, `LISTED`, `SUSPENDED`, `REVOKED`).
- `availability_status`: current availability (`AVAILABLE`, `LIMITED`, `UNAVAILABLE`).

## VALU v4 score boundary

The authoritative full VALU Index produces a 0–100 score. A score of **35 or higher** is the minimum assessment score required for automated marketplace eligibility consideration.

`valu_index >= 35 → score-eligible`

It does **not** mean:

`valu_index >= 35 → LISTED`

Score eligibility is one input into `eligible_for_listing`. Listing remains a separate governed state and also depends on profile completeness, account/identity validity, capability selection/evidence, verification requirements, and governance controls.

## Normal flow

```text
Authoritative VALU assessment completed
      ↓
VALU score >= 35?
   ┌──┴──┐
  NO    YES
   ↓      ↓
Not   Eligibility evaluation
eligible     ↓
          Eligible?
          ┌──┴──┐
         NO    YES
          ↓      ↓
      NOT_LISTED  LISTED
                    ↓
              Marketplace discovery
```

## Governance override

```text
LISTED → ADMIN_REVOKED
LISTED → ADMIN_SUSPENDED
REVOKED → ADMIN_RESTORED (only after eligibility is re-confirmed)
SUSPENDED → ADMIN_UNSUSPENDED (only after eligibility is re-confirmed)
```

A professional can be listed but unavailable. Revoked or suspended professionals must not appear in marketplace discovery regardless of availability.

Every automatic or administrative transition should create a `professional_listing_events` record containing professional ID, event type, previous status, new status, reason, actor ID where applicable, metadata, and timestamp.

Marketplace clients must never be able to directly set `eligible_for_listing`, `listing_status`, `revoked_at`, `revoked_by`, or `revocation_reason`. These are platform-governed fields and must be protected by Postgres controls as well as API authorization.
