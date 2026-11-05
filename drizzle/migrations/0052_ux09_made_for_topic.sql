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

CREATE INDEX IF NOT EXISTS idx_builds_made_for_topic
  ON public.builds (creator_id, made_for_topic_id)
  WHERE made_for_topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_builds_made_for_topic_fk
  ON public.builds (made_for_topic_id)
  WHERE made_for_topic_id IS NOT NULL;

COMMENT ON COLUMN public.builds.made_for_topic_id IS
  'UX-09 P3. The topic a step tile''s draft was made in (the reply box, UX-06 Part 3). Set once on that path; nothing else writes it.';