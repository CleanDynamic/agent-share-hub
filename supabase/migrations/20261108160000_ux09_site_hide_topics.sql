-- UX-09 Q5: the site's moderators (admins) hide a reported topic or reply, and can unhide it.
--
-- The Terms let site staff act on any report in any space, and the UK Online Safety Act expects it. Until now only a topic's author
-- or a moderator of its space could hide a topic (openbuild_posts.hidden_by, posts_guard_update), and resolve_report refused hiding a
-- topic in words (20261108140000). This file adds a second hide, the site's, kept apart from the space's:
--
--   openbuild_posts.site_hidden_by   the admin who hid it (null: not hidden by the site)
--   openbuild_posts.site_hidden_at   when
--
-- TWO HIDES, EACH UNDONE ONLY BY ITS OWN SIDE. hidden_by stays the space's: set and cleared by the topic's author or a moderator of
-- its space, never by an admin acting as an admin. site_hidden_by is the site's: set and cleared only by an admin
-- (is_admin((select auth.uid()))), never by a space's moderators or the topic's author. posts_guard_update holds both rules.
--
-- WHO READS A SITE-HIDDEN ENTRY. Admins only. It is gone from every feed, space, list and search for everyone else, its author
-- included, because every read of openbuild_posts (the feed function get_build_feed, saved_items_used_in, still_open_topic_count and
-- has_open_ask are SECURITY INVOKER; the app's lists are plain reads) goes through this read policy. Its replies, reactions,
-- attachments and mentions follow their post as they already do. Space moderators lose sight of it too: they cannot undo it.
-- The author is told through site_hidden_posts_of(root) instead: their own entries in a topic that the site hid, with each one's
-- first line, so the topic page can say "Hidden by the site's moderators" on it.
--
-- reply_count counts a reply that neither side hid.
--
-- resolve_report: 'hide' on a topic or a reply (target_type 'openbuild_post') sets site_hidden_by and site_hidden_at as the admin,
-- and closes every open report on it as hidden, as it does for a build or a comment. Unhide is an admin's update of the two columns
-- back to null (the policy "Site staff hide and unhide"); the report stays resolved.
--
-- Every policy here calls (select auth.uid()), never a bare auth.uid(). Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. The admin's list of what the site hid (Admin > Reports > Hidden by the site):
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT id, root_id, parent_id, body, site_hidden_at FROM public.openbuild_posts
--       WHERE site_hidden_by IS NOT NULL ORDER BY site_hidden_at DESC LIMIT 50;
--      SHOULD SHOW: an Index Scan on idx_posts_site_hidden, no Seq Scan on openbuild_posts.
--   2. An author's notice on a topic page:
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT id FROM public.openbuild_posts WHERE root_id = '<a topic id>' AND author_id = '<the author>' AND site_hidden_by IS NOT NULL LIMIT 50;
--      SHOULD SHOW: an Index Scan on idx_posts_root_created (or idx_posts_site_hidden), no Seq Scan on openbuild_posts.

-- 1. The site's hide ------------------------------------------------------------------------------------------------------------

ALTER TABLE public.openbuild_posts
  ADD COLUMN IF NOT EXISTS site_hidden_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_hidden_at timestamptz NULL;

-- Almost nothing is hidden by the site: a partial index for the admin's list.
CREATE INDEX IF NOT EXISTS idx_posts_site_hidden
  ON public.openbuild_posts (site_hidden_at DESC)
  WHERE site_hidden_by IS NOT NULL;

COMMENT ON COLUMN public.openbuild_posts.site_hidden_by IS
  'UX-09. The admin who hid this topic or reply for the site (from a report). Only admins set or clear it; apart from hidden_by, which is the space''s.';
COMMENT ON COLUMN public.openbuild_posts.site_hidden_at IS
  'UX-09. When the site hid it; set by posts_guard_update with site_hidden_by.';

-- 2. Who reads -------------------------------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone reads posts that are not hidden" ON public.openbuild_posts;
CREATE POLICY "Anyone reads posts that are not hidden"
  ON public.openbuild_posts FOR SELECT
  TO anon, authenticated
  USING (
    (
      site_hidden_by IS NULL
      AND (
        hidden_by IS NULL
        OR author_id = (select auth.uid())
        OR public.viewer_owns_root(root_id)
        OR public.viewer_moderates_post(root_id)
      )
    )
    OR (select public.is_admin((select auth.uid())))
  );

-- Nobody writes a post already hidden by the site.
DROP POLICY IF EXISTS "Authors write their own posts" ON public.openbuild_posts;
CREATE POLICY "Authors write their own posts"
  ON public.openbuild_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())
    AND pinned_by IS NULL
    AND hidden_by IS NULL
    AND site_hidden_by IS NULL
    AND (parent_id IS NULL OR public.viewer_can_reply_in(root_id))
  );

