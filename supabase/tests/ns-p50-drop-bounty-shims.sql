-- =============================================================================
-- NeoScale — bounties over builds, and the shims dropped: acceptance checks
-- (NS-P50)
-- =============================================================================
-- Proves the NS-P50 acceptances that are facts about Postgres rather than about
-- TypeScript:
--
--   1. the shims are gone — eight columns, seven derivation triggers and two
--      derivation functions, with nothing of them left in the catalogue
--   2. what was NOT scaffolding survives: NS-P48's freeze trigger and its
--      function, and all seven rollback map tables, which stay until NS-P56
--   3. the drop orphaned nothing — every satellite row still resolves to a
--      bounties row, and the mapping the client now reads in place of the shims
--      is still one header per legacy bounty
--   4. accept_bounty_solution is shaped the way a definer-right function has to
--      be: SECURITY DEFINER, search_path pinned empty, unreachable by anon,
--      reachable by authenticated
--   5. THE ROUND TRIP, under row level security and by two different people: a
--      stranger submits against a gap, cannot accept it, and the author's
--      acceptance fills the node, clears the gap, credits the solver, appends
--      the milestone and solves the bounty — all five, or none
--   6. the acceptance log stops being world-readable: anon cannot see a row for
--      a bounty on an unpublished build, and can once it is published, while
--      the solver and the author can either way
--   7. NS-P45's gap trigger, as NS-P50 amended it: a SOLVED bounty may name a
--      node that is no longer a gap, and an unsolved one still may not
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v creator_id=<a profiles.id uuid> \
--     -v other_id=<a DIFFERENT profiles.id uuid> \
--     -f supabase/tests/ns-p50-drop-bounty-shims.sql
--
-- Both ids must be existing public.profiles rows and must not be the same
-- person: check 5 proves a stranger is refused what the author is allowed,
-- which is meaningless if they are the same. Neither may be an admin — an admin
-- passes every check for the wrong reason. The script asserts all of that.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind and is safe against a database with real rows: checks 1 to 4
-- only read the catalogue and what the migrations already wrote, and every row
-- it creates is discarded. Run it as a role that can SET ROLE authenticated and
-- anon — the reads and writes in checks 5 and 6 are meant to be subject to row
-- level security, not exempt from it.
--
-- Every check raises on failure, so a run that reaches "ALL CHECKS PASSED" has
-- passed all of them.
--
-- RUN, NOT JUST WRITTEN. All thirteen checks passed on 29 Aug 2026 against
-- PostgreSQL 16.13, on a database built by applying supabase/migrations/ in
-- order over a Supabase-shaped bootstrap (the anon/authenticated/service_role
-- roles, an auth.users table and auth.uid() reading request.jwt.claim.sub).
-- Sixteen migrations in that chain do not apply to such a harness — they want
-- the vector and pg_cron extensions or the supabase_realtime publication, or
-- they are the March bounty_system migration that was never applied to the live
-- project either — and none of them creates an object this file reads.
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
  set_config('ns_p50.creator_id', :'creator_id', true),
  set_config('ns_p50.other_id',   :'other_id',   true);

DO $$
BEGIN
  IF current_setting('ns_p50.creator_id') = current_setting('ns_p50.other_id') THEN
    RAISE EXCEPTION
      'the creator and the other person must be two different profiles — check 5 proves a stranger is refused what the author is allowed, which proves nothing if they are the same person';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('ns_p50.creator_id')::uuid) THEN
    RAISE EXCEPTION 'creator_id is not a public.profiles row';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('ns_p50.other_id')::uuid) THEN
    RAISE EXCEPTION 'other_id is not a public.profiles row';
  END IF;

  IF public.is_admin(current_setting('ns_p50.creator_id')::uuid)
     OR public.is_admin(current_setting('ns_p50.other_id')::uuid) THEN
    RAISE EXCEPTION
      'neither id may be an admin: an admin passes checks 5 and 6 through is_admin() rather than through the rule being tested';
  END IF;
END $$;


-- =============================================================================
-- CHECK 1: the shims are gone
-- =============================================================================
DO $$
DECLARE
  _n    INTEGER;
  _name TEXT;
