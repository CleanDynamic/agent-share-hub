
-- 1. SOLUTIONS
CREATE TABLE public.solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  slot_kind TEXT NOT NULL CHECK (slot_kind IN ('stage','block')),
  slot_id UUID NOT NULL,
  solver_id UUID NOT NULL,
  solver_note TEXT,
  content_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  vote_count INT NOT NULL DEFAULT 0,
  i_would_implement_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft','submitted','accepted','withdrawn')),
  submitted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_solutions_bounty_slot_status ON public.solutions(bounty_id, slot_id, status);
CREATE INDEX idx_solutions_solver_status ON public.solutions(solver_id, status);
CREATE INDEX idx_solutions_bounty_votes ON public.solutions(bounty_id, vote_count DESC);
CREATE UNIQUE INDEX uniq_solutions_one_draft_per_slot
  ON public.solutions(bounty_id, slot_id, solver_id) WHERE status = 'draft';

CREATE OR REPLACE FUNCTION public.validate_solution_bounty()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.content_items
    WHERE id = NEW.bounty_id AND post_type = 'bounty'
  ) THEN
    RAISE EXCEPTION 'solutions.bounty_id must reference a content_item with post_type=bounty';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_solution_bounty
  BEFORE INSERT OR UPDATE OF bounty_id ON public.solutions
  FOR EACH ROW EXECUTE FUNCTION public.validate_solution_bounty();
CREATE TRIGGER trg_solutions_updated_at
  BEFORE UPDATE ON public.solutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 2. SOLUTION_VOTES
CREATE TABLE public.solution_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solution_id UUID NOT NULL REFERENCES public.solutions(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL,
  vote_kind TEXT NOT NULL CHECK (vote_kind IN ('upvote','i_would_implement')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (solution_id, voter_id, vote_kind)
);
CREATE INDEX idx_solution_votes_solution ON public.solution_votes(solution_id);

CREATE OR REPLACE FUNCTION public.handle_solution_vote_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta INT;
  v_kind TEXT;
  v_sid UUID;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    delta := 1; v_kind := NEW.vote_kind; v_sid := NEW.solution_id;
  ELSE
    delta := -1; v_kind := OLD.vote_kind; v_sid := OLD.solution_id;
  END IF;
  IF v_kind = 'upvote' THEN
    UPDATE public.solutions SET vote_count = GREATEST(vote_count + delta, 0) WHERE id = v_sid;
  ELSE
    UPDATE public.solutions SET i_would_implement_count = GREATEST(i_would_implement_count + delta, 0) WHERE id = v_sid;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_solution_vote_ins AFTER INSERT ON public.solution_votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_solution_vote_change();
CREATE TRIGGER trg_solution_vote_del AFTER DELETE ON public.solution_votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_solution_vote_change();

-- 3. SOLUTION_ACCEPTANCE_LOG (append-only)
CREATE TABLE public.solution_acceptance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solution_id UUID NOT NULL REFERENCES public.solutions(id) ON DELETE RESTRICT,
  bounty_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE RESTRICT,
  solver_id UUID NOT NULL,
  bounty_author_id UUID NOT NULL,
  slot_kind TEXT NOT NULL,
  slot_id UUID NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sal_bounty ON public.solution_acceptance_log(bounty_id);
CREATE INDEX idx_sal_solver ON public.solution_acceptance_log(solver_id);
CREATE INDEX idx_sal_slot ON public.solution_acceptance_log(slot_id);

-- 4. BOUNTY_DISCUSSION_COMMENTS
CREATE TABLE public.bounty_discussion_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.bounty_discussion_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  tagged_bounty_author BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bdc_bounty_created ON public.bounty_discussion_comments(bounty_id, created_at);
CREATE INDEX idx_bdc_parent ON public.bounty_discussion_comments(parent_comment_id);
CREATE TRIGGER trg_bdc_updated_at BEFORE UPDATE ON public.bounty_discussion_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 5. BOUNTY_COMMENT_REACTIONS
CREATE TABLE public.bounty_comment_reactions (
  comment_id UUID NOT NULL REFERENCES public.bounty_discussion_comments(id) ON DELETE CASCADE,
  reactor_id UUID NOT NULL,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, reactor_id, reaction)
);

-- 6. BOUNTY_COMMENT_LAST_READ
CREATE TABLE public.bounty_comment_last_read (
  bounty_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bounty_id, user_id)
);

