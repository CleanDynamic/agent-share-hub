
-- =========================================================
-- USER PROGRESS CORE
-- =========================================================
CREATE TABLE public.user_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp_total INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  eligible_at TIMESTAMPTZ,
  counters JSONB NOT NULL DEFAULT '{"saves":0,"comments":0,"publishes":0,"returns":0,"reblogs":0,"likes":0,"follows":0,"views":0}'::jsonb,
  quest_state JSONB NOT NULL DEFAULT '{"steps":{"verify-email":false,"complete-profile":false,"first-save":false,"first-comment":false,"first-publish":false,"first-nudge":false,"return-tomorrow":false},"completed_at":null}'::jsonb,
  last_active_date DATE,
  streak_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_progress TO authenticated;
GRANT ALL ON public.user_progress TO service_role;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_progress" ON public.user_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_update_own_progress" ON public.user_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_insert_own_progress" ON public.user_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- XP EVENTS (ledger)
-- =========================================================
CREATE TABLE public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT,
  source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_xp_events_user_created ON public.xp_events(user_id, created_at DESC);
GRANT SELECT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_xp_events" ON public.xp_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- CREATOR MARKS
-- =========================================================
CREATE TABLE public.creator_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mark_key TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pinned BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, mark_key)
);
CREATE INDEX idx_creator_marks_user ON public.creator_marks(user_id, earned_at DESC);
GRANT SELECT ON public.creator_marks TO anon, authenticated;
GRANT UPDATE ON public.creator_marks TO authenticated;
GRANT ALL ON public.creator_marks TO service_role;
ALTER TABLE public.creator_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator_marks_public_read" ON public.creator_marks FOR SELECT USING (true);
CREATE POLICY "creator_marks_owner_update" ON public.creator_marks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- DAILY CHALLENGES
-- =========================================================
CREATE TABLE public.daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target INTEGER NOT NULL DEFAULT 1,
  progress INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  claimed BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('day', now()) + interval '1 day'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_daily_challenges_user_expires ON public.daily_challenges(user_id, expires_at DESC);
GRANT SELECT, UPDATE ON public.daily_challenges TO authenticated;
GRANT ALL ON public.daily_challenges TO service_role;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_daily" ON public.daily_challenges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_update_own_daily" ON public.daily_challenges FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- CHALLENGE HISTORY
-- =========================================================
CREATE TABLE public.challenge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_key TEXT NOT NULL,
  title TEXT,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_challenge_history_user_completed ON public.challenge_history(user_id, completed_at DESC);
GRANT SELECT ON public.challenge_history TO authenticated;
GRANT ALL ON public.challenge_history TO service_role;
ALTER TABLE public.challenge_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_history" ON public.challenge_history FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- RPCs
-- =========================================================

