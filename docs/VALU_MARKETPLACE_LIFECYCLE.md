# VALORIA VALU → MARKETPLACE LIFECYCLE CONTRACT

This is the authoritative product/data contract for the professional discovery pipeline.

## Canonical journey

15-question VALU snapshot → Account → Full VALU assessment → Professional Profile → Capability → Eligibility → Listing → Marketplace

The 15-question snapshot is directional only. It does not establish the authoritative marketplace VALU record.

## Identity model

1 Account → 1 Professional Profile → 1–3+ Capabilities

Talent, Speaker and Facilitator are capability paths on the same professional profile. They are never separate professional identities.

## Account handoff

A professional account is created through the VALU flow. The server links the snapshot to the currently authenticated account. A browser-supplied user ID is never trusted for ownership.

## Profile completeness

A professional profile is complete only when the authoritative database lifecycle confirms the required identity/profile fields, public photo, CV, selected capability path, and a current full VALU assessment.

Client state does not establish marketplace eligibility.

## VALU marketplace gate

Marketplace eligibility requires:

- completed full VALU assessment
- current authoritative score >= 35
- complete professional profile
- no active administrative revocation or suspension

Expired or sub-threshold assessments do not satisfy the gate.

## Capability eligibility

Capability selection is driven by professional_profiles.active_tracks.

- Talent: current private CV on the professional profile.
- Speaker: speaking topics, speaking formats and audience-size experience captured on the profile.
- Facilitator: programme types plus facilitator/topic expertise captured on the profile.

Capability eligibility and listing state are platform-managed. Professionals do not write eligibility_status, eligible_for_listing, or listed_at directly.

## Reconciliation

Changes to profile, assessment or capability inputs enqueue a readiness refresh. The privileged worker reconciles profile completeness, every active capability, capability eligibility, and professional listing state.

The worker must not depend on an end-user auth.uid() check.

## Marketplace projection

Public marketplace views expose only professionals whose authoritative state satisfies the complete listing contract: listed, eligible, public visibility, complete profile, public photo, and at least one listed active capability.

The general marketplace returns one row per professional. Category marketplaces return one row per listed capability while preserving the same underlying professional identity.

## Source of truth

Supabase governance functions and the platform migration history are authoritative for eligibility and listing behavior. Public-site copy must describe this same lifecycle.

Do not introduce client-side eligibility shortcuts, alternate marketplace rules, legacy evidence-table requirements, or separate marketplace identities without changing this contract first.