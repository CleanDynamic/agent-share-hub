-- =============================================================================
-- buildgallery — durable import ceilings (EX-P13, migration 1 of 2)
-- =============================================================================
-- Two ceilings per creator, enforced where they can actually be enforced:
--
--   MAX_IMPORTS_PER_DAY  20   imports opened today, UTC
--   MAX_OPEN_IMPORTS      5   imports still in 'open' or 'assembling'
--
-- WHY THE DATABASE AND NOT THE EDGE FUNCTION. The contract says these two are
-- "enforced in the database ... because an edge function cannot be trusted to
-- count across concurrent requests". An edge function that reads a count and
-- then inserts has a window between the two in which another invocation — a
-- different isolate, possibly a different region — does the same. Both read 19
-- and both insert. Moving the count inside the inserting transaction closes
-- most of that window; the advisory lock below closes the rest.
--
-- NO QUOTA TABLE. A counter row per creator per day would need its own
-- lifecycle, its own RLS, its own reset and its own backfill, and it would be a
-- second copy of a fact import_sessions already holds. The rows ARE the count.
--
-- WHAT THIS MIGRATION DOES NOT DO. It adds no index — the count is served by
-- idx_import_sessions_user_status_created from EX-P05. It adds no column, no
-- policy and no grant. It does not touch expiry: that is migration 2,
-- 20260921120100_import_expiry_cron.sql, and this one must be applied first
-- because that one asserts against the table this one has already triggered.
-- =============================================================================


-- =============================================================================
-- 1. The ceiling function
-- =============================================================================
-- SECURITY INVOKER, deliberately and not by omission. The function runs as
-- whoever is inserting, so the count it takes is subject to the same RLS the
-- inserting caller is subject to — an owner-only SELECT policy on this table,
-- from EX-P05. A SECURITY DEFINER function here would bypass that policy to
-- read rows it has no business reading, to compute a number the caller's own
-- visibility already produces correctly. The explicit user_id predicate below
-- means the count does not DEPEND on RLS for correctness; RLS is simply not
-- fought with.
--
-- SET search_path = '' so no object resolves through a caller-controlled path.
-- public.import_sessions is therefore written out in full. Catalogue functions
-- (count, now, date_trunc, hashtext, pg_advisory_xact_lock) are NOT qualified
-- and do not need to be: pg_catalog is searched implicitly ahead of the
-- search_path and cannot be displaced by emptying it.
--
-- THE TWO COUNTS ARE ONE SCAN. Both are aggregates over the same row set — the
-- inserting user's rows — so they are taken as two FILTER clauses over a single
-- index scan rather than as two statements. The leading column of
-- idx_import_sessions_user_status_created is user_id, which is the whole WHERE
-- clause, so this is an index scan with no sort and no heap access for the
-- status filter.
--
--   Measured on the local replay, 5,000 rows across 40 users, EXPLAIN ANALYZE:
--     Aggregate (actual time=0.161..0.161 rows=1)
--       -> Bitmap Heap Scan on import_sessions (rows=125)
--            Recheck Cond: (user_id = $1)
--            -> Bitmap Index Scan on idx_import_sessions_user_status_created
--                 Index Cond: (user_id = $1)   Buffers: shared hit=2
--     Execution Time: 0.183 ms
--
--   A bitmap scan rather than an index-only scan: all three columns are in the
--   index, but the seeded rows had never been vacuumed, so the visibility map
--   was unset and the heap had to be visited. On a live table with routine
--   autovacuum this can plan as index-only. Either way the index is used and
--   its leading column is the whole predicate, which is the claim being made.
--
-- The daily half reads every row this user has ever opened, because created_at
-- is the index's THIRD column and there is no equality on the second. At 20 a
-- day that is a few thousand index entries a year — cheap, and cheaper than the
-- (user_id, created_at) index that would bound it, which EX-P05 considered and
-- deliberately did not add. If a creator's history ever makes this bite, that
-- index is the fix, not a quota table.
CREATE OR REPLACE FUNCTION public.enforce_import_ceilings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  -- Named here rather than read from anywhere: SQL cannot import
  -- supabase/functions/mcp/constants.ts, which is the contract's one home for
  -- both numbers. That makes these a SECOND copy, and a number typed twice is
  -- the bug the contract's one-home rule exists to prevent. The guard is a test
  -- rather than a comment: "the migration's ceilings are the constants file's
  -- ceilings" in supabase/functions/mcp/index.test.ts reads this file and
  -- constants.ts and fails if they ever disagree. Change one, change both, or
  -- the Deno suite goes red.
  _max_per_day  CONSTANT INTEGER := 20;  -- MAX_IMPORTS_PER_DAY
  _max_open     CONSTANT INTEGER := 5;   -- MAX_OPEN_IMPORTS
  _ttl_days     CONSTANT INTEGER := 7;   -- IMPORT_TTL_DAYS, for the wording only

  _day_start    TIMESTAMPTZ;
  _today        INTEGER;
  _open         INTEGER;