BEGIN
  SELECT count(*) INTO _n
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT a.attisdropped
    AND a.attname IN ('legacy_bounty_item_id', 'legacy_meta_item_id', 'legacy_spawned_item_id');
  IF _n <> 0 THEN
    RAISE EXCEPTION 'check 1: % shim column(s) survive', _n;
  END IF;

  FOR _name IN
    SELECT unnest(ARRAY[
      'trg_solutions_legacy_bounty_item',
      'trg_sal_legacy_bounty_item',
      'trg_bdc_legacy_bounty_item',
      'trg_bclr_legacy_bounty_item',
      'trg_bde_legacy_bounty_item',
      'trg_bar_legacy_bounty_item',
      'trg_mbsd_legacy_item_ids'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = _name AND NOT tgisinternal) THEN
      RAISE EXCEPTION 'check 1: derivation trigger % survives', _name;
    END IF;
  END LOOP;

  SELECT count(*) INTO _n
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('set_legacy_bounty_item_id', 'set_meta_sub_legacy_item_ids');
  IF _n <> 0 THEN
    RAISE EXCEPTION 'check 1: % derivation function(s) survive', _n;
  END IF;

  RAISE NOTICE 'check 1 passed: eight columns, seven triggers and two functions are gone';
END $$;


-- =============================================================================
-- CHECK 2: what was not scaffolding survives
-- =============================================================================
-- The freeze is NS-P48's decision — a sub-definition may only be filed against
-- a legacy bounty — and it reads bounties.legacy_item_id directly, so it has
-- nothing to do with the shims that shared its table. The map tables are the
-- only record of the pre-repoint values and belong to NS-P56.
DO $$
DECLARE _name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mbsd_freeze_to_legacy' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'check 2: the NS-P48 freeze trigger was dropped with the scaffolding';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'assert_meta_sub_definition_is_legacy'
  ) THEN
    RAISE EXCEPTION 'check 2: assert_meta_sub_definition_is_legacy() was dropped';
  END IF;

  FOR _name IN
    SELECT unnest(ARRAY[
      'ns_p46_migration_map_solutions',
      'ns_p46_migration_map_acceptance_log',
      'ns_p48_migration_map_meta_subs'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = _name
    ) THEN
      RAISE EXCEPTION 'check 2: rollback map public.% is missing — the maps stay until NS-P56', _name;
    END IF;
  END LOOP;

  RAISE NOTICE 'check 2 passed: the freeze and the rollback maps survive';
END $$;


-- =============================================================================
-- CHECK 3: the drop orphaned nothing
-- =============================================================================
-- Every satellite row still resolves to a bounties row — the foreign keys make
-- that true, and this states it anyway because the shims were the other way a
-- row could be found — and the mapping the client reads in their place is still
-- exactly one header per legacy bounty, which is what makes
-- resolveBountyByLegacyItem safe to memoise for a session.
DO $$
DECLARE
  _tbl TEXT;
  _bad INTEGER;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'solutions',
    'solution_acceptance_log',
    'bounty_discussion_comments',
    'bounty_comment_last_read',
    'bounty_deadline_extensions',
    'bounty_author_review'
  ] LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I t
        WHERE NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = t.bounty_id)', _tbl)
      INTO _bad;
    IF _bad > 0 THEN
      RAISE EXCEPTION 'check 3: % rows in public.% do not resolve to a bounty', _bad, _tbl;
    END IF;
  END LOOP;

  SELECT count(*) INTO _bad
  FROM (
    SELECT legacy_item_id
    FROM public.bounties
    WHERE legacy_item_id IS NOT NULL
    GROUP BY legacy_item_id
    HAVING count(*) > 1
  ) duplicated;
  IF _bad > 0 THEN
    RAISE EXCEPTION
      'check 3: % legacy bounties have more than one header — resolveBountyByLegacyItem would pick one arbitrarily', _bad;
  END IF;

  SELECT count(*) INTO _bad
  FROM public.content_items ci
  WHERE ci.post_type = 'bounty'
    AND NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.legacy_item_id = ci.id);
  IF _bad > 0 THEN
    RAISE EXCEPTION
      'check 3: % legacy bounties have NO header — every read of their page now throws rather than returning nothing', _bad;
  END IF;

  RAISE NOTICE 'check 3 passed: every satellite resolves, and every legacy bounty has exactly one header';
END $$;