-- Which rows an admin may update. Which columns is posts_guard_update's: for an admin, only the site's two.
DROP POLICY IF EXISTS "Site staff hide and unhide" ON public.openbuild_posts;
CREATE POLICY "Site staff hide and unhide"
  ON public.openbuild_posts FOR UPDATE
  TO authenticated
  USING ((select public.is_admin((select auth.uid()))))
  WITH CHECK ((select public.is_admin((select auth.uid()))));

-- 3. The guard: two hides, each its own side's ------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.posts_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := (select auth.uid());
BEGIN
  IF (NEW.author_id, NEW.parent_id, NEW.root_id, NEW.created_at) IS DISTINCT FROM (OLD.author_id, OLD.parent_id, OLD.root_id, OLD.created_at) THEN
    RAISE EXCEPTION 'The author and place of a topic or reply cannot change.';
  END IF;

  -- No signed-in user: the service role or an admin connection. Row level security does not apply to them either.
  IF _uid IS NULL THEN
    IF NEW.site_hidden_by IS NULL THEN
      NEW.site_hidden_at := NULL;
    ELSIF OLD.site_hidden_by IS NULL THEN
      NEW.site_hidden_at := coalesce(NEW.site_hidden_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.body, NEW.tags, NEW.about_build_id, NEW.about_node_id, NEW.reward_gbp, NEW.still_open, NEW.closes_at)
     IS DISTINCT FROM (OLD.body, OLD.tags, OLD.about_build_id, OLD.about_node_id, OLD.reward_gbp, OLD.still_open, OLD.closes_at) THEN
    IF _uid <> OLD.author_id THEN
      RAISE EXCEPTION 'Only the author can edit a topic or reply.';
    END IF;
    NEW.updated_at := clock_timestamp();
  END IF;

  -- The space's pin and hide: the topic's author or a moderator of its space, as themselves. An admin is no exception here.
  IF (NEW.pinned_by, NEW.hidden_by, NEW.hidden_reason) IS DISTINCT FROM (OLD.pinned_by, OLD.hidden_by, OLD.hidden_reason) THEN
    IF NOT (public.viewer_owns_root(OLD.root_id) OR public.viewer_moderates_post(OLD.root_id)) THEN
      RAISE EXCEPTION 'Only the topic''s author or a moderator can pin or hide it.';
    END IF;
    IF (NEW.pinned_by IS DISTINCT FROM OLD.pinned_by AND NEW.pinned_by IS NOT NULL AND NEW.pinned_by <> _uid)
       OR (NEW.hidden_by IS DISTINCT FROM OLD.hidden_by AND NEW.hidden_by IS NOT NULL AND NEW.hidden_by <> _uid) THEN
      RAISE EXCEPTION 'You can pin or hide only as yourself.';
    END IF;
    IF NEW.pinned_by IS DISTINCT FROM OLD.pinned_by THEN
      NEW.pinned_at := CASE WHEN NEW.pinned_by IS NULL THEN NULL ELSE now() END;
    END IF;
    IF NEW.hidden_by IS NULL THEN
      NEW.hidden_reason := NULL;
    END IF;
  END IF;

  -- The site's hide: an admin, as themselves. Nobody else, whatever their place in the space.
  IF (NEW.site_hidden_by, NEW.site_hidden_at) IS DISTINCT FROM (OLD.site_hidden_by, OLD.site_hidden_at) THEN
    IF NOT public.is_admin(_uid) THEN
      RAISE EXCEPTION 'Only the site''s moderators can hide or unhide this for the site.';
    END IF;
    IF NEW.site_hidden_by IS NOT NULL AND NEW.site_hidden_by IS DISTINCT FROM OLD.site_hidden_by AND NEW.site_hidden_by <> _uid THEN
      RAISE EXCEPTION 'You can hide only as yourself.';
    END IF;
    NEW.site_hidden_at := CASE
      WHEN NEW.site_hidden_by IS NULL THEN NULL
      WHEN OLD.site_hidden_by IS NULL THEN now()
      ELSE OLD.site_hidden_at
    END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.posts_guard_update() FROM PUBLIC, anon, authenticated;

