-- UX-04: when a reader last opened a topic.
--
-- topic_reads (user_id, root_id, seen_at). "New replies" on a topic are the replies under that root created after seen_at and not
-- written by the reader. With no row, nothing is marked new. The app writes the row when someone opens a topic, at most once a minute
-- per topic (src/lib/openbuilds, markTopicSeen).
--
-- PRIVATE, like saves (SV-17): only the owner reads and writes their rows, and nothing here lets anyone see who has read what. There is
-- no DELETE grant: a row is replaced, and goes with the reader or the topic. anon has SELECT and no policy: a signed-out reader reads
-- no row. The grant is there because get_build_feed (security invoker) names this table and Postgres checks a table's privilege before it
-- knows the branch that reads it will not run, so without it the Everyone feed would fail for a signed-out reader.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. A reader's marks for the topics on a page:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT root_id, seen_at FROM public.topic_reads
--       WHERE user_id = '<a reader>' AND root_id = ANY (ARRAY['<id>','<id>']::uuid[]) LIMIT 50;
--      SHOULD SHOW: an Index Scan on topic_reads_pkey, no Seq Scan.
--   2. The cascade from a topic: DELETE FROM public.openbuild_posts WHERE id = '<a topic>' (inside BEGIN; ... ROLLBACK;)
--      SHOULD SHOW: an Index Scan on idx_topic_reads_root for the cascade.

CREATE TABLE IF NOT EXISTS public.topic_reads (
  user_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  root_id uuid        NOT NULL REFERENCES public.openbuild_posts(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, root_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_reads_root ON public.topic_reads (root_id);

ALTER TABLE public.topic_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.topic_reads FROM anon, authenticated, service_role;
GRANT SELECT ON public.topic_reads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.topic_reads TO authenticated;
GRANT ALL ON public.topic_reads TO service_role;

DROP POLICY IF EXISTS "Readers read their own marks" ON public.topic_reads;
CREATE POLICY "Readers read their own marks"
  ON public.topic_reads FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers add their own marks" ON public.topic_reads;
CREATE POLICY "Readers add their own marks"
  ON public.topic_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers change their own marks" ON public.topic_reads;
CREATE POLICY "Readers change their own marks"
  ON public.topic_reads FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

COMMENT ON TABLE public.topic_reads IS
  'UX-04. When a reader last opened a topic. Private to the reader. New replies are those created after seen_at and not written by the reader.';
