# Valoria Unified Requirements and Decision Register

**VALORIA_GOVERNANCE_VERSION: 1.0.0**  
**Initial status:** Baseline audit required. This register records obligations; it does not claim implementation or acceptance.  
**Source documents:** `Valoria Institute Website Review.pdf` (20 pages, updated 4 November 2026) and `Valoria Website Content Overhaul.pdf` (6 pages).  
**Status evidence:** Repository-specific `QUALITY_REGISTER.md` files and linked PR/CI/staging/production evidence.

## Status vocabulary

- **PASS:** acceptance evidence is linked and current.
- **FAIL:** acceptance criterion is demonstrably unmet.
- **NOT VERIFIED:** evidence is missing or stale.
- **FIXED IN CODE — NOT VERIFIED:** code exists but required runtime acceptance is outstanding.
- **DECISION REQUIRED:** conflicting authority or unresolved owner decision.
- **DEFERRED:** explicitly approved for a later phase.
- **AUDIT REQUIRED:** baseline inspection has not yet established the current state.

Do not change a status without evidence. A merged PR or successful build is not sufficient evidence of end-to-end completion.

## A. Protected standards

| ID | Requirement / acceptance criterion | Authority | Owner | Initial status |
|---|---|---|---|---|
| VAL-STD-001 | Taster and full assessment remain separate records and journeys; no question reuse or subtraction | Both PDFs; later approved journey | Platform | AUDIT REQUIRED |
| VAL-STD-002 | Full assessment contract remains 54 scored questions plus 4 validity anchors | Strategic Review | Platform | AUDIT REQUIRED |
| VAL-STD-003 | New Taster uses approved nine-question version; historical versioned 15-question sessions remain resumable only as legacy | Current approved platform contract | Platform | AUDIT REQUIRED |
| VAL-STD-004 | Create the participant account at Taster entry; request email confirmation only after Taster completion. Before confirmation, allow only the server-issued, short-lived, single-use Taster capability; dashboard, profile, marketplace and Full VALU remain confirmation-gated. Preserve legacy recovery | Latest explicit owner decision and approved confirmation callback contract | Site + Platform | FIXED IN GOVERNANCE — IMPLEMENTATION NOT VERIFIED |
| VAL-STD-005 | Assessment answers, progress and completion are independently persisted and server-confirmed | Both PDFs; REQS | Platform | AUDIT REQUIRED |
| VAL-STD-006 | PRIME has five clusters and 17 canonical skills; canonical labels/mappings are not locally invented | Strategic Review | Platform + Site | DECISION REQUIRED for canonical label parity |
| VAL-STD-007 | VALU is points-based; one server-side scoring/designation authority; no percentage or duplicate frontend scoring | Strategic Review; REQS | Platform | AUDIT REQUIRED |
| VAL-STD-008 | Any disagreement between PDF designation thresholds and the current canonical scorer is resolved by explicit decision before changing rules or historical results | Source reconciliation rule | Product + Platform | DECISION REQUIRED |
| VAL-STD-009 | One canonical professional profile per account, with multiple declared capabilities supported | Approved product architecture | Platform | AUDIT REQUIRED |
| VAL-STD-010 | Public profile visibility requires current participant-entered consent and applicable eligibility; admin attestation is not consent | Later explicit consent decision; production correction | Platform | AUDIT REQUIRED |
| VAL-STD-011 | Historical identity links require exact evidence and authenticated human review; no automatic ownership transfer | Later approved reconciliation policy | Site + Platform | AUDIT REQUIRED |
| VAL-STD-012 | No fabricated profiles, public counts, credentials, opportunities, buyer activity or outcomes | Both PDFs; REQS | Site + Platform | AUDIT REQUIRED |
| VAL-STD-013 | Participant data, answers, scores, identity links and consent are not changed without explicit authorization | REQS | Platform | AUDIT REQUIRED |
| VAL-STD-014 | Production deployment is Cloudflare-only and requires explicit release approval, passing gates and recovery plan | REQS / deployment policy | Site + Platform | AUDIT REQUIRED |\n| VAL-STD-015 | Taster completion automatically creates/refreshes the professional profile and eligibility projection without an admin approval gate; public visibility still requires participant-entered consent and eligibility | Later approved product decision plus consent policy | Platform | AUDIT REQUIRED |

## B. Strategic Review requirements

