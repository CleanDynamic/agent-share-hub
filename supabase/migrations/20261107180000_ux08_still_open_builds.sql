-- UX-08 P4: Builds counts still-open topics.
--
-- The Builds page's Still open lens and filter match a build that has an open request OR a still-open topic (a root post with
-- still_open true, not hidden) that attaches the build or is about it. Two computed columns of public.builds, which PostgREST reads
-- as columns, so the list stays ONE request and each lens count stays one request:
--
--   still_open_topic_count(builds)  integer  how many still-open topics attach this build or are about it (read with the row; the
--                                            Table's Open column adds it to the open requests the row already embeds)
--   has_open_ask(builds)            boolean  an open request exists OR a still-open topic exists (the filter and the lens count)
--
-- Both are STABLE, SECURITY INVOKER (the caller's row-level security applies: hidden topics stay hidden), and read only. The app
-- reads them with a fallback: until this file is applied the columns are missing, the read says so once and is made again as it
-- was (open requests alone).
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied (paste the plans back):
--   1. The lens count:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM public.builds b
--       WHERE b.status IN ('published', 'gallery') AND public.has_open_ask(b);
--      SHOULD SHOW: a Seq Scan on builds with the function as its filter (builds is a few thousand rows), and under the function's
--      subplans Index Scans on idx_posts_still_open_root (or idx_post_attachments_build and idx_posts_about_build). No Seq Scan on
--      openbuild_posts or post_attachments inside the loop.
--   2. One page of the Table with the filter on:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT b.id, public.still_open_topic_count(b) FROM public.builds b
--       WHERE b.status IN ('published', 'gallery') AND public.has_open_ask(b) ORDER BY b.reproduction_count DESC LIMIT 50;
--      SHOULD SHOW: the same index scans, once per build that reaches the function, and a total well under 100 ms.
--   3. The index itself:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.openbuild_posts WHERE still_open AND parent_id IS NULL AND hidden_by IS NULL;
--      SHOULD SHOW: an Index Scan or Index Only Scan on idx_posts_still_open_root.

-- Still-open root topics are few: a partial index keeps the check cheap however many replies and ordinary topics there are.
CREATE INDEX IF NOT EXISTS idx_posts_still_open_root ON public.openbuild_posts (id) WHERE still_open AND parent_id IS NULL AND hidden_by IS NULL;

CREATE OR REPLACE FUNCTION public.still_open_topic_count(b public.builds)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::integer
    FROM public.openbuild_posts p
   WHERE p.still_open
     AND p.parent_id IS NULL
     AND p.hidden_by IS NULL
     AND (
       p.about_build_id = b.id
       OR EXISTS (SELECT 1 FROM public.post_attachments a WHERE a.post_id = p.id AND a.build_id = b.id)
     );
$$;

CREATE OR REPLACE FUNCTION public.has_open_ask(b public.builds)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.bounties o WHERE o.build_id = b.id AND o.status = 'open')
      OR public.still_open_topic_count(b) > 0;
$$;

-- Read by the Builds page for any reader, signed in or not; nothing else calls them.
REVOKE ALL ON FUNCTION public.still_open_topic_count(public.builds) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_open_ask(public.builds) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.still_open_topic_count(public.builds) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_open_ask(public.builds) TO anon, authenticated, service_role;
