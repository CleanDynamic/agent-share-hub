-- UX-04 Part 5: notifications about posts, written by the database.
--
-- Clients never write a row that notifies someone else. Every row here comes from a trigger, through public.rc_notify (20261001200000):
-- the one writer, which writes nothing when the recipient is missing or is the actor and skips an identical row under ten minutes
-- old. Nobody is told of their own act. The message is fixed text with no em dashes; nothing a reader wrote is copied into it. The
-- page names the actor and the post live, as it does for builds.
--
--   kind          to                                          message
--   post_reply    the parent's author                         replied to your post / replied to your reply
--   post_thread   the root's author, when not the parent's    replied in your thread
--   post_mention  the person mentioned                        mentioned you in a post
--   post_like     the post's author                           liked your post
--   post_started  the maker of the work a root post attaches  started a post from your build (or part, session, step)
--   post_pinned   the pinned post's author                    pinned your reply / pinned your post
--
-- A person is told once per post: a mention of someone who already heard of the reply (the parent's author, the root's author) is
-- not told again. A LIKE BEHAVES AS A BUILD LIKE DOES: one rc_notify to the author. There is no batching in a build like beyond
-- rc_notify's ten-minute look-back (a like, an unlike and a like again is one notification), and this copies exactly that.
--
-- Every row targets the post (target_type 'post', target_id the post's id; for a reply the reply). The work's build goes in
-- notifications.build_id for post_started, so the page can name it.
--
-- notifications.target_type allows 'post'. Found in the catalogue and kept, as Part 4 does for saved_items.
--
-- The trigger functions are SECURITY DEFINER (a trigger runs as the person who caused it, who may not call rc_notify), set
-- search_path, and are executable by nobody: a trigger fires without EXECUTE.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS): no new index and no scan; every read is by primary key.

-- 1. A notification can point at a post -----------------------------------------------------------------------------------------

DO $$
DECLARE
  _attnum  smallint;
  _conname text;
  _def     text;
  _types   text[];
  _refused text;
BEGIN
  SELECT a.attnum INTO _attnum
    FROM pg_attribute a
   WHERE a.attrelid = 'public.notifications'::regclass AND a.attname = 'target_type' AND NOT a.attisdropped;

  IF _attnum IS NULL THEN
    RAISE EXCEPTION 'UX-04: notifications has no target_type column; nothing was changed';
  END IF;

  SELECT c.conname, pg_get_constraintdef(c.oid) INTO _conname, _def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.notifications'::regclass AND c.contype = 'c' AND c.conkey = ARRAY[_attnum]
   LIMIT 1;

  IF _conname IS NULL THEN
    RAISE EXCEPTION 'UX-04: notifications has no check on target_type; nothing was changed';
  END IF;

  SELECT array_agg(DISTINCT m[1]) INTO _types FROM regexp_matches(_def, '''([a-z_]+)''', 'g') AS m;
  IF _types IS NULL THEN
    RAISE EXCEPTION 'UX-04: could not read the target types notifications allows from %; nothing was changed', _def;
  END IF;
  _types := array_append(array_remove(_types, 'post'), 'post');

  SELECT string_agg(DISTINCT n.target_type, ', ' ORDER BY n.target_type) INTO _refused
    FROM public.notifications n WHERE n.target_type IS NOT NULL AND NOT (n.target_type = ANY (_types));
  IF _refused IS NOT NULL THEN
    RAISE EXCEPTION 'UX-04: notifications holds target types the new check would refuse: %; nothing was changed', _refused;
  END IF;

  EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', _conname);
  EXECUTE format('ALTER TABLE public.notifications ADD CONSTRAINT notifications_target_type_check CHECK (target_type IS NULL OR target_type IN (%s))',
                 (SELECT string_agg(quote_literal(t), ', ' ORDER BY t) FROM unnest(_types) t));
END;
$$;

