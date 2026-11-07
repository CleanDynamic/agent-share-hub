-- UX-15 Part 1: blocking, notification preferences, and the database half of deleting an account.
--
-- WHAT IT ADDS
--   1. public.user_blocks (blocker_id, blocked_id, created_at). A person reads, writes and deletes only the rows where they are the
--      blocker. The blocked person cannot read the row, so nothing tells them.
--   2. public.is_blocked_between(a, b): true when either has blocked the other. It answers only about pairs the caller is in
--      (a signed-in caller who is neither a nor b gets false), and anon cannot call it. It is the one check every policy, trigger and
--      feed uses.
--   3. RESTRICTIVE insert policies, one per way a person reaches another (follow, new direct thread, message, message reaction, reply,
--      mention, like and reaction on an entry, like on a build, comment on a build, attaching someone's build to a topic). A
--      restrictive policy is ANDed with whatever permissive policy the live table has, so nothing is edited that this file cannot
--      see. Rebuilds of a public build stay allowed.
--   4. On block: follows are removed both ways. Messages already sent stay; new ones are refused by 3.
--   5. rc_notify writes nothing between two people who have blocked each other, and nothing of a kind the recipient turned off
--      (profiles.notification_preferences, one key per kind; a missing key counts as on).
--   6. set_notification_preference(key, on): the one way a client writes a preference (a known key only).
--   7. account_deletions: written only by the delete function. No client policy; no client grant.
--   8. delete_account_rows(uid): service_role only. Removes the person's topics, replaces their replies in other people's topics
--      with "This reply was removed", then deletes or nulls every row that would stop auth.admin.deleteUser (found in the
--      catalogue, so a table this file has never heard of is handled too).
--   9. openbuild_posts.removed_at, author_id nullable, FK ON DELETE SET NULL, and posts_guard_update lets a removed reply lose its
--      author. (A reply keeps its place in the thread; its author is gone.)
--  10. get_build_feed, profile_reader_view (behind get_profile_feed and get_profile_side) and search_build_ids hide a blocked person
--      both ways. Each is patched from its LIVE definition with exact text replacement and a count; if the live text is not what this
--      file expects the migration stops with nothing changed.
--
-- WHY RESTRICTIVE POLICIES AND PATCHES, NOT NEW COPIES. The live schema has drifted from supabase/migrations (RULES §8). Copying a
-- 500-line function from a file would overwrite whatever the live database has. Patching the live text, or adding a restrictive
-- policy, changes only what it names.
--
-- WHAT THE BLOCKED PERSON CAN LEARN. A refused insert says "new row violates row-level security policy", the same message as any other
-- refusal. They can call is_blocked_between(me, them) and read the answer: that is the same fact the refused write already gave them,
-- and it is the price of closing the writes in the database. The block row, the list of blocks and the reverse direction are never
-- readable by the blocked person.
--
-- NOTIFICATION KEYS. kind -> key (notification_pref_key). A kind with no key is always sent.
--   rebuilt -> build_rebuilt            reproduced -> build_reproduced     comment, reply -> build_comment
--   like -> build_like                  follow -> new_follower (the key that already existed)
--   published -> followed_publishes     post_reply, post_thread -> post_reply
--   post_mention -> post_mention        post_like -> post_like             post_pinned -> post_pinned
--   post_started -> post_started        a row whose target_type is node or collection (SV-20) -> saved_changed
--   solution, solved (retired by UX-11) -> no key.
-- The profile default gains every key set to true. Existing profiles are not rewritten: a missing key counts as on.
--
-- Correct whether or not any of it already exists. Never applied by Claude Code.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied, in the SQL editor, as a signed-in test user:
--   1. The block check, both directions:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT public.is_blocked_between('<me>', '<someone>');
--      SHOULD SHOW: two Index Only Scans (or Index Scans) on user_blocks_pkey and idx_user_blocks_blocked, one row each, well under 1 ms.
--   2. The feed with the check in it:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT item_kind, item_at FROM public.get_build_feed(now(), 20, false);
--      SHOULD SHOW: the same plan as before plus a SubPlan per candidate row (the check), no new Seq Scan, and a time no more than
--      10% above the figure UX-04 recorded. If a user has no blocks the user_blocks probes are index-only and return at once.
--   3. rc_notify's two new reads:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT 1 FROM public.profiles p WHERE p.id = '<a user>' AND p.notification_preferences -> 'post_like' = 'false'::jsonb;
--      SHOULD SHOW: an Index Scan on profiles_pkey, one row.
--   4. The block list page:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT blocked_id, created_at FROM public.user_blocks WHERE blocker_id = '<me>' ORDER BY created_at DESC LIMIT 100;
--      SHOULD SHOW: an Index Scan on user_blocks_pkey (blocker_id leads), a Sort on a handful of rows.

-- 1. user_blocks ----------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

-- The primary key serves blocker_id; this serves the other direction and the cascade.
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks (blocked_id, blocker_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;

DROP POLICY IF EXISTS "Blockers read their own blocks" ON public.user_blocks;
CREATE POLICY "Blockers read their own blocks"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = (select auth.uid()));

DROP POLICY IF EXISTS "Blockers add their own blocks" ON public.user_blocks;
CREATE POLICY "Blockers add their own blocks"
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = (select auth.uid()));

