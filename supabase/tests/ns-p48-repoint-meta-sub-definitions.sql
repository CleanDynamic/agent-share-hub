-- =============================================================================
-- NeoScale — meta-bounty sub-definitions repointed and closed, acceptance
-- checks (NS-P48)
-- =============================================================================
-- Proves the NS-P48 acceptances that are facts about Postgres rather than about
-- TypeScript:
--
--   1. the repoint lost nothing and invented nothing — the row count matches
--      the rollback map, every meta_bounty_id resolves to a bounties row, every
--      spawn pointer that was set is still set and resolves, and both shims
--      agree with the mapping they were derived from
--   2. the shape changed the way the migration says it did: both foreign keys
--      point at bounties, meta_bounty_id still CASCADEs and spawned_bounty_id
--      still SET NULLs, the two shim columns are there with their partial
--      indexes, and both real columns are finally indexed
--   3. meta_bounty_pledges was NOT touched — NS-P49's table still keys
--      content_items on meta_bounty_id, still keys this table on
--      sub_definition_id, and still carries the three policies it had
--   4. the shims are derived and cannot be authored — a client that sends the
--      wrong legacy ids gets the right ones stored
--   5. THE FREEZE, twice: a sub-definition for a build-backed bounty is refused
--      below RLS (the trigger, which binds service_role too) and refused by the
--      INSERT policy on its own; and an existing row cannot be moved onto one
--   6. THE LIVE ACCEPTANCE, under row level security: anon reads a legacy
--      meta's sub-definitions through the shim, the author inserts, edits and
--      deletes one on their own legacy meta, and a third party may do none of
--      the three
--   7. deleting the legacy meta's content item still takes its sub-definitions
--      with it, now through bounties; deleting a spawned bounty's content item
--      still clears the pointer and leaves the sub-definition standing
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v creator_id=<a profiles.id uuid> \
--     -v other_id=<a DIFFERENT profiles.id uuid> \
--     -f supabase/tests/ns-p48-repoint-meta-sub-definitions.sql
--
-- Both ids must be existing public.profiles rows and must not be the same
-- person: check 6 proves a third party is refused what the author is allowed,
-- which is meaningless if they are the same. Neither may be an admin. The
-- script asserts all of that.
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
  set_config('ns_p48.creator_id', :'creator_id', true),
  set_config('ns_p48.other_id',   :'other_id',   true);

