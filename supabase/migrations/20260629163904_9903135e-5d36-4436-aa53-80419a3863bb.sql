
-- 1. user_badges table for ambient badge stream
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key text NOT NULL,
  state text NOT NULL DEFAULT 'earned' CHECK (state IN ('pending_reveal','earned','revealed')),
  title text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  earned_at timestamptz NOT NULL DEFAULT now(),
  revealed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_badges_select_own"
  ON public.user_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_badges_update_own_reveal"
  ON public.user_badges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_badges_user_state ON public.user_badges (user_id, state, earned_at DESC);

CREATE TRIGGER trg_user_badges_updated_at
  BEFORE UPDATE ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Welcome XP flag on user_progress (DB-backed, not localStorage)
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS welcome_xp_shown_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_welcome_xp_shown()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ts timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.user_progress (user_id) VALUES (auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.user_progress
     SET welcome_xp_shown_at = COALESCE(welcome_xp_shown_at, now())
   WHERE user_id = auth.uid()
   RETURNING welcome_xp_shown_at INTO _ts;
  RETURN _ts;
END;
$$;

-- 3. Realtime publication for ambient toasts
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_badges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.xp_events;
