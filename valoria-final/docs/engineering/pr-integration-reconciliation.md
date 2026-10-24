# Open-PR reconciliation and integration order

Eight pull requests are open across `valoria-platform` and `valoria-site`. Seven
are draft; #126 is a non-draft PR that has been open since 2026-10-22 and is
covered separately in §7. Several repair the same incidents from different
angles, and two pairs touch the same files on different branches. This document
records the comparison, the recommended integration order, and the disposition
of each PR.

Nothing here authorises a merge. Every PR stays draft until the staging
acceptance journey passes and an operator authorises release.

Verified state (re-read from the API immediately before this revision):
all eight are `state: open`, `merged: false`, `mergeable: true`. `main` is
untouched in both repositories.

## 0. Integration decisions taken in this pass

Two PRs duplicated work already fixed on the remediation branches. Both
duplicates were folded into `#62`/`#133` rather than waiting, so the candidate is
self-contained and does not depend on unrelated PRs landing first:

| Duplicate | Fixed independently by | Folded into | Reason |
| --- | --- | --- | --- |
| `submit-taster` cluster payload | #60 | **#62** | Byte-identical one-line fix. Leaving it out keeps snapshot submission broken on the candidate. |
| `vercel.json` API rewrite + catch-all | #60 + #63 | **#62** | Priority 1 (asset loading and routing). Same root cause, both halves needed. |
| Email/report abuse controls | #135 | **#133** | #135's analysis was correct where the first attempt was wrong; its design is adopted wholesale, with the missing HTML escaping added. |

#60, #61, #63 and #135 remain open and draft and are **not** closed, merged or
superseded. They are now partly redundant against `#62`/`#133`; §5 records what
each still uniquely contributes.

### 0.1 Closure verification pass

Each duplicate was re-diffed against the *current* candidate, not the version
that existed when it was first folded in. Two items were found that the earlier
fold missed and are now in the candidate; the rest are confirmed contained.

| PR | Verified against | Result |
| --- | --- | --- |
| #60 | `remediation/staging-2026-10-23` | **Two gaps found and adopted** (below). Its `submit-taster` fix and `vercel.json` rewrites are byte-identical to the candidate's. Its routing assertion is a weaker version of the candidate's `09_valu_api_routing_contract.test.js`. |
| #61 | its own branch, repaired | Its blocking assertion is fixed on its own branch (commit `bd4ba85`): the fallback is now located by destination, and the rewrites are resolved in order. Its repaired suite passes against **both** the current and the tightened `vercel.json`. |
| #63 | `remediation/staging-2026-10-23` | Fully contained. Its `vercel.json` change is byte-identical to the candidate's; its `10_missing_asset_404_contract.test.js` is a subset of the candidate's routing test. |
| #134 | `remediation/staging-2026-10-23` | Fully contained — the callback page differs only in comment wording. Its own suite passes against the candidate. |
| #135 | `remediation/staging-2026-10-23` | Fully contained. Its `api-abuse-controls-contract.test.js` (21 assertions with #134's) passes unmodified against the candidate. |

Gaps found in this pass and adopted into the candidate:

1. **`.env.example` was missing `SUPABASE_ANON_KEY`.** `api/claim-listing.js`
   reads `process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
   || SERVICE_ROLE_KEY` to verify the caller's access token against
   `/auth/v1/user`. Neither documented name is a platform variable
   (`.env.example` lists `VITE_SUPABASE_ANON_KEY`, which is the *client* name),
   so in practice that route authenticated with the **service-role key** — a
   privilege escalation relative to what the check needs, and a silent one,
   because the fallback is written as a valid chain. The variable is now
   documented. PR #60 fixes the same thing and is the origin of this item.
   #60 additionally pins `runtime: 'edge'` on the route; #62 does not, see §5.
2. **`api/send-profile-reminder.js` and `api/send-email.js` still resolved the
   site origin their own way** while the other three modules used
   `lib/site-url.js`. See §2.8.

---

## 1. Inventory

