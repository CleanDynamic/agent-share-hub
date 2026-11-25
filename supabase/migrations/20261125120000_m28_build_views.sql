-- =============================================================================
-- Mobile 28 D — how many people have looked at a build, for the maker's progress
-- =============================================================================
-- WHAT IT ADDS. Builds had no view count: post_view_log and
-- increment_content_view_count belong to the legacy content_items posts. The
-- phone's Your progress shows each build's Views beside Rebuilds, Likes and
-- Saved, so builds get their own:
--
--   build_view_counts  one row per build that has been viewed: its total.
--                      Readable by the build's maker only (it is the maker's
--                      analytics, like the progress page itself).
--   build_views        the dedupe ledger: one row per (build, signed-in viewer,
--                      UTC day).
--                      No reader can read or write it; only the function does.
--   record_build_view  the one writer. The build page calls it once a visit.
--
-- WHAT COUNTS AS A VIEW. One per signed-in viewer per UTC day per build, keyed
-- by auth.uid(), so a reload, a back-and-forth or a long session is one view.
-- The maker's own visits do not count, and only published builds ('published'
-- and 'gallery') are counted: a draft is not looked at by the public.
--
-- SIGNED-OUT VISITS ARE NOT COUNTED, on purpose. Telling one signed-out visitor
-- from another would mean keeping an identifier in their browser for counting,
-- which is analytics storage: the privacy text says the site uses none, and
-- UK rules (PECR) would want consent first. Counting them is a decision for
-- the owner, with a consent step, not something this migration does.
--
-- WHY A TABLE OF ITS OWN AND NOT builds.view_count. The like, save and comment
-- counters live on builds and their UPDATEs move builds.updated_at through
-- trg_builds_updated_at. Views arrive far more often than likes: on builds
-- they would keep rewriting the row and its updated_at for every visit, and
-- every visit would take the build row's lock. A separate counter row keeps
-- builds untouched. The progress page still reads it in the same request, as
-- a PostgREST embed along build_view_counts.build_id -> builds.id.
--
-- COUNTS ARE INCREMENTED, NOT RECOUNTED: the ledger insert and the counter
-- upsert happen in one statement chain inside the function, and the counter
-- only moves when the ledger insert actually added a row (ON CONFLICT DO
-- NOTHING returns nothing for a repeat).
--
-- SECURITY. record_build_view is SECURITY DEFINER with an empty search_path and
-- schema-qualified names ⟦references/security-privileges.md⟧: a reader may not
-- write either table directly. EXECUTE is revoked from PUBLIC and granted to
-- authenticated only: a signed-out caller has nothing to be counted by. Both tables have RLS
-- on, and their default grants are revoked before the one grant they need:
-- authenticated may SELECT build_view_counts, and the policy limits that to the
-- builds the caller made, reading the caller as (select auth.uid())
-- ⟦references/security-rls-performance.md⟧.
--
-- SIZE. build_views keeps one small row per viewer, day and build. Only the
-- current day's rows are needed for the dedupe; rows older than two days can be
-- deleted at any time without changing a count (no job is added here).
-- =============================================================================


-- a. build_view_counts --------------------------------------------------------
-- The primary key is the foreign key, which also indexes it for the embed and
-- for ON DELETE CASCADE from builds ⟦references/schema-foreign-key-indexes.md⟧.
CREATE TABLE IF NOT EXISTS public.build_view_counts (
  build_id   uuid        PRIMARY KEY REFERENCES public.builds(id) ON DELETE CASCADE,
  views      bigint      NOT NULL DEFAULT 0 CHECK (views >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.build_view_counts IS
  'Mobile 28. Views of a build: one per viewer per UTC day, the maker''s own visits left out. Written only by record_build_view; readable by the build''s maker.';


-- b. build_views --------------------------------------------------------------
-- The primary key serves the dedupe insert and the cascade from builds; the
-- viewer's own index serves the cascade from auth.users
-- ⟦references/schema-foreign-key-indexes.md⟧.
CREATE TABLE IF NOT EXISTS public.build_views (
  build_id  uuid NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day       date NOT NULL,
  PRIMARY KEY (build_id, viewer_id, day)
);

CREATE INDEX IF NOT EXISTS idx_build_views_viewer
  ON public.build_views (viewer_id);

COMMENT ON TABLE public.build_views IS
  'Mobile 28. The dedupe ledger behind build_view_counts: one row per (build, signed-in viewer, UTC day). Not readable or writable by any reader.';


-- c. row-level security and grants --------------------------------------------
ALTER TABLE public.build_view_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_views       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.build_view_counts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.build_views       FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.build_view_counts TO authenticated;

DROP POLICY IF EXISTS "Makers read their builds' views" ON public.build_view_counts;
CREATE POLICY "Makers read their builds' views"
  ON public.build_view_counts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.builds b
     WHERE b.id = build_view_counts.build_id
       AND b.creator_id = (select auth.uid())
  ));


-- d. record_build_view --------------------------------------------------------
-- Returns true when this call counted a view, false when it did not (a repeat
-- today, the maker, a draft, an unknown build, or nobody signed in).
CREATE OR REPLACE FUNCTION public.record_build_view(p_build uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid     uuid := (select auth.uid());
  _creator uuid;
  _added   integer;
BEGIN
  IF p_build IS NULL OR _uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT b.creator_id INTO _creator
    FROM public.builds b
   WHERE b.id = p_build
     AND b.status IN ('published', 'gallery');
  IF NOT FOUND OR _creator = _uid THEN
    RETURN false;
  END IF;

  INSERT INTO public.build_views (build_id, viewer_id, day)
  VALUES (p_build, _uid, (now() AT TIME ZONE 'UTC')::date)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _added = ROW_COUNT;
  IF _added = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.build_view_counts AS c (build_id, views, updated_at)
  VALUES (p_build, 1, now())
  ON CONFLICT (build_id) DO UPDATE
    SET views = c.views + 1,
        updated_at = now();
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.record_build_view(uuid) IS
  'Mobile 28. Counts one view of a published build by a signed-in reader: once per reader per UTC day, never the maker. The build page calls it once a visit.';

REVOKE EXECUTE ON FUNCTION public.record_build_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_build_view(uuid) TO authenticated;
