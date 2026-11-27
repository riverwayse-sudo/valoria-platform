# Valoria Design & Experience Constitution

**Version:** 1.0.0  
**Status:** Implementation baseline — acceptance remains evidence-gated  
**Applies to:** `valoria-site`, `valoria-platform`, and their shared product experience

## 1. Authority and intent

This constitution extends the existing `DESIGN_CONSTITUTION.md`, `MOTION_CONSTITUTION.md`, `VALORIA_UNIFIED_GOVERNANCE.md`, `VALORIA_REQUIREMENTS_REGISTER.md`, `PLATFORM_INVARIANTS.md`, and component change-control protocol. It does not supersede them. Where requirements conflict, the stricter approved product, security, accessibility, data-integrity, or release rule prevails.

The governing design principle is: **Evolve, don't replace. Enrich, don't decorate. Clarify, don't complicate.**

The rendered experience must feel coherent, institutional, precise, accessible, responsive, and trustworthy. Visual polish must never alter business rules or imply a state the system has not confirmed.

## 2. Protected Valoria identity

- Deep Midnight `#1A1A2E`
- Gold `#C9A84C`
- Slate Indigo `#2E2E4A`
- Warm Parchment `#F7F4EE`
- Antique Linen `#EDE8DC`
- Subtle Brass `#D4C9A8`
- Ivory `#FAFAF7`
- Raleway is the approved typeface.
- Do not reintroduce retired PRIME teal, purple, coral, amber, or unrelated blue/purple palettes.
- No new decorative imagery is introduced in this implementation phase. Existing approved assets are not silently replaced.
- Premium surfaces may use controlled depth, fine borders, restrained gradients, and subtle texture. Avoid generic glassmorphism, ornamental noise, and excessive effects.

## 3. Sixteen governing disciplines

1. **Brand identity and visual language:** consistent colour, typography, art direction, and institutional tone.
2. **Visual composition:** hierarchy, alignment, spacing, grouping, density, cards, surfaces, borders, and elevation.
3. **Content design:** consistent terminology, clear labels, meaningful actions, concise instructions, and recoverable error copy.
4. **Motion and interaction physics:** spatial continuity, purposeful transitions, interruptible interactions, and reduced-motion support.
5. **Micro-interactions:** immediate acknowledgement, state morphing, progressive list entry, controlled feedback, and meaningful completion states.
6. **Information architecture:** understandable structure, navigation, wayfinding, breadcrumbs where useful, and predictable page relationships.
7. **Behavioural UX:** familiar conventions, forgiving targets, cognitive-load reduction, contextual learning, and honest progress.
8. **Component engineering:** reusable components, documented variants, semantic states, and clear ownership.
9. **Navigation and discovery:** search, filtering, sorting, result grouping, empty results, and persistent search context.
10. **Data visualisation:** accurate scales, labels, comparisons, provenance, uncertainty, and accessible non-chart alternatives.
11. **System states and recovery:** loading, empty, pending, success, partial failure, error, offline, retry, expired session, and recovery.
12. **Accessibility:** WCAG 2.2 AA baseline, keyboard operation, focus visibility, semantics, contrast, assistive technology, and target sizing.
13. **Responsive adaptation:** intentional desktop, laptop, tablet, and mobile layouts; content adapts rather than merely shrinking.
14. **Performance and perceived speed:** progressive rendering, skeletons, honest progress, responsive feedback, and measured performance budgets.
15. **Trust, privacy, and ethical UX:** informed consent, transparent pricing, user control, accurate status, no dark patterns, and secure presentation.
16. **Design governance and quality assurance:** design tokens, change control, automated checks, browser evidence, visual regression, and release gates.

Cross-cutting requirements include personalisation, notifications, internationalisation, security, operational/admin interfaces, learning, assessment, certification, and professional-registry experiences.

## 4. Behavioural principles and interpretation

Apply established UX principles as decision aids, not as unquestionable numeric formulas:

- **Jakob:** use familiar conventions where they improve predictability; do not copy another product's identity.
- **Steering and Fitts:** make navigation paths forgiving and interactive targets comfortably usable; target 48px control height where practical.
- **Prägnanz:** remove visual noise without hiding meaningful information.
- **Working memory and chunking:** externalise recall through saved progress, recent context, clear grouping, and useful summaries. Do not enforce arbitrary item counts.
- **Active user:** teach in context, at the moment of need.
- **Default effect:** choose safe, user-beneficial defaults. Never pre-consent to marketing, public visibility, paid extras, or optional data sharing.
- **Goal gradient:** show honest progress and the next meaningful step; never fabricate progress or completion.
- **Postel:** accept reasonable presentation formats where safe, then normalise; server-side validation and security remain strict.
- **Tesler:** let the system handle repetitive work without concealing consequential decisions.
- **Similarity and proximity:** similar controls should behave consistently; labels remain close to their fields.
- **Serial position and Von Restorff:** prioritise important actions and use one clear visual standout per context.
- **Peak-end:** design completion, confirmation, and recovery states with care.
- **Hick:** reduce unnecessary choice while keeping important alternatives discoverable.
- **Doherty:** acknowledge input promptly; feedback must not falsely imply a server-side operation has completed.

## 5. Component contracts

Every shared component must define its purpose, content contract, variants, dimensions, responsive behaviour, interaction states, keyboard behaviour, accessible name, and reduced-motion behaviour.

Required state coverage, where relevant:
- default, hover, focus-visible, active/pressed, disabled;
- loading, pending, success, warning, error;
- empty, unavailable, offline, and retryable.

