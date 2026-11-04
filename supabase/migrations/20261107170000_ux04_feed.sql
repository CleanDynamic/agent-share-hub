-- UX-04 Part 6: Home's feed carries topics and every reply.
--
-- get_build_feed keeps its name and its arguments, (before, page_size, only_following), and keeps its four kinds exactly as
-- 20261001150000 (RC-P11) defines them: build, rebuild, repro_note, bounty. It gains two (entries in code; topics and replies on screen):
--
--   post          a topic. Everyone scope (only_following false): EVERY topic that is not hidden, in a space or in none, by anyone. It
--                 is not based on following and does not depend on who is asking. Following scope (true): topics by the viewer, by
--                 someone the viewer follows, or in a space the viewer belongs to, and only those.
--   reply_group   ONE item per topic, carrying its newest reply and the topic's exact reply count. Every reply reaches Home this way,
--                 without a card per reply. Everyone scope: any reply, so every conversation with a reply is there once. Following
--                 scope: a reply by someone the viewer follows, a reply by anyone but the viewer under a topic the viewer made, or a
--                 reply under one of the 50 newest topics of a space the viewer belongs to.
--
-- NEW REPLIES (reply_new_count). topic_reads (20261107166000) holds the time each reader last opened each topic. The count is the replies
-- under the topic created after that time and not written by the reader, up to 100; with no row, nothing is new (0). The count is the
-- READER'S, so it is null in the Everyone scope, whose answer is the same for everybody (UX-01 P5: its query key lost the viewer). The
-- app asks for those counts with the reader's own read of topic_reads (src/lib/openbuilds, getNewReplyCounts).
--
-- REPLY COUNT. post_reply_count is openbuild_posts.reply_count (20261107164000), exact and kept by trigger. Zero is returned as 0; the
-- page does not show it (UX-03 P8).
--
-- HIDDEN ENTRIES NEVER APPEAR, even to the people who can read them elsewhere: every leg says hidden_by IS NULL, and a reply_group of a
-- hidden topic is dropped. BLOCKED AND MUTED PEOPLE: neither a block of a person (UX-15) nor a mute of a person exists on disk (the
-- only is_muted columns belong to a conversation's two sides), and none is added; when UX-15 lands its filter belongs in the legs below.
--
-- THE FUNCTION'S ROW GROWS, so it is dropped and created again, as RC-P11 did, inside one transaction, with the grants re-issued.
-- New columns are appended after the old ones; no old column is renamed, retyped or reordered. The joins to builds and profiles
-- become LEFT joins because a topic row has no build; every old row still has one. post_body and reply_body are the first 1000
-- characters: a feed card is an excerpt, and 50 rows of 10000 characters is not a page.
--
-- THE GUARD (section 0) refuses to run unless the live function is RC-P11's, byte for byte: one overload of the three-argument
-- signature, body md5 3d184c32586e1eb37bc54f930e529dd1, SQL, stable, security invoker, search_path "". If it has drifted, or RC-P11
-- was never applied, this raises "UX-04:" and changes nothing, and the live text has to be read (L-P11-0) and this file regenerated.
-- The entry tables must exist (20261107130000 and the ones before it, reply_count and topic_reads included).
--
-- INDEXES, each justified by a leg below:
--   idx_posts_root_created    (root_id, created_at)        the replies of one topic, in order: the new-reply count, the reply legs that
--                                                          start from a topic, and getPost (Part 7).
--   idx_posts_author_created  (author_id, created_at DESC) one person's newest entries: the author legs of both feeds, listPostsBy, and
--                                                          the cascade from profiles.
--   idx_post_spaces_space     (space_id, created_at DESC)  a space's newest topics: the viewer's-spaces legs and listPosts. This needs
--                                                          post_spaces.created_at, a copy of the topic's own time written with the row
--                                                          (they are inserted together), so a space is read in order without sorting
--                                                          every topic it ever held.
--   idx_posts_roots_created   (created_at DESC) WHERE parent_id IS NULL AND hidden_by IS NULL
--                                                          the Everyone topic leg: newest topics, stopping at the page size.
--   idx_posts_replies_created (created_at DESC) WHERE parent_id IS NOT NULL AND hidden_by IS NULL
--                                                          the Everyone reply leg: newest replies, stopping at the limit.
--
-- Correct whether or not the indexes and the column exist. The function is replaced once: a SECOND RUN STOPS AT THE GUARD, harmlessly,
-- because by then the live function is no longer RC-P11's.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied, with real ids. The whole function shows as one Function Scan, so the legs are
-- written out; <me> is a reader who follows people, belongs to a space and has made topics.
--   0. The whole call, both scopes:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT item_kind, item_at FROM public.get_build_feed(now(), 20, false);
--      EXPLAIN (ANALYZE, BUFFERS) SELECT item_kind, item_at FROM public.get_build_feed(now(), 20, true);   -- as <me>
--      SHOULD SHOW: a Function Scan, Execution Time in the low tens of milliseconds, and no more than a few thousand shared buffers.
--   1. EVERYONE, the topic leg:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT p.id, p.created_at FROM public.openbuild_posts p
--       WHERE p.parent_id IS NULL AND p.hidden_by IS NULL AND p.created_at < now() ORDER BY p.created_at DESC LIMIT 20;
--      SHOULD SHOW: an Index Scan on idx_posts_roots_created that stops at the limit, no Sort, no Seq Scan on openbuild_posts.
--   1b. EVERYONE, the reply leg:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT r.id, r.root_id, r.created_at FROM public.openbuild_posts r
--       WHERE r.parent_id IS NOT NULL AND r.hidden_by IS NULL AND r.created_at < now() ORDER BY r.created_at DESC LIMIT 80;
--      SHOULD SHOW: an Index Scan on idx_posts_replies_created that stops at the limit, no Sort, no Seq Scan.
--   2. FOLLOWING, the topic leg by people (the viewer and those they follow):
--      EXPLAIN (ANALYZE, BUFFERS) SELECT x.id, x.created_at
--        FROM (SELECT following_id AS id FROM public.follows WHERE follower_id = '<me>' UNION SELECT '<me>'::uuid) f
--        CROSS JOIN LATERAL (SELECT p.id, p.created_at FROM public.openbuild_posts p
--                             WHERE p.author_id = f.id AND p.parent_id IS NULL AND p.hidden_by IS NULL AND p.created_at < now()
--                             ORDER BY p.created_at DESC LIMIT 20) x
--       ORDER BY x.created_at DESC LIMIT 20;
--      SHOULD SHOW: a Nested Loop with an Index Scan Backward on idx_posts_author_created per person, each stopping at its limit,
--      then one Sort of at most (people x 20) rows, no Seq Scan on openbuild_posts.
--   3. FOLLOWING, the topic leg by spaces:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT ps.post_id, ps.created_at
--        FROM public.space_members m
--        CROSS JOIN LATERAL (SELECT s.post_id, s.created_at FROM public.post_spaces s
--                             WHERE s.space_id = m.space_id AND s.created_at < now() ORDER BY s.created_at DESC LIMIT 20) ps
--       WHERE m.user_id = '<me>' ORDER BY ps.created_at DESC LIMIT 20;
--      SHOULD SHOW: an Index Scan on idx_space_members_user, then an Index Scan Backward on idx_post_spaces_space per space, no Seq
--      Scan on post_spaces.
--   4. FOLLOWING, the reply leg by people the viewer follows:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT x.id, x.root_id, x.created_at
--        FROM public.follows f
--        CROSS JOIN LATERAL (SELECT r.id, r.root_id, r.created_at FROM public.openbuild_posts r
--                             WHERE r.author_id = f.following_id AND r.parent_id IS NOT NULL AND r.hidden_by IS NULL
--                               AND r.created_at < now() ORDER BY r.created_at DESC LIMIT 80) x
--       WHERE f.follower_id = '<me>' ORDER BY x.created_at DESC LIMIT 80;
--      SHOULD SHOW: the follows primary key (or idx_follows_follower), then idx_posts_author_created per person, no Seq Scan.
--   5. FOLLOWING, the reply leg under the viewer's own topics:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT r.id, r.root_id, r.created_at FROM public.openbuild_posts root
--        JOIN public.openbuild_posts r ON r.root_id = root.id
--       WHERE root.author_id = '<me>' AND root.parent_id IS NULL AND r.parent_id IS NOT NULL AND r.hidden_by IS NULL
--         AND r.author_id <> '<me>' AND r.created_at < now()
--       ORDER BY r.created_at DESC LIMIT 80;
--      SHOULD SHOW: idx_posts_author_created for the viewer's topics, then idx_posts_root_created per topic, no Seq Scan. If the
--      viewer has thousands of topics this leg reads each of them; send the plan back.
--   5b. FOLLOWING, the reply leg under a space's newest topics:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT r.id, r.root_id, r.created_at
--        FROM public.space_members m
--        CROSS JOIN LATERAL (SELECT s.post_id FROM public.post_spaces s WHERE s.space_id = m.space_id ORDER BY s.created_at DESC LIMIT 50) ps
--        JOIN public.openbuild_posts r ON r.root_id = ps.post_id AND r.parent_id IS NOT NULL AND r.hidden_by IS NULL AND r.author_id <> '<me>'
--       WHERE m.user_id = '<me>' AND r.created_at < now() ORDER BY r.created_at DESC LIMIT 80;
--      SHOULD SHOW: idx_space_members_user, idx_post_spaces_space per space, idx_posts_root_created per topic, no Seq Scan.
--   6. The new-reply count for one topic:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM (SELECT 1 FROM public.openbuild_posts x WHERE x.root_id = '<a topic>'
--        AND x.parent_id IS NOT NULL AND x.hidden_by IS NULL AND x.author_id <> '<me>'
--        AND x.created_at > (SELECT t.seen_at FROM public.topic_reads t WHERE t.user_id = '<me>' AND t.root_id = '<a topic>')
--        LIMIT 100) c;
--      SHOULD SHOW: an Index Scan on idx_posts_root_created and a primary key probe of topic_reads, stopping at 100 rows, no Seq Scan.
--   If any plan shows a Seq Scan on openbuild_posts or post_spaces once they hold more than a few thousand rows, send the plan back.

-- =============================================================================
-- 0. The guard
-- =============================================================================
DO $guard$
DECLARE
  live      record;
  overloads int;
BEGIN
  IF to_regclass('public.openbuild_posts') IS NULL OR to_regclass('public.post_spaces') IS NULL OR to_regclass('public.space_members') IS NULL OR to_regclass('public.topic_reads') IS NULL THEN
    RAISE EXCEPTION 'UX-04: the topic tables are not there; apply 20261107120000 to 20261107166000 first. Nothing was changed.';
  END IF;

  SELECT count(*) INTO overloads
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_build_feed';

  IF overloads <> 1 OR to_regprocedure('public.get_build_feed(timestamptz, integer, boolean)') IS NULL THEN
    RAISE EXCEPTION 'UX-04: expected exactly one public.get_build_feed(timestamptz, integer, boolean), found % overload(s). Apply 20261001150000 first, or read the live text and regenerate this migration. Nothing was changed.', overloads;
  END IF;

  SELECT md5(p.prosrc) AS body_md5, l.lanname, p.provolatile, p.prosecdef, p.proconfig
    INTO live
    FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
   WHERE p.oid = to_regprocedure('public.get_build_feed(timestamptz, integer, boolean)');

  IF live.body_md5 <> '3d184c32586e1eb37bc54f930e529dd1'
     OR live.lanname <> 'sql' OR live.provolatile <> 's' OR live.prosecdef
     OR live.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] THEN
    RAISE EXCEPTION 'UX-04: the live get_build_feed is not the definition in 20261001150000_rc_build_feed_following.sql (body md5 %, language %, volatility %, security definer %, config %). Nothing was changed. Read the live text and regenerate this migration from it.',
      live.body_md5, live.lanname, live.provolatile, live.prosecdef, live.proconfig;
  END IF;