| PR | Repo | Head branch | Base | Head | Commits | Files | Scope |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #60 | platform | `fix/valu-critical-path-audit-2026-10-23` | `main` | `f781c94` | — | 5 | Snapshot submit routing + taster cluster payload |
| #61 | platform | `test/valu-critical-path-regressions-2026-10-23` | **#60's branch** | `fcefb3c` | — | 2 | Tests for #60 |
| #62 | platform | `remediation/staging-2026-10-23` | `main` | `3d8213a` | 15 | 31 | Full platform remediation (this audit) |
| #63 | platform | `fix/valu-missing-asset-404-2026-10-23` | `main` | `2b3c623` | — | 2 | Missing-asset 404 instead of the SPA shell |
| #133 | site | `remediation/staging-2026-10-23` | `main` | `61f5dff` | 16 | 55 | Full site remediation (this audit) |
| #134 | site | `fix/valu-confirmation-snapshot-recovery-2026-10-23` | `main` | `1e45583` | — | 2 | Snapshot recovery on the confirmation landing |
| #135 | site | `fix/valu-email-report-abuse-controls-2026-10-23` | `main` | `ba4bf3e` | — | 6 | Email/report abuse controls (duplicates #133) |
| #126 | site | `security/tighten-valu-client-privileges-20261022` | `main` | `0f426c8` | — | 2 | RLS/privilege tightening + one index (see §7) |

`mergeable` is `true` for all eight against their current bases.

### Changed files per PR

| PR | Files |
| --- | --- |
| #60 | `.env.example`, `api/claim-listing.js`, `api/submit-taster.js`, `src/__tests__/07_taster_contact_contract.test.js`, `vercel.json` |
| #61 | `src/__tests__/07_taster_contact_contract.test.js`, `src/__tests__/09_valu_api_routing_contract.test.js` |
| #62 | 31 files — 13 API handlers, `lib/site-url.js`, `vercel.json`, `package.json`, `scripts/find-block-scope-bugs.mjs`, 13 test suites, 2 fixtures, 2 docs |
| #63 | `src/__tests__/10_missing_asset_404_contract.test.js`, `vercel.json` |
| #133 | 55 files — see §2.2 |
| #134 | `src/__tests__/confirmation-snapshot-recovery-contract.test.js`, `src/app/auth/callback/page.jsx` |
| #135 | `src/__tests__/api-abuse-controls-contract.test.js`, `api/trigger-report/route.js`, `api/welcome-email/route.js`, `login/page.jsx`, `signup/page.jsx`, `lib/api-guard.js` |
| #126 | `supabase/migrations/20261022100000_tighten_client_privileges_on_internal_valu_tables.sql`, `supabase/migrations/20261022110000_index_career_applications_reviewed_by.sql` |

### CI status at the current head

| PR | Result |
| --- | --- |
| #60 | 6/6 success |
| #61 | 2/2 success |
| #62 | in progress at time of writing; 6/6 success on the preceding head `89edd18` |
| #63 | 6/6 success |
| #133 | in progress at time of writing; the `Secret Scan` failure on head `f0c96d1` is fixed by `61f5dff` (a synthetic UUID fixture tripped gitleaks) |
| #134 | 8 success, 1 skipped |
| #135 | 7 success, 1 skipped, 1 failure |
| #126 | 8 success, 1 skipped |

**Do not read #61's green CI as evidence that it is independently mergeable.**
CI runs against its stacked base, so it validates `#60 + #61` together, not #61
against `main`.

---

## 2. Overlap and duplication

### 2.1 Same file, different branch — platform `vercel.json`

#60 and #63 both edit `valoria-final/vercel.json`, but in different places:

| PR | Change | Position |
| --- | --- | --- |
| #60 | Adds a rewrite `"/valu/assessment/api/:path*" → "/api/:path*"` | Start of `rewrites` |
| #63 | Narrows the catch-all: `"/(.*)"` → `"/((?!api/)(?!.*\\.[a-zA-Z0-9]+$).*)"` | Third `rewrites` entry |

`main` currently carries neither. **#62 now carries both changes**, so the
candidate does not depend on #60 or #63 landing. #60 and #63 are therefore now
partly redundant; if they are ever merged after #62, both are no-op edits against
an already-correct `vercel.json`.

They are semantically complementary rather than duplicated:

* #60 makes the assessment SPA's `/api/*` calls resolve behind the
  `/valu/assessment` base path. Without it, those calls fall into the catch-all
  and receive `index.html` with a `200`, so the SPA parses HTML as JSON.
* #63 stops the catch-all from answering `200 index.html` for a missing asset.
  Without it, a bad asset path renders a broken shell instead of a `404`.

Both address the same root cause — an unconditional catch-all rewrite — from
opposite directions, and neither alone is sufficient. See §4 for the ordering
hazard.

### 2.2 Site — no overlap

