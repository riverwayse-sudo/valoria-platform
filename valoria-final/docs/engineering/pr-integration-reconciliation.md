# Open-PR reconciliation and integration order

Six pull requests are open across `valoria-platform` and `valoria-site`, all
draft and unmerged. Several repair the same incidents from different angles, and
two pairs touch the same files on different branches. This document records the
comparison, the recommended integration order, and the disposition of each PR.

Nothing here authorises a merge. Every PR stays draft until the staging
acceptance journey passes and an operator authorises release.

Verified state: all six are `state: open`, `draft: true`, `merged: false`.
`main` is untouched in both repositories.

---

## 1. Inventory

| PR | Repo | Head branch | Base | Commits | Files | Scope |
| --- | --- | --- | --- | --- | --- | --- |
| #60 | platform | `fix/valu-critical-path-audit-2026-10-23` | `main` | — | 5 | Snapshot submit routing + taster cluster payload |
| #61 | platform | `test/valu-critical-path-regressions-2026-10-23` | **#60's branch** | — | 2 | Tests for #60 |
| #62 | platform | `remediation/staging-2026-10-23` | `main` | 13 | 25 | Full platform remediation (this audit) |
| #63 | platform | `fix/valu-missing-asset-404-2026-10-23` | `main` | — | 2 | Missing-asset 404 instead of the SPA shell |
| #133 | site | `remediation/staging-2026-10-23` | `main` | 13 | 50 | Full site remediation (this audit) |
| #134 | site | `fix/valu-confirmation-snapshot-recovery-2026-10-23` | `main` | — | 2 | Snapshot recovery on the confirmation landing |

`mergeable_state` is `clean` for #60, #61 and #63 against their current bases.

---

## 2. Overlap and duplication

### 2.1 Same file, different branch — platform `vercel.json`

#60 and #63 both edit `valoria-final/vercel.json`, but in different places:

| PR | Change | Position |
| --- | --- | --- |
| #60 | Adds a rewrite `"/valu/assessment/api/:path*" → "/api/:path*"` | Start of `rewrites` |
| #63 | Narrows the catch-all: `"/(.*)"` → `"/((?!api/)(?!.*\\.[a-zA-Z0-9]+$).*)"` | Third `rewrites` entry |

`main` currently carries neither. **#62 does not touch `vercel.json` at all**, so
there is no three-way conflict; #60 and #63 will apply to `main` independently.
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

* #60 fixes it: `p_cluster_scores: results.points`.
* #62 does **not** fix it — `submit-taster.js` is unchanged on
  `remediation/staging-2026-10-23`, and the defect is present on `main`
  identically (`git show main:.../submit-taster.js` line 96).

So #62 is **not** a superset of #60. Two options:

1. Fold #60's one-line fix (and #61's tests) into #62, or
2. Land #60/#61 first, then rebase #62.

Either is safe. Leaving both unlanded keeps snapshot submission broken.

`src/VALUIndexV4Gate.jsx` line 48 also reads `results.normalisedScores`, which
would throw on the taster result screen. That component is imported only by
`src/prime-assessment-v4.jsx`, which is not reachable from the Vite entry point
(`src/main.jsx` → `VALUIndexV4App.jsx` → `VALUIndexV4GateNext.jsx`). It is dead
code, not a live crash, but it should be corrected or deleted when #60 lands so
the next reader is not misled.

### 2.5 #62 and #63 both concern asset handling

#62 fixes the site-side half of the asset incident (`src/middleware.js` no
longer runs for `/valu/assessment*`, and `src/lib/middleware-routing.js` holds
the bypass). #63 fixes the platform-side half (a missing asset returns `404`
rather than the shell). They are complementary; the incident is only fully
closed with both.

---

## 3. Recommended integration order

Ordered by dependency, then by risk. Each step is independently verifiable.

| Step | PR | Why here |
| --- | --- | --- |
| 1 | **#60** | Unblocks snapshot submission; #61 depends on it |
| 2 | **#61** | Retarget to `main` first; adds #60's regression coverage |
| 3 | **#63** | Small, isolated `vercel.json` change; no dependency |
| 4 | **#134** | Independent of #133; recovery on the confirmation landing |
| 5 | **#62** | Rebase on `main` after #60/#61; resolve the `submit-taster` overlap |
| 6 | **#133** | Rebase on `main` after #62/#63 so the parity vectors match |

Notes:

* Steps 1–3 are platform `vercel.json` + one API file. Steps 5–6 are the large
  remediation branches and should land last, once the small fixes are in and CI
  is green.
* #62 and #133 should land **together or in adjacent releases**. #133's scoring
  parity vectors are generated from #62's engine; a site release against an
  older platform engine is the exact drift the parity check exists to catch.
* #133 and #134 are independent, but #134's recovery path calls
  `/api/claim-taster`, which exists on `main` already, so #134 needs nothing
  from #133.

### Ordering hazard — do not merge #63 before #60

#63 narrows the catch-all to exclude paths containing a dot and paths under
`api/`. #60 adds the `/valu/assessment/api/*` rewrite. If #63 lands first and
#60 is delayed, `/valu/assessment/api/*` requests hit the narrowed catch-all and
return `404` instead of `index.html` — a louder failure, but still a failure.
Neither ordering is dangerous once both are in; the risk is releasing #63 alone
while the SPA's API calls remain unrouted.

---

## 4. Release-path confirmation

Both fixes the operator asked about **are** in the intended release path, but in
different PRs, and neither is in #62 or #133:

* **Missing-asset fix** — PR **#63** (platform). The site-side root cause (the
  middleware treating asset requests as page requests) is in PR **#133**.
  Both are required.
* **Confirmation-recovery fix** — PR **#134** (site). It is not in #133. Note
  #134 does **not** add a new route: it calls the pre-existing
  `/api/claim-taster`, which is already on `main`. So #134 is additive and low
  risk.

---

## 5. Disposition

| PR | Disposition | Blocker |
| --- | --- | --- |
| #60 | Land first | None; needs a rebase check against #63's `vercel.json` edit |
| #61 | Land with #60 | Retarget base from #60's branch to `main` |
| #62 | Land after #60/#61 | Rebase; reconcile the `submit-taster` overlap |
| #63 | Land after #60 | None |
| #133 | Land last | Rebase; regenerate parity vectors against the landed platform engine |
| #134 | Land any time | None |

No PR should be merged, closed, or retargeted until the staging acceptance
journey in the audit plan passes and an operator authorises release.

---

## 6. Open questions for the operator

1. Should #60's `submit-taster` fix be folded into #62 rather than landing #60
   separately? (Reduces the number of open PRs but makes #62 larger.)
2. Is `src/prime-assessment-v4.jsx` / `VALUIndexV4Gate.jsx` intended to be
   deleted, or is it pending re-wiring? It reads a field that does not exist.
3. Should #61 be retargeted to `main` now, or left stacked on #60?