DO $$
BEGIN
  IF current_setting('ns_p48.creator_id') = current_setting('ns_p48.other_id') THEN
    RAISE EXCEPTION
      'the creator and the other person must be two different profiles — check 6 proves a third party is refused what the author is allowed, which proves nothing if they are the same person';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('ns_p48.creator_id')::UUID) THEN
    RAISE EXCEPTION 'creator_id % is not a public.profiles row', current_setting('ns_p48.creator_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('ns_p48.other_id')::UUID) THEN
    RAISE EXCEPTION 'other_id % is not a public.profiles row', current_setting('ns_p48.other_id');
  END IF;

  IF public.is_admin(current_setting('ns_p48.creator_id')::UUID)
     OR public.is_admin(current_setting('ns_p48.other_id')::UUID) THEN
    RAISE EXCEPTION 'neither id may be an admin — is_admin passes these policies by design';
  END IF;
END $$;


-- =============================================================================
-- CHECK 1: the repoint lost nothing and invented nothing
-- =============================================================================
-- The same five facts the migration asserts, re-asked after it has committed,
-- because an assertion inside the transaction that wrote the rows proves the
-- statements ran and this proves the rows are right.
DO $$
DECLARE _now INTEGER; _was INTEGER; _bad INTEGER;
BEGIN
  SELECT count(*) INTO _now FROM public.meta_bounty_sub_definitions;
  SELECT count(*) INTO _was FROM public.ns_p48_migration_map_meta_subs;
  IF _now <> _was THEN
    RAISE EXCEPTION 'check 1: % sub-definitions now, % in the rollback map', _now, _was;
  END IF;

  SELECT count(*) INTO _bad
  FROM public.meta_bounty_sub_definitions s
  WHERE NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = s.meta_bounty_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION 'check 1: % sub-definitions do not resolve to a bounties row', _bad;
  END IF;

  SELECT count(*) INTO _bad
  FROM public.meta_bounty_sub_definitions s
  WHERE s.spawned_bounty_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = s.spawned_bounty_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION 'check 1: % spawned_bounty_id values do not resolve to a bounties row', _bad;
  END IF;

  SELECT count(*) INTO _bad
  FROM public.meta_bounty_sub_definitions s
  JOIN public.ns_p48_migration_map_meta_subs m ON m.id = s.id
  WHERE (m.old_spawned_bounty_id IS NULL) <> (s.spawned_bounty_id IS NULL);
  IF _bad > 0 THEN
    RAISE EXCEPTION 'check 1: % sub-definitions gained or lost a spawn pointer', _bad;
  END IF;

  -- The shims must agree with the mapping AND with what the row used to hold.
  -- The second half is what the migration itself cannot check: it compares the
  -- derived value against the rollback map, which was written before anything
  -- moved.
  SELECT count(*) INTO _bad
  FROM public.meta_bounty_sub_definitions s
  JOIN public.ns_p48_migration_map_meta_subs m ON m.id = s.id
  WHERE s.legacy_meta_item_id    IS DISTINCT FROM m.old_meta_bounty_id
     OR s.legacy_spawned_item_id IS DISTINCT FROM m.old_spawned_bounty_id;
  IF _bad > 0 THEN
    RAISE EXCEPTION
      'check 1: % sub-definitions carry a legacy shim that is not the id they held before the repoint', _bad;
  END IF;

  RAISE NOTICE 'check 1 passed: % sub-definitions repointed, both shims agree with the rollback map', _now;
END $$;


-- =============================================================================
-- CHECK 2: the shape is what the migration says it is
-- =============================================================================
DO $$
DECLARE _target TEXT; _action "char"; _n INTEGER;
BEGIN
  -- meta_bounty_id -> bounties, ON DELETE CASCADE
  SELECT c.confrelid::regclass::TEXT, c.confdeltype INTO _target, _action
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.meta_bounty_sub_definitions'::regclass
    AND c.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a
                          WHERE a.attrelid = 'public.meta_bounty_sub_definitions'::regclass
                            AND a.attname = 'meta_bounty_id')]::SMALLINT[];
  IF _target IS DISTINCT FROM 'bounties' OR _action <> 'c' THEN
    RAISE EXCEPTION 'check 2: meta_bounty_id keys % ON DELETE %, expected bounties ON DELETE CASCADE', _target, _action;
  END IF;

  -- spawned_bounty_id -> bounties, ON DELETE SET NULL
  SELECT c.confrelid::regclass::TEXT, c.confdeltype INTO _target, _action
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.meta_bounty_sub_definitions'::regclass
    AND c.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a
                          WHERE a.attrelid = 'public.meta_bounty_sub_definitions'::regclass
                            AND a.attname = 'spawned_bounty_id')]::SMALLINT[];
  IF _target IS DISTINCT FROM 'bounties' OR _action <> 'n' THEN
    RAISE EXCEPTION 'check 2: spawned_bounty_id keys % ON DELETE %, expected bounties ON DELETE SET NULL', _target, _action;
  END IF;

  -- Both shim columns key content_items, ON DELETE SET NULL.
  SELECT count(*) INTO _n
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.meta_bounty_sub_definitions'::regclass
    AND c.confrelid = 'public.content_items'::regclass
    AND c.confdeltype = 'n';
  IF _n <> 2 THEN
    RAISE EXCEPTION 'check 2: % shim foreign keys to content_items ON DELETE SET NULL, expected 2', _n;
  END IF;

  -- The four indexes the migration adds.
  FOREACH _target IN ARRAY ARRAY[
    'idx_mbsd_legacy_meta_item',
    'idx_mbsd_legacy_spawned_item',
    'idx_mbsd_meta_bounty',
    'idx_mbsd_spawned_bounty'
  ]
  LOOP
    IF to_regclass('public.' || _target) IS NULL THEN
      RAISE EXCEPTION 'check 2: index % is missing', _target;
    END IF;
  END LOOP;

  -- The rollback map is an operator table: RLS on, and no policy behind it.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ns_p48_migration_map_meta_subs'::regclass) THEN
    RAISE EXCEPTION 'check 2: the rollback map does not have row level security enabled';
  END IF;
  SELECT count(*) INTO _n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'ns_p48_migration_map_meta_subs';
  IF _n <> 0 THEN
    RAISE EXCEPTION 'check 2: the rollback map has % policies, expected 0 (operator access only)', _n;
  END IF;

  -- No policy on this table may still name content_items: every one of them
  -- would answer "no row" for every row on the platform.
  SELECT count(*) INTO _n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'meta_bounty_sub_definitions'
    AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%content_items%';
  IF _n <> 0 THEN
    RAISE EXCEPTION 'check 2: % policies on meta_bounty_sub_definitions still name content_items', _n;
  END IF;

  -- And none of them may use a bare auth.uid(). Postgres stores the wrapped
  -- form as "( SELECT auth.uid() AS uid)", so the test removes every wrapped
  -- occurrence and then looks for anything left.
  SELECT count(*) INTO _n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'meta_bounty_sub_definitions'
    AND replace(
          COALESCE(qual, '') || ' ' || COALESCE(with_check, ''),
          '( SELECT auth.uid() AS uid)', ''
        ) LIKE '%auth.uid()%';
  IF _n <> 0 THEN
    RAISE EXCEPTION 'check 2: % policies on meta_bounty_sub_definitions use a bare auth.uid()', _n;
  END IF;

  RAISE NOTICE 'check 2 passed: both foreign keys at bounties with their original delete actions, four indexes, no content_items left in a policy';