-- 2. A reply -----------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rc_notify_post_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent_author uuid;
  _root_author   uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.author_id INTO _parent_author FROM public.openbuild_posts p WHERE p.id = NEW.parent_id;
  SELECT p.author_id INTO _root_author FROM public.openbuild_posts p WHERE p.id = NEW.root_id;

  PERFORM public.rc_notify(
    _parent_author, NEW.author_id, 'post_reply', NULL, 'post', NEW.id,
    CASE WHEN NEW.parent_id = NEW.root_id THEN 'replied to your topic' ELSE 'replied to your reply' END
  );

  -- Once, and only if the root's author is someone the line above did not already tell.
  IF _root_author IS DISTINCT FROM _parent_author THEN
    PERFORM public.rc_notify(_root_author, NEW.author_id, 'post_thread', NULL, 'post', NEW.id, 'replied in your topic');
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_post_reply ON public.openbuild_posts;
CREATE TRIGGER trg_rc_notify_post_reply
AFTER INSERT ON public.openbuild_posts
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_post_reply();

-- 3. A mention ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rc_notify_post_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
  _parent uuid;
  _parent_author uuid;
  _root_author   uuid;
BEGIN
  SELECT p.author_id, p.parent_id INTO _author, _parent FROM public.openbuild_posts p WHERE p.id = NEW.post_id;

  -- A reply already told its parent's author and its root's author; they are not told a second time.
  IF _parent IS NOT NULL THEN
    SELECT p.author_id INTO _parent_author FROM public.openbuild_posts p WHERE p.id = _parent;
    SELECT p.author_id INTO _root_author FROM public.openbuild_posts p WHERE p.id = (SELECT q.root_id FROM public.openbuild_posts q WHERE q.id = NEW.post_id);
    IF NEW.user_id IN (_parent_author, _root_author) THEN
      RETURN NULL;
    END IF;
  END IF;

  PERFORM public.rc_notify(NEW.user_id, _author, 'post_mention', NULL, 'post', NEW.post_id, 'mentioned you');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_post_mention ON public.post_mentions;
CREATE TRIGGER trg_rc_notify_post_mention
AFTER INSERT ON public.post_mentions
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_post_mention();

-- 4. A like ------------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rc_notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
BEGIN
  SELECT p.author_id INTO _author FROM public.openbuild_posts p WHERE p.id = NEW.post_id;
  PERFORM public.rc_notify(_author, NEW.user_id, 'post_like', NULL, 'post', NEW.post_id, CASE WHEN (SELECT q.parent_id FROM public.openbuild_posts q WHERE q.id = NEW.post_id) IS NULL THEN 'liked your topic' ELSE 'liked your reply' END);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_post_like ON public.post_likes;
CREATE TRIGGER trg_rc_notify_post_like
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_post_like();

-- 5. A root post started from someone's work ------------------------------------------------------------------------------------
-- The authorship trigger (20261107140000) has already refused anything but published work from another maker, so what reaches here
-- is work its maker allowed. A reply attaches only the replier's own work and tells nobody.

CREATE OR REPLACE FUNCTION public.rc_notify_post_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
  _parent uuid;
  _owner  uuid;
BEGIN
  IF NEW.kind = 'media' THEN
    RETURN NULL;
  END IF;

  SELECT p.author_id, p.parent_id INTO _author, _parent FROM public.openbuild_posts p WHERE p.id = NEW.post_id;
  IF _parent IS NOT NULL THEN
    RETURN NULL;
  END IF;

  _owner := public.post_attachment_owner(NEW.kind, NEW.build_id, NEW.node_id, NEW.session_key);
  PERFORM public.rc_notify(_owner, _author, 'post_started', NEW.build_id, 'post', NEW.post_id, 'started a topic from your ' || NEW.kind);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_post_started ON public.post_attachments;
CREATE TRIGGER trg_rc_notify_post_started
AFTER INSERT ON public.post_attachments
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_post_started();

-- 6. A pin -------------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rc_notify_post_pinned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pinned_by IS NOT NULL AND OLD.pinned_by IS DISTINCT FROM NEW.pinned_by THEN
    PERFORM public.rc_notify(
      NEW.author_id, NEW.pinned_by, 'post_pinned', NULL, 'post', NEW.id,
      CASE WHEN NEW.parent_id IS NULL THEN 'pinned your topic' ELSE 'pinned your reply' END
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_post_pinned ON public.openbuild_posts;
CREATE TRIGGER trg_rc_notify_post_pinned
AFTER UPDATE OF pinned_by ON public.openbuild_posts
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_post_pinned();

-- 7. Nobody calls them -----------------------------------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.rc_notify_post_reply()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_post_mention() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_post_like()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_post_started() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_post_pinned()  FROM PUBLIC, anon, authenticated;
