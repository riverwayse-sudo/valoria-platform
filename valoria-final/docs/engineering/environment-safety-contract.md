# Environment safety contract

Status: **proposal for owner review.** Nothing in this document has been applied to
Vercel, Supabase or any deployment. It defines the invariant, the variables that
enforce it, and the evidence that closes it — so the staging remediation can be
approved as a bounded change rather than an open-ended configuration task.

---

## 1. The invariant

> **A non-production runtime must never perform a privileged write against the
> production database.**

Today that invariant does not hold: the preview environment is configured with the
production Supabase URL and service-role key, so a preview deployment writes to
production. The environment guard in PR #67 is the enforcement mechanism. This
document describes the configuration the guard needs in order to allow legitimate
writes and refuse illegitimate ones.

## 2. The two failure modes to avoid

The guard is fail-closed. That is correct, but fail-closed has its own failure
mode, and both must be designed against:

| Failure mode | Symptom | Cause |
| --- | --- | --- |
| **Unsafe allow** | A preview writes to production | A declaration is missing or wrong, and the guard defaults to permitted |
| **Over-refusal** | Every legitimate production write returns 503 | The guard is deployed while its declarations are unset |

The second is not hypothetical. With `PRODUCTION_SUPABASE_PROJECT_REF` unset —
today's production state — the guard **refuses a valid production write**. Merging
PR #67 before the declarations exist would take the assessment offline.

## 3. Variables

| Variable | Environment | Value | Secret? |
| --- | --- | --- | --- |
| `PRODUCTION_SUPABASE_PROJECT_REF` | Production | `sbkgpisgkuhbalsxqkdr` | No — a project ref is public in any client Supabase app |
| `SUPABASE_URL` | Production | `https://sbkgpisgkuhbalsxqkdr.supabase.co` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | production key | **Yes** |
| `STAGING_SUPABASE_PROJECT_REF` | Preview | the staging project ref | No |
| `SUPABASE_URL` | Preview | `https://<staging-ref>.supabase.co` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview | staging key | **Yes** |
| `VERCEL_TOKEN` | GitHub secret | Vercel token | **Yes** |

How `sbkgpisgkuhbalsxqkdr` was established: it was read from the **publicly served
production bundle**, where it appears in client Supabase storage URLs. That is
evidence of which project the *client* is built against. It is not the same as
reading the Production environment variables through Vercel, which is the
authorised confirmation step 2 in section 5 and has not been performed.

The guard extracts a ref only from a hostname matching
`^[a-z0-9]{20}\.supabase\.(co|in)$`. The production ref is exactly 20 characters,
so it satisfies this; a staging ref must also be 20 characters or the guard will
refuse every write to it.

Rules:

- A project ref is not a credential; a service-role key is. Never place a key in a
  variable that is not marked secret, and never in a repository file.
- The preview `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be the **staging**
  values. If they remain the production values, the guard correctly refuses every
  preview write — which is safe, but the preview is then useless for testing.

## 4. What the guard decides

Verified behaviour of the pure decision function (`lib/environment-guard.js` in
PR #67, head `154dcc8`). The function was extracted from that commit and executed
against each combination below; all eleven matched the expected outcome.

| Runtime | Declarations | Decision |
| --- | --- | --- |
| production | production ref declared and matching | **allow** |
| production | production ref unset | refuse |
| production | production ref wrong | refuse |
| preview | staging declared, targets staging | **allow** |
| preview | targets production | refuse |
| preview | staging declaration names production | refuse |
| preview | no staging declared | refuse |
| preview | no production declared | refuse |
| VERCEL_ENV unset | local writes not enabled | refuse |
| VERCEL_ENV unset | local writes enabled, targets staging | **allow** |
| VERCEL_ENV unset | local writes enabled, targets production | refuse |

Two details worth noting, both verified in that run:

- The production ref `sbkgpisgkuhbalsxqkdr` is exactly 20 characters and matches
  the guard's URL pattern, so it is accepted as a valid ref.
- The guard refuses a **preview** write when the production ref is undeclared,
  even if the target looks like staging. It cannot prove the target is not
  production without knowing which project production is. This is why the
  production declaration must exist before the guard ships.

## 5. Activation order (the part that prevents an outage)

The declarations and the guard must be introduced in a fixed order. The guard is
safe to deploy **only after** the production declaration exists.

1. **Set `PRODUCTION_SUPABASE_PROJECT_REF` in the Production environment.** With the
   guard absent, this variable is inert — it changes no behaviour, so there is no
   risk in setting it first.
2. **Verify** the production value matches what production actually uses
   (`sbkgpisgkuhbalsxqkdr`), by reading it back through the authorised mechanism.
3. **Create the staging project**, then set the Preview `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` and `STAGING_SUPABASE_PROJECT_REF` to the staging values.
4. **Verify preview isolation before the guard ships:** with the guard still
   unmerged, confirm the preview `SUPABASE_URL` resolves to the staging ref, not
   production.
5. **Only then merge PR #67.** Production writes continue to work because the
   declaration now exists; preview writes reach staging because the preview is
   pointed at staging.
6. **Verify both directions** (section 6) before declaring the remediation complete.

Steps 1 and 2 are owner actions and are **safe to perform today** — they cannot
break anything while the guard is unmerged. Steps 3–4 require creating a Supabase
project. Step 5 is the merge of #67, which remains explicitly out of scope.

## 6. Evidence required to close this

The remediation is complete when all of the following are demonstrated:

1. A production-runtime privileged write **succeeds**.
2. A preview-runtime write **against the production ref is refused**.
3. A preview-runtime write **against the staging ref succeeds**.
4. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Preview resolve to the staging
   project, verified by reading them back, not by inspecting the dashboard.
5. The staging signup → email confirmation → taster → full-assessment →
   result-retrieval journey completes end to end.
6. Production behaviour is unchanged: a production submission still succeeds.

Items 2 and 3 are covered by automated tests today (the guard matrix). Items 1, 4,
5 and 6 require the configured environments.

## 7. Rejected approaches

- **Disabling Vercel Deployment Protection** to reach a preview. This weakens the
  boundary the guard exists to protect. Use a Protection Bypass for Automation
  secret, or restrict protection to production deployments only.
- **Merging the guard first and configuring afterwards.** This is the over-refusal
  failure mode: production writes would return 503 until the declaration is added.
- **Pointing a preview at production to make testing convenient.** This is the
  original defect.
- **Editing migrations to resolve the version collisions.** The collision must be
  resolved against the applied history, which requires database access
  (`docs/engineering/migration-collision-register.md`).
