# Valoria Automated Listing Eligibility Protocol

## Principle

Valoria separates assessment completion, score eligibility, listing status, and availability. Completing a VALU assessment does not itself grant permanent marketplace access.

## VALU v4 score contract

The authoritative full assessment uses the canonical v4 scoring contract:

1. Each PRIME cluster is normalised independently against its canonical maximum.
2. Normalised cluster scores are combined using the canonical weights: P 20%, R 25%, I 25%, M 20%, E 10%.
3. The weighted result is rounded once to produce the 0–100 VALU Index.
4. Integrity signals are diagnostic governance data. They do not silently reduce or mutate the published score.
5. **35 is the marketplace score-eligibility threshold.**

`score_eligible_for_marketplace = valu_index >= 35`

This threshold is necessary for marketplace eligibility but is **not** equivalent to being listed.

## Eligibility inputs

The automated eligibility decision should evaluate only canonical platform-controlled facts:

- assessment is completed;
- authoritative VALU score is valid and `total_score >= 35`;
- required professional profile fields are complete;
- professional identity/account is valid;
- no active suspension or revocation exists where policy makes this a listing blocker;
- any required verification flags are satisfied;
- professional has selected at least one supported capability: Talent, Speaker, or Facilitator.

## Decision

`eligible_for_listing = true` means the professional satisfies the current automated rules. It does not mean the professional is necessarily discoverable at that moment.

A successful eligibility evaluation may automatically transition the listing to `LISTED` and preserve an audit event. A failed evaluation must leave the listing `NOT_LISTED` or move it out of discovery without deleting the professional, assessment, or historical governance records.

## Listing is a separate governed state

`listing_status` is an independent marketplace state:

- `NOT_LISTED` — not discoverable;
- `LISTED` — approved for discovery;
- `SUSPENDED` — temporarily removed from discovery by governance;
- `REVOKED` — listing authority withdrawn.

Therefore:

`35+ score ≠ automatically listed`

A professional can be score-eligible while still being `NOT_LISTED` because profile, verification, capability evidence, administrator governance, or another platform requirement is incomplete.

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
