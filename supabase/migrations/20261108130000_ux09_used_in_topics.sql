-- UX-09 P4: Library's Used in counts the topics that attach a saved step.
--
-- saved_items_used_in() (SV-17, 20261029120000) gains a third column, topics: for each of the caller's saved steps, how many
-- topics (a topic, or a reply in it) attach that step (post_attachments kind 'step', node_id = the saved step's ref). The builds
-- column is unchanged. Still one request, still SECURITY INVOKER, so a topic the caller can't read isn't counted and a hidden one
-- (hidden_by set) isn't either.
--
-- A function's result columns can't be changed by CREATE OR REPLACE, so it is dropped and made again, with its grants. The app reads
-- topics as 0 while it is missing, so the app works before and after this file is applied.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied (paste the plan back):
--   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.saved_items_used_in();   -- as a reader with saved steps
--   SHOULD SHOW: for the new arm, an Index Scan or Bitmap Index Scan on idx_post_attachments_node and an Index Scan on
--   openbuild_posts_pkey; no Seq Scan on post_attachments. The two existing arms keep their plans (idx_build_nodes_source_node,
--   idx_build_nodes_source_import_session).

DROP FUNCTION IF EXISTS public.saved_items_used_in();

CREATE FUNCTION public.saved_items_used_in()
RETURNS TABLE (saved_item_id uuid, builds integer, topics integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT s.id, count(DISTINCT n.build_id)::integer, 0
    FROM public.saved_items s
    JOIN public.build_nodes n
      ON n.source_ref ->> 'node_id' = s.ref
     AND s.kind IN ('part','step')
   WHERE s.user_id = (select auth.uid())
     AND n.build_id IS DISTINCT FROM s.build_id
   GROUP BY s.id
  UNION ALL
  SELECT s.id, count(DISTINCT n.build_id)::integer, 0
    FROM public.saved_items s
    JOIN public.build_nodes n
      ON n.source_ref ->> 'import_session_id' = s.ref
     AND s.kind = 'session'
   WHERE s.user_id = (select auth.uid())
     AND n.build_id IS DISTINCT FROM s.build_id
   GROUP BY s.id
  UNION ALL
  -- A step's ref is its node's id. Only a ref shaped as a uuid is compared, so a malformed one can't fail the cast.
  SELECT s.id, 0, count(DISTINCT p.root_id)::integer
    FROM public.saved_items s
    JOIN public.post_attachments a
      ON a.kind = 'step'
     AND a.node_id = (CASE WHEN s.ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN s.ref::uuid END)
    JOIN public.openbuild_posts p
      ON p.id = a.post_id
     AND p.hidden_by IS NULL
   WHERE s.user_id = (select auth.uid())
     AND s.kind = 'step'
   GROUP BY s.id
  LIMIT 1000
$$;

REVOKE EXECUTE ON FUNCTION public.saved_items_used_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saved_items_used_in() TO authenticated;

COMMENT ON FUNCTION public.saved_items_used_in() IS
  'SV-17, UX-09 P4. For the caller''s saved parts, steps and sessions: the other builds with a tile from each (builds), and for steps the topics that attach it, a topic or a reply in it (topics). One row per item and arm; the app adds them up.';
