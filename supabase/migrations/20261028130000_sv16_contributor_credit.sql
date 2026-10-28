-- SV-16: who made each tile.
--
-- build_nodes.contributor_id names the person whose work a tile is, when that is not the build's maker. Null means the
-- build's maker. It is set by the maker's own writers (accepting a solution, inserting from Library) and copied as it is
-- when a build is forked, since credit is method and travels with it. Sessions record theirs in
-- builds.making.sessions_meta[key].contributor_id, which is json and needs no column.
--
-- The policies are unchanged: only the build's maker writes rows on their build, so nobody writes credit on someone
-- else's build. The column is nullable with no default, so existing rows and every existing writer are untouched.
-- ON DELETE SET NULL: if a contributor's account is deleted their tiles fall back to the maker rather than vanishing.
-- (SV-19 reports on what happens to saved copies; this does not decide it.)
--
-- Correct whether or not the column or index already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied (it backs "Builds contributed to" on OpenBuilds):
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT DISTINCT build_id FROM public.build_nodes WHERE contributor_id = '<a user id with contributed tiles>' LIMIT 200;
-- SHOULD SHOW: an Index Scan or Bitmap Index Scan on idx_build_nodes_contributor, no Seq Scan on build_nodes.

ALTER TABLE public.build_nodes
  ADD COLUMN IF NOT EXISTS contributor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
    WHERE n.nspname = 'public' AND c.relname = 'build_nodes' AND a.attname = 'contributor_id'
  ) THEN
    CREATE INDEX idx_build_nodes_contributor ON public.build_nodes (contributor_id) WHERE contributor_id IS NOT NULL;
  END IF;
END
$$;
