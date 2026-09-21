-- =============================================================================
-- buildgallery — ceilings and expiry acceptance checks (EX-P13)
-- =============================================================================
-- Proves the EX-P13 acceptances that are facts about Postgres rather than about
-- TypeScript. The TypeScript half — that begin_import sweeps before it inserts,
-- that the sweep is scoped and bounded, and that a ceiling refusal reaches the
-- caller as the trigger wrote it — is proved by `deno test` in
-- supabase/functions/mcp/index.test.ts and is not repeated here.
--
--   1. the trigger is installed BEFORE INSERT on import_sessions, and its
--      function is SECURITY INVOKER with search_path = '' and no EXECUTE grant
--      to anon or authenticated
--   2. THE STEP'S OWN CHECK, first half: the 21st insert for a user today
--      RAISES, under SQLSTATE BGCAP, with the error table's wording
--   3. THE STEP'S OWN CHECK, second half: the 6th open import RAISES likewise.
--      'assembling' counts as open, which is the half a test written against
--      status = 'open' alone would miss
--   4. POSITIVE CONTROLS for both. Without these, 2 and 3 would pass against a
--      table that refused every insert for some entirely different reason
--   5. the total_chars <= 400000 CHECK from EX-P05 is still in place. EX-P13
--      was asked to confirm it, not to add it — this is the confirmation
--   6. expire_import_sessions is SECURITY INVOKER, search_path = '', and is
--      not executable by anon, authenticated or service_role
--   7. THE JOB-ROLE CHECK. A row owned by user A, past expires_at, IS expired
--      when the function runs as the job's role — and FORCE ROW LEVEL SECURITY
--      is off, which is the fact that makes that true. If FORCE were ever
--      turned on, the nightly job would run, report success and expire nothing;
--      this check is what stops that landing silently
--   8. the nightly job expires only the three live states, and only rows
--      actually past expires_at
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v user_a_id=<an auth.users uuid> \
--     -v user_b_id=<a DIFFERENT auth.users uuid> \
--     -f supabase/tests/ex-p13-ceilings-and-expiry.sql
--
-- Both ids must be existing auth.users rows and must not be the same person:
-- check 7 is meaningless if the row the job expires belongs to the role running
-- it, and the script asserts they differ.
--
-- It must be run as a role that can SET ROLE authenticated AND SET ROLE to the
-- owner of public.import_sessions — checks 2 to 4 must be subject to RLS, and
-- check 7 must not be.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind and is safe against a database with real rows: check 7's
-- assertions are scoped to the rows this script inserted, so a real overdue row
-- belonging to somebody else is expired inside the transaction and un-expired
-- by the ROLLBACK.
--
-- Every check raises on failure, so a run that reaches "ALL CHECKS PASSED" has
-- passed all of them.
--
-- NOT RUN AGAINST THE LIVE BACKEND. The Supabase CLI is not used on this
-- project and nothing is live until Lovable deploys the merge to main, so this
-- script has never touched project zybdotagjwektucfdkri. It was run at the time
-- of writing against a local PostgreSQL 16.13 replay of this repository's
-- import_sessions migration plus the two EX-P13 migrations, where all eight
-- checks passed. The first run HERE is still where these meet real rows.
--
-- ONE THING THIS SCRIPT CANNOT PROVE LOCALLY: pg_cron is not installed in the
-- replay container, so check 8 exercises expire_import_sessions() directly
-- rather than through a scheduled job, and the schedule itself is unverified
-- until the migration runs on Lovable Cloud. See docs/connector/HANDOVER.md.
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

-- psql does not substitute :'var' inside a dollar-quoted body, so the ids are
-- parked in settings the DO blocks can read with current_setting().
SELECT set_config('ex_p13.user_a_id', :'user_a_id', true);
SELECT set_config('ex_p13.user_b_id', :'user_b_id', true);

DO $$
BEGIN
  IF current_setting('ex_p13.user_a_id') = current_setting('ex_p13.user_b_id') THEN
    RAISE EXCEPTION
      'SETUP FAILED: user_a_id and user_b_id are the same uuid. Check 7 would prove nothing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = current_setting('ex_p13.user_a_id')::uuid) THEN
    RAISE EXCEPTION 'SETUP FAILED: user_a_id is not an auth.users row';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = current_setting('ex_p13.user_b_id')::uuid) THEN
    RAISE EXCEPTION 'SETUP FAILED: user_b_id is not an auth.users row';
  END IF;
END
$$;


