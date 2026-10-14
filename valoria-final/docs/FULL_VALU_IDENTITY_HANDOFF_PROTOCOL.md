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
