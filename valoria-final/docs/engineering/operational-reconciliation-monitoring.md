# Operational reconciliation monitoring

The database migration `20261015145000_valu_operational_reconciliation_monitoring.sql` extends the private service-role health report. It reports aggregate counts for assessment identity integrity, roster alignment, capability eligibility, resumable snapshot progress, identity-candidate categories, and journey freshness.

Call `private.valu_reconciliation_health()` only from a trusted server-side process using service-role credentials. Never expose the function or raw identity candidate data to browser clients.

Alert for any owner conflict, missing assessment link, journey mismatch, roster membership mismatch, expired in-progress snapshot, or eligible active capability that is not listed. Treat these as review triggers; do not automatically merge identities, delete records, recalculate scores, or publish profiles.

Journey records older than seven days that are not completed or closed need inspection of their next action and event history before changing state. Historical unknown taster versions must remain unknown until immutable release evidence proves otherwise.

Live baseline on 2026-10-15: 17 completed full assessments; 18 profiles (one without a completed full assessment and unlisted); 17 listed profiles and 17 public roster rows with no membership mismatch; 35 tasters classified as 2 account-linked, 16 contact candidates, and 17 unresolved; 5 stale journey records; no assessment-owner conflicts or missing completed-assessment links. Zero progress rows does not prove a broken flow; live POST init/save/reload/submit/retry verification remains outstanding.

The health report now distinguishes review decisions from persisted correction state. A verified assessment-to-taster link, verified assessment-to-account ownership link, or verified taster-to-account ownership link is counted as applied only when the database rows agree with the reviewed candidate and owner. These records are excluded from `identity_review_queue_open` and counted in `identity_review_queue_applied`. Separately, `missing_taster_link_assessments_without_verified_taster_review` remains non-zero until each completed assessment missing `taster_id` has a latest traceable verified review specifically naming a taster; a prior account-owner review alone does not satisfy that requirement. No identity link is applied by the health function.
