# Security notes

Sensitive assessment and profile APIs must authenticate the caller before using the service-role key.

`identity_hash` is an identifier, not an authorization credential. Never use it alone to authorize access to an assessment or professional profile.
