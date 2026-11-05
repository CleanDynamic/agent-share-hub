-- UX-09 P3: a draft made inside a reply remembers the topic it was made for.
--
-- builds.made_for_topic_id  uuid NULL  the topic (a root openbuild_posts row) a step tile's draft was made in, set once by the
--                                      reply box's path (makeReplyDraft, UX-06 Part 3) and written by nothing else. Drafts shows
--                                      "For @maya's topic" under such a draft.
--
-- ON DELETE SET NULL: a deleted topic leaves the draft, which then shows no line. The column is the maker's own, on their own
-- draft: the existing builds update policy (the creator only) already covers the write, so no policy changes. The app writes it
-- with a separate update that it lets fail, and reads it beside the drafts list: until this file is applied both say so once and
-- the reply and Drafts work as they did.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied (paste the plan back):
--   Drafts' read of the topic lines, for one maker:
--     EXPLAIN (ANALYZE, BUFFERS) SELECT id, made_for_topic_id FROM public.builds
--      WHERE creator_id = '<a maker with drafts>' AND status = 'draft' AND made_for_topic_id IS NOT NULL LIMIT 50;
--   SHOULD SHOW: an Index Scan on idx_builds_made_for_topic (or the existing creator index with a filter on the few rows it
--   returns), no Seq Scan on builds.

ALTER TABLE public.builds
  ADD COLUMN IF NOT EXISTS made_for_topic_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'builds_made_for_topic_id_fkey' AND conrelid = 'public.builds'::regclass
  ) THEN
    ALTER TABLE public.builds
      ADD CONSTRAINT builds_made_for_topic_id_fkey
      FOREIGN KEY (made_for_topic_id) REFERENCES public.openbuild_posts(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- Almost no build has one: a partial index serves Drafts' read and the cascade when a topic is deleted.
CREATE INDEX IF NOT EXISTS idx_builds_made_for_topic
  ON public.builds (creator_id, made_for_topic_id)
  WHERE made_for_topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_builds_made_for_topic_fk
  ON public.builds (made_for_topic_id)
  WHERE made_for_topic_id IS NOT NULL;

COMMENT ON COLUMN public.builds.made_for_topic_id IS
  'UX-09 P3. The topic a step tile''s draft was made in (the reply box, UX-06 Part 3). Set once on that path; nothing else writes it.';