END $$;


-- =============================================================================
-- CHECK 3: meta_bounty_pledges was not touched — it is NS-P49's
-- =============================================================================
DO $$
DECLARE _target TEXT; _n INTEGER;
BEGIN
  SELECT c.confrelid::regclass::TEXT INTO _target
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.meta_bounty_pledges'::regclass
    AND c.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a
                          WHERE a.attrelid = 'public.meta_bounty_pledges'::regclass
                            AND a.attname = 'meta_bounty_id')]::SMALLINT[];
  IF _target IS DISTINCT FROM 'content_items' THEN
    RAISE EXCEPTION
      'check 3: meta_bounty_pledges.meta_bounty_id keys %, expected content_items — NS-P48 must not repoint it', _target;
  END IF;

  SELECT c.confrelid::regclass::TEXT INTO _target
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.meta_bounty_pledges'::regclass
    AND c.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a
                          WHERE a.attrelid = 'public.meta_bounty_pledges'::regclass
                            AND a.attname = 'sub_definition_id')]::SMALLINT[];
  IF _target IS DISTINCT FROM 'meta_bounty_sub_definitions' THEN
    RAISE EXCEPTION
      'check 3: meta_bounty_pledges.sub_definition_id keys %, expected meta_bounty_sub_definitions — no sub-definition id changed, so this foreign key must still hold', _target;
  END IF;

  SELECT count(*) INTO _n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'meta_bounty_pledges';
  IF _n <> 3 THEN
    RAISE EXCEPTION 'check 3: meta_bounty_pledges carries % policies, expected the 3 it was created with', _n;
  END IF;

  -- Every pledge that names a sub-definition still finds it.
  SELECT count(*) INTO _n
  FROM public.meta_bounty_pledges p
  WHERE p.sub_definition_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.meta_bounty_sub_definitions s WHERE s.id = p.sub_definition_id
    );
  IF _n <> 0 THEN
    RAISE EXCEPTION 'check 3: % pledges point at a sub-definition that is not there', _n;
  END IF;

  RAISE NOTICE 'check 3 passed: meta_bounty_pledges untouched, and every pledge still finds its sub-definition';
END $$;


-- =============================================================================
-- Fixtures for checks 4 to 7
-- =============================================================================
-- A legacy meta bounty with a header, a legacy bounty to stand in for the thing
-- a sub-definition spawns, and a build-backed bounty that the freeze must
-- refuse. All of them are discarded by the ROLLBACK at the end.
INSERT INTO public.content_items
  (id, creator_id, title, content_type, difficulty, status, post_type, bounty_status, bounty_is_meta)
