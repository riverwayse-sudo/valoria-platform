# Valoria lead pipeline

Meta Lead Ads -> Supabase meta_lead_events -> process-meta-leads -> lead_captures -> sync-leads-to-brevo -> Brevo.

Website waitlist and event registration writes are mirrored into lead_captures by database triggers. pg_cron runs both workers every minute.

lead_captures is the canonical lead record. Source/external IDs are idempotent and Brevo delivery state is persisted for retry.

Required server-side credentials:
- BREVO_API_KEY
- META_VERIFY_TOKEN
- META_APP_SECRET
- META_PAGE_ACCESS_TOKEN
- Optional META_GRAPH_API_VERSION

Brevo contact writes use updateEnabled=true; a lead is not discarded because Brevo is temporarily unavailable.

Brevo currently rejects Supabase egress with HTTP 401 due to IP authorisation on the Brevo credential. The queue keeps retrying with backoff until the Brevo security setting is corrected.
