-- =============================================================================
-- CA-29 Part 6 — who can execute a SECURITY DEFINER function in public
-- =============================================================================
-- A function created in public is open to PUBLIC and, on this project, to anon
-- too (the default privileges grant it), whatever a later GRANT adds. This
-- migration takes that access away where the function is only for a signed-in
-- reader or only for the database itself, and sets the one thing a definer
-- function must always set. It changes no function that is already safe.
--
-- WHAT IT DOES, in four steps. Each finds its functions in pg_proc when it runs,
-- not from the repository: the live database has drifted from the migration
-- files before (20260323000001_bounty_system.sql was never applied), and an
-- overload this file does not know about must not be left open.
--
--   1. Signed-in-only functions. Each checks auth.uid() itself, so a signed-out
--      call already does nothing; this stops anon reaching them at all. EXECUTE
--      is revoked from PUBLIC and anon and granted to authenticated.
--        claim_challenge, mark_depth_revealed, mark_welcome_xp_shown,
--        record_daily_activity, respec_track, set_user_track,
--        soft_delete_primitive_comment, resolve_report, get_quest_state
--
--   2. get_quest_state(_user_id) answered ANY user id for ANY caller, signed in
--      or not, and wrote a user_progress row for it. Nothing in src calls it
--      with another reader's id. It now refuses a _user_id that is not the
--      caller's own, and is otherwise identical. (Its grants are step 1.)
--
--   3. Trigger functions that are SECURITY DEFINER. A trigger function cannot
--      be called by RPC, and EXECUTE is checked when a trigger is created, not
--      when it fires, so revoking it from the API roles changes nothing for the
--      triggers and removes them from the advisor's list.
--
--   4. Every SECURITY DEFINER function in public without a search_path setting
--      gets `SET search_path = public`. The two bounty triggers in
--      20260323000001_bounty_system.sql lack one; the pass also catches
--      anything the live database holds that the files do not show.
--
-- WHAT IT LEAVES ALONE, on purpose, and why (all in the CA-29 report):
--   * award_xp, rc_grant_xp, rc_award_badge, rc_notify and the rc_* triggers'
--     callers: already revoked from PUBLIC, anon and authenticated by RC-P25 and
--     the RC notification and badge migrations.
--   * get_visible_surfaces(_user_id): a signed-out reader sees a profile's level
--     and track through it (src/lib/profile/profileProgress.ts), so anon keeps it.
--   * get_email_by_username: the sign-in page calls it before anyone is signed
--     in (src/lib/auth/signInWithEmailOrUsername.ts), so anon keeps it. It lets
--     anyone turn a username into an email address; replacing it is a design
--     decision, not a revoke.
--   * is_admin, is_thread_admin, is_thread_member, has_perk,
--     can_delete_primitive_comment: row-level security policies call them as the
--     querying role, so revoking anon would break reads.
--   * increment_content_view_count, increment_download_count,
--     increment_project_view_count, get_post_lineage: public counters and a
--     public read, with no owner.
--
-- EXPLAIN: none. No index, and no new read of a large table.
--
-- Apply exactly as written. Then run the security advisor and list what is left.
-- supabase/tests/ca29-function-access.sql has the checks to run after.
-- =============================================================================

-- 1. Signed-in-only functions ------------------------------------------------
DO $$
DECLARE
  _fn      record;
  _role    text;
  _changed integer := 0;
BEGIN
  FOR _fn IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'claim_challenge',
         'get_quest_state',
         'mark_depth_revealed',
         'mark_welcome_xp_shown',
         'record_daily_activity',
         'resolve_report',
         'respec_track',
         'set_user_track',
         'soft_delete_primitive_comment'
       )
     ORDER BY p.oid
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', _fn.proname, _fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', _fn.proname, _fn.args);
    _changed := _changed + 1;

    -- has_function_privilege follows membership and PUBLIC, so this also catches
    -- a grant that reaches anon some other way.
    FOREACH _role IN ARRAY ARRAY['anon'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = _role)
         AND has_function_privilege(_role::name, _fn.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'CA-29: % can still execute public.%(%); nothing was changed', _role, _fn.proname, _fn.args;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'CA-29: EXECUTE revoked from PUBLIC and anon on % signed-in-only overload(s)', _changed;
END
$$;

-- 2. get_quest_state answers only its own caller -------------------------------
-- Identical to 20260629162842 apart from the check after BEGIN. A _user_id that
-- is not the caller's refuses; no _user_id means the caller, as before.
CREATE OR REPLACE FUNCTION public.get_quest_state(_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := COALESCE(_user_id, auth.uid());
  _state jsonb;
  _level int;
  _milestone text;
BEGIN
  IF _user_id IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'get_quest_state answers only its own caller' USING ERRCODE = '42501';
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

-- CREATE OR REPLACE keeps the grants, but state them: this is the function step 1 closed.
REVOKE EXECUTE ON FUNCTION public.get_quest_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quest_state(uuid) TO authenticated;

-- 3. Trigger functions --------------------------------------------------------
DO $$
DECLARE
  _fn      record;
  _role    text;
  _revoked integer := 0;
BEGIN
  FOR _fn IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND p.prorettype = 'trigger'::regtype
     ORDER BY p.oid
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', _fn.proname, _fn.args);
    _revoked := _revoked + 1;

    FOREACH _role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = _role)
         AND has_function_privilege(_role::name, _fn.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'CA-29: % can still execute public.%(%); nothing was changed', _role, _fn.proname, _fn.args;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'CA-29: EXECUTE revoked from PUBLIC, anon and authenticated on % trigger function(s)', _revoked;
END
$$;

-- 4. search_path on every definer function that lacks one --------------------
DO $$
DECLARE
  _fn   record;
  _set  integer := 0;
BEGIN
  FOR _fn IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND NOT EXISTS (
         SELECT 1
           FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS setting
          WHERE setting LIKE 'search_path=%'
       )
     ORDER BY p.oid
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', _fn.proname, _fn.args);
    _set := _set + 1;
    RAISE NOTICE 'CA-29: search_path set on public.%(%)', _fn.proname, _fn.args;
  END LOOP;

  RAISE NOTICE 'CA-29: search_path set on % function(s)', _set;
END
$$;
