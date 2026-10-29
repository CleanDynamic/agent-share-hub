-- SV-20: notifications about builds, for the readers who kept them.
--
-- WHAT WAS THERE. 20261001200000 (RC-P19) already writes a notification to a build's MAKER when the build is rebuilt, run or
-- answered, from triggers, through public.rc_notify (the one writer: no self-notification, no repeat inside ten minutes). This
-- adds the readers who KEPT the build and asked to hear about it.
--
-- WHO HEARS. A reader who saved something that holds the build AND turned notifications on for it:
--   * a part or a step of the build (saved_items kind 'part' or 'step', build_id the build)  -> the notification targets that tile
--   * a public collection that holds the build (saved_items kind 'collection', ref the collection id) -> it targets the collection
-- saved_items.notify is the switch. It is off for every row, and a reader turns it on for the row they want, so "per collection"
-- is the reader's own saved-collection row. Saved items are private to their reader (SV-17), so nobody else can set it.
--
-- WHAT THEY HEAR ABOUT. The same three events the maker hears about, and nothing new is invented:
--   rebuilt     a rebuild of a build they kept was published       "rebuilt a build you saved"
--   reproduced  someone ran a build they kept                      "ran a build you saved and it worked" / "... and it did not work"
--   solution    someone posted an answer to a bounty on a build    "posted a solution to a bounty on a build you saved"
-- The message is fixed text. Nothing a reader wrote (a title, a prompt, a name) is copied into a notification.
-- A rebuild's row names the PARENT build (the one they kept), so its tile and collection links open the build they know.
--
-- NOBODY IS TOLD TWICE, AND NOBODY IS TOLD OF THEIR OWN ACT. The helper skips the actor and the build's maker (who already hears
-- as the maker), keeps one row per reader even when they kept the build in two collections and as a step (a tile wins over a
-- collection), and writes through rc_notify, which skips an identical row under ten minutes old. At most 500 readers are told
-- per event, the same cap RC-P19 puts on followers, so one event is one short transaction.
--
-- THE DATABASE NOTIFIES, NEVER THE CLIENT. Every row here is written by rc_notify from a trigger. The new functions are
-- SECURITY DEFINER (a trigger runs as the reader who caused it, who can read none of the savers' private rows), set search_path,
-- and are executable by nobody: a trigger fires without EXECUTE. They read only the three tables they need and write only through
-- rc_notify.
--
-- A BUILD NOBODY CAN READ IS NEVER ANNOUNCED. The helper does nothing unless the build is published or in the gallery. A
-- collection counts only if it is public, so a private collection's existence is not shown to a reader who can't see it.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. The readers to tell for one build:
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT s.user_id FROM public.saved_items s
--      WHERE s.notify AND s.kind IN ('part','step') AND s.build_id = '<a build id>' LIMIT 500;
--      SHOULD SHOW: an Index Scan or Bitmap Index Scan on idx_saved_items_build, no Seq Scan on saved_items.
--   2. The same through collections:
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT s.user_id FROM public.collection_items ci
--      JOIN public.saved_items s ON s.kind = 'collection' AND s.ref = ci.collection_id::text AND s.notify
--      WHERE ci.build_id = '<a build id>' LIMIT 500;
--      SHOULD SHOW: an Index Scan on idx_collection_items_build and one on idx_saved_items_collection_ref, no Seq Scan on
--      saved_items or collection_items.

-- 1. A notification can point at a tile or a collection -------------------------------------------------------------------------

-- The check is found in the catalogue, as 20261001200000 found it: every CHECK on notifications whose only column is target_type.
-- Rows are read first: a value the new check would refuse stops the block and changes nothing.
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
    RAISE EXCEPTION 'SV-20: notifications has no target_type column; nothing was changed';
  END IF;

  SELECT string_agg(DISTINCT n.target_type, ', ' ORDER BY n.target_type) INTO _refused
    FROM public.notifications n
   WHERE n.target_type IS NOT NULL
     AND n.target_type NOT IN ('blueprint','blog','bounty','stage','block','comment','message','thread','profile',
                               'build','build_comment','bounty_build','node','collection');

  IF _refused IS NOT NULL THEN
    RAISE EXCEPTION 'SV-20: notifications holds target_type values the new check would refuse: %; nothing was changed', _refused;
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
       'build','build_comment','bounty_build','node','collection'));
