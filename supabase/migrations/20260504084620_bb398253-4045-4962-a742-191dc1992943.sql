-- 0. Ensure shared updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. content_items competition columns
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS bounty_total_submissions INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounty_active_solvers INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounty_health_score FLOAT,
  ADD COLUMN IF NOT EXISTS bounty_is_meta BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bounty_meta_parent_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_meta_parent ON public.content_items(bounty_meta_parent_id);
CREATE INDEX IF NOT EXISTS idx_content_items_bounty_health ON public.content_items(bounty_health_score DESC) WHERE post_type = 'bounty';

-- 2. meta_bounty_pledges
CREATE TABLE IF NOT EXISTS public.meta_bounty_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_bounty_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  sub_definition_id UUID,
  pledger_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'GBP',
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pledged' CHECK (status IN ('pledged','released','refunded','cancelled')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_bounty_pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view non-anonymous pledges"
  ON public.meta_bounty_pledges FOR SELECT
  USING (is_anonymous = false OR pledger_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Pledger can insert own pledge"
  ON public.meta_bounty_pledges FOR INSERT
  TO authenticated
  WITH CHECK (pledger_id = auth.uid());

CREATE POLICY "Pledger can update own pledge"
  ON public.meta_bounty_pledges FOR UPDATE
  TO authenticated
  USING (pledger_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pledges_meta_bounty ON public.meta_bounty_pledges(meta_bounty_id);

-- 3. meta_bounty_sub_definitions
CREATE TABLE IF NOT EXISTS public.meta_bounty_sub_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_bounty_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  spawn_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (spawn_threshold_pct > 0 AND spawn_threshold_pct <= 100),
  spawned_bounty_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_bounty_sub_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read sub definitions"
  ON public.meta_bounty_sub_definitions FOR SELECT USING (true);

CREATE POLICY "Meta bounty author can insert sub definitions"
  ON public.meta_bounty_sub_definitions FOR INSERT
  TO authenticated
  WITH CHECK (meta_bounty_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

CREATE POLICY "Meta bounty author can update sub definitions"
  ON public.meta_bounty_sub_definitions FOR UPDATE
  TO authenticated
  USING (meta_bounty_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

CREATE POLICY "Meta bounty author can delete sub definitions"
  ON public.meta_bounty_sub_definitions FOR DELETE
  TO authenticated
  USING (meta_bounty_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

ALTER TABLE public.meta_bounty_pledges
  ADD CONSTRAINT meta_bounty_pledges_sub_def_fkey
  FOREIGN KEY (sub_definition_id) REFERENCES public.meta_bounty_sub_definitions(id) ON DELETE SET NULL;

-- 4. solver_leaderboard_cache
CREATE TABLE IF NOT EXISTS public.solver_leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rank INT NOT NULL,
  submission_count INT NOT NULL DEFAULT 0,
  vote_total INT NOT NULL DEFAULT 0,
  acceptance_count INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bounty_id, user_id)
);
ALTER TABLE public.solver_leaderboard_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read leaderboard cache"
  ON public.solver_leaderboard_cache FOR SELECT USING (true);

CREATE POLICY "Admin can manage leaderboard cache"
  ON public.solver_leaderboard_cache FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_leaderboard_bounty_rank ON public.solver_leaderboard_cache(bounty_id, rank);

-- 5. bounty_author_review
CREATE TABLE IF NOT EXISTS public.bounty_author_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  solution_id UUID NOT NULL,
  author_id UUID NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('shortlisted','rejected','noted')),
  private_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (solution_id, author_id)
);
ALTER TABLE public.bounty_author_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Author can read own review entries"
  ON public.bounty_author_review FOR SELECT
  TO authenticated
  USING (author_id = auth.uid()
         AND bounty_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

CREATE POLICY "Author can insert review on own bounty"
  ON public.bounty_author_review FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid()
              AND bounty_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

CREATE POLICY "Author can update own review entries"
  ON public.bounty_author_review FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Author can delete own review entries"
  ON public.bounty_author_review FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- 6. bounty_deadline_extensions
CREATE TABLE IF NOT EXISTS public.bounty_deadline_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  extended_by UUID NOT NULL,
  previous_deadline TIMESTAMPTZ,
  new_deadline TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bounty_deadline_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read deadline extensions"
  ON public.bounty_deadline_extensions FOR SELECT USING (true);

CREATE POLICY "Bounty author can insert extension"
  ON public.bounty_deadline_extensions FOR INSERT
  TO authenticated
  WITH CHECK (extended_by = auth.uid()
              AND bounty_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_deadline_extensions_bounty ON public.bounty_deadline_extensions(bounty_id);

-- 7. profile lifetime solver columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bounty_lifetime_submissions INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounty_lifetime_acceptances INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounty_lifetime_votes_received INT NOT NULL DEFAULT 0;

-- 8. updated_at triggers
DROP TRIGGER IF EXISTS trg_meta_bounty_pledges_updated ON public.meta_bounty_pledges;
CREATE TRIGGER trg_meta_bounty_pledges_updated
  BEFORE UPDATE ON public.meta_bounty_pledges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_meta_bounty_sub_definitions_updated ON public.meta_bounty_sub_definitions;
CREATE TRIGGER trg_meta_bounty_sub_definitions_updated
  BEFORE UPDATE ON public.meta_bounty_sub_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_bounty_author_review_updated ON public.bounty_author_review;
CREATE TRIGGER trg_bounty_author_review_updated
  BEFORE UPDATE ON public.bounty_author_review
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();