END
$guard$;

-- =============================================================================
-- 1. Indexes
-- =============================================================================
ALTER TABLE public.post_spaces
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_posts_root_created   ON public.openbuild_posts (root_id, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON public.openbuild_posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_spaces_space    ON public.post_spaces (space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_roots_created  ON public.openbuild_posts (created_at DESC) WHERE parent_id IS NULL AND hidden_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_replies_created ON public.openbuild_posts (created_at DESC) WHERE parent_id IS NOT NULL AND hidden_by IS NULL;

-- =============================================================================
-- 2. Drop the three-argument signature, then create it again with the new columns
-- =============================================================================
DROP FUNCTION public.get_build_feed(TIMESTAMPTZ, INT, BOOLEAN);

CREATE FUNCTION public.get_build_feed(
  before         TIMESTAMPTZ DEFAULT now(),
  page_size      INT DEFAULT 20,
  only_following BOOLEAN DEFAULT false
)
RETURNS TABLE (
  item_kind             TEXT,
  item_at               TIMESTAMPTZ,
  build_id              UUID,
  slug                  TEXT,
  title                 TEXT,
  outcome               TEXT,
  shape                 TEXT,
  cover_media_id        UUID,
  creator_id            UUID,
  creator_username      TEXT,
  creator_display       TEXT,
  creator_avatar        TEXT,
  reproduction_count    INT,
  rebuild_count         INT,
  parent_build_id       UUID,
  source_title_at_fork  TEXT,
  source_handle_at_fork TEXT,
  rebuild_note          TEXT,
  repro_note            TEXT,
  repro_model           TEXT,
  repro_user_username   TEXT,
  status                TEXT,
  made_for              TEXT[],
  last_confirmed_at     TIMESTAMPTZ,
  last_confirmed_model  TEXT,
  cover_bucket          TEXT,
  cover_path            TEXT,
  cover_kind            TEXT,
  cover_poster_path     TEXT,
  repro_worked          BOOLEAN,
  bounty_id             UUID,
  bounty_reward_gbp     NUMERIC,
  bounty_gap_title      TEXT,
  -- UX-04: the root post of a 'post' or 'reply_group' row. Null on every other kind.
  post_id               UUID,
  post_created_at       TIMESTAMPTZ,
  post_author_id        UUID,
  post_author_username  TEXT,
  post_author_display   TEXT,
  post_author_avatar    TEXT,
  post_body             TEXT,
  post_still_open       BOOLEAN,
  post_reward_gbp       NUMERIC,
  post_reply_count      INT,
  -- UX-04: the newest reply of a 'reply_group' row, and how many replies are new to the viewer. Null on every other kind.
  reply_id              UUID,
  reply_at              TIMESTAMPTZ,
  reply_author_id       UUID,
  reply_author_username TEXT,
  reply_author_display  TEXT,
  reply_author_avatar   TEXT,
  reply_body            TEXT,
  reply_new_count       INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH bounds AS (
    -- The cap is INSIDE the function: page_size arrives over the wire from a browser. A caller asking for a million gets fifty.
    SELECT LEAST(GREATEST(COALESCE(get_build_feed.page_size, 20), 1), 50) AS n
  ),
  followed AS (SELECT following_id FROM public.follows WHERE follower_id = (select auth.uid())),
  -- ---------------------------------------------------------------------------------------------------------------------
  -- 'post': the root posts this page shows, newest first, each once. UNION (not ALL) drops a post found by two legs.
  -- ---------------------------------------------------------------------------------------------------------------------
  post_hits AS (
    SELECT u.id, u.created_at
    FROM (
      -- following: by the viewer or by someone they follow, one index range per person
      (
        SELECT x.id, x.created_at
        FROM (SELECT f.following_id AS id FROM followed f UNION SELECT (select auth.uid())) who
        CROSS JOIN LATERAL (
          SELECT p.id, p.created_at
          FROM public.openbuild_posts p
          WHERE p.author_id = who.id
            AND p.parent_id IS NULL
            AND p.hidden_by IS NULL
            AND p.created_at < get_build_feed.before
          ORDER BY p.created_at DESC
          LIMIT (SELECT bounds.n FROM bounds)
        ) x
        WHERE only_following
        ORDER BY x.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
      UNION
      -- following: in a space the viewer belongs to, one index range per space
      (
        SELECT sp.post_id AS id, sp.created_at
        FROM public.space_members m
        CROSS JOIN LATERAL (
          SELECT s.post_id, s.created_at
          FROM public.post_spaces s
          WHERE s.space_id = m.space_id
            AND s.created_at < get_build_feed.before
          ORDER BY s.created_at DESC
          LIMIT (SELECT bounds.n FROM bounds)
        ) sp
        WHERE only_following
          AND m.user_id = (select auth.uid())
        ORDER BY sp.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
      UNION
      -- everyone: any topic that is not hidden, in a space or in none
      (
        SELECT p.id, p.created_at
        FROM public.openbuild_posts p
        WHERE NOT only_following
          AND p.parent_id IS NULL
          AND p.hidden_by IS NULL
          AND p.created_at < get_build_feed.before
        ORDER BY p.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
    ) u
    -- a post found through a space may be hidden or a reply by the time it is read; the join below is the last word
    ORDER BY u.created_at DESC
    LIMIT (SELECT bounds.n FROM bounds)
  ),
  -- ---------------------------------------------------------------------------------------------------------------------
  -- 'reply_group': the newest qualifying reply of each root, from two legs. Each leg reads up to four pages of replies so that one
  -- busy thread cannot crowd out the others; a page can still come back short when it does.
  -- ---------------------------------------------------------------------------------------------------------------------
  reply_hits AS (
    SELECT DISTINCT ON (c.root_id) c.root_id, c.id AS reply_id, c.created_at
    FROM (
      -- someone the viewer follows replied
      (
        SELECT x.id, x.root_id, x.created_at
        FROM followed f
        CROSS JOIN LATERAL (
          SELECT r.id, r.root_id, r.created_at
          FROM public.openbuild_posts r
          WHERE r.author_id = f.following_id
            AND r.parent_id IS NOT NULL
            AND r.hidden_by IS NULL
            AND r.created_at < get_build_feed.before
          ORDER BY r.created_at DESC
          LIMIT (SELECT bounds.n * 4 FROM bounds)
        ) x
        WHERE only_following
          AND f.following_id <> (select auth.uid())
        ORDER BY x.created_at DESC
        LIMIT (SELECT bounds.n * 4 FROM bounds)
      )
      UNION ALL
      -- anyone but the viewer replied under a root the viewer made
      (
        SELECT r.id, r.root_id, r.created_at
        FROM public.openbuild_posts root
        JOIN public.openbuild_posts r ON r.root_id = root.id
        WHERE only_following
          AND root.author_id = (select auth.uid())
          AND root.parent_id IS NULL
          AND r.parent_id IS NOT NULL
          AND r.hidden_by IS NULL
          AND r.author_id <> (select auth.uid())
          AND r.created_at < get_build_feed.before
        ORDER BY r.created_at DESC
        LIMIT (SELECT bounds.n * 4 FROM bounds)
      )
      UNION ALL
      -- anyone replied under one of the 50 newest topics of a space the viewer belongs to
      (
        SELECT r.id, r.root_id, r.created_at
        FROM public.space_members m
        CROSS JOIN LATERAL (
          SELECT s.post_id
          FROM public.post_spaces s
          WHERE s.space_id = m.space_id
          ORDER BY s.created_at DESC
          LIMIT 50
        ) ps
        JOIN public.openbuild_posts r ON r.root_id = ps.post_id
        WHERE only_following
          AND m.user_id = (select auth.uid())
          AND r.parent_id IS NOT NULL
          AND r.hidden_by IS NULL
          AND r.author_id <> (select auth.uid())
          AND r.created_at < get_build_feed.before
        ORDER BY r.created_at DESC
        LIMIT (SELECT bounds.n * 4 FROM bounds)
      )
      UNION ALL
      -- everyone: any reply
      (
        SELECT r.id, r.root_id, r.created_at
        FROM public.openbuild_posts r
        WHERE NOT only_following
          AND r.parent_id IS NOT NULL
          AND r.hidden_by IS NULL
          AND r.created_at < get_build_feed.before
        ORDER BY r.created_at DESC
        LIMIT (SELECT bounds.n * 4 FROM bounds)
      )
    ) c
    ORDER BY c.root_id, c.created_at DESC
  ),
  page AS MATERIALIZED (
    SELECT
      u.item_kind,
      u.item_at,
      u.build_id,
      u.repro_note,
      u.repro_model,
      u.repro_user_id,
      u.repro_worked,
      u.bounty_id,
      u.bounty_reward_gbp,
      u.gap_node_id,
      u.post_id,
      u.reply_id,
      u.reply_new_count
    FROM (
      -- -------------------------------------------------------------------
      -- 'build': a published build that is nobody's child
      -- -------------------------------------------------------------------
      (
        SELECT
          'build'::TEXT   AS item_kind,
          b.published_at  AS item_at,
          b.id            AS build_id,
          NULL::TEXT      AS repro_note,
          NULL::TEXT      AS repro_model,
          NULL::UUID      AS repro_user_id,
          NULL::BOOLEAN   AS repro_worked,
          NULL::UUID      AS bounty_id,
          NULL::NUMERIC   AS bounty_reward_gbp,
          NULL::UUID      AS gap_node_id,
          NULL::UUID      AS post_id,
          NULL::UUID      AS reply_id,
          NULL::INT       AS reply_new_count
        FROM public.builds b
        WHERE b.status IN ('published', 'gallery')
          AND b.published_at IS NOT NULL
          AND b.parent_build_id IS NULL
          AND b.published_at < get_build_feed.before
          AND (NOT only_following OR b.creator_id IN (SELECT following_id FROM followed))
        ORDER BY b.published_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )

      UNION ALL

      -- -------------------------------------------------------------------
      -- 'rebuild': a published build that names a parent
      -- -------------------------------------------------------------------
      (
        SELECT
          'rebuild'::TEXT AS item_kind,
          b.published_at  AS item_at,
          b.id            AS build_id,
          NULL::TEXT      AS repro_note,
          NULL::TEXT      AS repro_model,
          NULL::UUID      AS repro_user_id,
          NULL::BOOLEAN   AS repro_worked,
          NULL::UUID      AS bounty_id,
          NULL::NUMERIC   AS bounty_reward_gbp,
          NULL::UUID      AS gap_node_id,
          NULL::UUID      AS post_id,
          NULL::UUID      AS reply_id,
          NULL::INT       AS reply_new_count
        FROM public.builds b
        WHERE b.status IN ('published', 'gallery')
          AND b.published_at IS NOT NULL
          AND b.parent_build_id IS NOT NULL
          AND b.published_at < get_build_feed.before
          AND (NOT only_following OR b.creator_id IN (SELECT following_id FROM followed))
        ORDER BY b.published_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )

      UNION ALL

      -- -------------------------------------------------------------------
      -- 'repro_note': somebody ran a published build and wrote something
      -- -------------------------------------------------------------------
      (
        SELECT
          'repro_note'::TEXT AS item_kind,
          r.confirmed_at     AS item_at,
          r.build_id         AS build_id,
          r.note             AS repro_note,
          r.model_used       AS repro_model,
          r.user_id          AS repro_user_id,
          r.worked           AS repro_worked,
          NULL::UUID         AS bounty_id,
          NULL::NUMERIC      AS bounty_reward_gbp,
          NULL::UUID         AS gap_node_id,
          NULL::UUID         AS post_id,
          NULL::UUID         AS reply_id,
          NULL::INT          AS reply_new_count
        FROM public.build_reproductions r
        WHERE r.note IS NOT NULL
          AND btrim(r.note) <> ''
          AND r.confirmed_at < get_build_feed.before
          AND (NOT only_following OR r.user_id IN (SELECT following_id FROM followed))
          AND EXISTS (
            SELECT 1
            FROM public.builds b
            WHERE b.id = r.build_id
              AND b.status IN ('published', 'gallery')
          )
        ORDER BY r.confirmed_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )

      UNION ALL

      -- -------------------------------------------------------------------
      -- 'bounty': an OPEN ask on a published build (NS-P52)
      -- -------------------------------------------------------------------
      (
        SELECT
          'bounty'::TEXT  AS item_kind,
          bo.created_at   AS item_at,
          bo.build_id     AS build_id,
          NULL::TEXT      AS repro_note,
          NULL::TEXT      AS repro_model,
          NULL::UUID      AS repro_user_id,
          NULL::BOOLEAN   AS repro_worked,
          bo.id           AS bounty_id,
          bo.reward_gbp   AS bounty_reward_gbp,
          bo.gap_node_id  AS gap_node_id,
          NULL::UUID      AS post_id,
          NULL::UUID      AS reply_id,
          NULL::INT       AS reply_new_count
        FROM public.bounties bo
        WHERE bo.status = 'open'
          AND bo.build_id IS NOT NULL
          AND bo.created_at < get_build_feed.before
          AND (NOT only_following OR bo.author_id IN (SELECT following_id FROM followed))
          AND EXISTS (
            SELECT 1
            FROM public.builds b
            WHERE b.id = bo.build_id
              AND b.status IN ('published', 'gallery')
          )
        ORDER BY bo.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )

      UNION ALL

      -- -------------------------------------------------------------------
      -- 'post': a root post (UX-04)
      -- -------------------------------------------------------------------
      (
        SELECT
          'post'::TEXT    AS item_kind,
          h.created_at    AS item_at,
          NULL::UUID      AS build_id,
          NULL::TEXT      AS repro_note,
          NULL::TEXT      AS repro_model,
          NULL::UUID      AS repro_user_id,
          NULL::BOOLEAN   AS repro_worked,
          NULL::UUID      AS bounty_id,
          NULL::NUMERIC   AS bounty_reward_gbp,
          NULL::UUID      AS gap_node_id,
          h.id            AS post_id,
          NULL::UUID      AS reply_id,
          NULL::INT       AS reply_new_count
        FROM post_hits h
        -- the last word on hidden: a post found by the space leg is checked here as well
        WHERE EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = h.id AND p.hidden_by IS NULL)
        ORDER BY h.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )

      UNION ALL

      -- -------------------------------------------------------------------
      -- 'reply_group': one item per root, carrying its newest reply and the count of new ones (UX-04)
      -- -------------------------------------------------------------------
      (
        SELECT
          'reply_group'::TEXT AS item_kind,
          h.created_at        AS item_at,
          NULL::UUID          AS build_id,
          NULL::TEXT          AS repro_note,
          NULL::TEXT          AS repro_model,
          NULL::UUID          AS repro_user_id,
          NULL::BOOLEAN       AS repro_worked,
          NULL::UUID          AS bounty_id,
          NULL::NUMERIC       AS bounty_reward_gbp,
          NULL::UUID          AS gap_node_id,
          h.root_id           AS post_id,
          h.reply_id          AS reply_id,
          CASE WHEN NOT only_following THEN NULL ELSE COALESCE((
            SELECT count(*)::INT
            FROM (
              SELECT 1
              FROM public.openbuild_posts x
              WHERE x.root_id = h.root_id
                AND x.parent_id IS NOT NULL
                AND x.hidden_by IS NULL
                AND x.author_id <> (select auth.uid())
                AND x.created_at > (
                  SELECT t.seen_at FROM public.topic_reads t WHERE t.user_id = (select auth.uid()) AND t.root_id = h.root_id
                )
              LIMIT 100
            ) counted
          ), 0) END                   AS reply_new_count
        FROM reply_hits h
        JOIN public.openbuild_posts rt ON rt.id = h.root_id AND rt.hidden_by IS NULL
        ORDER BY h.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
    ) u
    ORDER BY u.item_at DESC
    LIMIT (SELECT bounds.n FROM bounds)
  )
  SELECT
    page.item_kind,
    page.item_at,
    page.build_id,
    b.slug,
    b.title,
    b.outcome,
    b.shape,
    b.cover_media_id,
    b.creator_id,
    p.username     AS creator_username,
    p.display_name AS creator_display,
    p.avatar_url   AS creator_avatar,
    b.reproduction_count,
    b.rebuild_count,
    b.parent_build_id,
    b.source_title_at_fork,
    b.source_handle_at_fork,
    b.rebuild_note,
    page.repro_note,
    page.repro_model,
    rp.username    AS repro_user_username,
    b.status,
    b.made_for,
    b.last_confirmed_at,
    b.last_confirmed_model,
    cm.bucket      AS cover_bucket,
    cm.path        AS cover_path,
    cm.kind        AS cover_kind,
    cm.poster_path AS cover_poster_path,
    page.repro_worked,
    page.bounty_id,
    page.bounty_reward_gbp,
    gn.title       AS bounty_gap_title,
    page.post_id,
    pr.created_at  AS post_created_at,
    pr.author_id   AS post_author_id,
    pa.username    AS post_author_username,
    pa.display_name AS post_author_display,
    pa.avatar_url  AS post_author_avatar,
    left(pr.body, 1000) AS post_body,
    pr.still_open  AS post_still_open,
    pr.reward_gbp  AS post_reward_gbp,
    pr.reply_count AS post_reply_count,
    page.reply_id,
    rr.created_at  AS reply_at,
    rr.author_id   AS reply_author_id,
    ra.username    AS reply_author_username,
    ra.display_name AS reply_author_display,
    ra.avatar_url  AS reply_author_avatar,
    left(rr.body, 1000) AS reply_body,
    page.reply_new_count
  FROM page
  -- LEFT now: a post row has no build. Every build row still has its build and its maker, by primary key, fifty at most.
  LEFT JOIN public.builds b
    ON b.id = page.build_id
  LEFT JOIN public.profiles p
    ON p.id = b.creator_id
  LEFT JOIN public.build_media cm
    ON cm.id = b.cover_media_id
  LEFT JOIN public.profiles rp
    ON rp.id = page.repro_user_id
  LEFT JOIN public.build_nodes gn
    ON gn.id = page.gap_node_id
  -- the root post and its maker, and the newest reply and its maker
  LEFT JOIN public.openbuild_posts pr
    ON pr.id = page.post_id
  LEFT JOIN public.profiles pa
    ON pa.id = pr.author_id
  LEFT JOIN public.openbuild_posts rr
    ON rr.id = page.reply_id
  LEFT JOIN public.profiles ra
    ON ra.id = rr.author_id
  ORDER BY page.item_at DESC, page.build_id DESC NULLS LAST, page.post_id DESC NULLS LAST, page.item_kind DESC;
$$;

COMMENT ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT, BOOLEAN) IS
  'The new-path home feed: published builds, rebuilds, noted reproductions, open bounties, root posts and reply groups as one ordered page, newest first, keyset-paged on item_at. only_following keeps the rows whose actor the caller follows or made (RC-P11), and is the only scope that carries reply groups (UX-04). SECURITY INVOKER. Consumed by src/lib/feed/getBuildFeed.ts.';

-- =============================================================================
-- 3. Grants
-- =============================================================================
REVOKE ALL ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT, BOOLEAN) TO anon, authenticated;
