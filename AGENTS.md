# Engineering guidance — Valoria Institute platform

Apply the project engineering standards in `docs/engineering/ASD-STE100.md` to technical documentation, procedures, API specifications, test evidence, pull requests, incidents, and operational instructions.

Preserve the authoritative assessment, VALU scoring, PRIME, identity, capability, eligibility, and marketplace contracts. Do not simplify documentation or code in a way that changes these rules.

For all changes:
- Inspect the current implementation and data contracts before modifying them.
- Treat server-side authorization and validation as authoritative.
- Do not use user-editable metadata as an authorization source.
- Do not expose Supabase service-role credentials to browser code.
- Preserve assessment continuity and prevent loss of submitted answers.
- Record migrations, data impact, recovery steps, and test evidence.
- Test security-sensitive paths and failure states.
- Verify deployed behavior before declaring a change complete.

The ASD-STE100 policy is STE-aligned guidance. It is not a claim of formal compliance with the complete official standard.