-- 4. reply_count: a reply neither side hid ----------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_reply_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _was boolean;
  _now boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_id IS NOT NULL AND NEW.hidden_by IS NULL AND NEW.site_hidden_by IS NULL THEN
      UPDATE public.openbuild_posts SET reply_count = reply_count + 1 WHERE id = NEW.root_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_id IS NOT NULL AND OLD.hidden_by IS NULL AND OLD.site_hidden_by IS NULL THEN
      UPDATE public.openbuild_posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.root_id;
    END IF;
  ELSIF NEW.parent_id IS NOT NULL THEN
    _was := OLD.hidden_by IS NULL AND OLD.site_hidden_by IS NULL;
    _now := NEW.hidden_by IS NULL AND NEW.site_hidden_by IS NULL;
    IF _was AND NOT _now THEN
      UPDATE public.openbuild_posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = NEW.root_id;
    ELSIF _now AND NOT _was THEN
      UPDATE public.openbuild_posts SET reply_count = reply_count + 1 WHERE id = NEW.root_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_reply_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_reply_count ON public.openbuild_posts;
CREATE TRIGGER trg_sync_reply_count
AFTER INSERT OR DELETE OR UPDATE OF hidden_by, site_hidden_by ON public.openbuild_posts
FOR EACH ROW EXECUTE FUNCTION public.sync_reply_count();

-- 5. The author's notice --------------------------------------------------------------------------------------------------------
-- The caller's own entries in one topic that the site hid (the topic's page address may be the topic or one of its replies), with
-- each one's first line: only their own, only what the site hid, and nothing for anyone signed out. SECURITY DEFINER because the read policy no longer shows the author these rows.

CREATE OR REPLACE FUNCTION public.site_hidden_posts_of(_root uuid)
RETURNS TABLE (id uuid, parent_id uuid, heading text, hidden_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.parent_id, left(btrim(split_part(btrim(p.body), E'\n', 1)), 140), p.site_hidden_at
    FROM public.openbuild_posts p
   WHERE (p.root_id = _root OR p.id = _root)
     AND p.author_id = (select auth.uid())
     AND p.site_hidden_by IS NOT NULL
   ORDER BY p.created_at
   LIMIT 50;
$$;

COMMENT ON FUNCTION public.site_hidden_posts_of(uuid) IS
  'UX-09. The caller''s own topic or replies in this topic that the site''s moderators hid, with each one''s first line, so the topic page can tell its author. At most 50.';

REVOKE ALL ON FUNCTION public.site_hidden_posts_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_hidden_posts_of(uuid) TO authenticated;

-- 6. resolve_report hides a topic or a reply for the site ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_report(report uuid, action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin       uuid := (select auth.uid());
  _target_type text;
  _target_id   uuid;
BEGIN
  IF _admin IS NULL OR NOT public.is_admin(_admin) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF action IS NULL OR action NOT IN ('hide', 'dismiss') THEN
    RAISE EXCEPTION 'resolve_report: action must be hide or dismiss' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT r.target_type, r.target_id INTO _target_type, _target_id
    FROM public.content_reports r
   WHERE r.id = report
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resolve_report: no report %', report USING ERRCODE = 'no_data_found';
  END IF;

  IF action = 'hide' THEN
    IF _target_type = 'build' THEN
      UPDATE public.builds SET is_hidden = true WHERE id = _target_id;
    ELSIF _target_type = 'comment' THEN
      UPDATE public.build_comments SET is_hidden = true WHERE id = _target_id;
    ELSIF _target_type = 'openbuild_post' THEN
      -- The site's hide, as this admin; the guard stamps site_hidden_at. One already hidden by the site keeps its first stamp.
      UPDATE public.openbuild_posts SET site_hidden_by = _admin WHERE id = _target_id AND site_hidden_by IS NULL;
    ELSE
      RAISE EXCEPTION 'resolve_report: cannot hide a % here', _target_type USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Every open report on this target is answered by the same act.
    UPDATE public.content_reports
       SET status = 'hidden', resolved_at = now(), resolved_by = _admin
     WHERE target_type = _target_type
       AND target_id = _target_id
       AND (id = report OR status = 'open');
  ELSE
    UPDATE public.content_reports
       SET status = 'dismissed', resolved_at = now(), resolved_by = _admin
     WHERE id = report;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.resolve_report(uuid, text) IS
  'RC-P17b, UX-09. Admin only (raises "not allowed" otherwise). hide: hides the reported build or comment (is_hidden), or the topic or reply for the site (openbuild_posts.site_hidden_by, apart from its space''s hide), and closes every open report on it as hidden; dismiss: closes this report as dismissed. Both stamp resolved_at and resolved_by.';

REVOKE ALL ON FUNCTION public.resolve_report(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_report(uuid, text) TO authenticated;
