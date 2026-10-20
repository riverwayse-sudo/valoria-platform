-- Prevent future public tables created by the migration role from inheriting
-- these non-RLS-protected privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

-- Least-privilege hardening: client roles must not be able to TRUNCATE tables,
-- create foreign-key references, or create triggers. RLS does not protect
-- TRUNCATE, so row policies alone are not sufficient for these privileges.
-- Keep ordinary SELECT/INSERT/UPDATE/DELETE grants unchanged; RLS continues
-- to enforce row-level access for those operations.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %I.%I FROM anon, authenticated',
      r.schema_name, r.table_name
    );
  END LOOP;
END $$;