END;
$$;

-- 2. The saver's switch ---------------------------------------------------------------------------------------------------------

ALTER TABLE public.saved_items
  ADD COLUMN IF NOT EXISTS notify boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.saved_items.notify IS
  'SV-20. The reader asked to hear when a build they kept is rebuilt, run or answered. Off by default. Read only by the notification triggers.';

-- 3. The savers of a build, told ------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rc_notify_savers(
  _build   uuid,
  _actor   uuid,
  _kind    text,
  _message text,
  _skip    uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _maker  uuid;
  _status text;
  _saver  record;
BEGIN
  SELECT b.creator_id, b.status INTO _maker, _status
    FROM public.builds b
   WHERE b.id = _build;

  IF _status IS NULL OR _status NOT IN ('published', 'gallery') THEN
    RETURN;
  END IF;

  FOR _saver IN
    SELECT picked.user_id, picked.target_type, picked.target_id
      FROM (
        SELECT DISTINCT ON (found.user_id) found.user_id, found.target_type, found.target_id
          FROM (
            -- a part or a step of the build: the tile (rank 1 wins over a collection)
            SELECT s.user_id,
                   'node'::text AS target_type,
                   CASE WHEN s.ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN s.ref::uuid END AS target_id,
                   1 AS rank
              FROM public.saved_items s
             WHERE s.notify
               AND s.kind IN ('part', 'step')
               AND s.build_id = _build
               AND s.user_id <> _maker
               AND s.user_id <> _actor
               AND s.user_id IS DISTINCT FROM _skip
            UNION ALL
            -- a public collection that holds the build
            SELECT s.user_id,
                   'collection'::text,
                   c.id,
                   2
              FROM public.collection_items ci
              JOIN public.collections c ON c.id = ci.collection_id AND c.is_public
              JOIN public.saved_items s ON s.kind = 'collection' AND s.ref = c.id::text AND s.notify
             WHERE ci.build_id = _build
               AND s.user_id <> _maker
               AND s.user_id <> _actor
               AND s.user_id IS DISTINCT FROM _skip
          ) found
         WHERE found.target_id IS NOT NULL
         ORDER BY found.user_id, found.rank
      ) picked
     LIMIT 500
  LOOP
    PERFORM public.rc_notify(_saver.user_id, _actor, _kind, _build, _saver.target_type, _saver.target_id, _message);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.rc_notify_savers(uuid, uuid, text, text, uuid) IS
  'SV-20. Tells the readers who kept a published build, and turned notify on, that it was rebuilt, run or answered. Called by the triggers only; writes through rc_notify; skips the actor, the maker and the skipped reader; one row per reader, at most 500.';

REVOKE ALL ON FUNCTION public.rc_notify_savers(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- 4. builds: a rebuild published ------------------------------------------------------------------------------------------------

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
    PERFORM public.rc_notify_savers(NEW.parent_build_id, NEW.creator_id, 'rebuilt', 'rebuilt a build you saved');
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

-- 5. build_reproductions: a run -------------------------------------------------------------------------------------------------

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
  PERFORM public.rc_notify_savers(
    NEW.build_id, NEW.user_id, 'reproduced',
    CASE WHEN NEW.worked THEN 'ran a build you saved and it worked' ELSE 'ran a build you saved and it did not work' END
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_notify_reproduced ON public.build_reproductions;
CREATE TRIGGER trg_rc_notify_reproduced
AFTER INSERT ON public.build_reproductions
FOR EACH ROW EXECUTE FUNCTION public.rc_notify_reproduced();

-- 6. solutions: an answer -------------------------------------------------------------------------------------------------------
-- Only a submitted answer is told to savers. The accepted one goes to its solver, as before.

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
      IF _build IS NOT NULL THEN
        PERFORM public.rc_notify_savers(_build, NEW.solver_id, 'solution', 'posted a solution to a bounty on a build you saved', _author);
      END IF;
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

-- 7. Nobody calls them ----------------------------------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.rc_notify_build_visible() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_reproduced()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rc_notify_solution()      FROM PUBLIC, anon, authenticated;
