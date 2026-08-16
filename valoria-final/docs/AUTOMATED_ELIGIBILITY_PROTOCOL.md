# Valoria Automated Listing Eligibility Protocol

## Principle

Valoria separates assessment completion, eligibility, listing status, and availability. Completing a VALU assessment does not itself grant permanent marketplace access.

## Eligibility inputs

The automated eligibility decision should evaluate only canonical platform-controlled facts:

- assessment is completed;
- assessment has a valid completed score/designation;
- required professional profile fields are complete;
- professional identity/account is valid;
- no active suspension or revocation exists;
- any required verification flags are satisfied;
- professional has selected at least one supported capability: Talent, Speaker, or Facilitator.

## Decision

`eligible_for_listing = true` means the professional satisfies the current automated rules. It does not prevent an administrator from suspending or revoking the listing.

A successful eligibility evaluation may automatically transition the listing to `LISTED` and preserve an audit event. A failed evaluation must leave the listing `NOT_LISTED` or move it out of discovery without deleting the professional, assessment, or historical governance records.

## Admin override

Administrators can approve, suspend, revoke, or restore a listing. Restoration must re-run the eligibility rules before returning the professional to `LISTED`.

## Availability

Availability is independent of eligibility and listing:

- `AVAILABLE` — eligible/listed and accepting introduction requests;
- `LIMITED` — eligible/listed but with constrained availability;
- `UNAVAILABLE` — still listed if policy permits, but excluded from active availability results.

## Marketplace rule

The organization-facing marketplace should return a professional only when all required discovery conditions are true:

`eligible_for_listing = true`

`listing_status = LISTED`

`availability_status IN (AVAILABLE, LIMITED)`

`profile_visibility = PUBLIC`

## Governance and audit

Every automated or administrative status change must produce an immutable governance event with the previous status, new status, reason, actor/system identity, and timestamp.

## Important implementation rule

Do not use `users.user_type` as the sole eligibility authority. Professional capabilities and platform authorization are separate concepts. The eventual database implementation must use the canonical identity model and enforce platform-controlled fields through Postgres/RLS, not only client-side checks.
