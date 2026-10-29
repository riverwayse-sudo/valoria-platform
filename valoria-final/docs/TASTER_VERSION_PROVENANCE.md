# Taster version provenance protocol

- Every new 9-question taster submission (VALU v4.1) is stamped server-side with the canonical `VALU_VERSION` from `src/valuTaster.js`.
- `taster_version_source=server_stamped` means the version came from the running server's canonical question/scoring module.
- Historical rows created before version stamping retain `taster_version=NULL` and `taster_version_source=legacy_unknown` unless a human verifies version from release artifacts or deployment records.
- Do not infer a historical version solely from `created_at`, name, role, score, or a later code version. Dates are useful for narrowing the release window, not proof of which code actually served the request.
- If an administrator verifies a legacy row from immutable deployment/release evidence, set the actual version and `taster_version_source=admin_verified`, and record the evidence in the platform audit trail.
- Reconciliation tools must show version and provenance separately. Unknown is a valid and preferable value to a fabricated version.
- This metadata is for provenance and audit only; adding it must not recalculate or change historical scores.