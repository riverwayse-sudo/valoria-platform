# Valoria Institute — Consolidated Release Closeout

**Updated:** 27 November 2026  
**Applies to:** `riverwayse-sudo/valoria-site` and `riverwayse-sudo/valoria-platform`  
**Authority:** Valoria Institute Website Review (20 pages), Valoria Website Content Overhaul (6 pages), 10 November 2026 Closeout Register/Addendum, current owner instructions, and the shared engineering governance documents.

## 1. Release decision

**Code consolidation is merged; production release is not approved.** The two repositories now share byte-identical `VALORIA_UNIFIED_GOVERNANCE.md`, `VALORIA_REQUIREMENTS_REGISTER.md`, and `PLATFORM_INVARIANTS.md`. Site PR #481 and platform PR #290 are merged. Their CI gates passed. These were documentation/governance changes and did not change runtime behaviour or participant data.

A merged PR, successful build, or staging preview is not proof that the complete participant journey works. Production remains outside this closeout until all acceptance gates below are evidenced and separately authorised.

## 2. Canonical requirements

- Valoria Institute is the institution; the website and platform are its delivery mechanisms. Use institution-first, internationally oriented positioning. Retain jurisdiction/legal references only where operationally or legally necessary.
- PRIME has exactly five dimensions and 17 canonical skills. Do not reintroduce an eighteenth skill or legacy labels.
- VALU is points-based. Use the five approved merit designations. Do not display percentage-style VALU scores or internal scoring mechanics.
- The current owner-approved participant journey supersedes the older pre-account Taster sequence in the original documents: **account registration → authenticated 9-question Taster → Taster completion → email confirmation → authenticated dashboard → separate 58-question full assessment → official VALU Index and applicable designation**.
- The Taster and full assessment are separate instruments. Taster responses are not included in, deducted from, or substituted for the full assessment. Full-assessment progress must persist and resume independently.
- Do not expose internal question counts, validity checks, or question-count progress labels to participants.
- Taster completion, account verification, full assessment completion, VALU designation, listing eligibility, public visibility, and certification are separate states.
- Public professional visibility requires current eligibility and recorded consent. Never manufacture, duplicate, or force profiles public to meet a target count.
- Only publish real opportunities with a working application/enquiry route. Otherwise show a truthful empty state or buyer enquiry route.
- Do not claim certification, accreditation, independent validation, partnerships, programme outcomes, or live inventory without verifiable evidence.
- Homepage design follows the latest owner direction: no new imagery for now, a maximum of six to seven focused sections, a centered oval navigation that is not sticky, and a restrained editorial/fashion-magazine feel. Preserve the approved palette and Raleway typography.
- The older nine-section homepage outline in the strategic review is superseded by this more recent owner-approved section limit; do not re-expand the page to nine sections.

## 3. Verified implementation and evidence

### Governance and code
- Site PR #481 merged: `72fae53c38222cfcc519e7a03617a5daeb5ca1ab`.
- Platform PR #290 merged: `6b7f65970a4f5fd0dd0023576324326ee80b40e3`.
- Shared governance, requirements, and invariants documents have matching Git blob hashes in both repositories.
- Site and platform CI, tests, production builds, security/secret checks, environment parity and Cloudflare build validation passed on the merged governance PRs.
- The 17-skill assessment aggregation, account-at-entry Taster architecture, post-Taster confirmation handoff and retry-safe Taster submission have prior passing automated and isolated staging evidence recorded in the platform quality register.

### Staging infrastructure
- Supabase staging project `yccxgjdqworgcbircnvn` is active and healthy; production project remains separate.
- Owner reports the dedicated GitHub staging secret has been added. Cloudflare metadata confirms a `SUPABASE_SERVICE_ROLE_KEY` secret binding exists on the `valoria-staging-site` Worker. Secret values were not retrieved or exposed.
- This verifies presence of a Worker secret binding, **not** successful signup, email delivery, token confirmation, or authenticated session creation.
- A current 82-route/viewport site staging audit previously reached all pages but failed eight checks because the Privacy Policy and Terms pages overrode inherited staging `noindex` metadata and used production absolute canonicals. A targeted fix is now on site PR #479; its refreshed staging workflow is running. Do not weaken the noindex test.

## 4. Remaining acceptance gates

