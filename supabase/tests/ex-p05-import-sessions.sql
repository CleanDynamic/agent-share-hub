-- =============================================================================
-- buildgallery — import sessions acceptance checks (EX-P05)
-- =============================================================================
-- Proves the EX-P05 acceptances that are facts about Postgres rather than about
-- TypeScript. There is no TypeScript half yet: EX-P05 adds a table, a bucket
-- and their policies, and nothing reads them until EX-P06 builds the pipe. So
-- everything this step claims is claimed here.
--
--   1. the table is installed with RLS ENABLED and exactly four policies, and
--      every auth.uid() in all eight policies EX-P05 adds — four on the table,
--      four on storage.objects — is written (select auth.uid()). anon holds no
--      grant on the table at all
--   2. THE BRIEF'S OWN CHECK, first half: user A inserts a row and reads it
--      back. Without this the three refusals below would pass on an empty table
--   3. THE BRIEF'S OWN CHECK, second half: user B's SELECT returns NOTHING
--   4. THE BRIEF'S OWN CHECK, second half: user B's UPDATE affects ZERO ROWS.
--      A denied UPDATE does not raise — RLS filters the row out and the
--      statement succeeds having done nothing — so this is asserted on
--      ROW_COUNT, which is the only place the refusal is visible
--   5. user B's DELETE affects zero rows likewise. EX-P05's DELETE policy is
--      the one deletion the whole feature has (a creator binning their own
--      waiting import), and a policy with no test is invisible: one that
--      returns nothing looks exactly like no data
--   6. user B cannot insert a row carrying user A's user_id. That is the INSERT
--      policy's actual claim, and USING-only policies pass checks 3 to 5 while
--      failing this one
--   7. the imports bucket is PRIVATE, with its 50,000-byte and text/plain
--      limits, and its four object policies are installed
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v user_a_id=<an auth.users uuid> \
--     -v user_b_id=<a DIFFERENT auth.users uuid> \
--     -f supabase/tests/ex-p05-import-sessions.sql
--
-- Both ids must be existing auth.users rows, and they must not be the same
-- person — checks 3 to 6 are meaningless otherwise, and the script asserts it.
-- A public.profiles id serves: profiles.id is a foreign key to auth.users(id)
-- and is that table's primary key, so the two are the same uuid.
--
-- Unlike the NS-P45 script, NEITHER id needs to be a non-admin. import_sessions
-- has no admin escape hatch by design — an import is one account's private
-- working material — so there is no policy here that an admin id would turn
-- green for the wrong reason.
--
-- It must be run as a role that can SET ROLE authenticated: the reads and
-- writes are meant to be subject to row level security, not exempt from it.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind and is safe against a database with real rows.
--
-- Every check raises on failure, so a run that reaches "ALL CHECKS PASSED" has
-- passed all of them.
--
-- NOT RUN AGAINST THE LIVE BACKEND. The Supabase CLI is not used on this
-- project and nothing is live until Lovable deploys the merge to main, so this
-- script has never touched project zybdotagjwektucfdkri. It was run at the time
-- of writing against a local PostgreSQL 16.13 built by replaying this
-- repository's own migrations in order, where all seven checks passed and
-- check 1 failed before the migration was added. That harness is not this
-- project: the first run HERE is still where these policies meet real rows.
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
SELECT set_config('ex_p05.user_a_id', :'user_a_id', true);
SELECT set_config('ex_p05.user_b_id', :'user_b_id', true);

DO $$
BEGIN
  IF current_setting('ex_p05.user_a_id') = current_setting('ex_p05.user_b_id') THEN
    RAISE EXCEPTION
      'SETUP FAILED: user_a_id and user_b_id are the same uuid. Checks 3 to 6 would pass by accident';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = current_setting('ex_p05.user_a_id')::uuid) THEN
    RAISE EXCEPTION 'SETUP FAILED: user_a_id is not an auth.users row';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = current_setting('ex_p05.user_b_id')::uuid) THEN
    RAISE EXCEPTION 'SETUP FAILED: user_b_id is not an auth.users row';
  END IF;
END
$$;


-- =============================================================================
-- 1. The table's posture, and the (select auth.uid()) rule across all eight
-- =============================================================================
-- The wrapping check counts rather than pattern-matches. Postgres renders a
-- stored policy back as "( SELECT auth.uid() AS uid)", so a regex looking for
-- auth.uid() NOT preceded by "(" matches the wrapped form too and reports every
-- correct policy as a violation. Counting total occurrences against
-- SELECT-wrapped occurrences has no such blind spot: equal means all wrapped.
DO $$
DECLARE
  _rls      BOOLEAN;
  _policies INTEGER;
  _cmds     TEXT;
  _p        RECORD;
  _expr     TEXT;
  _total    INTEGER;
  _wrapped  INTEGER;
  _anon     INTEGER;