| ID | Requirement / acceptance criterion | Primary owner | Initial status |
|---|---|---|---|
| VAL-STR-001 | Institutional authority, digital platform value and opportunity proposition are clearly connected | Site | AUDIT REQUIRED |
| VAL-STR-002 | Homepage explains professional and buyer value and provides accurate assessment entry | Site | AUDIT REQUIRED |
| VAL-STR-003 | PRIME and VALU methodology are explained accurately and consistently | Site + Platform | AUDIT REQUIRED |
| VAL-STR-004 | Professional journey connects assessment, results, profile, visibility and opportunities | Site + Platform | AUDIT REQUIRED |
| VAL-STR-005 | Buyer discovery supports capability, sector, seniority and declared role where supplied | Platform | AUDIT REQUIRED |
| VAL-STR-006 | Profile includes approved professional identity, headline, modalities, capabilities, permitted VALU result, evidence, location and shareable URL | Platform | AUDIT REQUIRED |
| VAL-STR-007 | Assessment completion, listing eligibility, participant consent and public discoverability are distinct states | Platform | AUDIT REQUIRED |
| VAL-STR-008 | Opportunity categories are only presented as active offers when supply and application/enquiry routes exist | Site + Platform + Operations | AUDIT REQUIRED |
| VAL-STR-009 | Opportunity cards show verified title, organisation, category, location/work mode, expertise, terms, deadline and working action where supplied | Site + Platform | AUDIT REQUIRED |
| VAL-STR-010 | Matching explanations do not imply guaranteed suitability | Platform | AUDIT REQUIRED |
| VAL-STR-011 | Dashboard preserves session continuity, assessment progress and clear next actions | Platform + Site | AUDIT REQUIRED |
| VAL-STR-012 | Analytics cover acquisition, conversion, activation, opportunity engagement and retention without misrepresenting unavailable events | Site + Platform | AUDIT REQUIRED |
| VAL-STR-013 | Accessibility, responsive behavior and interaction quality are verified against the engineering target | Site + Platform | AUDIT REQUIRED |

## C. Content Overhaul requirements

| ID | Requirement / acceptance criterion | Primary owner | Initial status |
|---|---|---|---|
| VAL-CNT-001 | Homepage follows approved capability-led story and removes retired positioning | Site | AUDIT REQUIRED |
| VAL-CNT-002 | Remove duplicated registry cards and unverified live professional count; label illustrative examples | Site | AUDIT REQUIRED |
| VAL-CNT-003 | PRIME page uses canonical five clusters, 17 skills and approved designations | Site | AUDIT REQUIRED |
| VAL-CNT-004 | VALU page explains Taster and full assessment as separate stages; correct legacy “first 9 of 58” wording | Site | AUDIT REQUIRED |
| VAL-CNT-005 | Develop and facilitator/programme pages are consolidated only to the extent supported by actual offers | Site | AUDIT REQUIRED |
| VAL-CNT-006 | Marketplace cards show verified name, headline, declared role, permitted designation/points and development area; incomplete/unconsented profiles are not public | Site + Platform | AUDIT REQUIRED |
| VAL-CNT-007 | ATB Connect and ATB Spotlight describe working, truthful buyer journeys | Site + Platform | AUDIT REQUIRED |
| VAL-CNT-008 | About page exists and uses approved mission, vision, purpose and verified leadership information | Site | AUDIT REQUIRED |
| VAL-CNT-009 | Remove unsupported facilitator certification, cohort reporting, 90-day remeasurement, pricing and independent-validation claims | Site | AUDIT REQUIRED |
| VAL-CNT-010 | Verify every navigation item, CTA, footer link, Privacy and Terms route | Site | AUDIT REQUIRED |
| VAL-CNT-011 | Legal entity, canonical public names, programme pricing, facilitator certification evidence and public speaker name are approved before publication | Product Owner | DECISION REQUIRED |
| VAL-CNT-012 | Resolve international positioning against later approved brand direction; do not reintroduce retired localisation without approval | Product Owner + Site | DECISION REQUIRED |

## D. Cross-repository architecture and reliability

