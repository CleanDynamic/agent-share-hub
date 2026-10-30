-- SV-22 Part 3: reviews and the weekly goal.
--
-- builds.in_review / builds.in_review_since: a maker puts a published build in review; Builds (listGallery, its counts and the
-- table) leave it out until the maker ends the review. The build page stays open to anyone with the link, and its runs and
-- step comments are the review. Set by the maker (or an admin) through the builds update policy that already exists; nothing
-- here widens it.
--
-- site_challenges: site-wide challenges, one row each. The row 'weekly-requests-closed' holds the goal for the number of
-- requests closed (bounties.status = 'solved') since Monday 00:00 UTC, counted by the page from bounties.solved_at. Anyone
-- reads; only admins write (public.is_admin, the check the builds policies use).
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. OpenBuilds' Reviews tab:
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT id, slug, title, in_review_since FROM public.builds
--      WHERE in_review AND status IN ('published', 'gallery') ORDER BY in_review_since DESC, id DESC LIMIT 11;
--      SHOULD SHOW: an Index Scan on idx_builds_in_review, no Sort, no Seq Scan on builds.
--   2. The week's goal count:
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT count(*) FROM public.bounties WHERE status = 'solved' AND solved_at >= date_trunc('week', now()) AND build_id IS NOT NULL;
--      SHOULD SHOW: an Index Only or Index Scan on idx_bounties_solved_at, no Seq Scan on bounties.
--   3. The step comments of a page of reviews:
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT build_id FROM public.build_comments
--      WHERE build_id = ANY (ARRAY['<an in-review build id>']::uuid[]) AND node_id IS NOT NULL AND NOT is_hidden LIMIT 500;
--      SHOULD SHOW: an Index Scan on idx_build_comments_build_created, no Seq Scan on build_comments.

ALTER TABLE public.builds ADD COLUMN IF NOT EXISTS in_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.builds ADD COLUMN IF NOT EXISTS in_review_since timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_builds_in_review
  ON public.builds (in_review_since DESC, id DESC)
  WHERE in_review AND status IN ('published', 'gallery');

CREATE INDEX IF NOT EXISTS idx_bounties_solved_at
  ON public.bounties (solved_at)
  WHERE status = 'solved';

CREATE TABLE IF NOT EXISTS public.site_challenges (
  slug       text PRIMARY KEY CHECK (char_length(slug) BETWEEN 1 AND 80),
  title      text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  goal       integer NOT NULL CHECK (goal > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads site challenges" ON public.site_challenges;
CREATE POLICY "Anyone reads site challenges" ON public.site_challenges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins add site challenges" ON public.site_challenges;
CREATE POLICY "Admins add site challenges" ON public.site_challenges FOR INSERT WITH CHECK (public.is_admin((select auth.uid())));

DROP POLICY IF EXISTS "Admins edit site challenges" ON public.site_challenges;
CREATE POLICY "Admins edit site challenges" ON public.site_challenges FOR UPDATE
  USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));

DROP POLICY IF EXISTS "Admins remove site challenges" ON public.site_challenges;
CREATE POLICY "Admins remove site challenges" ON public.site_challenges FOR DELETE USING (public.is_admin((select auth.uid())));

REVOKE ALL ON public.site_challenges FROM anon, authenticated, service_role;
GRANT SELECT ON public.site_challenges TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_challenges TO authenticated;
GRANT ALL ON public.site_challenges TO service_role;
