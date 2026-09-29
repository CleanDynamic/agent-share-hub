-- =============================================================================
-- RC-P11 — a following scope on the build feed
-- =============================================================================
-- One argument added to get_build_feed, one CTE, and one predicate in each of
-- its four branches. With only_following false (the default) the function
-- returns exactly what it returned before; with it true, each branch keeps
-- only the rows whose actor the caller follows:
--
--   build, rebuild   b.creator_id    the maker who published it
--   repro_note       r.user_id       the person who ran it and wrote the note
--   bounty           bo.author_id    the person who opened the ask
--
-- No output column is renamed, added or reordered, and the language,
-- volatility, security mode and search_path are the base definition's:
-- LANGUAGE sql, STABLE, SECURITY INVOKER, search_path ''. The caller's follows
-- are read with (select auth.uid()), once per call; a signed-out caller has
-- none, so the following scope returns nothing to them.
--
-- WHY DROP, THEN CREATE. A new argument on CREATE OR REPLACE would make a
-- second overload beside the old one, and PostgREST's two-argument calls would
-- then be ambiguous between them. So the old signature is dropped and the new
-- one created in the same transaction, and the grants the drop takes with it
-- are re-issued.
--
-- THE BASE DEFINITION IS THE REPOSITORY'S, NOT THE LIVE ONE, AND THE GUARD IN
-- SECTION 0 IS WHAT MAKES THAT SAFE. RC-P11 asks for the live definition
-- through the read-only Lovable message L-P11-0 and says the pasted text is
-- the source. It was not supplied when this was written, so the body below is
-- supabase/migrations/20260829220000_build_feed_bounty_items.sql's, byte for
-- byte, plus the additions above. Section 0 refuses to run unless the live
-- function is that definition exactly: its body's md5, its language,
-- volatility, security mode and search_path, and no second overload. If the
-- live function has drifted, this file raises "RC-P11:" and changes nothing,
-- and it has to be regenerated from L-P11-0's output.
--
-- THE FOLLOWS INDEX. The feed's following scope reads follows by follower_id.
-- The repository creates follows with UNIQUE (follower_id, following_id),
-- whose index already leads with follower_id; section 4 asks the live
-- catalogue rather than trusting that, and creates idx_follows_follower only
-- when no index on follows starts with follower_id.
-- =============================================================================


-- =============================================================================
-- 0. The guard: the live function must be the base this file was written from
-- =============================================================================
DO $guard$
DECLARE
  live record;
  overloads int;
BEGIN
  SELECT count(*) INTO overloads
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_build_feed';

  IF overloads <> 1 OR to_regprocedure('public.get_build_feed(timestamptz, integer)') IS NULL THEN
    RAISE EXCEPTION 'RC-P11: expected exactly one public.get_build_feed(timestamptz, integer), found % overload(s). Run L-P11-0 and regenerate this migration.', overloads;
  END IF;

  SELECT md5(p.prosrc) AS body_md5, l.lanname, p.provolatile, p.prosecdef, p.proconfig
  INTO live
  FROM pg_proc p
  JOIN pg_language l ON l.oid = p.prolang
  WHERE p.oid = to_regprocedure('public.get_build_feed(timestamptz, integer)');

  IF live.body_md5 <> '79ba5af25f4f4d1b6221f506652fa940'
     OR live.lanname <> 'sql'
     OR live.provolatile <> 's'
     OR live.prosecdef
     OR live.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] THEN
    RAISE EXCEPTION 'RC-P11: the live get_build_feed is not the definition in 20260829220000_build_feed_bounty_items.sql (body md5 %, language %, volatility %, security definer %, config %). Nothing was changed. Run L-P11-0 and regenerate this migration from the live text.',
      live.body_md5, live.lanname, live.provolatile, live.prosecdef, live.proconfig;
  END IF;
END
$guard$;


-- =============================================================================
-- 1. Drop the two-argument signature
-- =============================================================================
DROP FUNCTION public.get_build_feed(TIMESTAMPTZ, INT);


