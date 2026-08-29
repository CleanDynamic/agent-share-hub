-- =============================================================================
-- NeoScale — the bounty surfaces: acceptance checks (NS-P52)
-- =============================================================================
-- Proves the NS-P52 acceptances that are facts about Postgres rather than about
-- TypeScript:
--
--   1. get_build_feed still has NS-P41's posture after being dropped and
--      recreated — SECURITY INVOKER, STABLE, search_path pinned empty,
--      executable by anon and authenticated — and it now declares the three
--      bounty columns on top of everything it declared before
--   2. the fourth arm has an index shaped like its WHERE clause, so it is an
--      ordered index scan rather than a sort over every open bounty
--   3. bounty_me_too_marks is what a new table on this project has to be: a
--      natural primary key, RLS enabled, its foreign keys indexed, and a
--      counter maintained by trigger rather than by a client
--   4. THE FEED CLAIM, end to end: an open bounty on a PUBLISHED build comes
--      back as item_kind 'bounty' carrying its reward and its gap node's
--      title; the same bounty on a DRAFT build does not; and solving it takes
--      it out of the feed, which is the acceptance "solved bounties leave the
--      open set"
--   5. the me-too rules, under row level security and as somebody who is not
--      the bounty's author: a mark moves the counter, a second mark by the
--      same person is refused by the primary key, a mark as somebody else is
--      refused by policy, and a mark on a solved bounty is refused by policy
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v creator_id=<a profiles.id uuid> \
--     -v other_id=<a DIFFERENT profiles.id uuid> \
--     -f supabase/tests/ns-p52-bounty-surfaces.sql
--
-- Both ids must be existing public.profiles rows and must not be the same
-- person: check 5 is about somebody who is NOT the author, which is meaningless
-- if they are the same. Neither may be an admin — an admin passes the policy
-- checks for the wrong reason. The script asserts all of that.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind and is safe against a database with real rows.
--
-- NOT RUN AT THE TIME OF WRITING. NS-P52 was implemented in an environment with
-- no egress to any Postgres — the Supabase host is refused by the sandbox's
-- proxy — so unlike the NS-P45 through NS-P50 check scripts, this one carries
-- no "all checks passed" line. It is written to be run by the operator who
-- applies 20260829200000 and 20260829220000, and the first run is where its own
-- correctness is established as well as the migrations'.
--
-- THE PLAN CHECK IS NOT IN HERE, because EXPLAIN output is not an assertion a
-- script can make portable. Run it by hand after applying:
--
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT * FROM public.get_build_feed(now(), 20);
--
-- Expect four Index Scan Backward nodes under the Append — one per arm,
-- including idx_bounties_feed_open — and no Seq Scan on builds,
-- build_reproductions or bounties. That is the NS-P41 check, re-run with the
-- arm this migration adds.
-- =============================================================================

\if :{?creator_id}
\else
  \echo 'ERROR: pass -v creator_id=<uuid> and -v other_id=<uuid>'
  \quit
\endif

\if :{?other_id}
\else
  \echo 'ERROR: pass -v other_id=<uuid>'
  \quit
\endif

\set ON_ERROR_STOP on

BEGIN;

SELECT
  set_config('ns_p52.creator_id', :'creator_id', true),
  set_config('ns_p52.other_id',   :'other_id',   true);

DO $$
BEGIN
  IF current_setting('ns_p52.creator_id') = current_setting('ns_p52.other_id') THEN
    RAISE EXCEPTION
      'the creator and the other person must be two different profiles — check 5 is about somebody who is not the author';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('ns_p52.creator_id')::uuid) THEN
    RAISE EXCEPTION 'creator_id is not a public.profiles row';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('ns_p52.other_id')::uuid) THEN
    RAISE EXCEPTION 'other_id is not a public.profiles row';
  END IF;

  IF public.is_admin(current_setting('ns_p52.creator_id')::uuid)
     OR public.is_admin(current_setting('ns_p52.other_id')::uuid) THEN
    RAISE EXCEPTION
      'neither id may be an admin: an admin passes check 5 through is_admin() rather than through the rule being tested';
  END IF;
END $$;


-- =============================================================================
-- CHECK 1: get_build_feed's posture and shape
-- =============================================================================
DO $$
DECLARE
  _p      pg_proc%ROWTYPE;
  _column TEXT;
