-- =============================================================================
-- NeoScale — reproduction acceptance checks (NS-P17)
-- =============================================================================
-- Proves the three acceptances that are facts about Postgres rather than about
-- TypeScript:
--
--   1. a second person recording a reproduction moves the build header
--   2. the creator recording one against their own build is refused by policy
--   3. deleting the reproduction returns the header to where it started
--
-- and, because it is the design claim the whole trigger rests on, that
-- flipping `worked` corrects the header the same way a deletion does.
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v creator_id=<a profiles.id uuid> \
--     -v reader_id=<a DIFFERENT profiles.id uuid> \
--     -f supabase/tests/ns-p17-reproductions.sql
--
-- Both ids must be existing public.profiles rows, and they must not be the
-- same person — the second acceptance is meaningless otherwise.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind, and it is safe to run against a database with real rows in
-- it. It must be run as a role that can SET ROLE authenticated: the point of
-- the exercise is to be subject to row level security, not exempt from it.
--
-- Every check raises on failure, so a run that reaches "ALL CHECKS PASSED" has
-- passed all of them.
-- =============================================================================

\if :{?creator_id}
\else
  \echo 'ERROR: pass -v creator_id=<uuid> and -v reader_id=<uuid>'
  \quit
\endif

\if :{?reader_id}
\else
  \echo 'ERROR: pass -v reader_id=<uuid>'
  \quit
\endif

\set ON_ERROR_STOP on

BEGIN;

-- Carry the two ids into the transaction as settings so the checks below can
-- read them: psql does not interpolate its variables inside a DO block body.
SELECT
  set_config('ns_p17.creator_id', :'creator_id', true),
  set_config('ns_p17.reader_id',  :'reader_id',  true);

DO $$
BEGIN
  IF current_setting('ns_p17.creator_id') = current_setting('ns_p17.reader_id') THEN
    RAISE EXCEPTION
      'the creator and the reader must be two different profiles — a signal a creator can award themselves is not a signal';
  END IF;
END;
$$;

-- A throwaway build with a fixed slug, so the assertions below can address it
-- without carrying a psql variable into a DO block.
INSERT INTO public.builds (creator_id, slug, title, outcome, shape, status, published_at)
VALUES (
  :'creator_id'::uuid,
  'ns-p17-acceptance-build',
  'NS-P17 acceptance fixture',
  'Exists for the length of one transaction.',
  'app',
  'published',
  now()
);

DO $$
DECLARE
  _creator uuid;
BEGIN
  SELECT creator_id INTO _creator
  FROM public.builds WHERE slug = 'ns-p17-acceptance-build';

  IF _creator IS NULL THEN
    RAISE EXCEPTION 'setup failed: the fixture build was not inserted';
  END IF;
END;
$$;


-- =============================================================================
-- 1. A second person records a reproduction
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'reader_id', 'role', 'authenticated')::text,
  true
);

INSERT INTO public.build_reproductions (build_id, user_id, model_used, worked)
SELECT id, :'reader_id'::uuid, 'claude-sonnet-4-5', true
FROM public.builds WHERE slug = 'ns-p17-acceptance-build';

RESET ROLE;

DO $$
DECLARE
  b public.builds%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.builds WHERE slug = 'ns-p17-acceptance-build';

  IF b.reproduction_count <> 1 THEN
    RAISE EXCEPTION 'ACCEPTANCE 1 FAILED: reproduction_count is %, expected 1', b.reproduction_count;
  END IF;
  IF b.last_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'ACCEPTANCE 1 FAILED: last_confirmed_at is still null';
  END IF;
  IF b.last_confirmed_model IS DISTINCT FROM 'claude-sonnet-4-5' THEN
    RAISE EXCEPTION 'ACCEPTANCE 1 FAILED: last_confirmed_model is %, expected claude-sonnet-4-5', b.last_confirmed_model;
  END IF;

  RAISE NOTICE 'acceptance 1 passed: count 1, confirmed %, on %', b.last_confirmed_at, b.last_confirmed_model;
END;
$$;


-- =============================================================================
-- 2. `worked` flipping corrects the header, without any row disappearing
-- =============================================================================
-- This is what "recompute rather than increment" buys. An incrementing counter
-- cannot see this change at all.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'reader_id', 'role', 'authenticated')::text,
  true
);

