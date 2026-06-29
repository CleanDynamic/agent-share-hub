
-- ============================================================
-- Extend user_progress with track + depth + streak metrics
-- ============================================================
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS track              TEXT NULL CHECK (track IN ('architect','curator','mentor','explorer')),
  ADD COLUMN IF NOT EXISTS track_xp           BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_respec_at     TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS depth_revealed_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS streak_current     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_best        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freezes_used_month INT NOT NULL DEFAULT 0;

-- streak_days ledger
CREATE TABLE IF NOT EXISTS public.streak_days (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date    DATE NOT NULL,
  kind    TEXT NOT NULL DEFAULT 'active' CHECK (kind IN ('active','frozen')),
  PRIMARY KEY (user_id, date)
);
GRANT SELECT ON public.streak_days TO authenticated;
GRANT ALL ON public.streak_days TO service_role;
ALTER TABLE public.streak_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own streak days" ON public.streak_days FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- post_lineage (referenced by remix lib but missing)
CREATE TABLE IF NOT EXISTS public.post_lineage (
  post_id        UUID PRIMARY KEY REFERENCES public.content_items(id) ON DELETE CASCADE,
  parent_post_id UUID NOT NULL REFERENCES public.content_items(id),
  root_post_id   UUID NOT NULL REFERENCES public.content_items(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_lineage_parent ON public.post_lineage (parent_post_id);
CREATE INDEX IF NOT EXISTS idx_post_lineage_root   ON public.post_lineage (root_post_id);
GRANT SELECT ON public.post_lineage TO authenticated, anon;
GRANT INSERT ON public.post_lineage TO authenticated;
GRANT ALL ON public.post_lineage TO service_role;
ALTER TABLE public.post_lineage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post lineage readable by everyone" ON public.post_lineage FOR SELECT USING (true);
CREATE POLICY "Authors can insert lineage for own posts" ON public.post_lineage FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = post_id AND ci.creator_id = auth.uid()));