-- =============================================================================
-- 2. get_build_feed, with a following scope
-- =============================================================================
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
  -- the card's own fields, so that a card costs no query of its own
  status                TEXT,
  made_for              TEXT[],
  last_confirmed_at     TIMESTAMPTZ,
  last_confirmed_model  TEXT,
  cover_bucket          TEXT,
  cover_path            TEXT,
  cover_kind            TEXT,
  cover_poster_path     TEXT,
  repro_worked          BOOLEAN,
  -- NS-P52: the ask itself. Null on every other kind of row.
  bounty_id             UUID,
  bounty_reward_gbp     NUMERIC,
  bounty_gap_title      TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH bounds AS (
    -- The cap is INSIDE the function, not a convention the client is trusted
    -- to keep: page_size arrives over the wire from a browser, and 20 is what
    -- the tab asks for. A caller asking for a million gets fifty. Computed
    -- once here rather than written out five times below, so the five limits
    -- cannot drift apart.
    SELECT LEAST(GREATEST(COALESCE(get_build_feed.page_size, 20), 1), 50) AS n
  ),
  followed AS (SELECT following_id FROM public.follows WHERE follower_id = (select auth.uid())),
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
      u.gap_node_id
    FROM (
      -- -------------------------------------------------------------------
      -- 'build' — a published build that is nobody's child
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
          NULL::UUID      AS gap_node_id
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
      -- 'rebuild' — a published build that names a parent
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
          NULL::UUID      AS gap_node_id
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
      -- 'repro_note' — somebody ran a published build and wrote something
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
          NULL::UUID         AS gap_node_id
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
      -- 'bounty' — an OPEN ask on a published build (NS-P52)
      -- -------------------------------------------------------------------
      -- OPEN, checked here rather than left to the reader. A solved bounty
      -- leaves this arm the moment accept_bounty_solution writes its status,
      -- which is the whole behaviour: the feed carries questions, and a
      -- question that has been answered is not one. 'closed' and 'expired' go
      -- the same way for the same reason.
      --
      -- LEGACY BOUNTIES ARE NOT HERE, and cannot be: a content_items bounty
      -- has no build_id, so it has no card to render and no /b2/ address to
      -- link to. The legacy board is still where those are read.
      --
      -- The build test is an EXISTS rather than a join, exactly as the
      -- reproduction arm's is, so this stays a single ordered index scan over
      -- bounties with a primary key probe as its filter. Joining here would
      -- cost the arm its ordering and with it the early stop.
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
          bo.gap_node_id  AS gap_node_id
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
    ) u
    -- item_at alone: the order the four indexes deliver.
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
    gn.title       AS bounty_gap_title
  FROM page
  -- Fifty primary key probes at most, whatever the size of the table.
  JOIN public.builds b
    ON b.id = page.build_id
  JOIN public.profiles p
    ON p.id = b.creator_id
  -- LEFT, always: a build whose cover row was deleted out from under it is
  -- still a build, and the card falls back down resolveCover's chain exactly
  -- as it does for a build that never had one.
  LEFT JOIN public.build_media cm
    ON cm.id = b.cover_media_id
  -- LEFT, so that a reproduction whose author deleted their profile does not
  -- take the note off the feed.
  LEFT JOIN public.profiles rp
    ON rp.id = page.repro_user_id
  -- LEFT, and null for every row that is not a bounty. Also null for a
  -- build-level ask, which names no gap node: the strip then says the build's
  -- name and nothing about a part, which is the truth about that bounty.
  LEFT JOIN public.build_nodes gn
    ON gn.id = page.gap_node_id
  ORDER BY page.item_at DESC, page.build_id DESC, page.item_kind DESC;
$$;

COMMENT ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT, BOOLEAN) IS
  'The new-path home feed: published builds, rebuilds, noted reproductions and open bounties as one ordered page, newest first, keyset-paged on item_at. only_following keeps the rows whose maker, reproducer or bounty author the caller follows (RC-P11). SECURITY INVOKER — every row is one the caller could have read for themselves. Consumed by src/lib/feed/getBuildFeed.ts.';


-- =============================================================================
-- 3. Grants
-- =============================================================================
-- The base definition granted EXECUTE to anon and authenticated; the drop in
-- section 1 took those grants with it, so they are re-issued for the new
-- signature, after PUBLIC's default EXECUTE is revoked.
REVOKE ALL ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT, BOOLEAN)
  TO anon, authenticated;


-- =============================================================================
-- 4. An index leading with follows.follower_id, when there is none
-- =============================================================================
-- ⟦supabase-postgres-best-practices › references/schema-foreign-key-indexes.md⟧
-- follower_id is a foreign key and the feed's following scope filters on it.
DO $index$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a
      ON a.attrelid = i.indrelid
     AND a.attnum = i.indkey[0]
    WHERE i.indrelid = 'public.follows'::regclass
      AND a.attname = 'follower_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id);
  END IF;
END
$index$;
