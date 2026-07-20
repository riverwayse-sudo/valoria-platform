# Deploy notes — pulled straight from the two repos, verified, patched

I can't push to GitHub from this chat (no write-capable connector here — only
Supabase is connected), and I can't reach your local C:\ drive either. So
these are ready-to-drop-in files, not commits. Copy each into place and push
yourself; every diff below is the *only* thing that changed in that file.

## 🔴 Item 1 — PRIMEAssessment.jsx: bigger finding than expected

I confirmed via the actual repo (not the summary) that `valoria-platform`
main is still the 137-line orphaned-screens stub — no imports, no default
export, unbuildable.

But: two files called `PRIMEAssessment-FIXED.jsx` and
`PRIMEAssessment-FIXED (1).jsx` are sitting at the **root of the valoria-site
repo** (not valoria-platform) — 1858 and 1871 lines, both fully wired,
modular (imports from `assessmentLock.js` / `scoringEngine.js` /
`questions.js`, which already exist in `valoria-platform/valoria-final/src`),
with a real default export and the correct `intro → assessing → results →
report` phase list. These look like backups from an earlier session that
never got moved into place. `(1)` is the more recent of the two (better
error handling, a corrected `/profile-page` → `/profile/edit` link).

**One real bug in it, now fixed:** its signup handler still POSTed straight
to `/rest/v1/professional_profiles` with the anon key — the exact broken
path `claim-listing.js`'s own comments say has never actually listed a real
user (RLS silently rejects it). I replaced that block with a call to
`/api/claim-listing`, using the same `fp` fingerprint the file already
computes as `identity_hash`. Confirmed by direct diff.

**Note:** the account-type/industry screens (`AccountTypeScreen` etc.) are
*not* in this file either — matches the earlier finding that they were never
merged into the assessment flow. `/profile/setup` already collects the same
info, so this isn't blocking; call it separately if you still want it
earlier in the funnel.

→ `src/PRIMEAssessment.jsx` replaces
`valoria-platform/valoria-final/src/PRIMEAssessment.jsx`

## 🔴 Item 4 — claim-listing.js

Explicitly initializes `active_tracks: []` on first insert instead of
leaving the column unset, so it reads as genuinely empty rather than
ambiguous. `/profile/setup`'s later upsert (merge-duplicates) still owns
setting the real value — confirmed it already does this correctly.

→ `api/claim-listing.js` replaces `valoria-platform/valoria-final/api/claim-listing.js`

## 🟢 Item 5 — Facilitator marketplace

New listings page at `/valoria-develop`, built from `atb-connect.jsx` as the
template, filtered on `.contains('active_tracks', ['facilitator'])`,
surfacing `programme_types` / `fee_range` instead of `skills` /
`salary_expectation`. Also added a "BROWSE CERTIFIED FACILITATORS" link from
the existing static marketing page at `/facilitators`, which previously
had no path into a real listings page at all.

→ `valoria-develop/page.jsx` is new: `valoria-site/src/app/valoria-develop/page.jsx`
→ `facilitators/page.jsx` replaces `valoria-site/src/app/facilitators/page.jsx` (one line changed)

## 🟡 Items 6 & 7 — dashboard + public profile track branching

Both files had a binary `isSpeaker` check standing in for "not a candidate,"
which mislabeled facilitators as candidates (wrong fields: skills/salary
instead of programme_types/fee_range) and collapsed multi-track people to
whichever track happened to be first in the array. Both now derive
independent `isCandidate` / `isSpeaker` / `isFacilitator` flags from the
full `active_tracks` array.

Also fixed: a profile with **no track chosen yet** (fresh off
`claim-listing`, before `/profile/setup`) previously fell through to the
candidate branch silently. The dashboard now shows an explicit "finish
setting up your profile" prompt in that state instead.

The public profile page is single-column, so where copy has to pick one
framing (headline, CTA wording, mailto subject) I added a `displayTrack`
variable with documented precedence (facilitator > speaker > candidate).
This only affects copy — the person still appears correctly on every
marketplace they're actually listed on, since atb-connect/spotlight/
valoria-develop each query `active_tracks` independently of this page.

→ `dashboard/page.jsx` replaces `valoria-site/src/app/dashboard/page.jsx`
→ `profile-id/page.jsx` replaces `valoria-site/src/app/profile/[id]/page.jsx`

## Before you push

- Brace/paren-balance checked on every file — all clean.
- Not run through the actual build — recommend `npm run build` locally on
  both repos before pushing to main, especially valoria-platform given
  item 1's history of shipping unbuildable files.
- The two `PRIMEAssessment-FIXED*.jsx` files sitting at the valoria-site
  root should probably be deleted once you've confirmed the moved copy
  builds — no reason to leave dead 1800-line files at repo root.
