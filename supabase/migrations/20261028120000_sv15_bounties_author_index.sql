-- SV-15: the index listActivityFor's "requests the reader opened" read relies on.
--
-- listActivityFor reads `bounties where author_id = <reader>` to find the requests whose answers it reports. No index
-- on bounties leads with author_id (idx_bounties_status_closes, idx_bounties_build and the unique indexes do not), so
-- that read would scan the table. This adds one, only where no index on the table already leads with author_id, since
-- the live database has drifted from these files before.
--
-- Every other read in listActivityFor already has its index: builds by creator (idx_builds_creator_status_updated),
-- build_saves by user (idx_build_saves_user_created), build_reproductions by build (idx_build_reproductions_build_confirmed),
-- builds by parent (idx_builds_parent_build), solutions by bounty (idx_solutions_bounty_slot_status).
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT id, build_id FROM public.bounties WHERE author_id = '<a user id with requests>' LIMIT 200;
-- SHOULD SHOW: an Index Scan (or Bitmap Index Scan) on idx_bounties_author_created, no Seq Scan on bounties.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
    WHERE n.nspname = 'public' AND c.relname = 'bounties' AND a.attname = 'author_id'
  ) THEN
    CREATE INDEX idx_bounties_author_created ON public.bounties (author_id, created_at DESC);
  END IF;
END
$$;
