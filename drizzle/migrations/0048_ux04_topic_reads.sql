-- UX-04: when a reader last opened a topic.
--
-- Correct whether or not any of it already exists.

CREATE TABLE IF NOT EXISTS public.topic_reads (
  user_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  root_id uuid        NOT NULL REFERENCES public.openbuild_posts(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, root_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_reads_root ON public.topic_reads (root_id);

REVOKE ALL ON public.topic_reads FROM anon, authenticated, service_role;
GRANT SELECT ON public.topic_reads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.topic_reads TO authenticated;
GRANT ALL ON public.topic_reads TO service_role;

ALTER TABLE public.topic_reads ENABLE ROW LEVEL SECURITY;

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