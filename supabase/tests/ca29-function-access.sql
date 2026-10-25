-- =============================================================================
-- buildgallery — function access acceptance checks (CA-29 Part 6)
-- =============================================================================
-- Proves, after supabase/migrations/20261026120000_ca29_function_access.sql is
-- applied, that each function it changed is refused to a signed-out caller,
-- refused to the wrong owner where it has an owner argument, and allowed to the
-- owner.
--
--   1. signed out: anon cannot execute any signed-in-only function, and cannot
--      execute any SECURITY DEFINER trigger function
--   2. signed in: authenticated can execute each signed-in-only function
--   3. every SECURITY DEFINER function in public sets a search_path
--   4. get_quest_state, signed out: refused (42501)
--   5. get_quest_state, wrong owner: user A asking for user B is refused (42501)
--   6. get_quest_state, owner: user A asking for nobody, or for A, is answered
--   7. mark_welcome_xp_shown and record_daily_activity, signed out: refused;
--      as the owner: answered
--   8. what the migration leaves open on purpose is still open: anon can execute
--      get_visible_surfaces (a profile is read signed out) and
--      get_email_by_username (sign-in resolves a username before anyone is in)
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v user_a_id=<an auth.users uuid> \
--     -v user_b_id=<a DIFFERENT auth.users uuid> \
--     -f supabase/tests/ca29-function-access.sql
--
-- Run it as a role that can SET ROLE anon and SET ROLE authenticated. The whole
-- script runs in one transaction and ends in ROLLBACK, so the user_progress rows
-- the owner checks create are not kept. Every check raises on failure, so a run
-- that reaches "ALL CHECKS PASSED" has passed all of them.
--
-- NOT RUN AGAINST THE LIVE BACKEND. The Supabase CLI is not used on this project
-- and nothing is live until Lovable applies the migration.
-- =============================================================================

\if :{?user_a_id}
\else
  \echo 'ERROR: pass -v user_a_id=<uuid> and -v user_b_id=<uuid>'
  \quit
\endif

\if :{?user_b_id}
\else
  \echo 'ERROR: pass -v user_b_id=<uuid>'
  \quit
\endif

BEGIN;

\set ON_ERROR_STOP on

SELECT set_config('ca29.user_a_id', :'user_a_id', true);
SELECT set_config('ca29.user_b_id', :'user_b_id', true);

DO $$
BEGIN
  IF current_setting('ca29.user_a_id') = current_setting('ca29.user_b_id') THEN
    RAISE EXCEPTION 'SETUP FAILED: user_a_id and user_b_id are the same uuid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = current_setting('ca29.user_a_id')::uuid) THEN
    RAISE EXCEPTION 'SETUP FAILED: user_a_id is not an auth.users row';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = current_setting('ca29.user_b_id')::uuid) THEN
    RAISE EXCEPTION 'SETUP FAILED: user_b_id is not an auth.users row';
  END IF;
END
$$;


-- 1. signed out ---------------------------------------------------------------
DO $$
DECLARE
  _fn record;
BEGIN
  FOR _fn IN
    SELECT p.oid, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND (p.prorettype = 'trigger'::regtype
            OR p.proname IN ('claim_challenge', 'get_quest_state', 'mark_depth_revealed', 'mark_welcome_xp_shown',
                             'record_daily_activity', 'resolve_report', 'respec_track', 'set_user_track',
                             'soft_delete_primitive_comment'))
  LOOP
    IF has_function_privilege('anon', _fn.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'CHECK 1 FAILED: anon can execute public.%', _fn.proname;
    END IF;
  END LOOP;
  RAISE NOTICE 'check 1 passed: anon executes no signed-in-only or trigger definer function';
END
$$;


-- 2. signed in ----------------------------------------------------------------
DO $$
DECLARE
  _fn record;
  _seen integer := 0;
BEGIN
  FOR _fn IN
    SELECT p.oid, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('claim_challenge', 'get_quest_state', 'mark_depth_revealed', 'mark_welcome_xp_shown',
                         'record_daily_activity', 'resolve_report', 'respec_track', 'set_user_track',
                         'soft_delete_primitive_comment')
  LOOP
    _seen := _seen + 1;
    IF NOT has_function_privilege('authenticated', _fn.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'CHECK 2 FAILED: authenticated cannot execute public.%', _fn.proname;
    END IF;
  END LOOP;
  IF _seen < 9 THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: found % of the 9 signed-in-only functions', _seen;
  END IF;
  RAISE NOTICE 'check 2 passed: authenticated executes all %', _seen;
END
$$;


-- 3. search_path --------------------------------------------------------------
DO $$
DECLARE
  _missing text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO _missing
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef
     AND NOT EXISTS (
       SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS setting WHERE setting LIKE 'search_path=%'
     );
  IF _missing IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: no search_path on %', _missing;
  END IF;
  RAISE NOTICE 'check 3 passed: every SECURITY DEFINER function in public sets search_path';
END
$$;


-- 4. get_quest_state, signed out ----------------------------------------------
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM public.get_quest_state(NULL);
  RAISE EXCEPTION 'CHECK 4 FAILED: anon called get_quest_state';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'check 4 passed: get_quest_state refuses a signed-out caller';
END
$$;
RESET ROLE;


-- 5 and 6. get_quest_state, wrong owner and owner -------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('ca29.user_a_id'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  _answer jsonb;
BEGIN
  BEGIN
    PERFORM public.get_quest_state(current_setting('ca29.user_b_id')::uuid);
    RAISE EXCEPTION 'CHECK 5 FAILED: user A read user B''s quest state';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'check 5 passed: get_quest_state refuses a caller asking for someone else';
  END;

  _answer := public.get_quest_state();
  IF NOT (_answer ? 'steps' AND _answer ? 'next_milestone') THEN
    RAISE EXCEPTION 'CHECK 6 FAILED: get_quest_state() gave % for its owner', _answer;
  END IF;
  _answer := public.get_quest_state(current_setting('ca29.user_a_id')::uuid);
  IF NOT (_answer ? 'steps' AND _answer ? 'next_milestone') THEN
    RAISE EXCEPTION 'CHECK 6 FAILED: get_quest_state(A) gave % for A', _answer;
  END IF;
  RAISE NOTICE 'check 6 passed: get_quest_state answers its owner, with or without the id';
END
$$;

-- 7, owner half: answered.
DO $$
BEGIN
  PERFORM public.mark_welcome_xp_shown();
  PERFORM public.record_daily_activity();
  RAISE NOTICE 'check 7 (owner half) passed: both answer a signed-in caller';
END
$$;
RESET ROLE;

-- 7, signed-out half: refused.
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.mark_welcome_xp_shown();
    RAISE EXCEPTION 'CHECK 7 FAILED: anon called mark_welcome_xp_shown';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.record_daily_activity();
    RAISE EXCEPTION 'CHECK 7 FAILED: anon called record_daily_activity';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'check 7 (signed-out half) passed: both refuse a signed-out caller';
END
$$;
RESET ROLE;


-- 8. what stays open on purpose -------------------------------------------------
DO $$
BEGIN
  IF NOT has_function_privilege('anon', 'public.get_visible_surfaces(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: anon can no longer read a profile''s surfaces';
  END IF;
  IF NOT has_function_privilege('anon', 'public.get_email_by_username(text)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: anon can no longer resolve a username at sign-in';
  END IF;
  RAISE NOTICE 'check 8 passed: get_visible_surfaces and get_email_by_username stay open to anon';
END
$$;

\echo 'ALL CHECKS PASSED'

ROLLBACK;
