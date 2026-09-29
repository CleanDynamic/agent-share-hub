-- =============================================================================
-- RC-P19 — notifications about builds, written by the database
-- =============================================================================
-- WHAT IT ADDS. Notifications were inserted by the client, and nothing
-- targeted a build. A client cannot safely write a row for another reader, and
-- the events that matter happen in the database, so these are written by
-- triggers and by nothing else:
--
--   kind         to                         message (fixed; no reader's text)
--   rebuilt      the parent build's creator "rebuilt your build"
--   published    each follower of the maker "published a new build"
--   reproduced   the build's creator        "ran your build and it worked" /
--                                           "ran your build and it did not work"
--   comment      the build's creator        "commented on your build"
--   reply        the parent comment's author "replied to your comment"
--   like         the build's creator        "liked your build"
--   solution     the bounty's author        "posted a solution to your bounty"
--   solved       the solver                 "accepted your solution"
--   follow       the reader followed        "started following you"
--
-- ONE WRITER. Every trigger calls public.rc_notify, which writes one row
-- unless the recipient is missing or is the actor (nobody is told about their
-- own act), and skips a row identical in (recipient, actor, kind, target) to
-- one from the last ten minutes (a like, an unlike and a like again is one
-- notification). rc_notify is SECURITY DEFINER and executable by nobody but
-- its owner: not PUBLIC, not anon, not authenticated
-- ⟦supabase-postgres-best-practices › references/security-privileges.md⟧. The
-- trigger functions are SECURITY DEFINER for that reason — a trigger runs as
-- the reader who caused it, and that reader may not call rc_notify — and none
-- of them is executable by anyone either: a trigger fires without EXECUTE.
--
-- SMALL, SHORT WRITES ⟦references/lock-short-transactions.md⟧. Each trigger
-- reads one or two rows by primary key and inserts one notification, except
-- 'published', which inserts one per follower, capped at 500 (see d).
--
-- THE MESSAGE IS FIXED TEXT ⟦neoscale-error-monitoring › Privacy⟧: nothing a
-- reader wrote (a comment's body, a build's title, a name) is copied into a
-- notification. The page reads the actor and the build's title live.
--
-- THE BUILD, TWICE. notifications.build_id (new, foreign-keyed, cascading) is
-- the row's build; rc_notify also writes it into metadata.build_id, the one
-- place the client reads it from, so a client that asks for it before this
-- migration is applied asks for an existing column and gets nothing, rather
-- than asking for a missing one and getting an error for the whole page.
--
-- THE PROMPT'S (user_id, created_at DESC) is (recipient_id, created_at DESC):
-- the recipient column is recipient_id, and 20260501102008 already made that
-- index as idx_notifications_recipient_created, which b names again so a
-- second copy is never built.
--
-- NOTHING ELSE CHANGES: no policy on notifications is touched, and the
-- client's own inserts keep working under "Users can insert notifications as
-- themselves".
-- =============================================================================


-- =============================================================================
-- a. target_type: the old values, plus three for builds
-- =============================================================================
-- The check is found in the catalogue, not by name: every CHECK on
-- notifications whose only column is target_type ⟦references/
-- schema-constraints.md⟧. Before anything is dropped, the rows are read: if any
-- holds a target_type the new check would refuse, the block stops, names the
-- values, and nothing has changed — the live table allows something the
-- repository does not know about, and the list below must be regenerated.
DO $$
DECLARE
  _attnum  smallint;
  _conname text;
  _refused text;
BEGIN
  SELECT a.attnum INTO _attnum
    FROM pg_attribute a
   WHERE a.attrelid = 'public.notifications'::regclass
     AND a.attname = 'target_type'
     AND NOT a.attisdropped;

  IF _attnum IS NULL THEN
    RAISE EXCEPTION 'RC-P19: notifications has no target_type column; nothing was changed';
  END IF;

  SELECT string_agg(DISTINCT n.target_type, ', ' ORDER BY n.target_type) INTO _refused
    FROM public.notifications n
   WHERE n.target_type IS NOT NULL
     AND n.target_type NOT IN ('blueprint','blog','bounty','stage','block','comment','message','thread','profile',
                               'build','build_comment','bounty_build');

  IF _refused IS NOT NULL THEN
    RAISE EXCEPTION 'RC-P19: notifications holds target_type values the new check would refuse: %; nothing was changed', _refused;
  END IF;

  FOR _conname IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.notifications'::regclass
       AND c.contype = 'c'
       AND c.conkey = ARRAY[_attnum]
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', _conname);
  END LOOP;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_target_type_check
    CHECK (target_type IS NULL OR target_type IN
      ('blueprint','blog','bounty','stage','block','comment','message','thread','profile',
       'build','build_comment','bounty_build'));
END;
$$;


-- =============================================================================
-- b. The build a notification is about
-- =============================================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS build_id uuid NULL REFERENCES public.builds(id) ON DELETE CASCADE;

-- Every foreign-key column has its own index ⟦references/schema-foreign-key-indexes.md⟧;
-- most notifications have no build ⟦references/query-partial-indexes.md⟧.
CREATE INDEX IF NOT EXISTS idx_notifications_build
  ON public.notifications (build_id)
  WHERE build_id IS NOT NULL;

-- The page's read, and rc_notify's ten-minute look-back.
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications (recipient_id, created_at DESC);


-- =============================================================================
-- c. rc_notify: the one writer
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rc_notify(
  recipient   uuid,
  actor       uuid,
  kind        text,
  build       uuid,
  target_type text,
  target      uuid,
  message     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nobody, or the actor themselves: nothing to say.
  IF rc_notify.recipient IS NULL OR rc_notify.recipient = rc_notify.actor THEN
    RETURN;
  END IF;

  -- Said already, in the last ten minutes.
  IF EXISTS (
    SELECT 1
      FROM public.notifications n
     WHERE n.recipient_id = rc_notify.recipient
       AND n.actor_id IS NOT DISTINCT FROM rc_notify.actor
       AND n.notification_type = rc_notify.kind
       AND n.target_id IS NOT DISTINCT FROM rc_notify.target
       AND n.created_at > now() - interval '10 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, actor_id, notification_type, build_id, target_type, target_id, body, metadata)
  VALUES (
    rc_notify.recipient,
    rc_notify.actor,
    rc_notify.kind,
    rc_notify.build,
    rc_notify.target_type,
    rc_notify.target,
    rc_notify.message,
    CASE WHEN rc_notify.build IS NULL THEN NULL ELSE jsonb_build_object('build_id', rc_notify.build) END
  );
END;
$$;

COMMENT ON FUNCTION public.rc_notify(uuid, uuid, text, uuid, text, uuid, text) IS
  'RC-P19. The one writer of build notifications, called by triggers only. Writes nothing when the recipient is null or is the actor, or when an identical (recipient, actor, kind, target) row is under ten minutes old. message is fixed text, never a reader''s.';

REVOKE ALL ON FUNCTION public.rc_notify(uuid, uuid, text, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- d. builds: rebuilt, and published
-- =============================================================================
-- Fires when a build BECOMES visible (published or gallery): inserted visible,
-- or updated from draft. A build that is already visible and changes again
-- tells nobody anything.
--
-- AT MOST 500 FOLLOWERS PER BUILD. 'published' goes to the maker's first 500
-- followers, oldest follow first; beyond that none are told, so publishing
-- stays one short transaction whoever publishes. A maker with more followers
-- than that needs a queued fan-out, which this migration does not build.
CREATE OR REPLACE FUNCTION public.rc_notify_build_visible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent_creator uuid;
  _follower       uuid;
BEGIN
  IF NEW.status NOT IN ('published', 'gallery') THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('published', 'gallery') THEN
    RETURN NULL;
  END IF;

  IF NEW.parent_build_id IS NOT NULL THEN
    SELECT b.creator_id INTO _parent_creator
      FROM public.builds b
     WHERE b.id = NEW.parent_build_id;
    PERFORM public.rc_notify(_parent_creator, NEW.creator_id, 'rebuilt', NEW.id, 'build', NEW.id, 'rebuilt your build');
  END IF;

  FOR _follower IN
    SELECT f.follower_id
      FROM public.follows f
     WHERE f.following_id = NEW.creator_id
     ORDER BY f.created_at
     LIMIT 500
  LOOP
    PERFORM public.rc_notify(_follower, NEW.creator_id, 'published', NEW.id, 'build', NEW.id, 'published a new build');
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_build_visible ON public.builds;
CREATE TRIGGER trg_rc_notify_build_visible
AFTER INSERT OR UPDATE OF status ON public.builds
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_build_visible();


-- =============================================================================
-- e. build_reproductions: reproduced
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rc_notify_reproduced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator uuid;
BEGIN
  SELECT b.creator_id INTO _creator FROM public.builds b WHERE b.id = NEW.build_id;
  PERFORM public.rc_notify(
    _creator, NEW.user_id, 'reproduced', NEW.build_id, 'build', NEW.build_id,
    CASE WHEN NEW.worked THEN 'ran your build and it worked' ELSE 'ran your build and it did not work' END
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_reproduced ON public.build_reproductions;
CREATE TRIGGER trg_rc_notify_reproduced
AFTER INSERT ON public.build_reproductions
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_reproduced();


-- =============================================================================
-- f. build_comments: comment, and reply
-- =============================================================================
-- A comment inserted hidden tells nobody. A reply tells the build's creator
-- that there is a comment and the parent's author that there is a reply.
CREATE OR REPLACE FUNCTION public.rc_notify_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator       uuid;
  _parent_author uuid;
BEGIN
  IF NEW.is_hidden THEN
    RETURN NULL;
  END IF;

  SELECT b.creator_id INTO _creator FROM public.builds b WHERE b.id = NEW.build_id;
  PERFORM public.rc_notify(_creator, NEW.author_id, 'comment', NEW.build_id, 'build_comment', NEW.id, 'commented on your build');

  IF NEW.parent_id IS NOT NULL THEN
    SELECT c.author_id INTO _parent_author FROM public.build_comments c WHERE c.id = NEW.parent_id;
    PERFORM public.rc_notify(_parent_author, NEW.author_id, 'reply', NEW.build_id, 'build_comment', NEW.id, 'replied to your comment');
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_comment ON public.build_comments;
CREATE TRIGGER trg_rc_notify_comment
AFTER INSERT ON public.build_comments
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_comment();


-- =============================================================================
-- g. build_likes: like
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rc_notify_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator uuid;
BEGIN
  SELECT b.creator_id INTO _creator FROM public.builds b WHERE b.id = NEW.build_id;
  PERFORM public.rc_notify(_creator, NEW.user_id, 'like', NEW.build_id, 'build', NEW.build_id, 'liked your build');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_like ON public.build_likes;
CREATE TRIGGER trg_rc_notify_like
AFTER INSERT ON public.build_likes
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_like();


-- =============================================================================
-- h. solutions: solution, and solved
-- =============================================================================
-- A solution is inserted as 'submitted' (src/lib/bounty/solutions.ts) and
-- accepted by accept_bounty_solution, which updates it to 'accepted'. Both
-- notifications carry the bounty's build, where the answer is credited.
CREATE OR REPLACE FUNCTION public.rc_notify_solution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
  _build  uuid;
BEGIN
  SELECT bo.author_id, bo.build_id INTO _author, _build
    FROM public.bounties bo
   WHERE bo.id = NEW.bounty_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'submitted' THEN
      PERFORM public.rc_notify(_author, NEW.solver_id, 'solution', _build, 'bounty_build', NEW.bounty_id, 'posted a solution to your bounty');
    END IF;
  ELSIF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    PERFORM public.rc_notify(NEW.solver_id, _author, 'solved', _build, 'bounty_build', NEW.bounty_id, 'accepted your solution');
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_solution ON public.solutions;
CREATE TRIGGER trg_rc_notify_solution
AFTER INSERT OR UPDATE OF status ON public.solutions
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_solution();


-- =============================================================================
-- i. follows: follow
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rc_notify_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rc_notify(NEW.following_id, NEW.follower_id, 'follow', NULL, 'profile', NEW.follower_id, 'started following you');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_follow ON public.follows;
CREATE TRIGGER trg_rc_notify_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_follow();


-- =============================================================================
-- j. Nobody calls the trigger functions
-- =============================================================================
REVOKE ALL ON FUNCTION public.rc_notify_build_visible() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_reproduced()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_comment()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_like()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_solution()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_follow()        FROM PUBLIC, anon, authenticated;