BEGIN
  SELECT p.* INTO _p
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_build_feed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'check 1: public.get_build_feed does not exist';
  END IF;

  IF _p.prosecdef THEN
    RAISE EXCEPTION
      'check 1: get_build_feed is SECURITY DEFINER — every caller would get the same rows and this function would be the platform''s one hole';
  END IF;
  IF _p.provolatile <> 's' THEN
    RAISE EXCEPTION 'check 1: get_build_feed is not STABLE (provolatile = %)', _p.provolatile;
  END IF;
  -- Postgres stores the empty search_path as `search_path=""` on some versions
  -- and `search_path=` on others; both mean the same thing.
  IF NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_p.proconfig, ARRAY[]::TEXT[])) AS setting
    WHERE setting IN ('search_path=', 'search_path=""')
  ) THEN
    RAISE EXCEPTION
      'check 1: get_build_feed does not pin an empty search_path (%)',
      COALESCE(array_to_string(_p.proconfig, ','), '(none)');
  END IF;

  -- The grants a DROP took with it, re-issued by section 3 of the migration.
  IF NOT has_function_privilege('anon', _p.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'check 1: anon may not execute it, so a signed-out visitor gets no feed';
  END IF;
  IF NOT has_function_privilege('authenticated', _p.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'check 1: authenticated may not execute it';
  END IF;

  -- Everything NS-P41 declared is still declared: this migration adds, it does
  -- not reshape. Three of NS-P41's columns stand in for all of them here; the
  -- feed's own client fails loudly on a missing column anyway.
  FOREACH _column IN ARRAY ARRAY[
    'item_kind', 'item_at', 'build_id', 'slug', 'title', 'repro_worked',
    'cover_poster_path', 'bounty_id', 'bounty_reward_gbp', 'bounty_gap_title'
  ] LOOP
    IF NOT (_column = ANY(_p.proargnames)) THEN
      RAISE EXCEPTION 'check 1: get_build_feed does not return %', _column;
    END IF;
  END LOOP;

  RAISE NOTICE 'check 1 passed: invoker right, stable, empty search_path, both grants, three new columns';
END $$;


-- =============================================================================
-- CHECK 2: the fourth arm's index
-- =============================================================================
-- Partial and matching the arm's WHERE clause, so the planner can prove the
-- index covers the query. NS-P45's idx_bounties_status_closes cannot serve it:
-- it is (status, closes_at), and the feed orders by created_at.
DO $$
DECLARE _def TEXT;
BEGIN
  SELECT indexdef INTO _def
  FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = 'idx_bounties_feed_open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'check 2: idx_bounties_feed_open does not exist';
  END IF;

  IF _def !~ 'created_at DESC' THEN
    RAISE EXCEPTION 'check 2: the index is not keyed on created_at DESC: %', _def;
  END IF;
  IF _def !~* 'WHERE' OR _def !~ 'open' OR _def !~ 'build_id IS NOT NULL' THEN
    RAISE EXCEPTION 'check 2: the index is not partial on open build bounties: %', _def;
  END IF;

  RAISE NOTICE 'check 2 passed: idx_bounties_feed_open is partial and ordered';
END $$;


-- =============================================================================
-- CHECK 3: bounty_me_too_marks is shaped like a table on this project
-- =============================================================================
DO $$
DECLARE
  _oid   OID;
  _n     INTEGER;
  _name  TEXT;
  _expr  TEXT;
BEGIN
  SELECT c.oid INTO _oid
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'bounty_me_too_marks';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'check 3: public.bounty_me_too_marks does not exist';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = _oid) THEN
    RAISE EXCEPTION 'check 3: row level security is not enabled on bounty_me_too_marks';
  END IF;

  -- The natural key IS the rule: one mark per person per bounty.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = _oid AND contype = 'p'
      AND (SELECT count(*) FROM unnest(conkey)) = 2
  ) THEN
    RAISE EXCEPTION 'check 3: the primary key is not the (bounty_id, user_id) pair';
  END IF;

  -- Both foreign keys indexed: the pair's primary key leads with bounty_id,
  -- and user_id has its own index for the cascade from profiles.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_bounty_me_too_marks_user'
  ) THEN
    RAISE EXCEPTION 'check 3: user_id is unindexed, so deleting an account scans this table';
  END IF;

  SELECT count(*) INTO _n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'bounty_me_too_marks';
  IF _n < 3 THEN
    RAISE EXCEPTION 'check 3: expected the read, insert and delete policies, found %', _n;
  END IF;

  -- NO BARE auth.uid(). The bare form re-evaluates per row and is the single
  -- largest database cost in this codebase; every policy NS-P52 writes uses
  -- the cached form.
  --
  -- Tested by REMOVAL rather than by a lookbehind, which POSIX regular
  -- expressions do not have: strip every `(SELECT auth.uid() ...)` out of the
  -- stored expression, and if the words are still in what is left, one of them
  -- was bare. Postgres normalises the stored text — `( SELECT auth.uid() AS
  -- uid)` — so the pattern is written loosely enough to survive that.
  FOR _name, _expr IN
    SELECT policyname, concat_ws(' ', COALESCE(qual, ''), COALESCE(with_check, ''))
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bounty_me_too_marks'
  LOOP
    IF regexp_replace(_expr, '\( *SELECT +auth\.uid\(\)[^)]*\)', '', 'gi') ~* 'auth\.uid\(\)' THEN
      RAISE EXCEPTION
        'check 3: policy "%" calls auth.uid() outside a SELECT, which re-evaluates per row', _name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = _oid AND tgname = 'trg_bounty_me_too_count' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'check 3: the counter trigger is missing, so me_too_count is written by nothing';
  END IF;

  RAISE NOTICE 'check 3 passed: natural key, RLS, indexed foreign keys, three policies, counter trigger';