UPDATE public.build_reproductions r
SET worked = false
FROM public.builds b
WHERE b.slug = 'ns-p17-acceptance-build' AND r.build_id = b.id;

RESET ROLE;

DO $$
DECLARE
  b public.builds%ROWTYPE;
  _rows integer;
BEGIN
  SELECT * INTO b FROM public.builds WHERE slug = 'ns-p17-acceptance-build';
  SELECT count(*) INTO _rows FROM public.build_reproductions WHERE build_id = b.id;

  IF _rows <> 1 THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: the reproduction row went missing, % rows', _rows;
  END IF;
  IF b.reproduction_count <> 0 THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: reproduction_count is %, expected 0', b.reproduction_count;
  END IF;
  IF b.last_confirmed_at IS NOT NULL OR b.last_confirmed_model IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: the confirmation columns were left behind';
  END IF;

  RAISE NOTICE 'check 2 passed: a row that stopped working stopped counting';
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'reader_id', 'role', 'authenticated')::text,
  true
);

UPDATE public.build_reproductions r
SET worked = true
FROM public.builds b
WHERE b.slug = 'ns-p17-acceptance-build' AND r.build_id = b.id;

RESET ROLE;

DO $$
DECLARE
  b public.builds%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.builds WHERE slug = 'ns-p17-acceptance-build';
  IF b.reproduction_count <> 1 OR b.last_confirmed_model IS DISTINCT FROM 'claude-sonnet-4-5' THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: the header did not come back, count % model %',
      b.reproduction_count, b.last_confirmed_model;
  END IF;
  RAISE NOTICE 'check 2 passed: flipping it back restored the header';
END;
$$;


-- =============================================================================
-- 3. The creator may not record a reproduction of their own build
-- =============================================================================
-- The insert below is EXPECTED TO FAIL with a row level security error. The
-- savepoint is what lets the transaction carry on afterwards.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'creator_id', 'role', 'authenticated')::text,
  true
);

SAVEPOINT creator_attempt;

\echo '--- the next statement is expected to fail ---'
\set ON_ERROR_STOP off

INSERT INTO public.build_reproductions (build_id, user_id, worked)
SELECT id, :'creator_id'::uuid, true
FROM public.builds WHERE slug = 'ns-p17-acceptance-build';

\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT creator_attempt;

RESET ROLE;

DO $$
DECLARE
  b public.builds%ROWTYPE;
  _self integer;
BEGIN
  SELECT * INTO b FROM public.builds WHERE slug = 'ns-p17-acceptance-build';
  SELECT count(*) INTO _self
  FROM public.build_reproductions
  WHERE build_id = b.id AND user_id = b.creator_id;

  IF _self <> 0 THEN
    RAISE EXCEPTION 'ACCEPTANCE 2 FAILED: the creator recorded % reproductions of their own build', _self;
  END IF;
  IF b.reproduction_count <> 1 THEN
    RAISE EXCEPTION 'ACCEPTANCE 2 FAILED: the refused attempt moved the counter to %', b.reproduction_count;
  END IF;

  RAISE NOTICE 'acceptance 2 passed: the policy refused the creator';
END;
$$;


-- =============================================================================
-- 4. Deleting the reproduction returns the header to where it started
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'reader_id', 'role', 'authenticated')::text,
  true
);

DELETE FROM public.build_reproductions r
USING public.builds b
WHERE b.slug = 'ns-p17-acceptance-build' AND r.build_id = b.id;

RESET ROLE;

DO $$
DECLARE
  b public.builds%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.builds WHERE slug = 'ns-p17-acceptance-build';

  IF b.reproduction_count <> 0 THEN
    RAISE EXCEPTION 'ACCEPTANCE 3 FAILED: reproduction_count is %, expected 0', b.reproduction_count;
  END IF;
  IF b.last_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'ACCEPTANCE 3 FAILED: last_confirmed_at is %, expected null', b.last_confirmed_at;
  END IF;
  IF b.last_confirmed_model IS NOT NULL THEN
    RAISE EXCEPTION 'ACCEPTANCE 3 FAILED: last_confirmed_model is %, expected null', b.last_confirmed_model;
  END IF;

  RAISE NOTICE 'acceptance 3 passed: the header went back to nothing';
END;
$$;

\echo 'ALL CHECKS PASSED'

ROLLBACK;