BEGIN
  -- Serialise this creator's concurrent opens against each other, and nothing
  -- else. Without it the count below is still a read followed by an insert,
  -- just a narrower one: under READ COMMITTED two transactions can each count
  -- 19 uncommitted-by-the-other rows and each insert a 20th. The lock is
  -- transaction-scoped, so it is released at COMMIT or ROLLBACK with no
  -- unlock to forget.
  --
  -- Two keys, not one. The first namespaces the lock to this feature, so a
  -- lock taken elsewhere on a bare hash of a uuid cannot collide with it; the
  -- second is the creator. One lock, always acquired in the same order, so
  -- there is no second lock to deadlock against.
  --
  -- It serialises ONE CREATOR'S opens only. Two different creators opening at
  -- the same instant hash to different keys and never wait on each other.
  PERFORM pg_advisory_xact_lock(
    hashtext('public.import_sessions:ceiling'),
    hashtext(NEW.user_id::text)
  );

  -- Midnight UTC, which is what the error table promises the reset is. Written
  -- as a UTC-anchored round trip rather than date_trunc('day', now()), which
  -- would truncate in the server's TimeZone setting and reset at local midnight
  -- on any deployment where that is not UTC.
  _day_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  -- The explicit user_id predicate is what makes this correct, not RLS. Under
  -- the authenticated role RLS would narrow the scan to this user's rows
  -- anyway; under the table owner — a migration, a job, a psql session — it
  -- would not, and an owner-side insert would otherwise be counted against
  -- every row in the table.
  SELECT
    count(*) FILTER (WHERE created_at >= _day_start),
    count(*) FILTER (WHERE status IN ('open', 'assembling'))
  INTO _today, _open
  FROM public.import_sessions
  WHERE user_id = NEW.user_id;

  -- BEFORE INSERT, so NEW is not in the count yet: _today = 20 means this
  -- statement is opening the 21st, and _open = 5 means it is opening the 6th.
  -- Hence >=, not >.
  --
  -- The wording is the contract's error table, word for word, with the counts
  -- interpolated. It is raised from here rather than composed in TypeScript so
  -- there is one copy of it: begin_import returns this message unchanged.
  --
  -- ERRCODE BGCAP is this feature's own SQLSTATE. A bare RAISE EXCEPTION gives
  -- P0001, which every other user-defined exception in every other function
  -- also gives, so catching P0001 would mean catching anything. A dedicated
  -- code lets begin_import recognise a ceiling WITHOUT matching on the message
  -- text — which matters, because the message is the thing it must pass through
  -- untouched.
  IF _today >= _max_per_day THEN
    RAISE EXCEPTION
      'You have opened % imports today, which is the limit. It resets at midnight UTC. Existing waiting imports are unaffected.',
      _today
      USING ERRCODE = 'BGCAP';
  END IF;

  IF _open >= _max_open THEN
    RAISE EXCEPTION
      'You have % imports still open. Finish or abandon one before starting another; open imports expire after % days.',
      _open, _ttl_days
      USING ERRCODE = 'BGCAP';
  END IF;

  RETURN NEW;
END
$$;

COMMENT ON FUNCTION public.enforce_import_ceilings() IS
  'BEFORE INSERT guard on public.import_sessions: refuses a creator''s 21st import of the UTC day and their 6th simultaneously-open import, with the connector''s own error wording under SQLSTATE BGCAP. SECURITY INVOKER; counts only the inserting user''s rows.';


-- =============================================================================
-- 2. The trigger
-- =============================================================================
-- BEFORE INSERT FOR EACH ROW. Before, because the point is to refuse the write
-- rather than to undo it, and because a BEFORE trigger that raises leaves
-- nothing to roll back at the row level at all.
--
-- No WHEN clause: every insert is counted, including one made by the table
-- owner. A migration or a job that inserts on a creator's behalf is subject to
-- the same ceiling, which is the honest reading of "per creator".
--
-- DROP first so this migration is replayable. CREATE OR REPLACE TRIGGER exists
-- from PostgreSQL 14 and this database is 16, but the drop-and-create pair is
-- what every other trigger in this repository uses and a migration is not the
-- place to be novel.
DROP TRIGGER IF EXISTS enforce_import_ceilings ON public.import_sessions;

CREATE TRIGGER enforce_import_ceilings
  BEFORE INSERT ON public.import_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_import_ceilings();


-- =============================================================================
-- 3. Execute privileges
-- =============================================================================
-- Postgres grants EXECUTE on a new function to PUBLIC by default, and public is
-- an exposed schema, so this function would otherwise be callable as a PostgREST
-- RPC by anon and authenticated alike. It returns a trigger type and would fail
-- if called directly, so this is tidiness rather than a hole — but "it fails if
-- you call it" is a weaker sentence than "you cannot call it", and only the
-- second survives someone changing the return type later.
--
-- The trigger still fires: a trigger function is invoked by the executor, which
-- does not consult EXECUTE privileges on it.
REVOKE ALL ON FUNCTION public.enforce_import_ceilings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_import_ceilings() FROM anon, authenticated;