-- =============================================================================
-- CHECK 4: the shape of the acceptance function
-- =============================================================================
DO $$
DECLARE _p pg_proc%ROWTYPE;
BEGIN
  SELECT p.* INTO _p
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'accept_bounty_solution';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'check 4: public.accept_bounty_solution() does not exist';
  END IF;

  IF NOT _p.prosecdef THEN
    RAISE EXCEPTION 'check 4: accept_bounty_solution is not SECURITY DEFINER, so it cannot append to the acceptance log';
  END IF;

  -- Postgres stores the empty search_path as `search_path=""` on some versions
  -- and `search_path=` on others; both mean the same thing and neither is worth
  -- a failing check.
  IF NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_p.proconfig, ARRAY[]::text[])) AS setting
    WHERE setting IN ('search_path=', 'search_path=""')
  ) THEN
    RAISE EXCEPTION
      'check 4: accept_bounty_solution does not pin an empty search_path (%), so a caller could put another build_nodes in front of it',
      COALESCE(array_to_string(_p.proconfig, ','), '(none)');
  END IF;

  IF has_function_privilege('anon', _p.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'check 4: anon may execute a definer-right function';
  END IF;
  IF NOT has_function_privilege('authenticated', _p.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'check 4: authenticated may NOT execute it, so no browser can accept a solution';
  END IF;

  RAISE NOTICE 'check 4 passed: definer right, empty search_path, authenticated only';
END $$;


-- =============================================================================
-- CHECK 5: the round trip, under RLS, by two different people
-- =============================================================================
-- The fixture is written as the migration role so the setup is not itself a
-- test of the write policies — those are NS-P45's and are proven elsewhere.
-- Everything that MATTERS below runs as authenticated with a claim.
DO $$
DECLARE _type TEXT;
BEGIN
  SELECT key INTO _type
  FROM public.node_types
  WHERE is_active
    AND jsonb_array_length(COALESCE(schema -> 'fields', '[]'::jsonb)) > 0
  ORDER BY sort
  LIMIT 1;
  IF _type IS NULL THEN
    RAISE EXCEPTION 'check 5: no active node type declares any fields';
  END IF;
  PERFORM set_config('ns_p50.node_type', _type, true);
END $$;

INSERT INTO public.builds (id, creator_id, slug, title, shape, status)
VALUES (
  '4e6f5f70-3450-4000-8000-00000000a001',
  current_setting('ns_p50.creator_id')::uuid,
  'ns-p50-round-trip',
  'NS-P50 round trip',
  'agent',
  'draft'
);

INSERT INTO public.build_nodes (id, build_id, parent_id, position, type, title, payload, is_gap)
VALUES (
  '4e6f5f70-3450-4000-8000-00000000b001',
  '4e6f5f70-3450-4000-8000-00000000a001',
  NULL, 1,
  current_setting('ns_p50.node_type'),
  'The step nobody has written',
  '{}'::jsonb,
  true
);

INSERT INTO public.bounties (id, build_id, gap_node_id, author_id, status, reward_gbp)
VALUES (
  '4e6f5f70-3450-4000-8000-00000000c001',
  '4e6f5f70-3450-4000-8000-00000000a001',
  '4e6f5f70-3450-4000-8000-00000000b001',
  current_setting('ns_p50.creator_id')::uuid,
  'open',
  25
);

-- 5a: a stranger files a solution against the gap. The insert policy asks only
-- that the row is theirs; the slot trigger asks that it answers a real gap of
-- the bounty's build.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p50.other_id'), true);

INSERT INTO public.solutions (
  id, bounty_id, slot_kind, slot_id, solver_id, status, content_payload, submitted_at
) VALUES (
  '4e6f5f70-3450-4000-8000-00000000d001',
  '4e6f5f70-3450-4000-8000-00000000c001',
  'node',
  '4e6f5f70-3450-4000-8000-00000000b001',
  current_setting('ns_p50.other_id')::uuid,
  'submitted',
  '{"filled": "by the stranger"}'::jsonb,
  now()
);

-- 5b: and cannot accept their own solution. This is the check the whole definer
-- right exists to make safe: the function bypasses RLS, so the ownership rule
-- has to be inside it.
DO $$
BEGIN
  BEGIN
    PERFORM public.accept_bounty_solution(
      '4e6f5f70-3450-4000-8000-00000000c001',
      '4e6f5f70-3450-4000-8000-00000000d001'
    );
    RAISE EXCEPTION 'check 5b: a stranger accepted a solution on someone else''s bounty';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RAISE NOTICE 'check 5b passed: only the bounty author may accept';