| ID | Requirement / acceptance criterion | Primary owner | Initial status |
|---|---|---|---|
| VAL-ARC-001 | Site owns public presentation; platform owns canonical assessment, identity, scoring, profile, eligibility and data rules | Site + Platform | AUDIT REQUIRED |
| VAL-ARC-002 | Shared business rules are not independently reimplemented in both repositories | Site + Platform | AUDIT REQUIRED |
| VAL-ARC-003 | Cross-repository API/data contracts are documented, versioned and compatibility-tested | Site + Platform | AUDIT REQUIRED |
| VAL-ARC-004 | Critical routes, auth/session behavior, error states and recovery paths have automated coverage | Site + Platform | AUDIT REQUIRED |
| VAL-ARC-005 | Every defect has root cause, scope, correction, evidence, recurrence prevention and recovery record | Site + Platform | AUDIT REQUIRED |
| VAL-ARC-006 | Each release has exact source commit, test evidence, environment, Cloudflare Worker version and rollback/forward-recovery plan | Site + Platform | AUDIT REQUIRED |
| VAL-ARC-007 | Quality registers remain repository-specific and are linked to this shared requirements register | Site + Platform | AUDIT REQUIRED |

## E. Decision log and conflict handling

| Decision ID | Topic | Current rule | Source / rationale | Status |
|---|---|---|---|---|
| VAL-DEC-001 | Taster entry and confirmation | Create account at Taster entry; complete the nine-question Taster; request email confirmation at completion; verify ownership, link the exact Taster and establish the authenticated dashboard session. No general unconfirmed session or Full VALU access | Latest explicit owner decision and scanner-safe confirmation callback contract | APPROVED — VERIFY IMPLEMENTATION |
| VAL-DEC-002 | Taster versioning | New sessions use approved nine-question version; historical 15-question sessions remain versioned legacy | Current platform contract; do not reset historical answers | APPROVED — PROTECT |
| VAL-DEC-003 | Public visibility | Explicit participant-entered consent is required; admin attestation is insufficient | Later consent decision and production privacy correction | APPROVED — PROTECT |
| VAL-DEC-004 | Identity reconciliation | Automated suggestions require authenticated human review and traceable evidence before application | Reconciliation safety policy | APPROVED — PROTECT |
| VAL-DEC-005 | VALU designation below 35 and production merit bands | Website Review (4 Nov), Content Overhaul (5 Nov) and Assessment V4 specify five levels: 80–100 Force to Align With; 65–79 Emerging Force; 50–64 Developing Professional; 35–49 Building Foundations; below 35 At the Starting Point. Current site `brand.js` and staging trigger implement the first four bands but return no designation below 35; production trigger still uses retired 90/75/55/35 labels. Owner must decide whether below 35 displays “At the Starting Point” or remains without a merit designation. | Do not change thresholds, triggers or historical labels by inference; reconcile source docs and production/staging before any migration | DECISION REQUIRED |
| VAL-DEC-006 | Public positioning | Latest approved international brand direction supersedes retired copy only where explicitly approved | Later brand direction; retain unresolved legal/jurisdiction facts for approval | DECISION REQUIRED where exact wording is unsettled |
| VAL-DEC-007 | Legal identity and public names | Publish only after owner confirmation | Strategic Review and Content Overhaul open decisions | DECISION REQUIRED |

## F. Phase and release tracking

The initial work phases are:

1. **Baseline and authority reconciliation:** inspect both repositories, both PDFs, subsequent decisions, open PRs, deployment provenance and current tests; resolve conflicts and de-duplicate work.
2. **Assessment and identity:** registration, confirmation, Taster, dashboard, separate full assessment, save/resume, scoring and reports.
3. **Profile and marketplace:** record reconciliation, capability model, eligibility, participant consent, visibility and buyer discovery.
4. **Website and content:** page implementation, truthful claims, routes, navigation, legal pages and responsive acceptance.
5. **Reliability and operations:** cross-repository contracts, security, accessibility, observability, backup/restore and regression coverage.
6. **Final acceptance:** controlled synthetic journeys, production smoke tests after explicit approval, evidence-backed closure.

Each requirement must be decomposed into atomic tasks and assigned to a repository/component. Do not close a phase while any Critical/High defect or unverified mandatory acceptance criterion remains.

## G. Evidence and updates

For every row, add: current status, exact PR/commit, CI run, test name/result, staging/production environment, date, owner and remaining limitation. Do not replace **AUDIT REQUIRED** with PASS based on memory, summaries, code presence, a merged PR or a successful build alone.
