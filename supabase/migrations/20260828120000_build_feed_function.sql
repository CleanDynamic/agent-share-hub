-- =============================================================================
-- NeoScale — the new-path feed, as one function (NS-P41)
-- =============================================================================
-- One set-returning function and three indexes. No table, no policy, no change
-- to anything that already exists.
--
-- WHAT IT IS FOR
-- The home feed fires roughly fifteen client-side queries across five tabs,
-- merging content_items, collections, projects and reblogs in the browser and
-- sorting the result there. It is the second-largest performance debt on the
-- platform, and builds — the record this whole rebuild exists to publish —
-- appear nowhere in it.
--
-- This is the other way round: ONE round trip returns one ordered, paged,
-- typed page, and the browser renders it in the order the database handed it
-- over. The five legacy tabs are untouched; the Builds tab consuming this is
-- additive, and retiring anything is a later prompt's business.
--
-- THREE SOURCES, ONE ORDER
--   'build'       a published build that is nobody's child, at published_at
--   'rebuild'     a published build that names a parent, at published_at
--   'repro_note'  somebody other than the creator ran a published build and
--                 wrote something about it, at confirmed_at
--
-- They are one UNION ALL rather than three queries because the ordering is
-- across all three: a reproduction note written this morning belongs above a
-- build published last week, and no client-side merge of three paged lists can
-- produce that without over-fetching all three.
--
-- SECURITY INVOKER, deliberately, and the same call gallery_facets made in
-- NS-P19. The function reads builds, build_reproductions, build_media and
-- profiles through the CALLER's own row level security: an anonymous reader
-- sees published work and nothing else, a creator's own drafts stay theirs,
-- and no reproduction of an unreadable build leaks through its note. A
-- SECURITY DEFINER function here would hand every caller the same rows and
-- make this function the platform's one hole.
--
-- STABLE, not IMMUTABLE: it reads tables, and its default argument is now().
--
-- search_path is pinned EMPTY and every reference is schema-qualified, so no
-- search path a caller sets can put a different `builds` in front of this one.
-- =============================================================================


-- =============================================================================
-- 1. The three indexes the plan needs
-- =============================================================================
-- All partial, and all partial for the same reason: the feed only ever asks
-- about rows that cleared a bar, and the rows that did not clear it have no
-- business making the index bigger and the writes slower.
--
-- THE SHAPE OF THESE INDEXES IS THE SHAPE OF THE PLAN, and section 2's
-- structure only pays off if they exist. Each one delivers ONE union arm's
-- rows already ordered by the timestamp the feed sorts on, so that arm's
-- ORDER BY ... LIMIT is an index scan that stops at page_size instead of a
-- sort over the table. Measured on a 40,000-build harness, the three together
-- are the difference between reading 34,851 rows to return 20 and reading 60
-- (55ms against 0.2ms); the EXPLAIN is in the NS-P41 handoff.

-- Branch 1: builds that are nobody's child.
--
-- idx_builds_status_published (NS-P01) is (status, published_at DESC), which
-- cannot serve this in order — the feed asks for two status values at once, so
-- that index yields two runs appended, not one descending stream. Splitting on
-- parent_build_id instead puts the two feed branches in their own indexes and
-- makes each one a single ordered scan.
--
-- The IS NOT NULL half of the predicate is not decoration: a build whose
-- status was set without going through publish() has a NULL published_at, and
-- a NULL item_at cannot be ordered or paged past. Section 2 filters those rows
-- out, so the index and the query agree on which rows exist.
CREATE INDEX idx_builds_feed_published
  ON public.builds (published_at DESC)
  WHERE status IN ('published', 'gallery')
    AND published_at IS NOT NULL
    AND parent_build_id IS NULL;

-- Branch 2: builds that name a parent. A small index — most builds are not
-- forks — and the reason the rebuild arm does not have to walk past thousands
-- of ordinary builds to find twenty rebuilds.
--
-- idx_builds_parent_build (NS-P36) does not serve this either: it is keyed on
-- parent_build_id, which answers "the children of THIS build" and yields
-- nothing in published_at order.
CREATE INDEX idx_builds_feed_rebuilt
  ON public.builds (published_at DESC)
  WHERE status IN ('published', 'gallery')
    AND published_at IS NOT NULL
    AND parent_build_id IS NOT NULL;