VALUES
  ('4e6f5f70-3438-4000-8000-00000000a001', current_setting('ns_p48.creator_id')::UUID,
   'NS-P48 legacy meta', 'Workflow Template', 'Any', 'approved', 'bounty', 'open', true),
  ('4e6f5f70-3438-4000-8000-00000000a002', current_setting('ns_p48.creator_id')::UUID,
   'NS-P48 spawned bounty', 'Workflow Template', 'Any', 'approved', 'bounty', 'open', false);

INSERT INTO public.bounties (id, legacy_item_id, author_id, status, is_meta)
VALUES
  ('4e6f5f70-3438-4000-8000-00000000b001', '4e6f5f70-3438-4000-8000-00000000a001',
   current_setting('ns_p48.creator_id')::UUID, 'open', true),
  ('4e6f5f70-3438-4000-8000-00000000b002', '4e6f5f70-3438-4000-8000-00000000a002',
   current_setting('ns_p48.creator_id')::UUID, 'open', false);

-- The new path: a published build, a gap node, and the bounty that is its
-- header. This is the shape a sub-definition may never be filed against.
INSERT INTO public.builds (id, creator_id, slug, title, outcome, shape, status, published_at)
VALUES (
  '4e6f5f70-3438-4000-8000-0000000b011d', current_setting('ns_p48.creator_id')::UUID,
  'ns-p48-build', 'NS-P48 build', 'Exists for the length of one transaction.', 'app', 'published', now()
);
INSERT INTO public.build_nodes (id, build_id, type, title, is_gap)
VALUES ('4e6f5f70-3438-4000-8000-000000009a70', '4e6f5f70-3438-4000-8000-0000000b011d',
        'gap', 'The gap a sub-bounty would have been', true);
INSERT INTO public.bounties (id, build_id, gap_node_id, author_id, status)
VALUES ('4e6f5f70-3438-4000-8000-00000000b003', '4e6f5f70-3438-4000-8000-0000000b011d',
        '4e6f5f70-3438-4000-8000-000000009a70', current_setting('ns_p48.creator_id')::UUID, 'open');


-- =============================================================================
-- CHECK 4: the shims are derived, not authored
-- =============================================================================
-- The client sends two wrong legacy ids and the database overrules both.
INSERT INTO public.meta_bounty_sub_definitions
  (id, meta_bounty_id, title, target_amount, spawned_bounty_id,
   legacy_meta_item_id, legacy_spawned_item_id)
VALUES
  ('4e6f5f70-3438-4000-8000-00000000c001', '4e6f5f70-3438-4000-8000-00000000b001',
   'derived, not authored', 100, '4e6f5f70-3438-4000-8000-00000000b002',
   '4e6f5f70-3438-4000-8000-00000000a002',   -- wrong on purpose
   '4e6f5f70-3438-4000-8000-00000000a001');  -- wrong on purpose, and swapped

DO $$
DECLARE _meta UUID; _spawn UUID;
BEGIN
  SELECT legacy_meta_item_id, legacy_spawned_item_id INTO _meta, _spawn
  FROM public.meta_bounty_sub_definitions
  WHERE id = '4e6f5f70-3438-4000-8000-00000000c001';

  IF _meta IS DISTINCT FROM '4e6f5f70-3438-4000-8000-00000000a001'::UUID THEN
    RAISE EXCEPTION 'check 4: legacy_meta_item_id was authored, not derived — stored %', _meta;
  END IF;
  IF _spawn IS DISTINCT FROM '4e6f5f70-3438-4000-8000-00000000a002'::UUID THEN
    RAISE EXCEPTION 'check 4: legacy_spawned_item_id was authored, not derived — stored %', _spawn;
  END IF;

  -- And clearing the spawn pointer clears its shim rather than leaving a stale
  -- content_items id behind.
  UPDATE public.meta_bounty_sub_definitions
  SET spawned_bounty_id = NULL
  WHERE id = '4e6f5f70-3438-4000-8000-00000000c001';

  SELECT legacy_spawned_item_id INTO _spawn
  FROM public.meta_bounty_sub_definitions
  WHERE id = '4e6f5f70-3438-4000-8000-00000000c001';
  IF _spawn IS NOT NULL THEN
    RAISE EXCEPTION 'check 4: clearing spawned_bounty_id left legacy_spawned_item_id at %', _spawn;
  END IF;

  -- Put it back for check 7.
  UPDATE public.meta_bounty_sub_definitions
  SET spawned_bounty_id = '4e6f5f70-3438-4000-8000-00000000b002'
  WHERE id = '4e6f5f70-3438-4000-8000-00000000c001';

  RAISE NOTICE 'check 4 passed: both shims are derived from the mapping and a client cannot author either';
