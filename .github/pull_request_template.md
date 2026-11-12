## Change summary
<!-- What changed and why? -->

## Defect record (required for fixes)
- **Root cause:**
- **Impact/scope:**
- **Correction and rationale:**
- **Regression prevention:**

## Risk review
- [ ] Business rules and boundary conditions reviewed
- [ ] Data integrity, migration and rollback impact reviewed
- [ ] Authentication, authorization, privacy and consent reviewed
- [ ] API contracts and integration failure/retry behaviour reviewed
- [ ] Accessibility (WCAG 2.2 AA) and responsive states reviewed
- [ ] Logs, monitoring and recovery behaviour reviewed
- [ ] No participant data or consent changed without explicit approval

## Verification evidence
- [ ] Static analysis / lint / type checks (where configured)
- [ ] Unit tests
- [ ] Integration / contract tests (where applicable)
- [ ] Regression test for the reported defect
- [ ] Production build
- [ ] Browser journey / staging acceptance (or explicitly marked NOT VERIFIED)
- [ ] Security and secret scan
- [ ] Cloudflare deployment/route verification (if release-bound)

**Commands and results / CI links:**

**NOT VERIFIED items and reason:**

## Release decision
- [ ] No known Critical or High defects remain
- [ ] All required CI checks pass (no skipped/cancelled required checks)
- [ ] Exact deployment commit/version and rollback path identified
- [ ] Change complies with `ENGINEERING_STANDARD.md`

## Component change-control (required for behavior changes)
- **Target component(s) / status / baseline commit:**
- **Requested outcome and in-scope behavior:**
- **Explicitly out of scope:**
- **Affected dependencies / neighboring components:**
- **Protected components inspected:**
- **Rollback / recovery:**

- [ ] Change is limited to named component(s), or cross-component impact is explicitly mapped
- [ ] No unrelated cleanup, redesign, dependency upgrade or behavior change is bundled
- [ ] Protected neighboring components remain unchanged, or reason and tests are documented
- [ ] Boundary and dependent-component regression tests are included
- [ ] Participant data, identity links, assessment answers/scores and consent remain unchanged unless explicitly authorized
- [ ] Real participant/owner accounts and real email recipients were not used without explicit authorization
- [ ] Component status and evidence will be updated in the quality register
