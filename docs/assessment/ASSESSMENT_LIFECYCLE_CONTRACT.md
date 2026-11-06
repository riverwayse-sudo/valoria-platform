# Assessment Lifecycle Contract — Staging Target

## Canonical instruments
| Attribute | Taster | Formal assessment |
|---|---|---|
| Instrument | Directional taster | Official VALU assessment |
| Question count | 9 | 58 |
| Independent lifecycle | Required | Required |
| Answer storage | Taster-only | Formal-only |
| Resume state | Taster-specific | Formal-specific |
| Official VALU Index | Never | Only after valid completion |
| Result units | Directional points only if approved | PRIME/VALU points |

## Required state transitions
Taster: not_started -> in_progress -> completed.
Formal: not_started -> in_progress -> completed.
Account creation/confirmation is a journey bridge, not a transfer of answers or an assessment state transition.

## Invariants
1. The formal assessment starts at 0/58.
2. No taster answer is copied into the formal answer map.
3. Taster and formal identifiers, progress and resume tokens are not interchangeable.
4. Formal scoring accepts only a completed formal assessment with all required answers.
5. Duplicate submissions remain idempotent.
6. A taster result cannot be represented as the official VALU Index.
7. All score displays use points, not percentages.
8. Dashboard status exposes the two instruments separately.

## Before implementation
Map every relevant UI component, route/handler, table, RPC, token, idempotency key, scoring function and migration. Produce a contract map and test fixtures. Do not perform a schema migration or rewrite existing records until the map is reviewed.

## Required tests
- Starting taster creates/uses only taster state.
- Completing taster does not create formal answers.
- Starting formal assessment reports 0/58.
- Formal progress and taster progress cannot overwrite one another.
- Resume restores only the matching instrument.
- Taster payload is rejected by formal scoring.
- Incomplete formal submission is rejected.
- Completed formal submission is idempotent.
- Dashboard shows independent statuses.
- Result report uses points and clearly identifies the official instrument.