END $$;


-- =============================================================================
-- CHECK 4: the feed carries an open ask, and loses it when it is solved
-- =============================================================================
-- The fixture is written as the migration role: the write policies are NS-P45's
-- and are proven elsewhere. What matters here is what the FUNCTION returns.
DO $$
DECLARE _type TEXT;
BEGIN
  SELECT key INTO _type FROM public.node_types WHERE is_active ORDER BY sort LIMIT 1;
  IF _type IS NULL THEN
    RAISE EXCEPTION 'check 4: no active node type to hang a gap on';
  END IF;
  PERFORM set_config('ns_p52.node_type', _type, true);
END $$;

INSERT INTO public.builds (id, creator_id, slug, title, shape, status, published_at)
VALUES (
  '4e6f5f70-3452-4000-8000-00000000a001',
  current_setting('ns_p52.creator_id')::uuid,
  'ns-p52-feed-published',
  'NS-P52 feed, published',
  'agent',
  'published',
  now() - interval '1 hour'
);

-- The draft control. Its bounty is real and open; the arm's EXISTS is what
-- keeps it out of the feed, and a draft leaking here would leak the existence
-- of unpublished work.
INSERT INTO public.builds (id, creator_id, slug, title, shape, status)
VALUES (
  '4e6f5f70-3452-4000-8000-00000000a002',
  current_setting('ns_p52.creator_id')::uuid,
  'ns-p52-feed-draft',
  'NS-P52 feed, draft',
  'agent',
  'draft'
);

INSERT INTO public.build_nodes (id, build_id, parent_id, position, type, title, payload, is_gap)
VALUES
  (
    '4e6f5f70-3452-4000-8000-00000000b001',
    '4e6f5f70-3452-4000-8000-00000000a001',
    NULL, 1,
    current_setting('ns_p52.node_type'),
    'The retry prompt',
    '{}'::jsonb,
    true
  ),
  (
    '4e6f5f70-3452-4000-8000-00000000b002',
    '4e6f5f70-3452-4000-8000-00000000a002',
    NULL, 1,
    current_setting('ns_p52.node_type'),
    'A hole in a draft',
    '{}'::jsonb,
    true
  );

-- created_at IS SET EXPLICITLY, and it has to be. now() inside a transaction
-- is the TRANSACTION's timestamp, so a row defaulted to now() and a cursor of
-- now() are the same instant — and the feed's predicate is strictly `<`, which
-- would drop the row this check is about for a reason that has nothing to do
-- with the code.
INSERT INTO public.bounties (id, build_id, gap_node_id, author_id, status, reward_gbp, created_at)
VALUES
  (
    '4e6f5f70-3452-4000-8000-00000000c001',
    '4e6f5f70-3452-4000-8000-00000000a001',
    '4e6f5f70-3452-4000-8000-00000000b001',
    current_setting('ns_p52.creator_id')::uuid,
    'open',
    120,
    now() - interval '1 minute'
  ),
  (
    '4e6f5f70-3452-4000-8000-00000000c002',
    '4e6f5f70-3452-4000-8000-00000000a002',
    '4e6f5f70-3452-4000-8000-00000000b002',
    current_setting('ns_p52.creator_id')::uuid,
    'open',
    50,
    now() - interval '1 minute'
  );

-- Read as a signed-out visitor, which is the caller the feed was built for and
-- the one whose row level security has to hold.
SET LOCAL ROLE anon;

DO $$
DECLARE _row RECORD;
BEGIN
  SELECT * INTO _row
  FROM public.get_build_feed(now(), 50)
  WHERE build_id = '4e6f5f70-3452-4000-8000-00000000a001'
    AND item_kind = 'bounty';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'check 4: the open ask on a published build is not in the feed';
  END IF;

  IF _row.bounty_id <> '4e6f5f70-3452-4000-8000-00000000c001' THEN
    RAISE EXCEPTION 'check 4: the row names bounty %, not the one that was filed', _row.bounty_id;
  END IF;
  IF _row.bounty_reward_gbp <> 120 THEN
    RAISE EXCEPTION 'check 4: the reward came back as %, not 120', _row.bounty_reward_gbp;
  END IF;
  IF _row.bounty_gap_title <> 'The retry prompt' THEN
    RAISE EXCEPTION 'check 4: the gap title came back as "%"', _row.bounty_gap_title;
  END IF;
  -- The card fields ride with it, which is what stops the strip costing a
  -- query of its own.
  IF _row.slug IS NULL OR _row.creator_id IS NULL THEN
    RAISE EXCEPTION 'check 4: the bounty row is missing the build card fields';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.get_build_feed(now(), 50)
    WHERE build_id = '4e6f5f70-3452-4000-8000-00000000a002'
  ) THEN
    RAISE EXCEPTION 'check 4: an ask on a DRAFT build reached the feed';
  END IF;

  RAISE NOTICE 'check 4a passed: the open ask is in the feed, priced and named; the draft''s is not';
