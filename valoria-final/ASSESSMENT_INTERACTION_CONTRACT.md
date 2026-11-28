# Valoria Assessment Interaction Contract

This contract implements the shared Valoria interaction lifecycle across the authenticated assessment, taster, full assessment, results and dashboard handoff.

## Applicable states

- **Idle** — the control is available.
- **Hover** — pointer-only affordance; never the only way to discover or operate a control.
- **Focus** — visible keyboard focus and equivalent keyboard operation.
- **Active** — immediate acknowledgement of activation or selection.
- **Loading** — pending work is explicit and duplicate submissions are prevented where appropriate.
- **Success** — completion is communicated clearly.
- **Error** — failure is perceivable, specific and recoverable.
- **Disabled** — unavailable controls have no misleading hover or active motion.
- **Recovery** — retry or resume preserves valid context and saved progress.

Not every component requires every state. Applicable states must be semantic, accessible and consistent with the operation. Colour or animation alone is never the only state signal.

## Assessment requirements

- Taster and full-assessment answer options expose selected state with `aria-pressed`.
- Keyboard focus remains visible independently of hover.
- Submission exposes pending state with `aria-busy` and a stable loading control.
- Errors and success messages remain perceivable without motion.
- Saved progress and recovery remain truthful; resuming must not imply a reset.
- The taster and full assessment remain separate workflows.
- Internal question counts and assessment mechanics are not exposed in interface copy.

## Motion requirements

- Shared tokens: micro 160ms, standard 240ms, emphasis 420ms, reveal 560ms, section 720ms.
- One canonical motion stylesheet owns transitions, animations and reduced-motion overrides.
- Reduced-motion preference disables nonessential movement.
- No duplicate or inline animation implementations.

The previously referenced 18-pattern catalogue was not enumerated in the approved source material. Do not claim all 18 are implemented until each approved pattern is explicitly specified and verified.
