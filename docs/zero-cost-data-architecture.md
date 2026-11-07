# Valoria zero-cost data architecture

## Decision

Valoria uses the existing Supabase PostgreSQL project and Cloudflare platform as its foundation. Do not add separately billed database products unless measured workload and an approved budget justify them.

## Mapping of database models to existing infrastructure

| Database model | Valoria implementation | Decision |
| --- | --- | --- |
| Relational | Supabase PostgreSQL tables, constraints and foreign keys | System of record for accounts, assessments, profiles, capabilities, certifications, employers, opportunities and applications. |
| Key-value | Existing PostgreSQL JSONB fields and purpose-built rate-limit/session tables; Cloudflare KV only where an existing free allowance is verified | Do not duplicate data in a new Redis service. |
| Object storage | Existing Supabase Storage buckets: avatars, cvs and career-applications | Store files in buckets; store ownership, verification and storage paths in relational metadata. |
| Vector | pgvector in the existing Supabase database | Private profile-search embedding index. The staging migration creates the storage foundation; embedding generation and search API remain disabled until model, consent and compute costs are verified. |
| Graph | Existing relational foreign keys and join tables across professionals, capabilities, certificates, employers, opportunities and applications | Use recursive CTEs or explicit joins for relationship traversal. No separate graph database at current scale. |
| Wide-column | Existing append-oriented journey and audit event tables | Retain PostgreSQL. Consider partitioning or a dedicated wide-column store only after measured event volume requires it. |

## Semantic-search safety

- Embeddings are restricted to approved, public-eligible professional profile fields.
- Never embed VALU answers, private assessment reports, CV contents, private messages, contact details or confidential employer data by default.
- Embeddings do not determine VALU Index points, merit tiers, assessment outcomes or certification eligibility.
- Matching is advisory. Existing eligibility, consent, listing and revocation checks remain authoritative.
- The staging migration uses a 384-dimensional gte-small-compatible vector column. No model inference, external API, scheduled job or paid service is enabled by this migration.
- Do not expose the private embedding table through the Supabase Data API.

## Cost and release controls

- No new Supabase project, paid database, Redis, Neo4j, Cassandra, hosted vector service or paid AI API.
- Reuse existing Supabase Storage buckets and Cloudflare Workers.
- Confirm account free-tier limits before enabling additional storage, KV, Worker AI or inference workloads.
- Apply this migration to the isolated valoria-staging project only. Production requires a separate review and explicit approval.