DROP POLICY IF EXISTS "Blockers remove their own blocks" ON public.user_blocks;
CREATE POLICY "Blockers remove their own blocks"
  ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = (select auth.uid()));

-- 2. The one check ------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN a IS NULL OR b IS NULL THEN false
    -- Only about a pair the caller is in. A signed-in stranger learns nothing. No signed-in user (a trigger run by the service role,
    -- a cron job) may ask about any pair.
    WHEN (select auth.uid()) IS NOT NULL AND (select auth.uid()) NOT IN (a, b) THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_blocks ub WHERE ub.blocker_id = a AND ub.blocked_id = b)
      OR EXISTS (SELECT 1 FROM public.user_blocks ub WHERE ub.blocker_id = b AND ub.blocked_id = a)
  END
$$;

REVOKE ALL ON FUNCTION public.is_blocked_between(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated, service_role;

-- A policy cannot read posts or builds under the caller's rights without recursing, and a blocker needs the author of a post or the
-- maker of a build whatever its state. These two answer only that, to a signed-in person.
CREATE OR REPLACE FUNCTION public.post_author(_post uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT p.author_id FROM public.openbuild_posts p WHERE p.id = _post $$;

CREATE OR REPLACE FUNCTION public.build_maker(_build uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT b.creator_id FROM public.builds b WHERE b.id = _build $$;

REVOKE ALL ON FUNCTION public.post_author(uuid), public.build_maker(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_author(uuid), public.build_maker(uuid) TO authenticated, service_role;

-- 3. Writes closed in the database -------------------------------------------------------------------------------------------

DO $policies$
DECLARE
  _p record;
BEGIN
  FOR _p IN
    SELECT * FROM (VALUES
      ('follows',          'UX-15 no follow across a block',
        $c$ NOT public.is_blocked_between((select auth.uid()), following_id) $c$),
      ('dm_threads',       'UX-15 no thread across a block',
        $c$ NOT public.is_blocked_between((select auth.uid()), CASE WHEN participant_a = (select auth.uid()) THEN participant_b ELSE participant_a END) $c$),
      ('dm_messages',      'UX-15 no message across a block',
        $c$ NOT EXISTS (SELECT 1 FROM public.dm_threads t WHERE t.id = thread_id AND t.type = 'direct'
              AND public.is_blocked_between((select auth.uid()), CASE WHEN t.participant_a = (select auth.uid()) THEN t.participant_b ELSE t.participant_a END)) $c$),
      ('dm_reactions',     'UX-15 no message reaction across a block',
        $c$ NOT public.is_blocked_between((select auth.uid()), (SELECT m.sender_id FROM public.dm_messages m WHERE m.id = message_id)) $c$),
      ('openbuild_posts',  'UX-15 no reply across a block',
        $c$ parent_id IS NULL OR NOT public.is_blocked_between((select auth.uid()), public.post_author(parent_id)) $c$),
      ('post_mentions',    'UX-15 no mention across a block',
        $c$ NOT public.is_blocked_between((select auth.uid()), user_id) $c$),
      ('post_likes',       'UX-15 no like across a block',
        $c$ NOT public.is_blocked_between((select auth.uid()), public.post_author(post_id)) $c$),
      ('post_reactions',   'UX-15 no reaction across a block',
        $c$ NOT public.is_blocked_between((select auth.uid()), public.post_author(post_id)) $c$),
      ('build_likes',      'UX-15 no build like across a block',
        $c$ NOT public.is_blocked_between((select auth.uid()), public.build_maker(build_id)) $c$),
      ('build_comments',   'UX-15 no build comment across a block',
        $c$ NOT public.is_blocked_between((select auth.uid()), public.build_maker(build_id)) $c$),
      ('post_attachments', 'UX-15 no topic from a blocker''s build',
        $c$ build_id IS NULL OR NOT public.is_blocked_between((select auth.uid()), public.build_maker(build_id)) $c$)
    ) AS v(tbl, pol, chk)
  LOOP
    IF to_regclass('public.' || _p.tbl) IS NULL THEN
      RAISE NOTICE 'UX-15: public.% does not exist here; no block policy added for it', _p.tbl;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', _p.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _p.pol, _p.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)', _p.pol, _p.tbl, _p.chk);
  END LOOP;
END;
$policies$;

-- 4. On block: stop following each other --------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_blocks_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.follows f
   WHERE (f.follower_id = NEW.blocker_id AND f.following_id = NEW.blocked_id)
      OR (f.follower_id = NEW.blocked_id AND f.following_id = NEW.blocker_id);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.user_blocks_after_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_user_blocks_after_insert ON public.user_blocks;
CREATE TRIGGER trg_user_blocks_after_insert
AFTER INSERT ON public.user_blocks
FOR EACH ROW EXECUTE FUNCTION public.user_blocks_after_insert();

-- 5. Notification preferences ---------------------------------------------------------------------------------------------------

ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences SET DEFAULT '{
    "new_follower": true, "content_approved": true,
    "build_rebuilt": true, "build_reproduced": true, "build_comment": true, "build_like": true,
    "followed_publishes": true, "post_reply": true, "post_mention": true, "post_like": true,
    "post_pinned": true, "post_started": true, "saved_changed": true
  }'::jsonb;

CREATE OR REPLACE FUNCTION public.notification_pref_key(kind text, target_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN target_type IN ('node', 'collection') THEN 'saved_changed'
    ELSE CASE kind
      WHEN 'rebuilt'      THEN 'build_rebuilt'
      WHEN 'reproduced'   THEN 'build_reproduced'
      WHEN 'comment'      THEN 'build_comment'
      WHEN 'reply'        THEN 'build_comment'
      WHEN 'like'         THEN 'build_like'
      WHEN 'follow'       THEN 'new_follower'
      WHEN 'published'    THEN 'followed_publishes'
      WHEN 'post_reply'   THEN 'post_reply'
      WHEN 'post_thread'  THEN 'post_reply'
      WHEN 'post_mention' THEN 'post_mention'
      WHEN 'post_like'    THEN 'post_like'
      WHEN 'post_pinned'  THEN 'post_pinned'
      WHEN 'post_started' THEN 'post_started'
      ELSE NULL
    END
  END
$$;

REVOKE ALL ON FUNCTION public.notification_pref_key(text, text) FROM PUBLIC, anon, authenticated;

-- rc_notify: its body from 20261001200000, plus the two early returns. The signature and every other line are unchanged.
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
DECLARE
  _key text;
BEGIN
  -- Nobody, or the actor themselves: nothing to say.
  IF rc_notify.recipient IS NULL OR rc_notify.recipient = rc_notify.actor THEN
    RETURN;
  END IF;

  -- UX-15: two people who have blocked each other are not told of each other.
  IF public.is_blocked_between(rc_notify.recipient, rc_notify.actor) THEN
    RETURN;
  END IF;

  -- UX-15: a kind the recipient turned off. A missing key, or a value that is not false, counts as on.
  _key := public.notification_pref_key(rc_notify.kind, rc_notify.target_type);
  IF _key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = rc_notify.recipient
       AND p.notification_preferences -> _key = 'false'::jsonb
  ) THEN
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

REVOKE ALL ON FUNCTION public.rc_notify(uuid, uuid, text, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- The one way a client writes a preference: a known key, the caller's own row, atomic (no read-modify-write in the browser).
CREATE OR REPLACE FUNCTION public.set_notification_preference(_key text, _on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (select auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Sign in to change your settings.';
  END IF;
  IF _on IS NULL OR _key IS NULL OR _key NOT IN (
    'new_follower', 'build_rebuilt', 'build_reproduced', 'build_comment', 'build_like', 'followed_publishes',
    'post_reply', 'post_mention', 'post_like', 'post_pinned', 'post_started', 'saved_changed'
  ) THEN
    RAISE EXCEPTION 'That is not a notification setting.';
  END IF;
  UPDATE public.profiles
     SET notification_preferences = coalesce(notification_preferences, '{}'::jsonb) || jsonb_build_object(_key, _on)
   WHERE id = (select auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.set_notification_preference(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_notification_preference(text, boolean) TO authenticated;

-- 6. Replies that stay when their author goes -----------------------------------------------------------------------------------

ALTER TABLE public.openbuild_posts ADD COLUMN IF NOT EXISTS removed_at timestamptz NULL;
COMMENT ON COLUMN public.openbuild_posts.removed_at IS
  'UX-15. Set when the author deleted their account: the reply stays so the thread reads, its body is "This reply was removed" and its author is null.';

DO $fk$
DECLARE
  _name text;
BEGIN
  SELECT c.conname INTO _name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
   WHERE c.conrelid = 'public.openbuild_posts'::regclass AND c.contype = 'f' AND a.attname = 'author_id'
     AND c.confrelid = 'public.profiles'::regclass
   LIMIT 1;

  ALTER TABLE public.openbuild_posts ALTER COLUMN author_id DROP NOT NULL;

  IF _name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.openbuild_posts DROP CONSTRAINT %I', _name);
  END IF;
  ALTER TABLE public.openbuild_posts
    ADD CONSTRAINT openbuild_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
END;
$fk$;


DO $patch$
DECLARE
  _fn   regprocedure := to_regprocedure('public.posts_guard_update()');
  _def  text;
  _olds text[] := ARRAY[
      $o$IF (NEW.author_id, NEW.parent_id, NEW.root_id, NEW.created_at) IS DISTINCT FROM (OLD.author_id, OLD.parent_id, OLD.root_id, OLD.created_at) THEN$o$
  ];
  _news text[] := ARRAY[
      $n$IF (NEW.author_id, NEW.parent_id, NEW.root_id, NEW.created_at) IS DISTINCT FROM (OLD.author_id, OLD.parent_id, OLD.root_id, OLD.created_at)
     AND NOT (OLD.author_id IS NOT NULL AND NEW.author_id IS NULL AND NEW.removed_at IS NOT NULL
              AND (NEW.parent_id, NEW.root_id, NEW.created_at) IS NOT DISTINCT FROM (OLD.parent_id, OLD.root_id, OLD.created_at)) THEN$n$
  ];
  _cnts int[]  := ARRAY[1];
  _i    int;
  _n    int;
BEGIN
  IF _fn IS NULL THEN
    RAISE EXCEPTION 'UX-15: posts_guard_update (public.posts_guard_update()) was not found; nothing was changed';
  END IF;
  _def := pg_get_functiondef(_fn);
  IF position('removed_at' in _def) > 0 THEN
    RETURN; -- already patched: running this twice changes nothing
  END IF;
  FOR _i IN 1 .. array_length(_olds, 1) LOOP
    _n := (length(_def) - length(replace(_def, _olds[_i], ''))) / length(_olds[_i]);
    IF _n <> _cnts[_i] THEN
      RAISE EXCEPTION 'UX-15: posts_guard_update no longer has the text patch % (found % times, expected %); nothing was changed', _i, _n, _cnts[_i];
    END IF;
    _def := replace(_def, _olds[_i], _news[_i]);
  END LOOP;
  EXECUTE _def;
END;
$patch$;


-- 7. Hidden both ways in the reads --------------------------------------------------------------------------------------------


DO $patch$
DECLARE
  _fn   regprocedure := to_regprocedure('public.get_build_feed(timestamptz, integer, boolean)');
  _def  text;
  _olds text[] := ARRAY[
      $o$        WHERE NOT only_following
          AND p.parent_id IS NULL
$o$,
      $o$        WHERE NOT only_following
          AND r.parent_id IS NOT NULL
$o$,
      $o$          AND (NOT only_following OR b.creator_id IN (SELECT following_id FROM followed))
$o$,
      $o$          AND (NOT only_following OR r.user_id IN (SELECT following_id FROM followed))
$o$,
      $o$          AND (NOT only_following OR bo.author_id IN (SELECT following_id FROM followed))
$o$,
      $o$          AND r.author_id <> (select auth.uid())
$o$,
      $o$WHERE EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = h.id AND p.hidden_by IS NULL)$o$
  ];
  _news text[] := ARRAY[
      $n$        WHERE NOT only_following
          AND p.parent_id IS NULL
          AND NOT public.is_blocked_between((select auth.uid()), p.author_id)
$n$,
      $n$        WHERE NOT only_following
          AND r.parent_id IS NOT NULL
          AND NOT public.is_blocked_between((select auth.uid()), r.author_id)
$n$,
      $n$          AND (NOT only_following OR b.creator_id IN (SELECT following_id FROM followed))
          AND NOT public.is_blocked_between((select auth.uid()), b.creator_id)
$n$,
      $n$          AND (NOT only_following OR r.user_id IN (SELECT following_id FROM followed))
          AND NOT public.is_blocked_between((select auth.uid()), r.user_id)
$n$,
      $n$          AND (NOT only_following OR bo.author_id IN (SELECT following_id FROM followed))
          AND NOT public.is_blocked_between((select auth.uid()), bo.author_id)
$n$,
      $n$          AND r.author_id <> (select auth.uid())
          AND NOT public.is_blocked_between((select auth.uid()), r.author_id)
$n$,
      $n$WHERE EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = h.id AND p.hidden_by IS NULL AND NOT public.is_blocked_between((select auth.uid()), p.author_id))$n$
  ];
  _cnts int[]  := ARRAY[1, 1, 2, 1, 1, 2, 1];
  _i    int;
  _n    int;
BEGIN
  IF _fn IS NULL THEN
    RAISE EXCEPTION 'UX-15: get_build_feed (public.get_build_feed(timestamptz, integer, boolean)) was not found; nothing was changed';
  END IF;
  _def := pg_get_functiondef(_fn);
  IF position('is_blocked_between' in _def) > 0 THEN
    RETURN; -- already patched: running this twice changes nothing
  END IF;
  FOR _i IN 1 .. array_length(_olds, 1) LOOP
    _n := (length(_def) - length(replace(_def, _olds[_i], ''))) / length(_olds[_i]);
    IF _n <> _cnts[_i] THEN
      RAISE EXCEPTION 'UX-15: get_build_feed no longer has the text patch % (found % times, expected %); nothing was changed', _i, _n, _cnts[_i];
    END IF;
    _def := replace(_def, _olds[_i], _news[_i]);
  END LOOP;
  EXECUTE _def;
END;
$patch$;


DO $patch$
DECLARE
  _fn   regprocedure := to_regprocedure('public.profile_reader_view(text)');
  _def  text;
  _olds text[] := ARRAY[
      $o$   WHERE lower(p.username) = lower(ltrim(btrim(p_username), '@'))
     AND (
$o$
  ];
  _news text[] := ARRAY[
      $n$   WHERE lower(p.username) = lower(ltrim(btrim(p_username), '@'))
     AND NOT public.is_blocked_between((select auth.uid()), p.id)
     AND (
$n$
  ];
  _cnts int[]  := ARRAY[1];
  _i    int;
  _n    int;
BEGIN
  IF _fn IS NULL THEN
    RAISE EXCEPTION 'UX-15: profile_reader_view (public.profile_reader_view(text)) was not found; nothing was changed';
  END IF;
  _def := pg_get_functiondef(_fn);
  IF position('is_blocked_between' in _def) > 0 THEN
    RETURN; -- already patched: running this twice changes nothing
  END IF;
  FOR _i IN 1 .. array_length(_olds, 1) LOOP
    _n := (length(_def) - length(replace(_def, _olds[_i], ''))) / length(_olds[_i]);
    IF _n <> _cnts[_i] THEN
      RAISE EXCEPTION 'UX-15: profile_reader_view no longer has the text patch % (found % times, expected %); nothing was changed', _i, _n, _cnts[_i];
    END IF;
    _def := replace(_def, _olds[_i], _news[_i]);
  END LOOP;
  EXECUTE _def;
END;
$patch$;


DO $patch$
DECLARE
  _fn   regprocedure := to_regprocedure('public.search_build_ids(text, integer)');
  _def  text;
  _olds text[] := ARRAY[
      $o$   WHERE b.status IN ('published', 'gallery')
   ORDER BY b.reproduction_count DESC$o$
  ];
  _news text[] := ARRAY[
      $n$   WHERE b.status IN ('published', 'gallery')
     AND NOT public.is_blocked_between((select auth.uid()), b.creator_id)
   ORDER BY b.reproduction_count DESC$n$
  ];
  _cnts int[]  := ARRAY[1];
  _i    int;
  _n    int;
BEGIN
  IF _fn IS NULL THEN
    RAISE EXCEPTION 'UX-15: search_build_ids (public.search_build_ids(text, integer)) was not found; nothing was changed';
  END IF;
  _def := pg_get_functiondef(_fn);
  IF position('is_blocked_between' in _def) > 0 THEN
    RETURN; -- already patched: running this twice changes nothing
  END IF;
  FOR _i IN 1 .. array_length(_olds, 1) LOOP
    _n := (length(_def) - length(replace(_def, _olds[_i], ''))) / length(_olds[_i]);
    IF _n <> _cnts[_i] THEN
      RAISE EXCEPTION 'UX-15: search_build_ids no longer has the text patch % (found % times, expected %); nothing was changed', _i, _n, _cnts[_i];
    END IF;
    _def := replace(_def, _olds[_i], _news[_i]);
  END LOOP;
  EXECUTE _def;
END;
$patch$;


-- 8. The deletion log ----------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.account_deletions (
  user_id      uuid        PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_deletions TO service_role;
COMMENT ON TABLE public.account_deletions IS
  'UX-15. Evidence that a deletion request was honoured. Written only by the delete-my-account function (service role). No policy: no client reads it. user_id has no foreign key because the user is gone.';

-- 9. The rows that stand in the way of deleting a user ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_account_rows(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _fk     record;
  _pass   int;
  _failed boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'delete_account_rows needs a user';
  END IF;

  -- Their topics go, and their replies in those topics with them (parent_id and root_id cascade).
  DELETE FROM public.openbuild_posts WHERE author_id = _uid AND parent_id IS NULL;

  -- Their replies in other people's topics stay, as a sentence. Nothing they attached or said stays with them.
  DELETE FROM public.post_attachments a USING public.openbuild_posts p WHERE a.post_id = p.id AND p.author_id = _uid;
  DELETE FROM public.post_mentions m USING public.openbuild_posts p WHERE m.post_id = p.id AND p.author_id = _uid;
  UPDATE public.openbuild_posts
     SET body = 'This reply was removed', removed_at = now(), tags = '{}', about_build_id = NULL, about_node_id = NULL,
         still_open = false
   WHERE author_id = _uid;

  -- Every other foreign key to a person that would refuse the delete (NO ACTION or RESTRICT), found in the catalogue: a row
  -- whose column cannot be null is deleted, any other has the column cleared. Up to four passes, because deleting one table's
  -- rows can free another's.
  FOR _pass IN 1 .. 4 LOOP
    _failed := false;
    FOR _fk IN
      SELECT c.conrelid::regclass AS tbl, a.attname AS col, a.attnotnull AS notnull
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
       WHERE c.contype = 'f'
         AND c.confdeltype IN ('a', 'r')
         AND c.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
         AND array_length(c.conkey, 1) = 1
         AND c.conrelid <> 'public.openbuild_posts'::regclass
         AND c.conrelid <> 'public.account_deletions'::regclass
         AND (SELECT n.nspname FROM pg_class k JOIN pg_namespace n ON n.oid = k.relnamespace WHERE k.oid = c.conrelid) = 'public'
    LOOP
      BEGIN
        IF _fk.notnull THEN
          EXECUTE format('DELETE FROM %s WHERE %I = $1', _fk.tbl, _fk.col) USING _uid;
        ELSE
          EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1', _fk.tbl, _fk.col, _fk.col) USING _uid;
        END IF;
      EXCEPTION WHEN foreign_key_violation THEN
        _failed := true;
      END;
    END LOOP;
    EXIT WHEN NOT _failed;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account_rows(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_rows(uuid) TO service_role;
