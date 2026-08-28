-- =============================================================================
-- NeoScale — solutions repointed at bounties, acceptance checks (NS-P46)
-- =============================================================================
-- Proves the NS-P46 acceptances that are facts about Postgres rather than about
-- TypeScript:
--
--   1. the repoint lost nothing and invented nothing — row counts match the
--      rollback map tables, every bounty_id resolves to a bounties row, and
--      every shim value agrees with the mapping it was derived from
--   2. the shape changed the way the migration says it did: the old trigger and
--      its function are gone, the new ones are there, both foreign keys point
--      at bounties with the delete actions they had before, and slot_kind has
--      learned 'node'
--   3. solution_votes and solution_comments were not touched — they still
--      foreign-key solutions(id)
--   4. the slot validation trigger rejects all four wrong combinations and
--      accepts both right ones: a node slot needs a gap node OF THE BOUNTY'S
--      BUILD, and a stage or block slot needs a legacy bounty
--   5. the shim column is derived and cannot be authored — a client that sends
--      the wrong legacy_bounty_item_id gets the right one stored
--   6. THE LIVE ACCEPTANCE: a legacy bounty page still finds its solutions
--      through the shim, as anon, and a signed-in reader can still vote on one
--   7. bounties.accepted_solution_id survives its solution being deleted
--   8. the acceptance log still refuses to let a solved bounty be deleted
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v creator_id=<a profiles.id uuid> \
--     -v other_id=<a DIFFERENT profiles.id uuid> \
--     -f supabase/tests/ns-p46-repoint-solutions.sql
--
-- Both ids must be existing public.profiles rows and must not be the same
-- person: check 6 proves a reader who is neither the author nor the solver can
-- still see a submitted solution, which is meaningless if they are. Neither may
-- be an admin — is_admin passes policies here by design. The script asserts
-- both.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind and is safe against a database with real rows: checks 1 to 3
-- only read what the migration already wrote, and every row it creates is
-- discarded. Run it as a role that can SET ROLE authenticated and anon — the
-- reads and writes in check 6 are meant to be subject to row level security,
-- not exempt from it.
--
-- Every check raises on failure, so a run that reaches "ALL CHECKS PASSED" has
-- passed all of them.
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
  set_config('ns_p46.creator_id', :'creator_id', true),
  set_config('ns_p46.other_id',   :'other_id',   true);

DO $$
BEGIN
  IF current_setting('ns_p46.creator_id') = current_setting('ns_p46.other_id') THEN
    RAISE EXCEPTION
      'the creator and the other person must be two different profiles — check 6 proves a third party can read a submitted solution, which proves nothing if they are the same person';
  END IF;

  IF public.is_admin(current_setting('ns_p46.creator_id')::uuid)
     OR public.is_admin(current_setting('ns_p46.other_id')::uuid) THEN
    RAISE EXCEPTION
      'neither id may belong to an admin — every policy under test admits admins';
  END IF;
END;
$$;


-- =============================================================================
-- 1. The repoint — read-only, against whatever this database already holds
-- =============================================================================
-- Runs before anything is inserted, so the numbers are the migration's own.
-- The map tables are the only surviving record of what the row counts were
-- before the repoint, which is exactly why they are what "unchanged" is
-- measured against.
DO $$
DECLARE
  _sol_now    INTEGER;
  _sol_was    INTEGER;
  _log_now    INTEGER;
  _log_was    INTEGER;
  _unresolved INTEGER;
  _disagree   INTEGER;
  _lost       INTEGER;