END $$;

RESET ROLE;

-- Solved, the way accept_bounty_solution solves it: the status first, then the
-- node stops being a gap. The order is NS-P50's and the gap trigger depends on
-- it.
UPDATE public.bounties
SET status = 'solved', solved_at = now()
WHERE id = '4e6f5f70-3452-4000-8000-00000000c001';

UPDATE public.build_nodes
SET is_gap = false
WHERE id = '4e6f5f70-3452-4000-8000-00000000b001';

SET LOCAL ROLE anon;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.get_build_feed(now(), 50)
    WHERE build_id = '4e6f5f70-3452-4000-8000-00000000a001'
      AND item_kind = 'bounty'
  ) THEN
    RAISE EXCEPTION 'check 4: a SOLVED bounty is still in the feed';
  END IF;

  RAISE NOTICE 'check 4b passed: solving it takes it out of the open set';
END $$;

RESET ROLE;


-- =============================================================================
-- CHECK 5: the me-too rules, as somebody who is not the author
-- =============================================================================
-- The second bounty is the one still open — check 4 solved the first — so the
-- insert policy's "on a bounty that is still asking" branch is exercised
-- against a real open row. Its build is a draft, which the READ policy on
-- bounties admits for its own creator only; the marks below are written as the
-- other person, so section 5b reads back through the migration role.
UPDATE public.builds
SET status = 'published', published_at = now()
WHERE id = '4e6f5f70-3452-4000-8000-00000000a002';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p52.other_id'), true);

INSERT INTO public.bounty_me_too_marks (bounty_id, user_id)
VALUES (
  '4e6f5f70-3452-4000-8000-00000000c002',
  current_setting('ns_p52.other_id')::uuid
);

DO $$
DECLARE _count INTEGER;
BEGIN
  SELECT me_too_count INTO _count
  FROM public.bounties WHERE id = '4e6f5f70-3452-4000-8000-00000000c002';
  IF _count <> 1 THEN
    RAISE EXCEPTION 'check 5: the counter reads % after one mark', _count;
  END IF;

  -- The same person again: the primary key, not a second vote.
  BEGIN
    INSERT INTO public.bounty_me_too_marks (bounty_id, user_id)
    VALUES (
      '4e6f5f70-3452-4000-8000-00000000c002',
      current_setting('ns_p52.other_id')::uuid
    );
    RAISE EXCEPTION 'check 5: a second mark by the same person was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- As somebody else: refused by policy, whatever the row says.
  BEGIN
    INSERT INTO public.bounty_me_too_marks (bounty_id, user_id)
    VALUES (
      '4e6f5f70-3452-4000-8000-00000000c002',
      current_setting('ns_p52.creator_id')::uuid
    );
    RAISE EXCEPTION 'check 5: a mark filed as somebody else was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- On a bounty that has been solved: refused, because the counter it moves is
  -- read beside the word "open".
  BEGIN
    INSERT INTO public.bounty_me_too_marks (bounty_id, user_id)
    VALUES (
      '4e6f5f70-3452-4000-8000-00000000c001',
      current_setting('ns_p52.other_id')::uuid
    );
    RAISE EXCEPTION 'check 5: a mark on a SOLVED bounty was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  RAISE NOTICE 'check 5a passed: one mark each, as yourself, on an open ask';
END $$;

-- Taking it back moves the counter the other way.
DELETE FROM public.bounty_me_too_marks
WHERE bounty_id = '4e6f5f70-3452-4000-8000-00000000c002'
  AND user_id = current_setting('ns_p52.other_id')::uuid;

RESET ROLE;

DO $$
DECLARE _count INTEGER;
BEGIN
  SELECT me_too_count INTO _count
  FROM public.bounties WHERE id = '4e6f5f70-3452-4000-8000-00000000c002';
  IF _count <> 0 THEN
    RAISE EXCEPTION 'check 5: the counter reads % after the mark was taken back', _count;
  END IF;

  RAISE NOTICE 'check 5b passed: the counter is derived from the rows, both ways';
END $$;


ROLLBACK;

\echo 'ALL CHECKS PASSED (nothing was left behind — the script ended in ROLLBACK)'