-- perks catalogue
CREATE TABLE IF NOT EXISTS public.perks (
  slug         TEXT PRIMARY KEY,
  track        TEXT NOT NULL CHECK (track IN ('architect','curator','mentor','explorer')),
  tier         SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
  effect_key   TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  icon_name    TEXT NOT NULL DEFAULT 'Sparkles',
  is_active    BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT ON public.perks TO authenticated, anon;
GRANT ALL ON public.perks TO service_role;
ALTER TABLE public.perks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perks readable by everyone" ON public.perks FOR SELECT USING (true);

INSERT INTO public.perks (slug, track, tier, effect_key, name, description, icon_name) VALUES
  ('desc_length_1000',     'architect', 1, 'desc_length_1000',     'Long-form descriptions',  'Write post descriptions up to 1000 characters.', 'AlignLeft'),
  ('templates',            'architect', 1, 'templates',            'Starter templates',       'Spin up new posts from curated templates.',      'LayoutTemplate'),
  ('custom_tags_advanced', 'curator',   1, 'custom_tags_advanced', 'Advanced custom tags',    'Add up to 15 custom tags with auto-suggest.',    'Tags'),
  ('advanced_filters',     'explorer',  1, 'advanced_filters',     'Advanced discover filters','Filter Discover by track, perk, and lineage.',  'Filter'),
  ('architect_t2_template','architect', 2, 'architect_t2_template','Remix templates',         'Save your blueprint as a remix template.',       'Layers')
ON CONFLICT (slug) DO NOTHING;

-- user_perks
CREATE TABLE IF NOT EXISTS public.user_perks (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  perk_slug  TEXT NOT NULL REFERENCES public.perks(slug) ON DELETE CASCADE,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, perk_slug)
);
GRANT SELECT ON public.user_perks TO authenticated;
GRANT ALL ON public.user_perks TO service_role;
ALTER TABLE public.user_perks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own perks" ON public.user_perks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_perk(_user_id UUID, _slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_perks WHERE user_id = _user_id AND perk_slug = _slug);
$$;
GRANT EXECUTE ON FUNCTION public.has_perk(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_depth_revealed()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _ts TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.user_progress (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  UPDATE public.user_progress
     SET depth_revealed_at = COALESCE(depth_revealed_at, now())
   WHERE user_id = auth.uid()
   RETURNING depth_revealed_at INTO _ts;
  UPDATE public.user_badges
     SET state = 'earned', revealed_at = COALESCE(revealed_at, now())
   WHERE user_id = auth.uid() AND state = 'pending_reveal';
  RETURN _ts;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_depth_revealed() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_track(_track TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _track NOT IN ('architect','curator','mentor','explorer') THEN
    RAISE EXCEPTION 'Invalid track: %', _track;
  END IF;
  INSERT INTO public.user_progress (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  UPDATE public.user_progress SET track = _track WHERE user_id = auth.uid() AND track IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_user_track(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.respec_track(_track TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _last TIMESTAMPTZ; _now TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _track NOT IN ('architect','curator','mentor','explorer') THEN
    RAISE EXCEPTION 'Invalid track: %', _track;
  END IF;
  SELECT last_respec_at INTO _last FROM public.user_progress WHERE user_id = auth.uid();
  IF _last IS NOT NULL AND _now < _last + INTERVAL '30 days' THEN
    RAISE EXCEPTION 'Respec on cooldown until %', (_last + INTERVAL '30 days');
  END IF;
  UPDATE public.user_progress
     SET track = _track, track_xp = 0, last_respec_at = _now
   WHERE user_id = auth.uid();
  DELETE FROM public.user_perks WHERE user_id = auth.uid();
  RETURN _now;
END;
$$;
GRANT EXECUTE ON FUNCTION public.respec_track(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_visible_surfaces(_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := COALESCE(_user_id, auth.uid());
  _p public.user_progress%ROWTYPE;
  _age_days INT;
  _counters_zero BOOLEAN;
  _quest_completed BOOLEAN;
  _depth_revealed BOOLEAN;
  _tabs JSONB;
  _isnew BOOLEAN;
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
  _depth_revealed := _p.depth_revealed_at IS NOT NULL;
  _isnew := _depth_revealed AND (now() - _p.depth_revealed_at) < INTERVAL '7 days';

  IF _depth_revealed THEN
    _tabs := jsonb_build_array('overview','skill_tree','trophies','challenges','history');
  ELSE
    _tabs := jsonb_build_array('overview','trophies','history');
  END IF;

  RETURN jsonb_build_object(
    'tabs', _tabs,
    'depth_revealed', _depth_revealed,
    'depth_revealed_at', _p.depth_revealed_at,
    'skill_tree_isnew', _isnew,
    'challenges_isnew', _isnew,
    'eligibility_notice', (_p.eligible_at IS NULL OR _p.eligible_at > now()),
    'quest', (NOT _quest_completed) OR (_age_days < 14),
    'daily_nudge', true,
    'next_unlock', true,
    'engagement_grid', NOT (_counters_zero AND _p.level <= 1),
    'empty_state', (_counters_zero AND _p.level <= 1),
    'marks_row', true,
    'showcase', true,
    'ledger', true,
    'level', _p.level,
    'track', _p.track,
    'last_respec_at', _p.last_respec_at
  );
END $$;

CREATE OR REPLACE FUNCTION public.record_daily_activity()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
  _p public.user_progress%ROWTYPE;
  _milestone INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.user_progress (user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT * INTO _p FROM public.user_progress WHERE user_id = _uid;
  IF _p.last_active_date = _today THEN
    RETURN jsonb_build_object('changed', false, 'streak_current', _p.streak_current);
  END IF;
  INSERT INTO public.streak_days (user_id, date, kind) VALUES (_uid, _today, 'active')
    ON CONFLICT DO NOTHING;
  IF _p.last_active_date = _today - 1 THEN
    UPDATE public.user_progress
       SET streak_current = streak_current + 1,
           streak_best = GREATEST(streak_best, streak_current + 1),
           last_active_date = _today
     WHERE user_id = _uid RETURNING * INTO _p;
  ELSE
    UPDATE public.user_progress
       SET streak_current = 1,
           streak_best = GREATEST(streak_best, 1),
           last_active_date = _today
     WHERE user_id = _uid RETURNING * INTO _p;
  END IF;
  _milestone := CASE WHEN _p.streak_current IN (3,7,14,30,60,100) THEN _p.streak_current ELSE NULL END;
  IF _milestone IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, actor_id, notification_type, metadata)
      VALUES (_uid, _uid, 'streak_milestone', jsonb_build_object('days', _milestone));
  END IF;
  RETURN jsonb_build_object('changed', true, 'streak_current', _p.streak_current, 'milestone', _milestone);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_daily_activity() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_post_lineage(_root_id UUID)
RETURNS TABLE(post_id UUID, parent_post_id UUID, root_post_id UUID, title TEXT, slug TEXT, creator_id UUID, depth INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT ci.id::uuid AS post_id, NULL::uuid AS parent_post_id, ci.id::uuid AS root_post_id,
           ci.title::text, ci.slug::text, ci.creator_id::uuid, 0 AS depth
      FROM public.content_items ci WHERE ci.id = _root_id
    UNION ALL
    SELECT ci.id::uuid, pl.parent_post_id::uuid, pl.root_post_id::uuid,
           ci.title::text, ci.slug::text, ci.creator_id::uuid, t.depth + 1
      FROM public.post_lineage pl
      JOIN public.content_items ci ON ci.id = pl.post_id
      JOIN tree t ON t.post_id = pl.parent_post_id
     WHERE t.depth < 10
  )
  SELECT * FROM tree;
$$;
GRANT EXECUTE ON FUNCTION public.get_post_lineage(UUID) TO authenticated, anon;