BEGIN
  SELECT count(*) INTO _sol_now FROM public.solutions;
  SELECT count(*) INTO _sol_was FROM public.ns_p46_migration_map_solutions;
  SELECT count(*) INTO _log_now FROM public.solution_acceptance_log;
  SELECT count(*) INTO _log_was FROM public.ns_p46_migration_map_acceptance_log;

  IF _sol_now < _sol_was OR _log_now < _log_was THEN
    RAISE EXCEPTION
      'check 1 failed: rows disappeared. solutions % -> %, acceptance log % -> %',
      _sol_was, _sol_now, _log_was, _log_now;
  END IF;

  -- Every row the migration repointed is still there, under the same id.
  SELECT count(*) INTO _lost
  FROM public.ns_p46_migration_map_solutions m
  WHERE NOT EXISTS (SELECT 1 FROM public.solutions s WHERE s.id = m.id);
  IF _lost <> 0 THEN
    RAISE EXCEPTION 'check 1 failed: % mapped solutions rows no longer exist', _lost;
  END IF;

  -- Every bounty_id names a bounties row. This is the acceptance's "every
  -- solutions.bounty_id resolves to a bounties row", asked of the data rather
  -- than of the foreign key that also asserts it.
  SELECT count(*) INTO _unresolved
  FROM public.solutions s
  WHERE NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = s.bounty_id);
  IF _unresolved <> 0 THEN
    RAISE EXCEPTION 'check 1 failed: % solutions rows do not resolve to a bounty', _unresolved;
  END IF;

  SELECT count(*) INTO _unresolved
  FROM public.solution_acceptance_log l
  WHERE NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = l.bounty_id);
  IF _unresolved <> 0 THEN
    RAISE EXCEPTION 'check 1 failed: % acceptance log rows do not resolve to a bounty', _unresolved;
  END IF;

  -- The mapping is reversible: each map row's old value is the legacy_item_id
  -- of the bounty its row now points at. If this holds, the rollback UPDATE in
  -- the migration's section 2 puts every row back exactly where it was.
  SELECT count(*) INTO _disagree
  FROM public.ns_p46_migration_map_solutions m
  JOIN public.solutions s ON s.id = m.id
  JOIN public.bounties b  ON b.id = s.bounty_id
  WHERE b.legacy_item_id IS DISTINCT FROM m.old_bounty_id;
  IF _disagree <> 0 THEN
    RAISE EXCEPTION 'check 1 failed: % rows cannot be rolled back — the map disagrees with the mapping', _disagree;
  END IF;

  -- The shim agrees with the mapping on every row, which is what makes the
  -- legacy read path in check 6 return the right bounty's solutions and not
  -- somebody else's.
  SELECT count(*) INTO _disagree
  FROM public.solutions s
  JOIN public.bounties b ON b.id = s.bounty_id
  WHERE s.legacy_bounty_item_id IS DISTINCT FROM b.legacy_item_id;
  IF _disagree <> 0 THEN
    RAISE EXCEPTION 'check 1 failed: % solutions rows have a stale legacy_bounty_item_id', _disagree;
  END IF;

  SELECT count(*) INTO _disagree
  FROM public.solution_acceptance_log l
  JOIN public.bounties b ON b.id = l.bounty_id
  WHERE l.legacy_bounty_item_id IS DISTINCT FROM b.legacy_item_id;
  IF _disagree <> 0 THEN
    RAISE EXCEPTION 'check 1 failed: % acceptance log rows have a stale legacy_bounty_item_id', _disagree;
  END IF;

  RAISE NOTICE 'check 1 passed: % solutions and % acceptance log rows, all resolving, all reversible',
    _sol_now, _log_now;
END;
$$;


-- =============================================================================
-- 2. The shape
-- =============================================================================
DO $$
DECLARE
  _def TEXT;
