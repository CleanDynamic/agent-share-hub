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