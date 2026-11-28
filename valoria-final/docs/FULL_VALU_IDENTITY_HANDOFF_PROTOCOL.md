# Full VALU identity handoff protocol

## Required submission contract

- The full assessment page must preserve the immutable `taster_id` from the entry URL or trusted saved progress and send it to `api/submit-assessment.js`.
- The submission API must resolve the taster server-side. Client-provided `user_id` and email are never trusted.
- A completed assessment is stored with `taster_id`, `completed_at`, `assessment_version`, answers, timing metadata and server-calculated score. Scores are not recalculated during identity linking.
- If the taster is already linked, submission may copy that verified account ID and verified email. If not, the assessment remains unowned but retains `taster_id` so a later authenticated claim can recover it.

## Linking and legacy recovery

1. A signed-in user claims the taster through the Valoria site API. The site verifies the Auth token and account identity.
2. Prefer the exact full assessment with that `taster_id`.
3. If the legacy assessment has no `taster_id`, only search completed assessments already owned by the same immutable authenticated `user_id` and with no current taster link.
4. Require normalized name and role to match the saved taster before stitching. This is a secondary consistency check, not a substitute for the account ID.
5. If any owner or taster conflict exists, stop and preserve both records for manual review.
6. Update ownership and `taster_id` conditionally; re-read and verify the result.
7. Upsert the assessment identity link without overwriting a conflicting owner, update profile assessment metadata, refresh `professional_journey`, then verify the marketplace projection.

## Reconciliation safety

- Never match by name, role, date or score alone.
- Never transfer an assessment already owned by another account.
- Never overwrite a different non-null `taster_id`.
- Never make the taster snapshot score look like an official full VALU Index.
- Keep the original score, answer payload, completion timestamp, and assessment/scoring/rubric versions immutable.
- Record unresolved records in a manual-review queue; do not auto-merge them.

## Release verification

- Run the contract tests and production build for both the assessment app and the Valoria site.
- Test signup before assessment, signup after assessment, email-confirmation return, retry, existing owner conflict, duplicate names, and missing `taster_id` legacy records.
- Compare counts separately for profiles, unique public roster professionals, completed tasters, completed full assessments, assessments with `taster_id`, identity links and unresolved candidates.
- Enable Supabase leaked-password protection and confirm RLS policies before release.
- The live production route must be verified after deployment; a passing preview build alone is not production verification.


## Production reconciliation status — 28 November 2026

The current aggregate production snapshot contains 47 Taster sessions, 42 unlinked sessions and 18 completed full assessments, of which 17 have no `taster_id`. Five Taster-to-account links and five assessment-to-account matches have already been applied; the latter do not resolve the missing Taster links.

The 42 open review items comprise 17 contact candidates, 23 unresolved records and 2 conflicting records. Contact-candidate evidence is not authenticated account ownership. Keep all 42 in manual review unless the participant completes the verified-email claim flow or an authorized reviewer records sufficient immutable evidence. Never infer a Taster link from name, role, email similarity, date, score or identity hash alone.

The current production public roster contains 13 profiles; all 13 are eligible and consented, and no eligible profile is missing from the roster. Do not publish additional profiles to reach the previously discussed target of 17 without the required eligibility and public-consent evidence.

The current journey snapshot has 9 records older than seven days (4 `signed_up`, 5 `profile_incomplete`). These represent participant next actions and must not be advanced automatically. One report is failed with `REQUEST_TIMEOUT` after five attempts; do not retry delivery without verifying the recipient and authorization.

The current Taster source version is 4.2. Historical provenance remains 9 sessions at v4.0, 3 at v4.1 and 35 `legacy_unknown`; do not backfill the unknown rows from date or current code.