| Gate | Current status | Required closure evidence |
|---|---|---|
| Site route and responsive staging audit | Fix in PR #479; refreshed workflow pending | Cloudflare staging deploy and all 82 route/viewport checks pass, including canonical redirects, noindex, privacy boundaries, no overflow, and browser console |
| Real account registration and confirmation | Not yet end-to-end verified | Synthetic staging account; confirm signup email uses the token-hash template; recipient POSTs confirmation; authenticated session is created; completed Taster is linked to the same account; dashboard opens without another login |
| Separate full assessment | Not yet end-to-end verified | Same synthetic account completes full assessment; autosave, refresh, resume, completion, points-based VALU report and designation verified |
| Specialist profile projections | Automated/source checks exist; live acceptance pending | Synthetic profile evidence verifies Talent, Speaker and Facilitator capability-specific projections; private evidence and personal assessment answers remain private |
| Marketplace inventory and consent | Production snapshot: 13 public-roster rows, 10 registered-only profiles; 23 profiles total, including 5 test profiles | Confirm each public row is complete, eligible and consented. Keep registered-only profiles private. Do not force a target of 17 or copy production personal data into staging |
| Opportunity discovery | Not signed off | Verify a real opportunity, terms, supplier and working application/enquiry path; otherwise retain empty state |
| Legal and institutional wording | Owner/legal sign-off pending | Approve mission, vision and purpose wording; legal entity/operator details; privacy/terms accuracy; and any certification claims. The Privacy Policy currently says analytics cookies/tracking are not used, while the production site layout loads Google Analytics; legal/privacy owner must reconcile the notice with actual tracking before release. Do not infer approval from existing copy |
| Visual and accessibility acceptance | Partial automated evidence only | Review actual Cloudflare staging screenshots on desktop/mobile for homepage, PRIME, VALU, Develop, Marketplace, ATB Connect, ATB Spotlight, About, forms, navigation, focus, contrast and reduced motion. Automated checks are not WCAG 2.2 AA certification |
| Production provenance and release | Not approved | Verify source commit/version of both production Workers, stage all accepted changes, complete all gates, then obtain explicit owner authorisation before production promotion |

## 5. Data integrity and non-negotiable protections

- The production identity review ledger has 104 rows and zero recorded human reviewers. Automated suggestions are not approvals. Do not apply identity links or merge candidate records without a recorded human reviewer and deterministic evidence.
- The 17 full-assessment records missing `taster_id` are not assumed to match the 17 contact candidates.
- The current verified public roster is 13 rows; 10 profiles remain registered-only. Do not publish them without the required evidence and consent.
- Do not mutate participant answers, assessment scores, profiles, consent acknowledgements, identity links, or production migrations as part of documentation or staging verification.
- Do not apply the specialist projection migration to production until its staging acceptance and release gate pass.
- Do not use Vercel for deployment operations. Cloudflare is the deployment authority.
- Do not promote staging code to production merely because CI or a preview succeeds.

## 6. Active pull requests relevant to this closeout

- Site PR #479: staging-only legacy route redirects and expanded browser audit. Targeted legal-page metadata correction is included; the new staging run must pass before merge.
- Site PR #482 and platform PR #291: paired design-foundation changes. CI/build checks passed and the platform has a Cloudflare preview, but visual acceptance remains outstanding. Review together against the design constitution and reduced-motion/focus standards before merging either.
- Other open pull requests are separate backlog or superseded work. Do not bulk-merge them as part of this closeout.

## 7. Closure rule

Close each gate only with a linked commit, CI run, staging evidence, controlled synthetic journey result, or explicit owner/legal approval. Record passed, failed, skipped and unverified separately. No production release is included in this document.

## 8. UX and micro-interaction implementation scope

The source catalogue supplied on 27 November contains **five groups of six patterns (30 patterns)**, not 18. The patterns cover gesture-following sheets and media, tooltips, typing indicators, stacked toasts, file-drop feedback, payment confirmation, copy and field states, checkout progress, map pins, deletion, speed-dial menus, sliders, collapsing titles, long-press actions, page dots, side menus, media controls, downloads, theme switching, search, send/unlock feedback, cart and submit states, progressive list entry, swipe dismissal, card flips and notification acknowledgement.

Apply these patterns only where the corresponding interaction already exists in Valoria. Do not invent payment, cart, map, media, download or unlock features merely to reproduce a reference animation. Preserve the user's motion rules: morph rather than abruptly swap; follow rather than teleport; cascade rather than dump; settle rather than stop abruptly; respond without distracting. All motion must respect reduced-motion preferences, remain keyboard/touch accessible, preserve state and never imply server success before confirmation.

Site PR #482 and platform PR #291 establish the first shared design-token/component foundation and semantic assessment-journey treatment. They do **not** constitute completion of all 30 interaction patterns or visual acceptance. The next implementation pass must map each applicable pattern to an existing Valoria component, implement only those with a real product use case, and verify desktop/mobile, keyboard, touch and reduced-motion behaviour before merge.
