-- =============================================================================
-- SV-01 part 6: who may call the database functions that run as their owner
-- =============================================================================
-- A SECURITY DEFINER function runs with its owner's rights, so row level
-- security does not apply inside it. Each one that writes, or that reads rows
-- that are not public, has to decide for itself who may call it. This migration
-- closes what an audit of the latest definition of every such function in
-- supabase/migrations/ found (design/audits/security/sv-01-before.md):
--
--   1. get_quest_state, get_visible_surfaces took any user id, read that user's
--      progress and created their row if it was missing. Now only the caller's.
--   2. get_post_lineage, callable by anon, returned the titles and slugs of
--      posts that are drafts, private or waiting for review. Now only what the
--      caller could read anyway.
--   3. rc_notify can write a notification to any recipient and was executable
--      by everyone. Only the database's own triggers call it.
--   4. The progress functions that already refuse a caller with no auth.uid()
--      were still executable by anon and PUBLIC. They now are not.
--   5. Every SECURITY DEFINER function in public without a search_path gets one.
--
-- NOT changed, on purpose (reported in the SV-01 report): get_email_by_username
-- (sign in by username needs it before there is a session), the three view and
-- download counters (visitors who are not signed in count), and is_admin,
-- is_thread_admin, is_thread_member, has_perk and can_delete_primitive_comment
-- (row level security policies call them as the reader).
--
-- The live database has drifted from this folder (RULES.md section 8), so
-- every privilege change finds its functions in the catalogue, by name and
-- every overload, and skips a function that is not there. Nothing here drops
-- anything.
--
-- Apply exactly as written. Then run the Supabase security advisor.
-- =============================================================================

-- 1. Own progress only ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_quest_state(_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := COALESCE(_user_id, auth.uid());
  _state jsonb;
  _level int;
  _milestone text;
BEGIN
  -- SV-01: a caller may read their own progress, not somebody else's. The
  -- function runs as its owner and creates the row it reads, so an id that is
  -- not the caller's would have created and read another reader's row.
  IF _user_id IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
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
  -- SV-01: a caller may read their own progress, not somebody else's. The
  -- function runs as its owner and creates the row it reads, so an id that is
  -- not the caller's would have created and read another reader's row.
  IF _user_id IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
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

-- 2. Lineage shows what the reader may see -------------------------------------
-- A post is visible to a reader when it is approved and public, or theirs.
-- Inline SQL, STABLE, so the planner treats it as the expression it is.

CREATE OR REPLACE FUNCTION public.sv01_lineage_visible(_status text, _visibility text, _creator uuid)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT (_status = 'approved' AND COALESCE(_visibility, 'public') = 'public')
      OR (auth.uid() IS NOT NULL AND _creator = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.sv01_lineage_visible(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sv01_lineage_visible(text, text, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_post_lineage(_root_id UUID)
RETURNS TABLE(post_id UUID, parent_post_id UUID, root_post_id UUID, title TEXT, slug TEXT, creator_id UUID, depth INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT ci.id::uuid AS post_id, NULL::uuid AS parent_post_id, ci.id::uuid AS root_post_id,
           ci.title::text, ci.slug::text, ci.creator_id::uuid, 0 AS depth
      FROM public.content_items ci WHERE ci.id = _root_id
       AND (public.sv01_lineage_visible(ci.status, ci.visibility, ci.creator_id))
    UNION ALL
    SELECT ci.id::uuid, pl.parent_post_id::uuid, pl.root_post_id::uuid,
           ci.title::text, ci.slug::text, ci.creator_id::uuid, t.depth + 1
      FROM public.post_lineage pl
      JOIN public.content_items ci ON ci.id = pl.post_id
       AND public.sv01_lineage_visible(ci.status, ci.visibility, ci.creator_id)
      JOIN tree t ON t.post_id = pl.parent_post_id
     WHERE t.depth < 10
  )
  SELECT * FROM tree;
$$;

-- 3 and 4. Who may execute -----------------------------------------------------

DO $$
DECLARE
  _fn record;
BEGIN
  -- Nobody but the database's own triggers (which run as the owner) may write a
  -- notification for somebody else.
  FOR _fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'rc_notify'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', _fn.sig);
  END LOOP;

  -- Functions that already raise 'Not authorized' for a caller with no
  -- auth.uid(): only signed-in readers have any use for them.
  FOR _fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'mark_welcome_xp_shown', 'mark_depth_revealed', 'claim_challenge',
         'record_daily_activity', 'respec_track', 'set_user_track',
         'get_quest_state', 'get_visible_surfaces'
       )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', _fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', _fn.sig);
  END LOOP;
END
$$;

-- 5. A search_path on every SECURITY DEFINER function that has none -------------
-- Extension-owned functions are left alone.

DO $$
DECLARE
  _fn record;
BEGIN
  FOR _fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND NOT EXISTS (
         SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS c WHERE c LIKE 'search_path=%'
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
       )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', _fn.sig);
  END LOOP;
END
$$;
