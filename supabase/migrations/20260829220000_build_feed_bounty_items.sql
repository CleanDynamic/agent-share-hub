-- =============================================================================
-- NeoScale — bounties in the feed (NS-P52)
-- =============================================================================
-- One index and one function body. No table, no policy, and no change to what
-- get_build_feed already returned: every column NS-P41 declared is still
-- declared, in the same order, with the same type.
--
-- WHAT THIS ADDS
-- A fourth kind of item, alongside 'build', 'rebuild' and 'repro_note':
--
--   'bounty'  an OPEN bounty on a published build, at bounties.created_at
--
-- NS-P41 wrote the extension point and said so in the comment over the rebuild
-- arm — "NS-P52 adds a fourth arm beside them" — and this is that arm, written
-- to the same three rules: its own arm rather than a CASE, its own ORDER BY and
-- LIMIT so the union never materialises more than page_size rows per branch,
-- and its keys narrowed in `page` before the joins widen them into a card.
--
-- WHY A DROP AND NOT A PLAIN CREATE OR REPLACE
-- The prompt asks for CREATE OR REPLACE and the security posture below is
-- exactly NS-P41's, but Postgres will not replace a function whose RETURNS
-- TABLE gains columns: OUT parameters are part of the signature, and
-- 42P13 "cannot change return type of existing function" is what a bare
-- CREATE OR REPLACE would raise. So the function is dropped and recreated in
-- one transaction — the Supabase CLI applies each migration file in one — and
-- the grants are re-issued below because a DROP takes them with it.
--
-- THREE NEW COLUMNS, and no more. reward_gbp because a priced ask is a
-- different proposition from an unpriced one; the gap node's title because "an
-- open bounty on Inbox triage agent" says nothing about WHICH part is missing;
-- and the bounty's own id so the card can address it. The gap's problem
-- statement is deliberately absent: it lives in the node's payload, it is
-- prose, and the feed strip has one line — the build page is where it is read.
--
-- SECURITY INVOKER, STABLE, search_path pinned empty: NS-P41's posture,
-- unchanged and load-bearing. A bounty is readable exactly when its home is
-- (NS-P45's policy), so an invoker-right function returns asks on builds the
-- caller could have read for themselves, and the arm's own EXISTS restates the
-- published-build test rather than trusting it.
--
-- THE EXPLAIN TO RE-RUN, once this is applied — the NS-P41 check, which is that
-- each arm is an ordered index scan that stops at page_size rather than a sort
-- over the table:
--
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT * FROM public.get_build_feed(now(), 20);
--
-- Expect four Index Scan Backward nodes under the Append, each with
-- "rows removed by filter" small and none of them a Seq Scan on builds,
-- build_reproductions or bounties.
-- =============================================================================


-- =============================================================================
-- 1. The index the fourth arm needs
-- =============================================================================
-- Partial, for the reason NS-P41's three are: the feed only ever asks for open
-- asks that live on a build, and the solved, closed and legacy rows have no
-- business making the index bigger and the writes slower.
--
-- idx_bounties_status_closes (NS-P45) cannot serve this. It is
-- (status, closes_at), so it yields rows in DEADLINE order — and most bounties
-- have no deadline at all, which puts them in one undifferentiated NULL run.
-- The feed sorts on created_at, so without this index the arm is a sort over
-- every open bounty on the platform to return twenty.
--
-- The predicate is written to match section 2's WHERE clause exactly, so the
-- planner can prove the index covers the query.
CREATE INDEX IF NOT EXISTS idx_bounties_feed_open
  ON public.bounties (created_at DESC)
  WHERE status = 'open'
    AND build_id IS NOT NULL;


-- =============================================================================
-- 2. get_build_feed, with the bounty arm
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_build_feed(TIMESTAMPTZ, INT);

CREATE OR REPLACE FUNCTION public.get_build_feed(
  before    TIMESTAMPTZ DEFAULT now(),
  page_size INT DEFAULT 20
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

COMMENT ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT) IS
  'The new-path home feed: published builds, rebuilds, noted reproductions and open bounties as one ordered page, newest first, keyset-paged on item_at. SECURITY INVOKER — every row is one the caller could have read for themselves. Consumed by src/lib/feed/getBuildFeed.ts.';


-- =============================================================================
-- 3. Grants
-- =============================================================================
-- Re-issued because section 2 dropped the function and the grants with it.
-- Same two roles NS-P41 gave: anonymous readers get the feed, which is the
-- point — the Builds tab is the first thing a signed-out visitor sees, and RLS
-- is what keeps it honest rather than the grant.
GRANT EXECUTE ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT)
  TO anon, authenticated;
