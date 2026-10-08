# Valoria Security Standard

## Baseline

Valoria follows OWASP ASVS/WSTG principles and Supabase-specific RLS guidance.

## Current controls

- RLS is enabled across exposed public tables.
- Assessment progress is intentionally server/internal-only; it is not a public client-write surface.
- Assessment and taster creation remain intentionally public only where required for anonymous entry, with constrained INSERT checks and no public SELECT policy.
- Marketplace roster is explicitly public; private assessment and profile data are not part of that public surface.
- Trigger-only SECURITY DEFINER functions are not callable by anon/authenticated API roles.
- Service-role credentials are never shipped to browser clients.
- CI performs secret scanning and environment-parity checks.

## Required controls

- Enable Supabase leaked-password protection in Auth settings.
- Maintain RLS policies using ownership predicates, not authentication alone.
- Keep privileged SECURITY DEFINER functions non-executable by API roles and use a fixed search_path.
- Review all public views for security-invoker behavior or remove public exposure.
- Apply rate limits to public assessment and lead endpoints.
- Maintain an auditable security review before production release.
- Rotate compromised credentials immediately and never commit secrets.

## Security verification queries

Run Supabase Security Advisors after schema/function changes. Any WARN or ERROR must be resolved or explicitly accepted by an owner before release.