END $$;


-- =============================================================================
-- CHECK 5: the table is closed to the new path
-- =============================================================================
-- 5a: below row level security. This runs as the migration role, which RLS does
-- not bind — so what refuses it is the trigger, which is the point: service_role
-- and any SECURITY DEFINER helper NS-P50 writes meet the same wall.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.meta_bounty_sub_definitions (meta_bounty_id, title, target_amount)
    VALUES ('4e6f5f70-3438-4000-8000-00000000b003', 'a sub-definition on a build', 50);
    RAISE EXCEPTION 'check 5a: a sub-definition was filed against a build-backed bounty';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- 5b: nor can an existing row be moved onto one after the fact.
  BEGIN
    UPDATE public.meta_bounty_sub_definitions
    SET meta_bounty_id = '4e6f5f70-3438-4000-8000-00000000b003'
    WHERE id = '4e6f5f70-3438-4000-8000-00000000c001';
    RAISE EXCEPTION 'check 5b: an existing sub-definition was moved onto a build-backed bounty';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  RAISE NOTICE 'check 5a/5b passed: the freeze holds below RLS, on INSERT and on re-parenting';
END $$;

-- 5c: the INSERT policy carries the same rule on its own. The trigger is
-- switched off for the length of this check so that what refuses the write is
-- the policy and nothing else — with it on, the trigger would raise first and
-- the policy would never be reached, and a policy that silently lost its
-- legacy_item_id test would still pass.
ALTER TABLE public.meta_bounty_sub_definitions DISABLE TRIGGER trg_mbsd_freeze_to_legacy;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p48.creator_id'), true);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.meta_bounty_sub_definitions (meta_bounty_id, title, target_amount)
    VALUES ('4e6f5f70-3438-4000-8000-00000000b003', 'policy half of the freeze', 50);
    RAISE EXCEPTION 'check 5c: the INSERT policy admitted a sub-definition on a build-backed bounty';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RAISE NOTICE 'check 5c passed: the INSERT policy refuses a build-backed parent on its own';
END $$;
RESET ROLE;
ALTER TABLE public.meta_bounty_sub_definitions ENABLE TRIGGER trg_mbsd_freeze_to_legacy;


-- =============================================================================
-- CHECK 6: the live acceptance, under row level security
-- =============================================================================
-- 6a: anon reads the legacy meta's sub-definitions through the shim. This is
-- the query the home ActiveCompetitions strip and getMetaBountyState make.
SET LOCAL ROLE anon;
DO $$
DECLARE _n INTEGER;
BEGIN
  SELECT count(*) INTO _n
  FROM public.meta_bounty_sub_definitions
  WHERE legacy_meta_item_id = '4e6f5f70-3438-4000-8000-00000000a001';
  IF _n <> 1 THEN
    RAISE EXCEPTION 'check 6a: anon sees % sub-definitions through the shim, expected 1', _n;
  END IF;

  -- The spawn pointer anon reads must be a content_items id: MetaBountyBody
  -- navigates to /content/:id with it.
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_bounty_sub_definitions s
    JOIN public.content_items ci ON ci.id = s.legacy_spawned_item_id
    WHERE s.id = '4e6f5f70-3438-4000-8000-00000000c001'
  ) THEN
    RAISE EXCEPTION 'check 6a: the spawn shim anon reads is not a content_items id';
  END IF;

  RAISE NOTICE 'check 6a passed: anon reads the legacy meta through the shim, and its spawn pointer routes';
END $$;
RESET ROLE;

-- 6b: the author writes on their own legacy meta.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p48.creator_id'), true);

INSERT INTO public.meta_bounty_sub_definitions (id, meta_bounty_id, title, target_amount, position)
VALUES ('4e6f5f70-3438-4000-8000-00000000c002', '4e6f5f70-3438-4000-8000-00000000b001',
        'filed under RLS', 75, 1);

