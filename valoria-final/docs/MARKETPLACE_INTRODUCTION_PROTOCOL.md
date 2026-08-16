# Valoria Marketplace & Introduction Protocol

## Purpose

Valoria is a curated professional intelligence and introduction platform. Professionals (Talent, Speakers, Facilitators) complete VALU assessments and may be listed when eligibility conditions are satisfied. Organizations (Employers, Event Organizers) discover listed professionals and request introductions. Valoria governance controls the introduction boundary.

## Core lifecycle

Professional: `REGISTERED -> ASSESSMENT_COMPLETED -> ELIGIBILITY_EVALUATED -> LISTED/NOT_LISTED`

Listing: `LISTED <-> SUSPENDED/REVOKED` (admin governed; restoration re-runs eligibility)

Availability: `AVAILABLE | LIMITED | UNAVAILABLE` and is separate from listing status.

Introduction request: `PENDING -> UNDER_REVIEW -> APPROVED -> INTRODUCTION_SENT -> COMPLETED` or `PENDING/UNDER_REVIEW -> DECLINED`; requests can be `PAUSED` if the professional is revoked or suspended.

## Marketplace visibility

Organization-facing queries may expose only approved marketplace fields. Private contact details, raw assessment answers, internal scoring metadata, verification documents, admin notes, and audit records remain platform-controlled.

A professional is discoverable only when:

- `listing_status = LISTED`
- `availability_status IN (AVAILABLE, LIMITED)`
- visibility is enabled
- the professional has passed current eligibility rules

## Organization permissions

Employers and Event Organizers may:

- manage their own organization profile;
- search/filter permitted marketplace records;
- view listed professional information;
- create an introduction request.

They may not:

- directly read private professional contact information;
- modify professional records;
- alter VALU scores or eligibility;
- approve their own introduction request;
- bypass Valoria governance to establish a direct introduction.

## Professional permissions

Professionals may:

- manage permitted profile fields;
- complete/update permitted assessment workflows before submission;
- control availability;
- receive and respond to introduction requests concerning themselves.

They may not:

- modify VALU scores;
- modify platform eligibility/listing status;
- approve an introduction request as the platform authority;
- access another professional's private data.

## Admin governance

Admins may approve, decline, suspend, revoke and restore listings and introduction requests, subject to audit logging. Revocation removes a professional from marketplace discovery immediately without deleting historical assessment or governance records.

## Security boundary

The Vercel API is not the sole security boundary. Supabase/Postgres RLS and database constraints must independently enforce ownership and visibility. Any endpoint that returns marketplace data must apply the same visibility rules as the database layer.

## Future transaction boundary

An approved introduction should create an auditable introduction event rather than expose private contact fields directly. Contact exchange and any later commercial engagement should be separate capabilities from marketplace discovery.