BEGIN
  -- The old validator is gone, both halves of it.
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.solutions'::regclass
      AND tgname = 'trg_validate_solution_bounty' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'check 2 failed: trg_validate_solution_bounty is still attached';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'validate_solution_bounty'
  ) THEN
    RAISE EXCEPTION 'check 2 failed: public.validate_solution_bounty() still exists';
  END IF;

  -- The new one is there, and so is the shim derivation on both tables.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.solutions'::regclass
      AND tgname = 'trg_validate_solution_slot' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'check 2 failed: trg_validate_solution_slot is not attached';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.solutions'::regclass
      AND tgname = 'trg_solutions_legacy_bounty_item' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.solution_acceptance_log'::regclass
      AND tgname = 'trg_sal_legacy_bounty_item' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'check 2 failed: the shim derivation trigger is missing from one of the two tables';
  END IF;

  -- Both validation functions run with a pinned, empty search_path. A
  -- SECURITY DEFINER function without one is a privilege escalation waiting for
  -- a caller who sets their own path.
  -- Postgres stores the pinned empty path as search_path="" rather than
  -- search_path=, so both spellings count.
  IF (
    SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('validate_solution_slot', 'set_legacy_bounty_item_id')
      AND p.prosecdef
      AND EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg
        WHERE cfg IN ('search_path=', 'search_path=""')
      )
  ) <> 2 THEN
    RAISE EXCEPTION 'check 2 failed: the new functions are not both SECURITY DEFINER with search_path pinned empty';
  END IF;

  -- solutions -> bounties, CASCADE. The action matters: it is what makes
  -- deleting a bounty take its answers with it.
  SELECT pg_get_constraintdef(c.oid) INTO _def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.solutions'::regclass
    AND c.contype = 'f'
    AND c.confrelid = 'public.bounties'::regclass;
  IF _def IS NULL OR _def NOT ILIKE '%ON DELETE CASCADE%' THEN
    RAISE EXCEPTION 'check 2 failed: solutions.bounty_id is not ON DELETE CASCADE to bounties (found: %)', COALESCE(_def, 'no such constraint');
  END IF;

  -- solution_acceptance_log -> bounties, RESTRICT. Also the action: an
  -- append-only log that cascades is not append-only.
  SELECT pg_get_constraintdef(c.oid) INTO _def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.solution_acceptance_log'::regclass
    AND c.contype = 'f'
    AND c.confrelid = 'public.bounties'::regclass;
  IF _def IS NULL OR _def NOT ILIKE '%ON DELETE RESTRICT%' THEN
    RAISE EXCEPTION 'check 2 failed: solution_acceptance_log.bounty_id is not ON DELETE RESTRICT to bounties (found: %)', COALESCE(_def, 'no such constraint');
  END IF;

  -- Neither table may still point at content_items through bounty_id.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid IN ('public.solutions'::regclass, 'public.solution_acceptance_log'::regclass)
      AND c.confrelid = 'public.content_items'::regclass
      AND c.conkey = ARRAY[(
        SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = c.conrelid AND a.attname = 'bounty_id'
      )]::SMALLINT[]
  ) THEN
    RAISE EXCEPTION 'check 2 failed: a bounty_id -> content_items foreign key survived the repoint';
  END IF;

  -- The deferred foreign key from NS-P45 is wired, and lets go rather than
  -- taking the bounty with it.
  SELECT pg_get_constraintdef(c.oid) INTO _def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.bounties'::regclass
    AND c.contype = 'f'
    AND c.confrelid = 'public.solutions'::regclass;
  IF _def IS NULL OR _def NOT ILIKE '%ON DELETE SET NULL%' THEN
    RAISE EXCEPTION 'check 2 failed: bounties.accepted_solution_id is not ON DELETE SET NULL to solutions (found: %)', COALESCE(_def, 'no such constraint');
  END IF;

  -- slot_kind knows all three words and no others.
  SELECT pg_get_constraintdef(c.oid) INTO _def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.solutions'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%slot_kind%';
  IF _def IS NULL OR _def NOT LIKE '%node%' OR _def NOT LIKE '%stage%' OR _def NOT LIKE '%block%' THEN
    RAISE EXCEPTION 'check 2 failed: solutions.slot_kind check is not (stage, block, node) (found: %)', COALESCE(_def, 'no such constraint');
  END IF;

  RAISE NOTICE 'check 2 passed: triggers replaced, both foreign keys repointed with their delete actions, slot_kind widened';
END;
$$;


-- =============================================================================
-- 3. What NS-P46 promised not to touch
-- =============================================================================
DO $$
DECLARE _n INTEGER;
BEGIN
  SELECT count(DISTINCT c.conrelid) INTO _n
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid IN ('public.solution_votes'::regclass, 'public.solution_comments'::regclass)
    AND c.confrelid = 'public.solutions'::regclass;

  IF _n <> 2 THEN
    RAISE EXCEPTION 'check 3 failed: solution_votes and solution_comments do not both still foreign-key solutions';
  END IF;

  -- And neither of them acquired a bounty_id of its own along the way.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('solution_votes', 'solution_comments')
      AND column_name = 'bounty_id'
  ) THEN
    RAISE EXCEPTION 'check 3 failed: a bounty_id column appeared on solution_votes or solution_comments';
  END IF;

  RAISE NOTICE 'check 3 passed: solution_votes and solution_comments still point at solutions, unchanged';
