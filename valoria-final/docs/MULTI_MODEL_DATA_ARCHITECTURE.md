# Valoria multi-model data architecture

## Design decision

Valoria does not need six separately purchased database products. The staging platform uses the existing Supabase Postgres database and Supabase Storage. The different data models are implemented as capabilities inside that existing platform.

No additional database vendor, paid database, or external vector service is introduced by this foundation.

## Model mapping

| Data model | Existing or new implementation | Valoria use |
|---|---|---|
| Relational | Existing Postgres tables | Accounts, professional profiles, assessments, employers, jobs, applications, consent and audit records |
| Wide-column / document | Existing JSONB columns in Postgres | Flexible PRIME cluster scores, assessment answers, capability evidence, profile metadata and versioned payloads |
| Key-value | `private.platform_kv` | Namespaced non-secret feature flags, matching configuration and small operational state, with optional expiry |
| Object storage | Existing private Supabase Storage buckets | CVs and career-application documents; `professional_documents` stores searchable metadata and ownership |
| Vector | Existing `pgvector` extension and `private.professional_search_embeddings` table | Future semantic retrieval over professional capabilities, opportunities and programme content |
| Graph | `private.professional_relationships` plus `private.traverse_professional_network` | Mentorship, referrals, collaboration, programme and employer relationship traversal |

## Security boundaries

- The key-value and relationship tables live in the private schema, have RLS enabled, and are granted only to `service_role`.
- Key-value storage is for non-secret configuration only. Credentials and API keys remain in Cloudflare Worker secrets.
- Graph traversal returns profile IDs, depth and relationship paths, not public profile content.
- Any profile details resolved from graph results must still pass the existing public-profile consent and eligibility checks.
- Existing Storage buckets remain private; document access must continue to be checked against the owning participant or authorized workflow.
- JSONB does not bypass validation: API boundaries must validate payload shape and version before persistence.

## Vector-search rollout

The `vector` extension and embeddings table already exist in staging, but the table is currently empty. This change does not generate embeddings or call an embedding model.

Before generating embeddings, Valoria must approve:
1. the embedding model and dimensions;
2. the text fields eligible for embedding;
3. retention and refresh rules;
4. the compute/usage budget.

Until that approval, vector storage is available as a schema capability without incurring model-inference usage.

## Cost and operational scope

- No separate wide-column, key-value, graph or vector database is provisioned.
- No new paid integration is added.
- Postgres, pgvector and the existing Storage buckets consume the existing Supabase project's quotas; usage must remain within the current plan.
- The graph and key-value structures are foundations only. Product APIs and UI should be added only when a concrete matching, referral or administration workflow needs them.

## Initial verification

The staging database should report:
- `vector` installed;
- existing private embeddings table present;
- private key-value and relationship tables present;
- RLS enabled on both new tables;
- no SELECT/INSERT/UPDATE/DELETE grants for `anon` or `authenticated`;
- traversal function executable only by `service_role`;
- existing document buckets private.