#133 and #134 share no changed file. #134 edits only
`src/app/auth/callback/page.jsx`; #133 does not touch that file at all
(`git diff main...HEAD -- src/app/auth/callback/page.jsx` is empty). They merge
in either order without conflict.

### 2.3 Dependency, not duplication — #61 → #60

#61's base branch is #60's head branch, not `main`. #61 therefore *contains*
#60's commits. Merging #61 into `main` before #60 would either pull #60 in
implicitly or require retargeting #61 to `main` after #60 lands. Retarget #61 to
`main` **after** #60 merges.

#61 has a second, independent blocker introduced by #62: its
`src/__tests__/09_valu_api_routing_contract.test.js` asserts
`indexOfRewrite("/(.*)") >= 0` — that the catch-all source is literally `/(.*)`.
#62 (and #63) replace that source with a tightened expression, so the assertion
fails and the index is `-1`. #61 must be updated to assert the destination and
the ordering instead of the exact source string, which is what
`src/__tests__/19_vercel_routing_contract.test.js` does. Do not "fix" this by
reverting the catch-all: that reintroduces the missing-asset/MIME defect.

### 2.4 #62 and #60 both fix the taster cluster payload

This is the one genuine duplicate, and it matters because **only one of the two
branches currently has the fix**.

`valoria-final/api/submit-taster.js` line 96 sends:

```js
p_cluster_scores: results.normalisedScores,
```

`computeTasterResult()` in `src/valuTaster.js` returns `{ ..., points, ... }` —
there is no `normalisedScores` key anywhere in `src/`. The value sent is
`undefined`.

The receiving RPC rejects that: `submit_taster_with_identity_candidate`
(`supabase/migrations/20261016121500_fix_taster_submission_ambiguous_reference.sql`)
raises `'cluster scores must be an object'` when
`jsonb_typeof(p_cluster_scores) <> 'object'`. So **every snapshot submission
fails with a 502**, and the participant's 15 answers are lost.

Root cause, pinned to a commit: `7458831` ("Replace VALU snapshot percentages
with points", currently the head of `main`) renamed `normalisedScores` to
`points` in `src/valuTaster.js` and updated the display in
`src/VALUIndexV4GateNext.jsx`, but did **not** update `api/submit-taster.js`. The
rename was incomplete and the submission path has been broken since. This is why
the defect is on `main` and not staging-specific.

* #60 fixes it: `p_cluster_scores: results.points`.
* #62 **now fixes it too**, at the same line, with the identical value. The two
  diffs are byte-for-byte the same one-line change, verified against #60's patch.

So the duplicate has been resolved by **option 1**: the fix is folded into #62.
#62 is now self-contained on the snapshot path and does not need #60 to land
first. #60 and #61 are left open and draft; #60 still uniquely contributes the
`claim-listing.js` change and the `.env.example` `SUPABASE_ANON_KEY` entry, and
#61 still uniquely contributes the `09_valu_api_routing_contract` suite.

#62 adds `src/__tests__/18_submit_taster_runtime.test.js` (19 tests) as the
regression coverage for this fix. It executes the real handler with only
`global.fetch` stubbed and asserts the RPC payload, so it fails if the field
regresses, if it is replaced with an empty object, or if the 15 answers are
truncated. #61's coverage of the same contract is contract-style (it reads the
file as text), so the runtime suite is the stronger of the two.

`src/VALUIndexV4Gate.jsx` line 48 also reads `results.normalisedScores`, which
would throw on the taster result screen. That component is imported only by
`src/prime-assessment-v4.jsx`, which is not reachable from the Vite entry point
(`src/main.jsx` → `VALUIndexV4App.jsx` → `VALUIndexV4GateNext.jsx`). It is dead
code, not a live crash, but it should be corrected or deleted when #60 lands so
the next reader is not misled.

### 2.5 #62 and #63 both concern asset handling

The asset incident has three halves, all now in the candidate:

* Site side (#133) — `src/middleware.js` no longer runs for `/valu/assessment*`,
  with the bypass in `src/lib/middleware-routing.js`.
* Platform routing (#62, from #63) — the catch-all no longer answers `200
  index.html` for a path that looks like a file.
* Platform API routing (#62, from #60) — `/valu/assessment/api/*` now reaches the
  Vercel functions instead of the catch-all.

#63 alone closed only the middle one. #62 carries all three, so #63 is now
redundant against it.

### 2.6 #133 and #135 both close the same two abuse surfaces

#135 (`fix/valu-email-report-abuse-controls-2026-10-23`) and #133 fix the same two
audit findings — the open welcome-email relay and the report-trigger credential.
They are independent implementations, and #135's is the better one. Measured
overlap (from #135's own merge simulation, reproduced here):

| Pair | Overlapping files | Merge result |
| --- | --- | --- |
| #133 ∩ #135 | 4 | **3 conflicts** (`trigger-report/route.js`, `welcome-email/route.js`, `login/page.jsx`) |
| #133 ∩ #134 | 0 | complementary, clean |

Resolved by folding #135 into #133 rather than merging both. What was taken and
what was changed:

* **Adopted verbatim** — `src/lib/api-guard.js`, including `isValidReportToken`.
  Its regex is character-for-character the platform's
  (`valoria-final/api/generate-and-send-report.js:30`), so the site cannot forward
  a token the upstream is guaranteed to reject. Also `signupEmailEligible`, the
  per-IP and per-recipient limits, and `user_id` on the signup call.
* **Added, because #135 omitted it** — the caller-supplied `name` is HTML-escaped
  and length-capped before it is interpolated into the email HTML. #135 removed
  the provider-body leak but left the name unescaped.
* **Corrected** — #135's route still logged the Brevo error body
  (`console.error(..., errText)`); that body can echo the recipient address, so
  only the status is logged.
* **Corrected** — the first #133 attempt required a session on `trigger-report`.
  That was wrong and would have broken the legitimate caller: `/login` fires the
  trigger *before* sign-in, and the upstream already applies its own per-IP and
  per-token limits to public triggers. The session requirement is removed. See
  §2.7.
* **Kept from #133** — the runtime test harness. #135's tests assert on source
  strings (`expect(route).toContain('isValidReportToken')`) because its jest setup
  did not transform the ESM routes; #133's `jest.config.js` does, so the tests
  execute the real handlers instead. `api-endpoint-security.test.js` covers the
  legitimate paths as well as the abuse paths.

#135 is left open and draft. After #133 lands it is fully redundant; it is not
closed, because that decision belongs to the owner.

### 2.7 The report-trigger contract, and why there is no session check

The relay in `src/app/api/trigger-report/route.js` had a reachable caller and
still did not work. `create-account.js:123` and `resend-confirmation.js:70` both
build the confirmation redirect as
`${VALORIA_SITE_URL}/auth/callback?identity_hash=…&report_token=…`, and `/login`
reads `identity_hash` off the query string and fires the relay. The relay
forwarded only `identity_hash` and dropped the `report_token` that was already on
the URL, so the upstream refused every call with
`"Valid report token is required"` (`400` → `502`) and the instant path silently
fell back to the `sweep-unsent-reports` cron.

`identity_hash` is not a credential: it is `fp_${hash}`, a deterministic 32-bit
fingerprint of the lowercased `name|role` pair
(`valoria-final/src/lockEngine.js`), so it is guessable and two people with the
same name and role share one. Forwarding it to a privileged endpoint treated a
guessable identifier as proof of identity.

The route now forwards `report_token` and nothing else. It does **not** require a
session, deliberately: the caller cannot hold one yet, and the upstream is the
authority — `generate-and-send-report.js:169-177` applies a per-IP limit
(10/hour) and a per-token limit via `consume_rate_limit` to any non-worker
request. Re-authenticating here would add nothing and would break the workflow.

`/api/welcome-email` is the opposite case and its limiter fails **open**,
matching `enquiries` and `waitlist`. That is safe only because the eligibility
check is independent of the limiter and fails closed on its own: a test fails
both limits and confirms a foreign recipient is still refused.

### 2.8 Site-origin resolution was inconsistent across five modules

`lib/site-url.js` introduced `resolveSiteUrl()` and converted three call sites.
Two were left resolving the origin their own way, so the fix was incomplete and
the staging defect it was written to remove could still occur:

| Module | Before | Consequence on staging |
| --- | --- | --- |
| `send-profile-reminder.js` | `process.env.VALORIA_SITE_URL \|\| 'https://valoriainstitute.com'` | Honoured one variable name only, fell back to production silently; a staging reminder emailed a **production** profile-setup link. |
| `send-email.js` | `<a href="https://valoriainstitute.com/profile/edit">` | The VALU report email's call to action hardcoded production. |

Both now call `resolveSiteUrl()`. In `send-email.js` only the call to action
changed; the logo asset URL and the postal footer legitimately name the public
domain and are environment-independent.

**Why the existing guard missed them.** `14_site_url_resolution.test.js` asserted
the *assignment shape* — a regex for `(redirect_to|redirectUrl|APP_URL|emailRedirectTo)\s*[:=]
… "https://valoriainstitute.com"`. `send-profile-reminder.js` matched none of
those names because it wrote a `process.env.X ||` expression, and `send-email.js`
is a participant-routing link rather than a redirect base. A guard written
against one spelling of a defect only catches that spelling.

The guard now asserts the **property**: every `api/*.js` module that builds a
site URL must route it through `resolveSiteUrl()`, and no module may read
`VALORIA_SITE_URL` ad hoc. The rewritten guard found `send-email.js` on its first
run, which is the evidence that the old one was too narrow.

This is the same failure mode as #61's routing assertion (§2.3): a test that
encodes *how* the code currently looks rather than *what it must do* stops being
a guard and starts being a reason not to fix things.

---

## 3. Recommended integration order

Ordered by dependency, then by risk. Each step is independently verifiable.

Because the candidate now carries the fixes that #60 and #63 contributed, the
order below is the recommended *release* order, not a dependency chain. Steps 1–2
are the candidate; steps 3–5 are optional follow-ups that add coverage or close
the remaining site-side gap.

| Step | PR | Why here |
| --- | --- | --- |
| 1 | **#62** | Self-contained: snapshot payload, both `vercel.json` fixes, 13 handler changes, 15 test suites. Platform release candidate. |
| 2 | **#133** | Site release candidate. Rebase on `main` after #62 so the scoring parity vectors match the landed engine. |
| 3 | **#134** | Closes the confirmation-landing recovery gap, which is the one incident neither candidate fully covers (see §4). Independent of #133 — zero shared files. |
| 4 | **#61** | Only after updating its `/(.*)` assertion (§2.3). Adds contract coverage that #62 already has at runtime. |
| 5 | **#60**, **#63**, **#135** | Redundant once #62/#133 land. Merge only if their remaining unique content is wanted; otherwise close with a note. |

Notes:

* #62 and #133 should land **together or in adjacent releases**. #133's scoring
  parity vectors are generated from #62's engine; a site release against an
  older platform engine is the exact drift the parity check exists to catch.
* #134 is the one item with no coverage in either candidate. It calls
  `/api/claim-taster`, which already exists on `main`, so it needs nothing from
  #133 and is low risk. Recommend landing it in the same release as #133.
* Do **not** merge #60 or #63 *before* #62. #63 narrows the catch-all; #62 adds
  the API rewrite that depends on it. Landing #63 alone would turn
  `/valu/assessment/api/*` from a silent wrong-200 into a 404 while the SPA's API
  calls remain unrouted. #62 contains both halves, so it has no such hazard.

### Ordering hazard — resolved inside #62

#63 narrows the catch-all to exclude paths containing a dot and paths under
`api/`. #60 adds the `/valu/assessment/api/*` rewrite. If #63 landed alone,
`/valu/assessment/api/*` requests would hit the narrowed catch-all and return
`404` instead of `index.html` — a louder failure, but still a failure.

#62 carries both changes in one commit, so the hazard does not apply to the
candidate: the API rewrite sits ahead of the fallback and the fallback is
narrowed. The hazard remains relevant only if someone merges #63 in isolation.

---

## 4. Release-path confirmation

Status of the two fixes the operator asked about, after this pass:

* **Missing-asset / MIME fix** — now **in the candidate**. The platform half is
  in #62 (`vercel.json`, both the catch-all narrowing and the API rewrite); the
  site half is in #133 (`src/middleware.js` no longer runs for
  `/valu/assessment*`). #63 is now redundant against #62.
* **Confirmation-recovery fix** — still **only in #134**, and it is the one
  incident with no coverage in either candidate. It is additive: it calls the
  pre-existing `/api/claim-taster`, which is already on `main`, and adds no new
  route. Recommend landing #134 alongside #133.

---

## 5. Disposition

| PR | Disposition | Blocker |
| --- | --- | --- |
| #62 | **Release candidate.** Land first | None. Awaiting staging acceptance and owner authorisation. |
| #133 | **Release candidate.** Land with or just after #62 | Rebase on `main` after #62; regenerate parity vectors against the landed platform engine. |
| #134 | **Folded into #133.** Keep open | None. The recovery fix is now in #133's callback page; the only difference is comment wording. Its own suite passes against #133. |
| #61 | **Assertion repaired on its own branch** (`bd4ba85`); land with or after #62 | None remaining on the routing test: it now passes against both the current and tightened fallback and still catches the original defect. Still stacked on #60, so retarget to `main` after #60 or #62 lands. |
| #60 | Redundant after #62. Keep open | Its snapshot fix is byte-identical to #62's and its `vercel.json` change is contained in #62's. Its unique `.env.example` `SUPABASE_ANON_KEY` entry is adopted into #62 (§0.1). It also adds `export const config = { runtime: 'edge' }` to `claim-listing.js`, which #62 **deliberately does not**: none of the fetch-based Supabase routes in that family (`claim-taster`, `submit-taster`, `submit-assessment`, `taster-progress`) declare a runtime, so adding it to one of them would make the family inconsistent. #62 runs it on the default runtime, which is what the other five already do. |
| #63 | Redundant after #62. Keep open | Fully contained: its `vercel.json` change is byte-identical to #62's and its `10_missing_asset_404_contract.test.js` is a subset of #62's routing test. |
| #135 | Redundant after #133. Keep open | Fully contained. Its design is adopted in #133 with HTML escaping added and the provider-body log removed; its `api-abuse-controls-contract.test.js` passes unmodified against #133. |
| #126 | **Separate review** — see §7 | Not a duplicate; touches shared database objects. |

No PR should be merged, closed, or retargeted until the staging acceptance
journey in the audit plan passes and an operator authorises release.

---

## 6. Open questions for the operator

1. ~~Should #60's `submit-taster` fix be folded into #62?~~ **Answered: yes,
   folded.** See §0 and §2.4. The same question for #135 is answered the same
   way in §2.6.
2. Is `src/prime-assessment-v4.jsx` / `VALUIndexV4Gate.jsx` intended to be
   deleted, or is it pending re-wiring? It reads `results.normalisedScores`,
   which does not exist. It is unreachable from the Vite entry point, so it is
   dead code rather than a live crash, and it is out of scope for this pass.
3. Should #61 be retargeted to `main` now, or left stacked on #60? Either way its
   routing assertion must be updated first (§2.3).
4. After #62 and #133 land, may #60, #63 and #135 be closed as redundant? They
   are kept open here because closing is the owner's decision, not the agent's.
5. #126 needs an owner decision on migration deployment — see §7.

---

## 7. Stale PR #126 — separate review

`#126` (`security/tighten-valu-client-privileges-20261022`) is **not** a draft and
has been open since 2026-10-22. It is not part of the remediation set and is
**not** a duplicate of anything above. It is recorded here rather than closed,
because closing it would discard unmerged security work.

**What it changes** (2 migrations, neither present on `main`):

* `20261022100000_tighten_client_privileges_on_internal_valu_tables.sql` —
  `REVOKE ALL` on `identity_reconciliation_reviews`,
  `taster_identity_candidates`, `taster_progress` from
  `PUBLIC, anon, authenticated`; the same for `private.marketplace_showcase_approvals`
  and `private.valu_reconciliation_health_snapshots`; and `REVOKE INSERT` on
  `assessment_sessions` and `taster_sessions`.
* `20261022110000_index_career_applications_reviewed_by.sql` — a covering index on
  `career_applications (reviewed_by)`.

**Why it is not obsolete.** The files are absent from `main` (50 migrations
present, none dated 2026-10-22 or later), so nothing in it has been merged
elsewhere. It is genuine, unlanded defence-in-depth.

**Why it is not in this pass.** It changes privileges on tables that the platform
candidate writes to — `taster_sessions` and `taster_identity_candidates` are
written by the RPC that `#62` fixes in §2.4. Deploying a `REVOKE` on those
tables is a database change to shared objects, and the brief forbids altering
shared production configuration without authorisation. Two things must be
confirmed by the operator before it lands:

1. The application routes reach these tables with the **service role**, which
   bypasses RLS and grants. If any route uses the anon or authenticated role,
   this migration would break it. The migration's own comment asserts server
   routes use the service role; that should be verified against the deployed
   configuration, not just the source.
2. The `taster_sessions` / `taster_identity_candidates` revokes should be
   validated against a real snapshot submission (the journey in §2.4) before
   being applied anywhere.

**Disposition:** keep open, do not close, do not merge in this pass. Requires an
operator decision and a database-owner review.