-- Branch 3. Reproductions are already indexed by (build_id, confirmed_at DESC)
-- for the build page, which is the wrong shape here: the feed asks for the
-- newest NOTED reproductions across every build, and there is no build_id to
-- lead with. Noted rows are a small minority of the table — most people tick
-- "it worked" and write nothing; the harness put it at one in twenty — so the
-- partial index is a fraction of the size of a full one.
--
-- The predicate is written to match section 2's WHERE clause exactly, btrim
-- and all, so the planner can prove the index covers the query. btrim is
-- immutable, which is what makes it legal in a predicate at all.
CREATE INDEX idx_build_reproductions_noted
  ON public.build_reproductions (confirmed_at DESC)
  WHERE note IS NOT NULL AND btrim(note) <> '';


-- =============================================================================
-- 2. get_build_feed
-- =============================================================================
-- KEYSET, NOT OFFSET. The caller passes the item_at of the last row it holds
-- and gets the next page below it, so page 50 costs what page 1 costs. OFFSET
-- would re-scan everything above the page on every scroll, and — worse on a
-- feed people publish into while it is being read — would skip a row every
-- time something new landed above the window.
--
-- TWO THINGS MAKE THIS FUNCTION O(page), AND BOTH ARE STRUCTURAL RATHER THAN
-- STYLISTIC. Write it the obvious way — three fully joined SELECTs unioned,
-- then ordered and limited — and Postgres assembles every joined row in all
-- three arms and top-N sorts the lot. Measured on a 40,000-build harness:
-- 34,851 rows built to return 20, and it grows with the table. That is the
-- fifteen-query feed's problem moved into the database, which is no fix at all.
--
-- 1. EVERY ARM CARRIES ITS OWN ORDER BY AND LIMIT.
--    Postgres will not turn a UNION ALL into a MergeAppend that stops early —
--    it does that for partitions and inheritance, not for a union of unrelated
--    tables — so an unlimited arm is a fully materialised arm no matter how the
--    outer query is written. Limiting each arm to page_size instead is exact,
--    not an approximation: the newest n rows of the union are necessarily
--    drawn from the newest n rows of each arm, so taking n from each and n
--    from the result of that returns precisely the rows the unlimited query
--    would have. At most 3 x page_size rows exist at any point, whatever the
--    size of the tables, and each arm is a single ordered index scan.
--
-- 2. THE PAGE IS NARROWED BEFORE IT IS WIDENED.
--    `page` selects only the keys and the columns that are not on the build
--    row. The joins that turn a key into a card — the creator, the cover, the
--    reproducer — then run over at most fifty rows, as primary key probes.
--    MATERIALIZED is load-bearing here: a CTE referenced once is inlined by
--    default, and an inlined one lets the planner push those joins back inside
--    the union, which is the plan this shape exists to avoid.
--
-- THE ORDER BY IS DELIBERATELY DIFFERENT IN THE TWO HALVES. Inside `page` it
-- is item_at alone, because that is the order the three indexes deliver and
-- any extra key would cost each arm its index scan. Outside, over the fifty
-- rows that survived, the tie-break keys cost nothing and make a tie render in
-- the same order twice running, which is what keeps React's list keys stable.
--
-- THE TIE THIS DOES NOT BREAK, stated plainly: two items sharing an item_at to
-- the microsecond across a page boundary means the second is not returned,
-- because the predicate is strictly `<`. A tuple cursor ((item_at, build_id) <
-- (before, last_id)) would close it, and is what to reach for if seeded or
-- imported data ever puts many rows on one timestamp. Live rows get their
-- timestamps from now() at different moments, so the case is theoretical.
--
-- EVERY COLUMN REFERENCE IN THE BODY IS QUALIFIED, and the two parameters are
-- qualified with the function's own name. RETURNS TABLE columns are OUT
-- parameters and are in scope in the body, so a bare `title` or `status` in
-- here is an ambiguity waiting to become a runtime error the first time
-- somebody edits it. Qualifying everything makes that impossible rather than
-- unlikely.
--
-- WHY THE RETURNED TABLE IS WIDER THAN "the feed row"
-- The Builds tab renders the SAME component the gallery renders, and that
-- component reads more of a build than an id and a title: the freshness line
-- under the title reads last_confirmed_at and last_confirmed_model, the PICKED
-- badge reads status, the tag row reads made_for, and the body leads with the
-- cover image. Those are returned here so a card costs no query of its own —
-- which is the entire point of the function. The cover is returned as its
-- bucket/path/kind/poster_path rather than as its id alone, because an id
-- cannot be signed: build-media is a private bucket and the browser needs the
-- path to ask for a URL. cover_media_id is returned beside them because
-- resolveCover() takes it as its first link.
--
-- repro_worked is returned for a narrower reason: build_reproductions records
-- both outcomes, the feed strip says "worked on <model>", and a strip that
-- said that over a reproduction whose `worked` is false would print a
-- falsehood about a named person's experience. The row set is every non-empty
-- note, exactly as specified; the flag is what lets the strip tell the truth
-- about each one.
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
  repro_worked          BOOLEAN
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
    -- once here rather than written out four times below, so the four limits
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
      u.repro_worked
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
          NULL::BOOLEAN   AS repro_worked
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
      -- Its own arm rather than a CASE over the arm above, because the two
      -- render as different things and because NS-P52 adds a fourth arm
      -- beside them: a shape that takes one more UNION arm cleanly is worth
      -- more here than four saved lines.
      (
        SELECT
          'rebuild'::TEXT AS item_kind,
          b.published_at  AS item_at,
          b.id            AS build_id,
          NULL::TEXT      AS repro_note,
          NULL::TEXT      AS repro_model,
          NULL::UUID      AS repro_user_id,
          NULL::BOOLEAN   AS repro_worked
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
      -- An empty note is not a note. A reproduction with nothing written on
      -- it is a tick on the build's counter and has already been counted
      -- there; it is not a thing to read, and putting it in a feed as one
      -- would fill the feed with rows that say nothing.
      --
      -- The build test is an EXISTS rather than a join so that this arm stays
      -- a single ordered index scan over build_reproductions with a primary
      -- key probe as its filter. Joining here would cost the arm its ordering
      -- and with it the early stop.
      (
        SELECT
          'repro_note'::TEXT AS item_kind,
          r.confirmed_at     AS item_at,
          r.build_id         AS build_id,
          r.note             AS repro_note,
          r.model_used       AS repro_model,
          r.user_id          AS repro_user_id,
          r.worked           AS repro_worked
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
    ) u
    -- item_at alone: the order the three arms already arrive in.
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
    page.repro_worked
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
  -- take the note off the feed. The strip renders "someone" for a missing
  -- handle, the same fallback rebuildDisplay.ts already makes.
  LEFT JOIN public.profiles rp
    ON rp.id = page.repro_user_id
  ORDER BY page.item_at DESC, page.build_id DESC, page.item_kind DESC;
$$;

COMMENT ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT) IS
  'The new-path home feed: published builds, rebuilds and noted reproductions as one ordered page, newest first, keyset-paged on item_at. SECURITY INVOKER — every row is one the caller could have read for themselves. Consumed by src/lib/feed/getBuildFeed.ts.';


-- =============================================================================
-- 3. Grants
-- =============================================================================
-- Anonymous readers get the feed, which is the point: the Builds tab is the
-- first thing a signed-out visitor sees, and RLS is what keeps it honest
-- rather than the grant. Nothing is revoked from PUBLIC here for the same
-- reason gallery_facets revokes nothing: a SECURITY INVOKER function returns
-- only rows the caller's own policies already admit, so EXECUTE on it confers
-- no read that a direct SELECT would not.
GRANT EXECUTE ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT)
  TO anon, authenticated;