-- Level math: level = floor((xp/75)^(1/1.7)) + 1, min 1
CREATE OR REPLACE FUNCTION public.calc_level_from_xp(_xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(1, FLOOR(POWER(GREATEST(_xp,0)::numeric / 75.0, 1.0/1.7))::int + 1);
$$;

CREATE OR REPLACE FUNCTION public.award_xp(
  _user_id uuid,
  _amount integer,
  _reason text,
  _source_type text DEFAULT NULL,
  _source_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _old_level int;
  _new_total int;
  _new_level int;
  _eligible_at timestamptz;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.user_progress (user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.xp_events (user_id, amount, reason, source_type, source_id, metadata)
    VALUES (_user_id, _amount, _reason, _source_type, _source_id, _metadata);

  SELECT level, eligible_at INTO _old_level, _eligible_at
    FROM public.user_progress WHERE user_id = _user_id;

  UPDATE public.user_progress
     SET xp_total = xp_total + _amount,
         level = public.calc_level_from_xp(xp_total + _amount),
         eligible_at = COALESCE(eligible_at,
           CASE WHEN xp_total + _amount >= 250 THEN now() ELSE NULL END)
   WHERE user_id = _user_id
   RETURNING xp_total, level, eligible_at INTO _new_total, _new_level, _eligible_at;

  RETURN jsonb_build_object(
    'xp_total', _new_total,
    'level', _new_level,
    'leveled_up', _new_level > _old_level,
    'eligible_at', _eligible_at,
    'awarded', _amount
  );
END $$;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid,integer,text,text,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_challenge(_challenge_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.daily_challenges%ROWTYPE;
  _award jsonb;
BEGIN
  SELECT * INTO _row FROM public.daily_challenges WHERE id = _challenge_id;
  IF NOT FOUND OR _row.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _row.claimed THEN
    RAISE EXCEPTION 'Already claimed';
  END IF;
  IF _row.progress < _row.target THEN
    RAISE EXCEPTION 'Challenge not yet complete';
  END IF;

  UPDATE public.daily_challenges SET claimed = true WHERE id = _challenge_id;

  _award := public.award_xp(_row.user_id, _row.xp_reward, 'challenge:' || _row.challenge_key, 'challenge', _row.id, jsonb_build_object('title', _row.title));

  INSERT INTO public.challenge_history (user_id, challenge_key, title, xp_awarded)
    VALUES (_row.user_id, _row.challenge_key, _row.title, _row.xp_reward);

  RETURN _award;
END $$;
GRANT EXECUTE ON FUNCTION public.claim_challenge(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_quest_state(_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := COALESCE(_user_id, auth.uid());
  _state jsonb;
  _level int;
  _milestone text;
BEGIN
  IF _uid IS NULL THEN RETURN '{}'::jsonb; END IF;
  INSERT INTO public.user_progress (user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT quest_state, level INTO _state, _level FROM public.user_progress WHERE user_id = _uid;
  _milestone := CASE
    WHEN _level < 2 THEN 'Reach Level 2'
    WHEN _level < 3 THEN 'Reach Level 3 — unlock Showcase'
    WHEN _level < 5 THEN 'Reach Level 5 — unlock Trophy Cabinet'
    ELSE 'Keep climbing'
  END;
  RETURN jsonb_build_object(
    'steps', _state->'steps',
    'completed_at', _state->'completed_at',
    'completed', (_state->>'completed_at') IS NOT NULL,
    'next_milestone', _milestone
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_quest_state(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_visible_surfaces(_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := COALESCE(_user_id, auth.uid());
  _p public.user_progress%ROWTYPE;
  _age_days int;
  _counters_zero boolean;
  _quest_completed boolean;
BEGIN
  IF _uid IS NULL THEN RETURN '{}'::jsonb; END IF;
  INSERT INTO public.user_progress (user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT * INTO _p FROM public.user_progress WHERE user_id = _uid;
  _age_days := EXTRACT(DAY FROM (now() - _p.created_at))::int;
  _quest_completed := (_p.quest_state->>'completed_at') IS NOT NULL;
  _counters_zero := COALESCE((_p.counters->>'saves')::int,0)
                  + COALESCE((_p.counters->>'comments')::int,0)
                  + COALESCE((_p.counters->>'publishes')::int,0)
                  + COALESCE((_p.counters->>'reblogs')::int,0) = 0;
  RETURN jsonb_build_object(
    'tabs', jsonb_build_array('overview','trophies','history'),
    'eligibility_notice', (_p.eligible_at IS NULL OR _p.eligible_at > now()),
    'quest', (NOT _quest_completed) OR (_age_days < 14),
    'daily_nudge', true,
    'next_unlock', true,
    'engagement_grid', NOT (_counters_zero AND _p.level <= 1),
    'empty_state', (_counters_zero AND _p.level <= 1),
    'marks_row', true,
    'showcase', true,
    'ledger', true
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_visible_surfaces(uuid) TO authenticated;

-- =========================================================
-- Seed user_progress on signup (extend handle_new_user)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, account_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'user')
  );
  INSERT INTO public.user_progress (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
