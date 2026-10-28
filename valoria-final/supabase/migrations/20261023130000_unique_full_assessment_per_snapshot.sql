-- Make a duplicate full-VALU assessment impossible at the database level.
--
-- WHY THIS EXISTS
-- api/submit-assessment.js protects against duplicates in application code: it
-- looks for an existing row by (taster_id, identity_hash) before inserting, and
-- recovers through a 409 branch. That is a read-then-write, so it cannot be
-- correct on its own. Two retries that both run the lookup before either insert
-- both see "no existing row" and both insert.
--
-- Nothing stopped them. The two unique indexes on this table cover
-- report_token and report_idempotency_key, and the submission path sets
-- neither: report_token is generated per attempt (so it is unique across
-- duplicates, not shared), and report_idempotency_key is only used by the
-- report state machine, never by submission. So two submissions for the same
-- (taster_id, identity_hash) both succeeded and the participant ended up with
-- two assessment rows — the exact outcome the retry requirement forbids.
--
-- Verified against a real PostgreSQL engine: with only the existing indexes,
-- the second insert is accepted and the row count becomes 2.
--
-- The constraint below makes the second writer fail with 23505, which PostgREST
-- reports as HTTP 409 — the branch the handler already handles by resolving to
-- the winner's record and returning it with alreadyCompleted. The application
-- fix and this constraint are complementary: the lookup keeps the common case
-- fast, and the constraint makes the race safe.
--
-- This mirrors the predicate the handler uses to detect an existing row
-- (taster_id + identity_hash), so the index and the lookup agree.

-- Existing rows may already contain duplicates, in which case the index cannot
-- be built. Report them instead of failing with an opaque "could not create
-- unique index", so the operator can decide how to reconcile them. This is a
-- read-only check and changes no data.
do $$
declare
  duplicate_groups integer;
  example text;
begin
  select count(*) into duplicate_groups from (
    select taster_id, identity_hash
    from public.valu_assessments
    where taster_id is not null and identity_hash is not null
    group by taster_id, identity_hash
    having count(*) > 1
  ) as d;

  if duplicate_groups > 0 then
    select format('taster_id=%s identity_hash=%s (%s rows)', taster_id, identity_hash, n)
      into example
    from (
      select taster_id, identity_hash, count(*) as n
      from public.valu_assessments
      where taster_id is not null and identity_hash is not null
      group by taster_id, identity_hash
      having count(*) > 1
      order by count(*) desc
      limit 1
    ) as e;

    raise exception
      'Cannot add the unique assessment constraint: % duplicate (taster_id, identity_hash) group(s) already exist, e.g. %. Reconcile these rows first — keep the earliest completed_at and remove the rest, verifying report_token and user_id ownership before deleting anything.',
      duplicate_groups, example
      using errcode = '23505';
  end if;
end
$$;

-- Partial: the index covers only the rows the application queries. A plain
-- index would also be correct for null keys — PostgreSQL treats NULLs as
-- distinct in a unique index by default, so null-keyed rows would not collide
-- either way — but scoping the constraint to (taster_id, identity_hash) pairs
-- that are both present keeps legacy/unlinked rows out of the constraint and
-- keeps the index small. The predicate matches the handler's lookup exactly.
create unique index if not exists valu_assessments_taster_identity_uidx
  on public.valu_assessments (taster_id, identity_hash)
  where taster_id is not null and identity_hash is not null;

comment on index public.valu_assessments_taster_identity_uidx is
  'One full VALU assessment per (snapshot, identity). Makes concurrent duplicate submissions impossible; the loser receives 23505, which api/submit-assessment.js recovers through its existing 409 path.';
