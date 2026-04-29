-- 1. New profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS level           text    NOT NULL DEFAULT 'reader',
  ADD COLUMN IF NOT EXISTS derived_bio     text,
  ADD COLUMN IF NOT EXISTS last_derived_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_level_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_level_check
      CHECK (level IN ('reader','builder','creator','curator'));
  END IF;
END $$;

-- 2. profile_stats materialized view (per-user aggregates)
DROP MATERIALIZED VIEW IF EXISTS public.profile_stats;
CREATE MATERIALIZED VIEW public.profile_stats AS
SELECT
  p.id AS user_id,
  COALESCE(SUM(ci.view_count), 0)::bigint                                             AS total_views,
  COUNT(*) FILTER (WHERE ci.post_type = 'blueprint' AND ci.status = 'approved')::bigint AS blueprints_count,
  COUNT(*) FILTER (WHERE ci.post_type = 'blog'      AND ci.status = 'approved')::bigint AS blogs_count,
  COUNT(*) FILTER (WHERE ci.post_type = 'bounty'    AND ci.status = 'approved')::bigint AS bounties_posted,
  COUNT(*) FILTER (WHERE ci.post_type = 'bounty'    AND ci.bounty_status = 'solved')::bigint AS bounties_solved,
  COALESCE(AVG(NULLIF(ci.estimated_reading_minutes, 0)), 0)::numeric(10,2)            AS avg_reading_minutes
FROM public.profiles p
LEFT JOIN public.content_items ci
  ON ci.creator_id = p.id
GROUP BY p.id;

CREATE UNIQUE INDEX IF NOT EXISTS profile_stats_user_id_idx
  ON public.profile_stats (user_id);

-- 3. Backfill `level` based on approved blueprint counts
UPDATE public.profiles SET level = 'reader';
UPDATE public.profiles
SET level = 'builder'
WHERE id IN (
  SELECT creator_id FROM public.content_items
  WHERE post_type = 'blueprint' AND status = 'approved'
  GROUP BY creator_id
);
UPDATE public.profiles
SET level = 'creator'
WHERE id IN (
  SELECT creator_id FROM public.content_items
  WHERE post_type = 'blueprint' AND status = 'approved'
  GROUP BY creator_id HAVING COUNT(*) >= 5
);
UPDATE public.profiles
SET level = 'curator'
WHERE id IN (SELECT user_id FROM public.curators WHERE is_active = true);