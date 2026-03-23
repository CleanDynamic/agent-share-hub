-- ══════════════════════════════════════════════════════════════
-- BOUNTY SYSTEM MIGRATION
-- ══════════════════════════════════════════════════════════════

-- ─── 1. New columns on content_items ────────────────────────

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS bounty_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bounty_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS bounty_tip_gbp numeric,
  ADD COLUMN IF NOT EXISTS bounty_solved_response_id uuid,
  ADD COLUMN IF NOT EXISTS bounty_me_too_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounty_closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounty_gap text;

-- ─── 2. New column on profiles ──────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bounties_solved integer NOT NULL DEFAULT 0;

-- ─── 3. bounty_responses ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bounty_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blueprint_content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE,
  inline_title text,
  inline_blocks jsonb,
  how_it_fixes text NOT NULL,
  tested_on text[],
  upvotes integer NOT NULL DEFAULT 0,
  verified_count integer NOT NULL DEFAULT 0,
  is_solution boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bounty_content_id, responder_id),
  CONSTRAINT how_it_fixes_max_length CHECK (char_length(how_it_fixes) <= 280),
  CONSTRAINT inline_title_max_length CHECK (char_length(inline_title) <= 120)
);

-- Score as a generated column
ALTER TABLE public.bounty_responses
  ADD COLUMN IF NOT EXISTS score numeric GENERATED ALWAYS AS (
    (CASE WHEN is_solution THEN 100 ELSE 0 END)
    + (verified_count * 10)
    + (upvotes * 3)
    - (EXTRACT(EPOCH FROM (now() - created_at)) / 86400 * 0.5)
  ) STORED;

-- ─── 4. bounty_me_too ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bounty_me_too (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_id, user_id)
);

-- ─── 5. bounty_response_verifications ───────────────────────

CREATE TABLE IF NOT EXISTS public.bounty_response_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.bounty_responses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(response_id, user_id)
);

-- ─── 6. RLS ─────────────────────────────────────────────────

ALTER TABLE public.bounty_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_me_too ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_response_verifications ENABLE ROW LEVEL SECURITY;

-- bounty_responses policies
CREATE POLICY "bounty_responses_public_select"
  ON public.bounty_responses FOR SELECT USING (true);

CREATE POLICY "bounty_responses_auth_insert"
  ON public.bounty_responses FOR INSERT
  WITH CHECK (auth.uid() = responder_id);

CREATE POLICY "bounty_responses_responder_update"
  ON public.bounty_responses FOR UPDATE
  USING (auth.uid() = responder_id)
  WITH CHECK (auth.uid() = responder_id);

CREATE POLICY "bounty_responses_responder_delete"
  ON public.bounty_responses FOR DELETE
  USING (auth.uid() = responder_id);

-- Allow bounty poster to update is_solution
CREATE POLICY "bounty_responses_poster_mark_solution"
  ON public.bounty_responses FOR UPDATE
  USING (
    auth.uid() = (
      SELECT creator_id FROM public.content_items WHERE id = bounty_content_id
    )
  );

-- bounty_me_too policies
CREATE POLICY "bounty_me_too_public_select"
  ON public.bounty_me_too FOR SELECT USING (true);

CREATE POLICY "bounty_me_too_auth_insert"
  ON public.bounty_me_too FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bounty_me_too_auth_delete"
  ON public.bounty_me_too FOR DELETE
  USING (auth.uid() = user_id);

-- bounty_response_verifications policies
CREATE POLICY "bounty_verifications_public_select"
  ON public.bounty_response_verifications FOR SELECT USING (true);

CREATE POLICY "bounty_verifications_auth_insert"
  ON public.bounty_response_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bounty_verifications_auth_delete"
  ON public.bounty_response_verifications FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 7. Triggers ────────────────────────────────────────────

-- Update verified_count on bounty_responses when verifications change
CREATE OR REPLACE FUNCTION public.update_bounty_verified_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _response_id uuid;
BEGIN
  _response_id := COALESCE(NEW.response_id, OLD.response_id);
  UPDATE public.bounty_responses
    SET verified_count = (
      SELECT COUNT(*) FROM public.bounty_response_verifications
      WHERE response_id = _response_id
    )
  WHERE id = _response_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_bounty_verified_count ON public.bounty_response_verifications;
CREATE TRIGGER trg_update_bounty_verified_count
  AFTER INSERT OR DELETE ON public.bounty_response_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_bounty_verified_count();

-- Update bounty_me_too_count on content_items when me_too rows change
CREATE OR REPLACE FUNCTION public.update_bounty_me_too_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _content_id uuid;
BEGIN
  _content_id := COALESCE(NEW.content_id, OLD.content_id);
  UPDATE public.content_items
    SET bounty_me_too_count = (
      SELECT COUNT(*) FROM public.bounty_me_too
      WHERE content_id = _content_id
    )
  WHERE id = _content_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_bounty_me_too_count ON public.bounty_me_too;
CREATE TRIGGER trg_update_bounty_me_too_count
  AFTER INSERT OR DELETE ON public.bounty_me_too
  FOR EACH ROW EXECUTE FUNCTION public.update_bounty_me_too_count();

-- Update bounty_status and bounty_solved_response_id when is_solution flips to true
CREATE OR REPLACE FUNCTION public.update_bounty_status_on_solution()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_solution = true AND (OLD.is_solution IS DISTINCT FROM true) THEN
    UPDATE public.content_items
      SET bounty_status = 'solved',
          bounty_solved_response_id = NEW.id
    WHERE id = NEW.bounty_content_id;

    -- Increment responder's bounties_solved count
    UPDATE public.profiles
      SET bounties_solved = bounties_solved + 1
    WHERE id = NEW.responder_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_bounty_status_on_solution ON public.bounty_responses;
CREATE TRIGGER trg_update_bounty_status_on_solution
  AFTER UPDATE ON public.bounty_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_bounty_status_on_solution();

-- ─── 8. Indexes ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bounty_responses_bounty_content_id
  ON public.bounty_responses(bounty_content_id);

CREATE INDEX IF NOT EXISTS idx_bounty_responses_responder_id
  ON public.bounty_responses(responder_id);

CREATE INDEX IF NOT EXISTS idx_bounty_me_too_content_id
  ON public.bounty_me_too(content_id);

CREATE INDEX IF NOT EXISTS idx_bounty_me_too_user_id
  ON public.bounty_me_too(user_id);

CREATE INDEX IF NOT EXISTS idx_bounty_verifications_response_id
  ON public.bounty_response_verifications(response_id);

CREATE INDEX IF NOT EXISTS idx_content_items_bounty_enabled
  ON public.content_items(bounty_enabled) WHERE bounty_enabled = true;