-- =============================================================================
-- 1. The trigger's posture
-- =============================================================================
DO $$
DECLARE
  _timing   TEXT;
  _event    TEXT;
  _prosec   BOOLEAN;
  _config   TEXT[];
  _grantees TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.import_sessions'::regclass
      AND tgname  = 'enforce_import_ceilings'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'CHECK 1 FAILED: trigger enforce_import_ceilings is not installed on public.import_sessions — the migration was not applied';
  END IF;

  -- tgtype bit 1 is BEFORE, bit 2 is INSERT, bit 0 is FOR EACH ROW.
  SELECT CASE WHEN (tgtype & 2) <> 0 THEN 'BEFORE' ELSE 'AFTER' END,
         CASE WHEN (tgtype & 4) <> 0 THEN 'INSERT' ELSE 'other' END
  INTO _timing, _event
  FROM pg_trigger
  WHERE tgrelid = 'public.import_sessions'::regclass AND tgname = 'enforce_import_ceilings';

  IF _timing <> 'BEFORE' OR _event <> 'INSERT' THEN
    RAISE EXCEPTION
      'CHECK 1 FAILED: the trigger is % %, not BEFORE INSERT. An AFTER trigger would let the row be written and then undone', _timing, _event;
  END IF;

  SELECT p.prosecdef, p.proconfig
  INTO _prosec, _config
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'enforce_import_ceilings';

  IF _prosec THEN
    RAISE EXCEPTION
      'CHECK 1 FAILED: enforce_import_ceilings is SECURITY DEFINER. It must be SECURITY INVOKER — a DEFINER function would read every account''s rows to compute one account''s count';
  END IF;

  -- Postgres stores the empty search_path as search_path="" in proconfig, so
  -- the stored forms are matched rather than the source text.
  IF _config IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(_config) AS c
    WHERE c IN ('search_path=', 'search_path=""', 'search_path=''''')
  ) THEN
    RAISE EXCEPTION
      'CHECK 1 FAILED: enforce_import_ceilings does not SET search_path = '''' (proconfig is %)', _config;
  END IF;

  SELECT string_agg(DISTINCT grantee, ', ')
  INTO _grantees
  FROM information_schema.role_routine_grants
  WHERE specific_schema = 'public'
    AND routine_name = 'enforce_import_ceilings'
    AND grantee IN ('anon', 'authenticated', 'PUBLIC');

  IF _grantees IS NOT NULL THEN
    RAISE EXCEPTION
      'CHECK 1 FAILED: enforce_import_ceilings is executable by %. public is an exposed schema, so that is a callable RPC endpoint', _grantees;
  END IF;

  RAISE NOTICE 'check 1 passed: BEFORE INSERT trigger installed, function SECURITY INVOKER with empty search_path, no EXECUTE to anon/authenticated/PUBLIC';
END
$$;


-- =============================================================================
-- 2, 3, 4. The two ceilings, and their positive controls
-- =============================================================================
-- Run as authenticated so RLS applies and the count the trigger takes is the
-- count a real caller's insert would produce.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ex_p13.user_a_id'), true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('ex_p13.user_a_id'), 'role', 'authenticated')::text,
  true
);

-- --- 2. the 21st insert of the UTC day -------------------------------------
-- The 20 seeded rows are 'claimed', not 'open'. That is deliberate: 'claimed'
-- is not a live state, so the FIVE-open ceiling stays out of the way and the
-- only thing that can refuse the 21st is the DAILY ceiling. Seeding them 'open'
-- would make this check pass for the wrong reason at row six.
DO $$
DECLARE
  _seeded   INTEGER;
  _message  TEXT;
  _state    TEXT;
BEGIN
  INSERT INTO public.import_sessions (user_id, status, source_hint)
  SELECT current_setting('ex_p13.user_a_id')::uuid, 'claimed', 'ex-p13-seed'
  FROM generate_series(1, 20);

  SELECT count(*) INTO _seeded
  FROM public.import_sessions
  WHERE user_id = current_setting('ex_p13.user_a_id')::uuid
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  IF _seeded < 20 THEN
    RAISE EXCEPTION
      'CHECK 2 SETUP FAILED: only % of the 20 seed rows landed, so the 21st is not the 21st', _seeded;
  END IF;

  BEGIN
    INSERT INTO public.import_sessions (user_id, status, source_hint)
    VALUES (current_setting('ex_p13.user_a_id')::uuid, 'open', 'ex-p13-seed');

    RAISE EXCEPTION
      'CHECK 2 FAILED: the 21st import of the day was ACCEPTED. The daily ceiling is not enforced';
  EXCEPTION WHEN SQLSTATE 'BGCAP' THEN
    GET STACKED DIAGNOSTICS _message = MESSAGE_TEXT, _state = RETURNED_SQLSTATE;
  END;

  IF _state <> 'BGCAP' THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: expected SQLSTATE BGCAP, got %', _state;
  END IF;

  -- The wording is the contract's error table, and begin_import returns it
  -- unchanged, so it is asserted here rather than trusted.
  IF _message <> 'You have opened 20 imports today, which is the limit. It resets at midnight UTC. Existing waiting imports are unaffected.' THEN
    RAISE EXCEPTION
      'CHECK 2 FAILED: the daily refusal does not carry the error table''s wording. Got: %', _message;
  END IF;

  RAISE NOTICE 'check 2 passed: the 21st insert today raises BGCAP with the error table''s wording';
