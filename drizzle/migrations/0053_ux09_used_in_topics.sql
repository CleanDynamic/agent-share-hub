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