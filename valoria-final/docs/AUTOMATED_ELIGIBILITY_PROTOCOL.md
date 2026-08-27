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
- professional has selected at least one supported capability: Talent, Speaker, or Facilitator, with required evidence.

## Decision

`eligible_for_listing = true` means the professional satisfies the current automated rules. It does not mean the professional is necessarily discoverable at that moment.

A successful eligibility evaluation may automatically transition the listing to `listed` and preserve an audit event. A failed evaluation must leave the listing `unlisted` or move it out of discovery without deleting the professional, assessment, or historical governance records.

## Listing is a separate governed state

The live database uses these listing states:

- `pending` — claim/profile setup is incomplete;
- `unlisted` — not discoverable;
- `listed` — approved for discovery;
- `suspended` — temporarily removed from discovery by governance;
- `revoked` — listing authority withdrawn.

Therefore:

`35+ score ≠ automatically listed`

A professional can be score-eligible while still being `unlisted` because profile, verification, capability evidence, administrator governance, or another platform requirement is incomplete.

## Admin override

Administrators can approve, suspend, revoke, or restore a listing. Restoration must re-run the eligibility rules before returning the professional to `listed`.

## Availability

Availability is independent of eligibility and listing:

- `available` — eligible/listed and accepting introduction requests;
- `limited` — eligible/listed but with constrained availability;
- `unavailable` — still listed if policy permits, but excluded from active availability results.

## Marketplace rule

The organization-facing marketplace should return a professional only when all required discovery conditions are true:

`eligible_for_listing = true`

`listing_status = listed`

`availability_status IN (available, limited)`

`visibility = public`

## Governance and audit

Every automated or administrative status change must produce a governance event with the previous status, new status, reason, actor/system identity where applicable, and timestamp.

## Important implementation rule

Do not use `users.user_type` as the sole eligibility authority. Professional capabilities and platform authorization are separate concepts. The database and server-side readiness engine are the source of truth; client-side state is presentation only.