-- 7. SOLUTION_COMMENTS
CREATE TABLE public.solution_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solution_id UUID NOT NULL REFERENCES public.solutions(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.solution_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sc_solution_created ON public.solution_comments(solution_id, created_at);
CREATE INDEX idx_sc_parent ON public.solution_comments(parent_comment_id);
CREATE TRIGGER trg_sc_updated_at BEFORE UPDATE ON public.solution_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 8. content_items columns
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS bounty_solved_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounty_total_slots INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forked_from_solution_id UUID;

-- 10. profiles solver stats
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bounty_solutions_accepted INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounty_solutions_submitted INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounty_solver_acceptance_rate DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS bounty_total_reward_earned NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_trusted_solver BOOLEAN NOT NULL DEFAULT false;

-- 12. Backfill
UPDATE public.content_items ci
SET bounty_total_slots = (
  COALESCE((SELECT count(*) FROM jsonb_each(COALESCE(ci.stage_grids->'stages','{}'::jsonb)) e
            WHERE (e.value->>'is_missing')::boolean IS TRUE),0)
  + COALESCE((SELECT count(*) FROM jsonb_each(COALESCE(ci.stage_grids->'blocks','{}'::jsonb)) e
              WHERE (e.value->>'is_missing')::boolean IS TRUE),0)
)
WHERE ci.post_type = 'bounty';

-- RLS
ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solution_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solution_acceptance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_discussion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_comment_last_read ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solution_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view non-draft solutions on published bounties"
  ON public.solutions FOR SELECT TO public
  USING (status <> 'draft' AND EXISTS (
    SELECT 1 FROM public.content_items ci WHERE ci.id = bounty_id AND ci.status = 'approved'));
CREATE POLICY "Solver can view own solutions"
  ON public.solutions FOR SELECT TO authenticated USING (solver_id = auth.uid());
CREATE POLICY "Bounty author can view solutions"
  ON public.solutions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = bounty_id AND ci.creator_id = auth.uid()));
CREATE POLICY "Solver can insert own solution"
  ON public.solutions FOR INSERT TO authenticated WITH CHECK (solver_id = auth.uid());
CREATE POLICY "Solver can update own solution"
  ON public.solutions FOR UPDATE TO authenticated
  USING (solver_id = auth.uid()) WITH CHECK (solver_id = auth.uid());
CREATE POLICY "Bounty author can accept solutions"
  ON public.solutions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = bounty_id AND ci.creator_id = auth.uid()));
CREATE POLICY "Solver can delete own draft"
  ON public.solutions FOR DELETE TO authenticated
  USING (solver_id = auth.uid() AND status = 'draft');

CREATE POLICY "Public can view votes" ON public.solution_votes FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can vote" ON public.solution_votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid());
CREATE POLICY "Voter can remove own vote" ON public.solution_votes FOR DELETE TO authenticated
  USING (voter_id = auth.uid());

CREATE POLICY "Public can read acceptance log" ON public.solution_acceptance_log
  FOR SELECT TO public USING (true);

CREATE POLICY "Public can read discussion on published bounties"
  ON public.bounty_discussion_comments FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = bounty_id AND ci.status = 'approved'));
CREATE POLICY "Authenticated can post discussion"
  ON public.bounty_discussion_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Author can edit discussion within 5 minutes"
  ON public.bounty_discussion_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND created_at > now() - interval '5 minutes');
CREATE POLICY "Author can delete own discussion"
  ON public.bounty_discussion_comments FOR DELETE TO authenticated USING (author_id = auth.uid());

CREATE POLICY "Public view comment reactions" ON public.bounty_comment_reactions
  FOR SELECT TO public USING (true);
CREATE POLICY "Reactor adds" ON public.bounty_comment_reactions FOR INSERT TO authenticated
  WITH CHECK (reactor_id = auth.uid());
CREATE POLICY "Reactor removes" ON public.bounty_comment_reactions FOR DELETE TO authenticated
  USING (reactor_id = auth.uid());

CREATE POLICY "User manages own last_read" ON public.bounty_comment_last_read
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Public read solution comments on published bounties"
  ON public.solution_comments FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.solutions s JOIN public.content_items ci ON ci.id = s.bounty_id
    WHERE s.id = solution_id AND ci.status = 'approved' AND s.status <> 'draft'));
CREATE POLICY "Authenticated post solution comment"
  ON public.solution_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Solution comment edit within 5 minutes"
  ON public.solution_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND created_at > now() - interval '5 minutes');
CREATE POLICY "Solution comment author delete"
  ON public.solution_comments FOR DELETE TO authenticated USING (author_id = auth.uid());