### Buttons and actions
- Primary actions are visually distinct and use clear verb-object labels.
- Target 48px minimum height and 24px horizontal padding for primary controls, unless a documented compact context requires otherwise.
- Sentence case is preferred for action labels; restrained uppercase may remain for metadata and institutional eyebrow labels.
- Provide visible focus, disabled, loading, success, and error feedback.
- Never make an action look available when it is disabled or unauthorized.

### Forms
- Persistent labels sit above fields; placeholders are hints, not labels.
- Keep labels, controls, hints, and errors spatially associated.
- Validate at the appropriate moment; explain how to recover.
- Preserve user input on recoverable failures.
- Use correct input types, autocomplete, and input-mode hints.

### Cards and surfaces
- Establish one dominant element, consistent alignment, a restrained spacing scale, and clear content grouping.
- Optional premium dark surfaces may use a three-stop midnight gradient, low-opacity pattern, 1px rim highlight, restrained glare, and layered contact/ambient shadows.
- Use depth only when it communicates grouping or interaction. Do not turn every card into a glossy payment card.
- Do not apply hover-only affordances to touch-only devices.

### Lists, menus, dialogs, and notifications
- Lists may enter progressively when this improves orientation; never delay access to content unnecessarily.
- Swipe actions must have an equivalent visible and keyboard-accessible action.
- Menus and hover paths must remain usable by keyboard, touch, and pointer.
- Notifications must distinguish unread, read, pending, failed, and actionable states.
- Do not mark a consequential notification as read merely to create an animation.

## 6. Motion rules

The existing `MOTION_CONSTITUTION.md` and its canonical timing/easing tokens remain authoritative. Do not introduce competing motion libraries, arbitrary durations, spring/bounce brand motion, decorative infinite loops, or page-specific animation systems.

Motion may communicate:
- press and release;
- state morphing rather than abrupt icon replacement;
- progressive list arrival;
- controlled card expansion;
- toast entry and dismissal;
- notification acknowledgement;
- progress and success confirmation.

Use transform and opacity where appropriate. Animations must be interruptible where practical, must not change layout unexpectedly, and must respect `prefers-reduced-motion`. The interface must remain understandable with motion disabled.

## 7. System state and recovery model

Every asynchronous or data-backed component must communicate its actual state. Pending is not success. Optimistic presentation is permitted only when rollback and reconciliation are defined. Payment, assessment submission, profile publication, credential issuance, and identity linking require authoritative server confirmation.

For recoverable failures:
1. preserve entered data and valid progress;
2. explain what happened in plain language;
3. identify whether the action was saved or not;
4. provide a safe retry or recovery path;
5. prevent duplicate submissions where relevant.

## 8. Valoria-specific product invariants

- The account-at-entry, nine-question Taster, post-Taster confirmation, authenticated dashboard, and separate Full VALU journey remain as approved.
- The Taster and Full VALU remain separate records and workflows. Do not expose internal question counts or internal mechanics in participant-facing progress labels.
- Assessment answers and progress must remain server-confirmed and recoverable.
- VALU is points-based. Do not display percentages or locally recalculate scores/designations.
- PRIME remains five clusters and 17 canonical skills, using approved labels and mappings.
- A result, merit tier, eligibility state, consent state, and public listing state are distinct.
- One account has one canonical professional profile with multiple declared capabilities.
- Public profile visibility requires explicit participant-entered consent and applicable eligibility.
- Never fabricate people, counts, credentials, opportunities, buyer activity, outcomes, or verification.
- Preserve existing authentication, assessment, scoring, resume, marketplace, privacy, and notification contracts.

## 9. Accessibility and responsive acceptance

- Target WCAG 2.2 AA.
- All interactive functionality is keyboard operable with visible focus and logical focus order.
- Controls have meaningful accessible names and programmatic labels.
- Text contrast meets AA; non-text controls and focus indicators have sufficient contrast.
- Touch targets should be at least 24×24 CSS pixels under WCAG 2.2 AA, with 44–48px preferred for primary actions.
- Do not rely on colour, motion, hover, or icon shape alone to communicate state.
- Verify representative desktop, laptop, tablet, and mobile widths, including 1440px, 1280px, 768px, and 390px.
- Content must reflow without horizontal scrolling at supported widths except for intentionally scrollable data regions.

## 10. Performance and integrity

- Set measurable budgets for route loading, interaction response, JavaScript, fonts, and image payloads before optimisation work.
- Use skeletons only when they represent the real content structure.
- Do not use fake progress bars or fabricated time estimates.
- Avoid unnecessary dependencies and duplicate component systems.
- Keep data formatting, scoring, access control, and persistence in their canonical owners.
- Privacy, consent, security, and server-side authorization are not visual concerns that may be weakened for convenience.

## 11. Design verification and release

For each implementation:
1. identify the target component and its contract;
2. record protected neighbouring components and explicit exclusions;
3. inspect the current implementation and baseline;
4. make the smallest coherent change;
5. add or update regression coverage;
6. run design, unit, accessibility, security, and build checks applicable to the change;
7. inspect the actual rendered preview at matching desktop and mobile viewports;
8. test keyboard, touch, reduced motion, loading, empty, pending, error, and success states as applicable;
9. record passed, failed, skipped, and unverified checks separately;
10. follow the existing Cloudflare-only release policy and obtain separate production approval.

**A successful build is not visual acceptance. A merged pull request is not production verification.**

## 12. Explicit non-goals for this phase

- No production deployment.
- No database, scoring, assessment, authentication, consent, identity, or participant-record changes.
- No new imagery or decorative illustration.
- No paid service or dependency introduction.
- No wholesale redesign or replacement of approved page structures.
- No merge of unrelated open pull requests.