END
$$;

-- --- 4a. positive control for the daily ceiling -----------------------------
-- The same insert, for a user who has not hit the ceiling, must succeed. This
-- is what proves check 2 measured the ceiling and not some unrelated refusal.
DO $$
DECLARE
  _id UUID;
BEGIN
  -- PERFORM, not SELECT: inside plpgsql a SELECT with no INTO has nowhere to
  -- put its result and raises "query has no destination for result data".
  PERFORM set_config('request.jwt.claim.sub', current_setting('ex_p13.user_b_id'), true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('ex_p13.user_b_id'), 'role', 'authenticated')::text,
    true
  );

  INSERT INTO public.import_sessions (user_id, status, source_hint)
  VALUES (current_setting('ex_p13.user_b_id')::uuid, 'open', 'ex-p13-seed')
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    RAISE EXCEPTION 'CHECK 4a FAILED: a user under both ceilings could not open an import at all';
  END IF;

  RAISE NOTICE 'check 4a passed: a user under the ceilings opens an import normally';
END
$$;

-- --- 3. the 6th open import -------------------------------------------------
-- Four 'open' plus one 'assembling' is five LIVE imports. Using a mix is the
-- point: a ceiling that counted only status = 'open' would let a sixth through
-- while an assembling import was still holding a slot.
DO $$
DECLARE
  _live     INTEGER;
  _message  TEXT;
  _state    TEXT;
BEGIN
  -- user B already has one open from check 4a; top up to five live.
  INSERT INTO public.import_sessions (user_id, status, source_hint)
  SELECT current_setting('ex_p13.user_b_id')::uuid, 'open', 'ex-p13-seed'
  FROM generate_series(1, 3);

  INSERT INTO public.import_sessions (user_id, status, source_hint)
  VALUES (current_setting('ex_p13.user_b_id')::uuid, 'assembling', 'ex-p13-seed');

  SELECT count(*) INTO _live
  FROM public.import_sessions
  WHERE user_id = current_setting('ex_p13.user_b_id')::uuid
    AND status IN ('open', 'assembling');

  IF _live <> 5 THEN
    RAISE EXCEPTION 'CHECK 3 SETUP FAILED: expected 5 live imports, found %', _live;
  END IF;

  BEGIN
    INSERT INTO public.import_sessions (user_id, status, source_hint)
    VALUES (current_setting('ex_p13.user_b_id')::uuid, 'open', 'ex-p13-seed');

    RAISE EXCEPTION
      'CHECK 3 FAILED: the 6th open import was ACCEPTED. The open ceiling is not enforced';
  EXCEPTION WHEN SQLSTATE 'BGCAP' THEN
    GET STACKED DIAGNOSTICS _message = MESSAGE_TEXT, _state = RETURNED_SQLSTATE;
  END;

  IF _state <> 'BGCAP' THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: expected SQLSTATE BGCAP, got %', _state;
  END IF;

  IF _message <> 'You have 5 imports still open. Finish or abandon one before starting another; open imports expire after 7 days.' THEN
    RAISE EXCEPTION
      'CHECK 3 FAILED: the open refusal does not carry the error table''s wording. Got: %', _message;
  END IF;

  RAISE NOTICE 'check 3 passed: the 6th live import raises BGCAP, and assembling counts as open';
END
$$;

-- --- 4b. positive control for the open ceiling ------------------------------
-- Free one slot and the next insert must be accepted. This is the whole reason
-- expiry exists: without it, five abandoned imports lock a creator out for ever.
DO $$
DECLARE
  _id UUID;
