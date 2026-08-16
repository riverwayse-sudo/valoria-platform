# Valoria Listing Governance Protocol

Valoria separates three concepts:

- `eligible_for_listing`: automated platform decision based on required trust and assessment conditions.
- `listing_status`: governed marketplace state (`NOT_LISTED`, `LISTED`, `SUSPENDED`, `REVOKED`).
- `availability_status`: current availability (`AVAILABLE`, `LIMITED`, `UNAVAILABLE`).

## Normal flow

```text
Assessment completed
      ↓
Eligibility evaluation
      ↓
Eligible
      ↓
Automatic listing
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