BEGIN
  IF to_regclass('public.import_sessions') IS NULL THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: public.import_sessions does not exist — the migration was not applied';
  END IF;

  SELECT relrowsecurity INTO _rls
  FROM pg_class WHERE oid = 'public.import_sessions'::regclass;

  IF NOT _rls THEN
    RAISE EXCEPTION
      'CHECK 1 FAILED: row level security is not enabled on public.import_sessions — every row is readable by every authenticated caller';
  END IF;

  SELECT count(*), string_agg(DISTINCT cmd, ',' ORDER BY cmd)
  INTO _policies, _cmds
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'import_sessions';

  IF _policies <> 4 THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: expected 4 policies on import_sessions, found %', _policies;
  END IF;

  IF _cmds <> 'DELETE,INSERT,SELECT,UPDATE' THEN
    RAISE EXCEPTION
      'CHECK 1 FAILED: the four policies do not cover one command each — found %', _cmds;
  END IF;

  -- All eight policies EX-P05 adds, on both tables.
  FOR _p IN
    SELECT policyname, tablename, coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expr
    FROM pg_policies
    WHERE (schemaname = 'public'  AND tablename = 'import_sessions')
       OR (schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'Import objects%')
  LOOP
    _expr    := _p.expr;
    _total   := (length(_expr) - length(replace(_expr, 'auth.uid()', ''))) / length('auth.uid()');
    _wrapped := (length(_expr) - length(replace(_expr, 'SELECT auth.uid()', ''))) / length('SELECT auth.uid()');

    IF _total = 0 THEN
      RAISE EXCEPTION
        'CHECK 1 FAILED: policy "%" on % names no auth.uid() at all — it does not scope to the caller', _p.policyname, _p.tablename;
    END IF;

    IF _total <> _wrapped THEN
      RAISE EXCEPTION
        'CHECK 1 FAILED: policy "%" on % carries % bare auth.uid() call(s). It must be (select auth.uid()) — the bare form re-evaluates per row',
        _p.policyname, _p.tablename, _total - _wrapped;
    END IF;
  END LOOP;

  -- "Grant nothing to anon" is a fact about the catalogue, not about RLS.
  SELECT count(*) INTO _anon
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'import_sessions' AND grantee = 'anon';

  IF _anon <> 0 THEN
    RAISE EXCEPTION
      'CHECK 1 FAILED: anon holds % grant(s) on import_sessions. Supabase default privileges grant new public tables to anon, so the migration must REVOKE them', _anon;
  END IF;

  RAISE NOTICE 'check 1 passed: RLS on, 4 policies one per command, 8 policies all (select auth.uid()), anon holds no grant';
END
$$;


-- =============================================================================
-- 2. User A opens an import and reads it back
-- =============================================================================
-- Run as authenticated so RLS applies. Without this check the three refusals
-- below would all pass against a table that simply has no rows in it.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ex_p05.user_a_id'), true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('ex_p05.user_a_id'), 'role', 'authenticated')::text,
  true
);

INSERT INTO public.import_sessions (user_id, client, source_hint, fingerprint, status, total_chars)
VALUES (
  current_setting('ex_p05.user_a_id')::uuid,
  'claude-code',
  'ex-p05 acceptance',
  'ex-p05-fingerprint',
  'open',
  0
);

DO $$
DECLARE _seen INTEGER;
BEGIN
  SELECT count(*) INTO _seen
  FROM public.import_sessions WHERE fingerprint = 'ex-p05-fingerprint';

  IF _seen <> 1 THEN
    RAISE EXCEPTION
      'CHECK 2 FAILED: user A inserted one import and can see % of them. The INSERT or SELECT policy refuses the owner', _seen;
  END IF;

  RAISE NOTICE 'check 2 passed: user A opened an import and can read it back';
END
$$;

RESET ROLE;


-- =============================================================================
-- 3, 4, 5, 6. User B cannot see it, change it, remove it, or forge one
-- =============================================================================
-- The row exists and belongs to A. Everything below runs as B.
--
-- A denied UPDATE and a denied DELETE DO NOT RAISE. RLS removes the row from
-- the statement's view and the statement then succeeds having touched nothing,
-- which is indistinguishable from success unless ROW_COUNT is read. That is why
-- checks 4 and 5 assert on GET DIAGNOSTICS rather than on an exception.
--
-- Check 6 is the opposite shape: a WITH CHECK violation DOES raise, with
-- SQLSTATE 42501, and is caught in its own subtransaction so the script
-- survives to finish.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ex_p05.user_b_id'), true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('ex_p05.user_b_id'), 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  _seen     INTEGER;
  _affected INTEGER;
  _state    TEXT;
