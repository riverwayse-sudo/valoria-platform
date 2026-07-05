-- supabase/rls-lockdown.sql
--
-- Run this in the Supabase SQL editor for the valoria-platform project
-- BEFORE relying on the new /api/submit-assessment.js and
-- /api/update-assessment.js endpoints. Without this, the anon key can still
-- write directly to valu_assessments and everything those two files do is
-- cosmetic — the old forgery path (POST straight to PostgREST with the anon
-- key) stays wide open.
--
-- Read this file, don't blind-run it: the SELECT policy at the bottom is a
-- template. Run the first query below to see what already exists, decide
-- what SELECT access the marketplace/profile pages actually need, then
-- adjust before applying.

-- 1) SEE WHAT'S THERE NOW — run this first and read the output.
select polname, polcmd, polroles, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy
where polrelid = 'public.valu_assessments'::regclass;

-- 2) Make sure RLS is actually on. If this table was ever queryable by the
--    anon key without a policy, RLS was probably off entirely, not just
--    misconfigured — worth confirming.
alter table public.valu_assessments enable row level security;

-- 3) Drop every existing INSERT/UPDATE policy for anon/authenticated.
--    The names below are guesses — replace with whatever query #1 returned.
--    Nothing except the service-role key (used only by the two /api routes)
--    should ever be able to write total_score, cluster_scores, skill_scores,
--    designation, email, user_id, or ai_report on this table again.
drop policy if exists "Enable insert for anon" on public.valu_assessments;
drop policy if exists "Enable insert for authenticated users only" on public.valu_assessments;
drop policy if exists "anon can insert" on public.valu_assessments;
drop policy if exists "anon can update" on public.valu_assessments;
drop policy if exists "Enable update for anon" on public.valu_assessments;
-- Add drop statements here for any other insert/update policy names query #1 revealed.

-- 4) Do NOT add a new INSERT or UPDATE policy for anon/authenticated.
--    service_role bypasses RLS entirely by default in Supabase, so the two
--    API endpoints will keep working with zero policy needed for them.

-- 5) SELECT policy — decide deliberately, don't leave this wide open.
--    A public marketplace realistically needs some read access (to show a
--    listed profile's VALU Index), but "anyone can select every column of
--    every row" is how you leaked identity_hash/email before. At minimum,
--    exclude email and any PII from what anon can read — do that via a view
--    rather than a table-level policy if you need column-level control:
--
--    create view public.valu_assessments_public as
--      select identity_hash, name, role, total_score, designation,
--             cluster_scores, skill_scores, completed_at
--      from public.valu_assessments
--      where <your "is this listed / not expired" condition>;
--
--    then point any client-side read at valu_assessments_public instead of
--    the base table, and lock the base table's SELECT down to service_role
--    (or to `auth.uid() = user_id` for a person reading their own row).

-- 6) Same treatment applies to `profiles` / `professional_profiles` /
--    `marketplace_profiles` / `messages` in valoria-site — run the
--    equivalent of query #1 against each of those before launch. The admin
--    panel's ADMIN_EMAILS check in src/app/admin/page.jsx is a UI convenience
--    only; it is not a security boundary. If RLS on `messages` or `profiles`
--    allows broad SELECT for anon/authenticated, any logged-in user can read
--    the same data the admin panel shows, admin check or not.