UPDATE public.meta_bounty_sub_definitions
SET title = 'edited under RLS'
WHERE id = '4e6f5f70-3438-4000-8000-00000000c002';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_bounty_sub_definitions
    WHERE id = '4e6f5f70-3438-4000-8000-00000000c002' AND title = 'edited under RLS'
  ) THEN
    RAISE EXCEPTION 'check 6b: the author could not file and edit a sub-definition on their own legacy meta';
  END IF;
  RAISE NOTICE 'check 6b passed: the author files and edits on their own legacy meta';
END $$;
RESET ROLE;

-- 6c: a third party may do none of it.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p48.other_id'), true);
DO $$
DECLARE _n INTEGER;
BEGIN
  BEGIN
    INSERT INTO public.meta_bounty_sub_definitions (meta_bounty_id, title, target_amount)
    VALUES ('4e6f5f70-3438-4000-8000-00000000b001', 'not my meta', 10);
    RAISE EXCEPTION 'check 6c: a third party filed a sub-definition on someone else''s meta';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  UPDATE public.meta_bounty_sub_definitions
  SET title = 'hijacked'
  WHERE id = '4e6f5f70-3438-4000-8000-00000000c002';
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> 0 THEN
    RAISE EXCEPTION 'check 6c: a third party edited % sub-definitions on someone else''s meta', _n;
  END IF;

  DELETE FROM public.meta_bounty_sub_definitions
  WHERE id = '4e6f5f70-3438-4000-8000-00000000c002';
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> 0 THEN
    RAISE EXCEPTION 'check 6c: a third party deleted % sub-definitions on someone else''s meta', _n;
  END IF;

  RAISE NOTICE 'check 6c passed: a third party is refused the insert, the edit and the delete';
END $$;
RESET ROLE;

-- 6d: and the author can still remove their own. The table is closed to new
-- rows, not frozen against the person whose rows they are.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p48.creator_id'), true);
DO $$
DECLARE _n INTEGER;
BEGIN
  DELETE FROM public.meta_bounty_sub_definitions
  WHERE id = '4e6f5f70-3438-4000-8000-00000000c002';
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> 1 THEN
    RAISE EXCEPTION 'check 6d: the author deleted % of their own sub-definitions, expected 1', _n;
  END IF;
  RAISE NOTICE 'check 6d passed: the author still removes their own sub-definitions';
END $$;
RESET ROLE;


-- =============================================================================
-- CHECK 7: the delete chains still reach, one hop longer
-- =============================================================================
DO $$
DECLARE _spawn UUID; _n INTEGER;
BEGIN
  -- Deleting the SPAWNED bounty's content item clears the pointer and leaves
  -- the sub-definition standing: content_items -> bounties (CASCADE) -> here
  -- (SET NULL).
  DELETE FROM public.content_items WHERE id = '4e6f5f70-3438-4000-8000-00000000a002';

  SELECT count(*) INTO _n FROM public.meta_bounty_sub_definitions
  WHERE id = '4e6f5f70-3438-4000-8000-00000000c001';
  IF _n <> 1 THEN
    RAISE EXCEPTION 'check 7: deleting the spawned bounty removed the sub-definition as well';
  END IF;

  SELECT spawned_bounty_id INTO _spawn FROM public.meta_bounty_sub_definitions
  WHERE id = '4e6f5f70-3438-4000-8000-00000000c001';
  IF _spawn IS NOT NULL THEN
    RAISE EXCEPTION 'check 7: the spawn pointer survived its bounty being deleted — %', _spawn;
  END IF;

  -- Deleting the META's content item takes the sub-definitions with it:
  -- content_items -> bounties (CASCADE) -> here (CASCADE).
  DELETE FROM public.content_items WHERE id = '4e6f5f70-3438-4000-8000-00000000a001';

  SELECT count(*) INTO _n FROM public.meta_bounty_sub_definitions
  WHERE id = '4e6f5f70-3438-4000-8000-00000000c001';
  IF _n <> 0 THEN
    RAISE EXCEPTION 'check 7: deleting the legacy meta left % sub-definitions behind', _n;
  END IF;

  RAISE NOTICE 'check 7 passed: the cascade and the set-null both still reach, through bounties';
END $$;


\echo ''
\echo 'ALL CHECKS PASSED'
\echo ''

ROLLBACK;