BEGIN
  -- 3. SELECT returns nothing
  SELECT count(*) INTO _seen
  FROM public.import_sessions WHERE fingerprint = 'ex-p05-fingerprint';

  IF _seen <> 0 THEN
    RAISE EXCEPTION
      'CHECK 3 FAILED: user B can see % of user A''s imports. A whole conversation, pre-redaction, is readable by the wrong account', _seen;
  END IF;
  RAISE NOTICE 'check 3 passed: user B''s select returns nothing';

  -- 4. UPDATE affects zero rows
  UPDATE public.import_sessions
     SET status = 'claimed'
   WHERE fingerprint = 'ex-p05-fingerprint';
  GET DIAGNOSTICS _affected = ROW_COUNT;

  IF _affected <> 0 THEN
    RAISE EXCEPTION
      'CHECK 4 FAILED: user B''s update affected % row(s) of user A''s imports', _affected;
  END IF;
  RAISE NOTICE 'check 4 passed: user B''s update affects zero rows';

  -- 5. DELETE affects zero rows
  DELETE FROM public.import_sessions WHERE fingerprint = 'ex-p05-fingerprint';
  GET DIAGNOSTICS _affected = ROW_COUNT;

  IF _affected <> 0 THEN
    RAISE EXCEPTION
      'CHECK 5 FAILED: user B''s delete removed % of user A''s imports', _affected;
  END IF;
  RAISE NOTICE 'check 5 passed: user B''s delete affects zero rows';

  -- 6. INSERT of a row owned by A is refused outright
  BEGIN
    INSERT INTO public.import_sessions (user_id, client, fingerprint, status)
    VALUES (current_setting('ex_p05.user_a_id')::uuid, 'web', 'ex-p05-forged', 'open');

    RAISE EXCEPTION
      'CHECK 6 FAILED: user B inserted an import owned by user A. The INSERT policy has no WITH CHECK, or it does not compare user_id';
  EXCEPTION
    WHEN insufficient_privilege THEN
      GET STACKED DIAGNOSTICS _state = RETURNED_SQLSTATE;
      RAISE NOTICE 'check 6 passed: user B''s insert on user A''s behalf was refused (SQLSTATE %)', _state;
  END;
END
$$;

RESET ROLE;


-- =============================================================================
-- 7. The bucket and its object policies
-- =============================================================================
-- Asserted from the catalogue rather than by uploading. On the live project an
-- object arrives through the storage API, which owns columns and triggers this
-- script has no business simulating; what EX-P05 is responsible for is the
-- bucket's posture and the four policies, and both are catalogue facts.
DO $$
DECLARE
  _public   BOOLEAN;
  _limit    BIGINT;
  _mimes    TEXT[];
  _policies INTEGER;
  _cmds     TEXT;
BEGIN
  SELECT public, file_size_limit, allowed_mime_types
  INTO _public, _limit, _mimes
  FROM storage.buckets WHERE id = 'imports';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: the imports bucket does not exist';
  END IF;

  IF _public THEN
    RAISE EXCEPTION
      'CHECK 7 FAILED: the imports bucket is PUBLIC. Every chunk of every half-sent conversation would be served without a signed URL';
  END IF;

  IF _limit IS DISTINCT FROM 50000 THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: file_size_limit is %, expected 50000 bytes', coalesce(_limit::text, 'NULL');
  END IF;

  IF _mimes IS DISTINCT FROM ARRAY['text/plain'] THEN
    RAISE EXCEPTION
      'CHECK 7 FAILED: allowed_mime_types is %, expected {text/plain}', coalesce(array_to_string(_mimes, ','), 'NULL');
  END IF;

  SELECT count(*), string_agg(DISTINCT cmd, ',' ORDER BY cmd)
  INTO _policies, _cmds
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'Import objects%';

  IF _policies <> 4 THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: expected 4 object policies for the imports bucket, found %', _policies;
  END IF;

  IF _cmds <> 'DELETE,INSERT,SELECT,UPDATE' THEN
    RAISE EXCEPTION
      'CHECK 7 FAILED: the four object policies do not cover one command each — found %', _cmds;
  END IF;

  RAISE NOTICE 'check 7 passed: imports bucket private, 50000 bytes, text/plain, 4 object policies';
END
$$;


\echo ''
\echo 'EX-P05 — ALL CHECKS PASSED'
\echo ''

ROLLBACK;