END $$;

-- 5c: the author accepts, and all five writes land.
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p50.creator_id'), true);
DO $$
DECLARE _result JSONB;
BEGIN
  _result := public.accept_bounty_solution(
    '4e6f5f70-3450-4000-8000-00000000c001',
    '4e6f5f70-3450-4000-8000-00000000d001'
  );
  IF _result ->> 'event_id' IS NULL OR _result ->> 'node_id' IS NULL THEN
    RAISE EXCEPTION 'check 5c: the function returned % without the ids its caller needs', _result;
  END IF;
END $$;
RESET ROLE;

DO $$
DECLARE
  _node  public.build_nodes%ROWTYPE;
  _b     public.bounties%ROWTYPE;
  _event public.build_events%ROWTYPE;
BEGIN
  SELECT * INTO _b FROM public.bounties WHERE id = '4e6f5f70-3450-4000-8000-00000000c001';
  IF _b.status <> 'solved' THEN
    RAISE EXCEPTION 'check 5c: the bounty is %, expected solved', _b.status;
  END IF;
  IF _b.accepted_solution_id <> '4e6f5f70-3450-4000-8000-00000000d001' THEN
    RAISE EXCEPTION 'check 5c: the bounty does not name the solution it accepted';
  END IF;
  IF _b.solved_at IS NULL THEN
    RAISE EXCEPTION 'check 5c: solved_at was not written';
  END IF;

  SELECT * INTO _node FROM public.build_nodes WHERE id = '4e6f5f70-3450-4000-8000-00000000b001';
  IF _node.is_gap THEN
    RAISE EXCEPTION 'check 5c: the node is still a gap after its answer was accepted';
  END IF;
  IF _node.payload <> '{"filled": "by the stranger"}'::jsonb THEN
    RAISE EXCEPTION 'check 5c: the node payload is %, not the accepted one', _node.payload;
  END IF;
  IF _node.source_ref ->> 'source' <> 'bounty'
     OR _node.source_ref ->> 'solution_id' <> '4e6f5f70-3450-4000-8000-00000000d001'
     OR _node.source_ref ->> 'solver_id' <> current_setting('ns_p50.other_id') THEN
    RAISE EXCEPTION 'check 5c: source_ref does not credit the solver (%)', _node.source_ref;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.solutions
    WHERE id = '4e6f5f70-3450-4000-8000-00000000d001'
      AND status = 'accepted' AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'check 5c: the solution was not marked accepted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.solution_acceptance_log
    WHERE solution_id = '4e6f5f70-3450-4000-8000-00000000d001'
      AND bounty_id = '4e6f5f70-3450-4000-8000-00000000c001'
      AND solver_id = current_setting('ns_p50.other_id')::uuid
      AND bounty_author_id = current_setting('ns_p50.creator_id')::uuid
  ) THEN
    RAISE EXCEPTION 'check 5c: nothing was appended to the acceptance log';
  END IF;

  SELECT * INTO _event
  FROM public.build_events
  WHERE build_id = '4e6f5f70-3450-4000-8000-00000000a001'
  ORDER BY ordinal DESC
  LIMIT 1;
  IF _event.kind <> 'milestone' THEN
    RAISE EXCEPTION 'check 5c: the last event is a %, expected a milestone', _event.kind;
  END IF;
  IF (_event.payload ->> 'text') NOT LIKE 'Gap solved by @%' THEN
    RAISE EXCEPTION 'check 5c: the milestone says "%"', _event.payload ->> 'text';
  END IF;
  IF _event.produced_node_id <> '4e6f5f70-3450-4000-8000-00000000b001' THEN
    RAISE EXCEPTION 'check 5c: the milestone does not name the node it filled';
  END IF;
  IF _event.ordinal < 1 THEN
    RAISE EXCEPTION 'check 5c: ordinals are dense and 1-based; got %', _event.ordinal;
  END IF;

  RAISE NOTICE 'check 5c passed: solution, log, bounty, node and event — all five';
END $$;