BEGIN
  UPDATE public.import_sessions
  SET status = 'expired'
  WHERE id = (
    SELECT id FROM public.import_sessions
    WHERE user_id = current_setting('ex_p13.user_b_id')::uuid
      AND status = 'open'
    LIMIT 1
  );

  INSERT INTO public.import_sessions (user_id, status, source_hint)
  VALUES (current_setting('ex_p13.user_b_id')::uuid, 'open', 'ex-p13-seed')
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    RAISE EXCEPTION 'CHECK 4b FAILED: freeing a slot did not let the next import open';
  END IF;

  RAISE NOTICE 'check 4b passed: expiring one live import frees the slot immediately';
END
$$;

RESET ROLE;

-- Clear the rows checks 2 to 4 seeded, so checks 7 and 8 can open imports for
-- the same two users without tripping the very ceilings just proved. Scoped to
-- this script's own tag: it never touches a row it did not write. (The whole
-- script rolls back regardless; this is about the checks below being able to
-- run at all, not about cleanliness.)
DELETE FROM public.import_sessions WHERE source_hint = 'ex-p13-seed';


-- =============================================================================
-- 5. The EX-P05 total_chars ceiling is still in place
-- =============================================================================
-- EX-P13 was asked to CONFIRM this constraint, not to add it. It is the
-- backstop the edge function cannot provide — concurrent appends, each legal
-- alone, that are not legal together.
DO $$
DECLARE
  _def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO _def
  FROM pg_constraint
  WHERE conrelid = 'public.import_sessions'::regclass
    AND conname  = 'import_sessions_total_chars_check';

  IF _def IS NULL THEN
    RAISE EXCEPTION
      'CHECK 5 FAILED: import_sessions_total_chars_check is gone. MAX_TOTAL_CHARS has no database backstop';
  END IF;

  IF _def !~ '400000' THEN
    RAISE EXCEPTION
      'CHECK 5 FAILED: the total_chars constraint is not 400000 — it reads %', _def;
  END IF;

  RAISE NOTICE 'check 5 passed: % is in place', _def;
END
$$;


-- =============================================================================
-- 6. The expiry function's posture
-- =============================================================================
DO $$
DECLARE
  _prosec   BOOLEAN;
  _config   TEXT[];
  _grantees TEXT;
BEGIN
  SELECT p.prosecdef, p.proconfig
  INTO _prosec, _config
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'expire_import_sessions';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHECK 6 FAILED: public.expire_import_sessions() does not exist';
  END IF;

  IF _prosec THEN
    RAISE EXCEPTION
      'CHECK 6 FAILED: expire_import_sessions is SECURITY DEFINER. The step requires SECURITY INVOKER, and check 7 is what makes that safe';
  END IF;

  IF _config IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(_config) AS c
    WHERE c IN ('search_path=', 'search_path=""', 'search_path=''''')
  ) THEN
    RAISE EXCEPTION
      'CHECK 6 FAILED: expire_import_sessions does not SET search_path = '''' (proconfig is %)', _config;
  END IF;

  SELECT string_agg(DISTINCT grantee, ', ')
  INTO _grantees
  FROM information_schema.role_routine_grants
  WHERE specific_schema = 'public'
    AND routine_name = 'expire_import_sessions'
    AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC');

  IF _grantees IS NOT NULL THEN
    RAISE EXCEPTION
      'CHECK 6 FAILED: expire_import_sessions is executable by %. public is exposed, so that is an unadvertised write endpoint on the connector''s table', _grantees;
  END IF;

  RAISE NOTICE 'check 6 passed: SECURITY INVOKER, empty search_path, no EXECUTE to anon/authenticated/service_role/PUBLIC';
END
$$;


-- =============================================================================
-- 7. THE JOB-ROLE CHECK
-- =============================================================================
-- expire_import_sessions is SECURITY INVOKER and the pg_cron job runs as
-- whichever role scheduled it. If that role is subject to RLS on
-- import_sessions, the nightly UPDATE matches zero rows — a job has no
-- auth.uid(), so (select auth.uid()) = user_id is never true — and the job runs
-- every night, raises nothing, and expires nothing. That failure is invisible
-- without this check, which is exactly why it is here.
--
-- Two things are asserted, in order:
--
--   a. FORCE ROW LEVEL SECURITY is OFF. Owner exemption is the mechanism this
--      job relies on, and FORCE is the one switch that removes it. EX-P05 did
--      not set it; this pins that it stays unset.
--   b. A row owned by USER A, past expires_at, is ACTUALLY expired when the
--      function runs as the table's owning role with no JWT claim set — which
--      is the position a cron job is in.
--
-- Written as user A's row expired by a DIFFERENT role on purpose. A test that
-- expired its own row would pass whether or not RLS was being bypassed.
SELECT pg_get_userbyid(relowner) AS owner_role
FROM pg_class WHERE oid = 'public.import_sessions'::regclass \gset

DO $$
DECLARE
  _forced BOOLEAN;
BEGIN
  SELECT relforcerowsecurity INTO _forced
  FROM pg_class WHERE oid = 'public.import_sessions'::regclass;

  IF _forced THEN
    RAISE EXCEPTION
      'CHECK 7a FAILED: FORCE ROW LEVEL SECURITY is ON for public.import_sessions. The owner is no longer exempt, so the nightly job will run every night and expire nothing. Do NOT fix this by making expire_import_sessions SECURITY DEFINER';
  END IF;

  RAISE NOTICE 'check 7a passed: FORCE ROW LEVEL SECURITY is off, so the owning role is exempt from RLS';
END
$$;

-- User A's overdue row, written as user A under RLS, so it is a genuine
-- creator-owned row and not one the job's role planted for itself.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ex_p13.user_a_id'), true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('ex_p13.user_a_id'), 'role', 'authenticated')::text,
  true
);

