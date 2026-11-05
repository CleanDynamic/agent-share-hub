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

REVOKE ALL ON FUNCTION public.still_open_topic_count(public.builds) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_open_ask(public.builds) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.still_open_topic_count(public.builds) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_open_ask(public.builds) TO anon, authenticated, service_role;