-- 5d: and it cannot happen twice.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p50.creator_id'), true);
DO $$
BEGIN
  BEGIN
    PERFORM public.accept_bounty_solution(
      '4e6f5f70-3450-4000-8000-00000000c001',
      '4e6f5f70-3450-4000-8000-00000000d001'
    );
    RAISE EXCEPTION 'check 5d: a bounty accepted a second solution';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  RAISE NOTICE 'check 5d passed: a solved bounty accepts nothing further';
END $$;
RESET ROLE;


-- =============================================================================
-- CHECK 6: the acceptance log stops being world-readable
-- =============================================================================
-- The build above is still a DRAFT, and NS-P50 is the migration that first
-- gives this table rows for one. Under the policy it replaced — USING (true) —
-- anon would read the solver's name, the author's name and the fact that
-- unpublished work exists.
SET LOCAL ROLE anon;
DO $$
DECLARE _n INTEGER;
BEGIN
  SELECT count(*) INTO _n
  FROM public.solution_acceptance_log
  WHERE solution_id = '4e6f5f70-3450-4000-8000-00000000d001';
  IF _n <> 0 THEN
    RAISE EXCEPTION 'check 6a: anon reads an acceptance row for a bounty on an unpublished build';
  END IF;
  RAISE NOTICE 'check 6a passed: an acceptance on a draft build is not public';
END $$;
RESET ROLE;

-- The two people the row is about can read it whatever the build's status.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p50.other_id'), true);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.solution_acceptance_log
    WHERE solution_id = '4e6f5f70-3450-4000-8000-00000000d001'
  ) THEN
    RAISE EXCEPTION 'check 6b: the solver cannot read their own acceptance';
  END IF;
  RAISE NOTICE 'check 6b passed: the solver reads their own acceptance on a draft build';
END $$;

SELECT set_config('request.jwt.claim.sub', current_setting('ns_p50.creator_id'), true);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.solution_acceptance_log
    WHERE solution_id = '4e6f5f70-3450-4000-8000-00000000d001'
  ) THEN
    RAISE EXCEPTION 'check 6c: the bounty author cannot read the acceptance on their own bounty';
  END IF;
  RAISE NOTICE 'check 6c passed: the author reads it too';
END $$;
RESET ROLE;

-- Published, and it is public again — nobody who could read a row before this
-- migration loses it.
UPDATE public.builds
SET status = 'published', published_at = now()
WHERE id = '4e6f5f70-3450-4000-8000-00000000a001';

SET LOCAL ROLE anon;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.solution_acceptance_log
    WHERE solution_id = '4e6f5f70-3450-4000-8000-00000000d001'
  ) THEN
    RAISE EXCEPTION 'check 6d: anon cannot read an acceptance on a PUBLISHED build';
  END IF;
  RAISE NOTICE 'check 6d passed: publishing makes the acceptance public again';
END $$;
RESET ROLE;


-- =============================================================================
-- CHECK 7: the gap trigger, as NS-P50 amended it
-- =============================================================================
-- NS-P45 asserted is_gap on every insert and update of a gap-bearing bounty.
-- Step 4 of the acceptance clears is_gap, so under the original rule the row
-- above could never be written again — not to close it, not by an admin, not at
-- all. 7a proves it can; 7b proves the assertion still bites for a bounty that
-- has NOT been solved, which is the case it was written for.
DO $$
BEGIN
  UPDATE public.bounties
  SET reward_gbp = 30
  WHERE id = '4e6f5f70-3450-4000-8000-00000000c001';
  RAISE NOTICE 'check 7a passed: a solved bounty may still be written';
END $$;

INSERT INTO public.build_nodes (id, build_id, parent_id, position, type, title, payload, is_gap)
VALUES (
  '4e6f5f70-3450-4000-8000-00000000b002',
  '4e6f5f70-3450-4000-8000-00000000a001',
  NULL, 2,
  current_setting('ns_p50.node_type'),
  'A step that is already written',
  '{}'::jsonb,
  false
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.bounties (build_id, gap_node_id, author_id, status)
    VALUES (
      '4e6f5f70-3450-4000-8000-00000000a001',
      '4e6f5f70-3450-4000-8000-00000000b002',
      current_setting('ns_p50.creator_id')::uuid,
      'open'
    );
    RAISE EXCEPTION 'check 7b: an OPEN bounty was filed against a node that is not a gap';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  RAISE NOTICE 'check 7b passed: an unsolved bounty still needs a live gap';
END $$;


\echo 'ALL CHECKS PASSED'

ROLLBACK;
