-- SV-22 Part 1: briefs.
--
-- builds.is_brief marks a published build as a brief: the maker's list of open steps that people answer with a rebuild of their
-- own. Its answers are its rebuilds (builds.parent_build_id), so nothing else is stored. The maker (or an admin) sets it through
-- the builds update policy that already exists; no new policy is added and nothing here widens one.
--
-- Correct whether or not the column or the index already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. OpenBuilds' Briefs tab:
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT id, slug, title, creator_id, published_at FROM public.builds
--      WHERE is_brief AND status IN ('published', 'gallery') ORDER BY published_at DESC, id DESC LIMIT 21;
--      SHOULD SHOW: an Index Scan on idx_builds_briefs, no Sort, no Seq Scan on builds.
--   2. The answers of a page of briefs (the existing partial index on parent_build_id):
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT parent_build_id, id, slug, title, created_at, reproduction_count FROM public.builds
--      WHERE parent_build_id = ANY (ARRAY['<a brief id>']::uuid[]) AND status IN ('published', 'gallery')
--      ORDER BY created_at DESC LIMIT 100;
--      SHOULD SHOW: an Index Scan on the parent_build_id index, no Seq Scan on builds.

ALTER TABLE public.builds ADD COLUMN IF NOT EXISTS is_brief boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_builds_briefs
  ON public.builds (published_at DESC, id DESC)
  WHERE is_brief AND status IN ('published', 'gallery');