END;
$$;


-- =============================================================================
-- Setup — one legacy bounty and one build-backed bounty, both the creator's
-- =============================================================================
-- Inserted as the invoking role, which owns these tables and is therefore not
-- subject to their policies. That is deliberate: this block is fixture
-- construction, and the policies are what check 6 tests, under the roles that
-- have to live with them.
--
-- The legacy bounty gets its bounties header written by hand. The NS-P45
-- backfill already ran, so anything created afterwards has to carry its own —
-- which is the shape of the world until NS-P50 writes headers at publish time.
INSERT INTO public.content_items (id, creator_id, title, slug, post_type, content_type, difficulty, status, stage_grids)
VALUES (
  '4e6f5f70-3436-4000-8000-00000000c17e',
  current_setting('ns_p46.creator_id')::uuid,
  'NS-P46 legacy bounty', 'ns-p46-legacy-bounty', 'bounty', 'blueprint', 'intermediate', 'approved',
  '{"stages": {}}'::jsonb
);

INSERT INTO public.bounties (id, legacy_item_id, author_id, status)
VALUES (
  '4e6f5f70-3436-4000-8000-00000000b0c0',
  '4e6f5f70-3436-4000-8000-00000000c17e',
  current_setting('ns_p46.creator_id')::uuid,
  'open'
);

INSERT INTO public.builds (id, creator_id, slug, title, outcome, shape, status, published_at)
VALUES (
  '4e6f5f70-3436-4000-8000-0000000b011d',
  current_setting('ns_p46.creator_id')::uuid,
  'ns-p46-build', 'NS-P46 build', 'Exists for the length of one transaction.', 'app', 'published', now()
);

INSERT INTO public.build_nodes (id, build_id, type, title, is_gap) VALUES
  ('4e6f5f70-3436-4000-8000-000000009a70', '4e6f5f70-3436-4000-8000-0000000b011d', 'gap',  'The gap',   true),
  ('4e6f5f70-3436-4000-8000-00000000f111', '4e6f5f70-3436-4000-8000-0000000b011d', 'note', 'Not a gap', false);

INSERT INTO public.bounties (id, build_id, gap_node_id, author_id, status)
VALUES (
  '4e6f5f70-3436-4000-8000-00000000b111',
  '4e6f5f70-3436-4000-8000-0000000b011d',
  '4e6f5f70-3436-4000-8000-000000009a70',
  current_setting('ns_p46.creator_id')::uuid,
  'open'
);