INSERT INTO public.import_sessions (user_id, status, expires_at, source_hint)
VALUES (
  current_setting('ex_p13.user_a_id')::uuid,
  'parsed',
  now() - interval '1 day',
  'ex-p13-job-role-check'
);

RESET ROLE;

-- Now become the job: the owning role, and no JWT claim at all.
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '', true);
SET LOCAL ROLE :"owner_role";

SELECT public.expire_import_sessions() AS rows_the_job_expired \gset

RESET ROLE;

DO $$
DECLARE
  _status TEXT;
  _owner  UUID;
BEGIN
  SELECT status, user_id INTO _status, _owner
  FROM public.import_sessions
  WHERE source_hint = 'ex-p13-job-role-check'
    AND user_id = current_setting('ex_p13.user_a_id')::uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHECK 7b SETUP FAILED: the seeded overdue row is not there';
  END IF;

  IF _status <> 'expired' THEN
    RAISE EXCEPTION
      'CHECK 7b FAILED: user A''s overdue row is still "%" after the job ran as the scheduling role. The job''s role is subject to RLS on import_sessions, so the nightly job would silently do nothing. STOP — this is a design problem, not a bug to patch', _status;
  END IF;

  RAISE NOTICE
    'check 7b passed: a row owned by % and past expires_at was expired by the job''s role, with no JWT claim set', _owner;
END
$$;


-- =============================================================================
-- 8. The nightly job expires the right rows and only those
-- =============================================================================
-- Three rows for user A: one overdue 'open', one overdue 'claimed' (a terminal
-- state, must be left alone), one 'open' that is not due yet.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ex_p13.user_a_id'), true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('ex_p13.user_a_id'), 'role', 'authenticated')::text,
  true
);

INSERT INTO public.import_sessions (user_id, status, expires_at, source_hint) VALUES
  (current_setting('ex_p13.user_a_id')::uuid, 'assembling', now() - interval '2 days', 'ex-p13-overdue-live'),
  (current_setting('ex_p13.user_a_id')::uuid, 'claimed',    now() - interval '2 days', 'ex-p13-overdue-terminal'),
  (current_setting('ex_p13.user_a_id')::uuid, 'open',       now() + interval '3 days', 'ex-p13-not-due');

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE :"owner_role";
SELECT public.expire_import_sessions();
RESET ROLE;

DO $$
DECLARE
  _live     TEXT;
  _terminal TEXT;
  _not_due  TEXT;
BEGIN
  SELECT status INTO _live     FROM public.import_sessions WHERE source_hint = 'ex-p13-overdue-live';
  SELECT status INTO _terminal FROM public.import_sessions WHERE source_hint = 'ex-p13-overdue-terminal';
  SELECT status INTO _not_due  FROM public.import_sessions WHERE source_hint = 'ex-p13-not-due';

  IF _live <> 'expired' THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: an overdue assembling row was left at "%"', _live;
  END IF;

  IF _terminal <> 'claimed' THEN
    RAISE EXCEPTION
      'CHECK 8 FAILED: an overdue CLAIMED row was changed to "%". A claimed import already became a build; expiring it rewrites history', _terminal;
  END IF;

  IF _not_due <> 'open' THEN
    RAISE EXCEPTION
      'CHECK 8 FAILED: a row that is not due until later was expired anyway ("%")', _not_due;
  END IF;

  RAISE NOTICE 'check 8 passed: overdue live rows expire, terminal rows and not-yet-due rows are untouched';
END
$$;


DO $$ BEGIN RAISE NOTICE 'ALL CHECKS PASSED'; END $$;

ROLLBACK;