-- =============================================================================
-- 4. The slot validation trigger — four ways to be wrong, two to be right
-- =============================================================================
-- Each failing insert gets its own BEGIN/EXCEPTION block, which opens a
-- subtransaction: the failure is caught and the outer transaction survives to
-- run the next one.
DO $$
DECLARE _ok BOOLEAN;
BEGIN
  -- (a) node slot, non-gap node of the right build — rejected.
  _ok := false;
  BEGIN
    INSERT INTO public.solutions (bounty_id, slot_kind, slot_id, solver_id, status, content_payload)
    VALUES ('4e6f5f70-3436-4000-8000-00000000b111', 'node',
            '4e6f5f70-3436-4000-8000-00000000f111',
            current_setting('ns_p46.other_id')::uuid, 'submitted', '{"a":1}'::jsonb);
  EXCEPTION WHEN check_violation THEN _ok := true;
  END;
  IF NOT _ok THEN
    RAISE EXCEPTION 'check 4a failed: a node solution against a node that is not a gap was accepted';
  END IF;

  -- (b) node slot, gap node of ANOTHER build — rejected. The node is a real
  --     gap; it is not this bounty's gap, which is the whole point of reading
  --     build_id in the trigger rather than is_gap alone.
  _ok := false;
  BEGIN
    INSERT INTO public.builds (id, creator_id, slug, title, outcome, shape, status)
    VALUES ('4e6f5f70-3436-4000-8000-0000000b012d', current_setting('ns_p46.creator_id')::uuid,
            'ns-p46-other-build', 'NS-P46 other build', 'Also transient.', 'app', 'published');
    INSERT INTO public.build_nodes (id, build_id, type, title, is_gap)
    VALUES ('4e6f5f70-3436-4000-8000-000000009a71', '4e6f5f70-3436-4000-8000-0000000b012d', 'gap', 'Another gap', true);

    INSERT INTO public.solutions (bounty_id, slot_kind, slot_id, solver_id, status, content_payload)
    VALUES ('4e6f5f70-3436-4000-8000-00000000b111', 'node',
            '4e6f5f70-3436-4000-8000-000000009a71',
            current_setting('ns_p46.other_id')::uuid, 'submitted', '{"a":1}'::jsonb);
  EXCEPTION WHEN check_violation THEN _ok := true;
  END;
  IF NOT _ok THEN
    RAISE EXCEPTION 'check 4b failed: a node solution against another build''s gap node was accepted';
  END IF;

  -- (c) node slot against a LEGACY bounty — rejected. A legacy bounty has no
  --     build, so it can have no nodes.
  _ok := false;
  BEGIN
    INSERT INTO public.solutions (bounty_id, slot_kind, slot_id, solver_id, status, content_payload)
    VALUES ('4e6f5f70-3436-4000-8000-00000000b0c0', 'node',
            '4e6f5f70-3436-4000-8000-000000009a70',
            current_setting('ns_p46.other_id')::uuid, 'submitted', '{"a":1}'::jsonb);
  EXCEPTION WHEN check_violation THEN _ok := true;
  END;
  IF NOT _ok THEN
    RAISE EXCEPTION 'check 4c failed: a node solution against a legacy bounty was accepted';
  END IF;

  -- (d) stage slot against a NEW-PATH bounty — rejected. A build has no
  --     stage_grids, so 'stage' names nothing there.
  _ok := false;
  BEGIN
    INSERT INTO public.solutions (bounty_id, slot_kind, slot_id, solver_id, status, content_payload)
    VALUES ('4e6f5f70-3436-4000-8000-00000000b111', 'stage',
            '4e6f5f70-3436-4000-8000-000000009a70',
            current_setting('ns_p46.other_id')::uuid, 'submitted', '{"a":1}'::jsonb);
  EXCEPTION WHEN check_violation THEN _ok := true;
  END;
  IF NOT _ok THEN
    RAISE EXCEPTION 'check 4d failed: a stage solution against a build-backed bounty was accepted';
  END IF;

  RAISE NOTICE 'check 4 passed: all four wrong slot/bounty combinations rejected';
END;
$$;

-- The two right ones, outside the exception blocks so that a failure here is
-- reported as itself rather than caught. These rows are used by checks 5 to 8.
INSERT INTO public.solutions (id, bounty_id, slot_kind, slot_id, solver_id, status, content_payload, legacy_bounty_item_id)
VALUES (
  '4e6f5f70-3436-4000-8000-000000005001',
  '4e6f5f70-3436-4000-8000-00000000b111', 'node',
  '4e6f5f70-3436-4000-8000-000000009a70',
  current_setting('ns_p46.other_id')::uuid, 'submitted', '{"answer":"node"}'::jsonb,
  -- Deliberately wrong, and deliberately not NULL: check 5 is that the
  -- database ignores what the client sent here.
  '4e6f5f70-3436-4000-8000-00000000c17e'
);

INSERT INTO public.solutions (id, bounty_id, slot_kind, slot_id, solver_id, status, content_payload)
VALUES (
  '4e6f5f70-3436-4000-8000-000000005002',
  '4e6f5f70-3436-4000-8000-00000000b0c0', 'stage',
  '4e6f5f70-3436-4000-8000-000000005107',
  current_setting('ns_p46.other_id')::uuid, 'submitted', '{"answer":"stage"}'::jsonb
);

-- A draft on the same legacy bounty, by the same solver. Check 6 proves anon
-- cannot see it.
INSERT INTO public.solutions (id, bounty_id, slot_kind, slot_id, solver_id, status, content_payload)
VALUES (
  '4e6f5f70-3436-4000-8000-000000005003',
  '4e6f5f70-3436-4000-8000-00000000b0c0', 'stage',
  '4e6f5f70-3436-4000-8000-000000005108',
  current_setting('ns_p46.other_id')::uuid, 'draft', '{}'::jsonb
);

INSERT INTO public.solution_comments (solution_id, author_id, body)
VALUES ('4e6f5f70-3436-4000-8000-000000005002', current_setting('ns_p46.creator_id')::uuid, 'Reads well.');


-- =============================================================================
-- 5. The shim is derived, not authored
-- =============================================================================
DO $$
DECLARE
  _node_shim   UUID;
  _legacy_shim UUID;
BEGIN
  SELECT legacy_bounty_item_id INTO _node_shim
  FROM public.solutions WHERE id = '4e6f5f70-3436-4000-8000-000000005001';

  -- The insert sent a content_items id on a build-backed bounty. The trigger
  -- overwrote it with the truth, which is that there is no legacy item.
  IF _node_shim IS NOT NULL THEN
    RAISE EXCEPTION
      'check 5 failed: a client-supplied legacy_bounty_item_id survived on a build-backed solution (%)', _node_shim;
  END IF;

  SELECT legacy_bounty_item_id INTO _legacy_shim
  FROM public.solutions WHERE id = '4e6f5f70-3436-4000-8000-000000005002';

  -- Nothing was sent for this one, and it was filled in anyway.
  IF _legacy_shim IS DISTINCT FROM '4e6f5f70-3436-4000-8000-00000000c17e'::uuid THEN
    RAISE EXCEPTION
      'check 5 failed: legacy_bounty_item_id was not derived on a legacy solution (got %)', _legacy_shim;
  END IF;

  RAISE NOTICE 'check 5 passed: the shim column is written by the database, whatever the client sends';
END;
$$;


-- =============================================================================
-- 6. THE LIVE ACCEPTANCE — the legacy bounty page, as the people who use it
-- =============================================================================
-- "A legacy bounty page renders its solutions and accepts a vote (shim)."
-- The page has one thing to go on: the content_items id in its route. This is
-- that query, run as anon, followed by that vote, run as a signed-in reader who
-- is neither the author nor the solver.
SET LOCAL ROLE anon;

DO $$
DECLARE
  _visible INTEGER;
  _drafts  INTEGER;
  _comments INTEGER;
BEGIN
  -- The listing query, verbatim in shape: solutions of this legacy bounty,
  -- found through the shim column, non-draft only.
  SELECT count(*) INTO _visible
  FROM public.solutions
  WHERE legacy_bounty_item_id = '4e6f5f70-3436-4000-8000-00000000c17e'
    AND status IN ('submitted', 'accepted');

  IF _visible < 1 THEN
    RAISE EXCEPTION
      'check 6 failed: anon cannot see the submitted solution of an approved legacy bounty through the shim';
  END IF;

  -- The draft stays private. The read policy is the thing being tested here,
  -- not the WHERE clause, so the query does not filter on status.
  SELECT count(*) INTO _drafts
  FROM public.solutions
  WHERE legacy_bounty_item_id = '4e6f5f70-3436-4000-8000-00000000c17e'
    AND status = 'draft';

  IF _drafts <> 0 THEN
    RAISE EXCEPTION 'check 6 failed: anon can see % draft solution(s)', _drafts;
  END IF;

  -- Comment counts on that page come through solution_comments, whose read
  -- policy also had to be rewritten. Zero here means the page renders every
  -- solution with "0 comments" for signed-out readers.
  SELECT count(*) INTO _comments
  FROM public.solution_comments
  WHERE solution_id = '4e6f5f70-3436-4000-8000-000000005002';

  IF _comments <> 1 THEN
    RAISE EXCEPTION
      'check 6 failed: anon sees % comments on a public solution, expected 1', _comments;
  END IF;

  RAISE NOTICE 'check 6a passed: anon lists the bounty''s solutions through the shim, sees its comments, and cannot see its drafts';
END;
$$;

RESET ROLE;

-- The vote. A signed-in third party, through the policies, on the solution the
-- page just listed.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('ns_p46.creator_id'), 'role', 'authenticated')::text,
  true
);

INSERT INTO public.solution_votes (solution_id, voter_id, vote_kind)
VALUES ('4e6f5f70-3436-4000-8000-000000005002', current_setting('ns_p46.creator_id')::uuid, 'upvote');

RESET ROLE;

DO $$
DECLARE _votes INTEGER;
BEGIN
  SELECT vote_count INTO _votes
  FROM public.solutions WHERE id = '4e6f5f70-3436-4000-8000-000000005002';

  -- The counter is maintained by a trigger on solution_votes that writes to
  -- solutions. If the repoint had broken that path, the vote would land and the
  -- count would not move.
  IF _votes <> 1 THEN
    RAISE EXCEPTION 'check 6 failed: the vote did not reach the counter (vote_count = %)', _votes;
  END IF;

  RAISE NOTICE 'check 6b passed: a signed-in reader voted on a solution and the counter moved';
END;
$$;


-- =============================================================================
-- 7. bounties.accepted_solution_id lets go
-- =============================================================================
DO $$
DECLARE
  _ok        BOOLEAN := false;
  _still_set UUID;
BEGIN
  -- It will not take just any uuid.
  BEGIN
    UPDATE public.bounties
    SET accepted_solution_id = '4e6f5f70-3436-4000-8000-00000000dead'
    WHERE id = '4e6f5f70-3436-4000-8000-00000000b111';
  EXCEPTION WHEN foreign_key_violation THEN _ok := true;
  END;
  IF NOT _ok THEN
    RAISE EXCEPTION 'check 7 failed: accepted_solution_id accepted a uuid that is not a solution';
  END IF;

  UPDATE public.bounties
  SET accepted_solution_id = '4e6f5f70-3436-4000-8000-000000005001'
  WHERE id = '4e6f5f70-3436-4000-8000-00000000b111';

  DELETE FROM public.solutions WHERE id = '4e6f5f70-3436-4000-8000-000000005001';

  SELECT accepted_solution_id INTO _still_set
  FROM public.bounties WHERE id = '4e6f5f70-3436-4000-8000-00000000b111';

  IF _still_set IS NOT NULL THEN
    RAISE EXCEPTION 'check 7 failed: the bounty still points at a deleted solution (%)', _still_set;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bounties WHERE id = '4e6f5f70-3436-4000-8000-00000000b111') THEN
    RAISE EXCEPTION 'check 7 failed: deleting the accepted solution deleted the bounty';
  END IF;

  RAISE NOTICE 'check 7 passed: a deleted solution nulls the pointer and leaves the bounty standing';
END;
$$;


-- =============================================================================
-- 8. The acceptance log still refuses
-- =============================================================================
-- The log points at bounties now, not at content_items, so the chain that
-- protects it is longer: deleting the content item cascades to its bounty, and
-- the bounty cannot go while a log row names it. Same outcome as before the
-- repoint — the delete fails — reached one table further along.
DO $$
DECLARE _ok BOOLEAN := false;
BEGIN
  INSERT INTO public.solution_acceptance_log
    (solution_id, bounty_id, solver_id, bounty_author_id, slot_kind, slot_id)
  VALUES (
    '4e6f5f70-3436-4000-8000-000000005002',
    '4e6f5f70-3436-4000-8000-00000000b0c0',
    current_setting('ns_p46.other_id')::uuid,
    current_setting('ns_p46.creator_id')::uuid,
    'stage',
    '4e6f5f70-3436-4000-8000-000000005107'
  );

  -- The shim on the log is derived too.
  IF (SELECT legacy_bounty_item_id FROM public.solution_acceptance_log
      WHERE solution_id = '4e6f5f70-3436-4000-8000-000000005002')
     IS DISTINCT FROM '4e6f5f70-3436-4000-8000-00000000c17e'::uuid THEN
    RAISE EXCEPTION 'check 8 failed: the acceptance log shim was not derived';
  END IF;

  BEGIN
    DELETE FROM public.content_items WHERE id = '4e6f5f70-3436-4000-8000-00000000c17e';
  EXCEPTION WHEN foreign_key_violation THEN _ok := true;
  END;

  IF NOT _ok THEN
    RAISE EXCEPTION 'check 8 failed: a content item with an accepted solution was deleted';
  END IF;

  RAISE NOTICE 'check 8 passed: the acceptance log still blocks the delete, through bounties';
END;
$$;


\echo ''
\echo 'ALL CHECKS PASSED'
\echo ''

ROLLBACK;
