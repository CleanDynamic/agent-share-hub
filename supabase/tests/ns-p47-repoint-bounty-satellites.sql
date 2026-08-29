-- =============================================================================
-- NeoScale — the bounty satellites repointed at bounties, acceptance checks
-- (NS-P47)
-- =============================================================================
-- Proves the NS-P47 acceptances that are facts about Postgres rather than about
-- TypeScript:
--
--   1. the repoint lost nothing and invented nothing — row counts match the
--      rollback map tables, every bounty_id resolves to a bounties row, and
--      every shim value agrees with the mapping it was derived from
--   2. the shape changed the way the migration says it did: all four foreign
--      keys point at bounties and every one of them still CASCADEs, the four
--      shim columns are there with their partial indexes, and
--      bounty_author_review finally has an index on bounty_id
--   3. bounty_comment_reactions was not touched — it still reaches a bounty
--      only through a comment, and has no foreign key to content_items
--   4. bounty_me_too was not repointed — its content_id still keys
--      content_items, which is the rule docs/retired-surfaces.md sets for every
--      generation-1 table in NS-P45 through NS-P49
--   5. the shim columns are derived and cannot be authored — a client that
--      sends the wrong legacy_bounty_item_id gets the right one stored
--   6. THE LIVE ACCEPTANCE, under row level security: anon reads a legacy
--      bounty's thread through the shim and cannot read one on an unapproved
--      bounty; a signed-in reader posts a comment, reacts to one, and marks the
--      thread read; the bounty author extends the deadline and triages a
--      solution, and a third party may do neither
--   7. deleting the legacy content item still takes the whole satellite set
--      with it, now through bounties rather than directly
--   8. the me-too counter dual-writes both counters — skipped, with a notice,
--      on a database where generation 1 was never deployed
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v creator_id=<a profiles.id uuid> \
--     -v other_id=<a DIFFERENT profiles.id uuid> \
--     -f supabase/tests/ns-p47-repoint-bounty-satellites.sql
--
-- Both ids must be existing public.profiles rows and must not be the same
-- person: check 6 proves a third party is refused writes the author is allowed,
-- which is meaningless if they are the same. Neither may be an admin. The
-- script asserts all of that.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind and is safe against a database with real rows: checks 1 to 4
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
  set_config('ns_p47.creator_id', :'creator_id', true),
  set_config('ns_p47.other_id',   :'other_id',   true);

DO $$
BEGIN
  IF current_setting('ns_p47.creator_id') = current_setting('ns_p47.other_id') THEN
    RAISE EXCEPTION
      'the creator and the other person must be two different profiles — check 6 proves a third party is refused what the author is allowed, which proves nothing if they are the same person';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('ns_p47.creator_id')::UUID) THEN
    RAISE EXCEPTION 'creator_id % is not a public.profiles row', current_setting('ns_p47.creator_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('ns_p47.other_id')::UUID) THEN
    RAISE EXCEPTION 'other_id % is not a public.profiles row', current_setting('ns_p47.other_id');
  END IF;

  IF public.is_admin(current_setting('ns_p47.creator_id')::UUID)
     OR public.is_admin(current_setting('ns_p47.other_id')::UUID) THEN
    RAISE EXCEPTION 'neither id may be an admin — is_admin passes these policies by design';
  END IF;
END $$;


-- =============================================================================
-- CHECK 1 — the repoint lost nothing and invented nothing
-- =============================================================================
DO $$
DECLARE
  _tbl TEXT;
  _now INTEGER;
  _was INTEGER;
  _bad INTEGER;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'bounty_discussion_comments',
    'bounty_comment_last_read',
    'bounty_deadline_extensions',
    'bounty_author_review'
  ]
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', _tbl) INTO _now;
    EXECUTE format('SELECT count(*) FROM public.%I', 'ns_p47_migration_map_' || _tbl) INTO _was;
    IF _now <> _was THEN
      RAISE EXCEPTION 'check 1: row count moved on public.% — % in the map, % in the table', _tbl, _was, _now;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.%I t
        WHERE NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = t.bounty_id)', _tbl)
    INTO _bad;
    IF _bad > 0 THEN
      RAISE EXCEPTION 'check 1: % rows in public.% do not resolve to a bounties row', _bad, _tbl;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.%I t
         JOIN public.bounties b ON b.id = t.bounty_id
        WHERE t.legacy_bounty_item_id IS DISTINCT FROM b.legacy_item_id', _tbl)
    INTO _bad;
    IF _bad > 0 THEN
      RAISE EXCEPTION 'check 1: % rows in public.% have a shim that disagrees with their bounty', _bad, _tbl;
    END IF;
  END LOOP;

  RAISE NOTICE 'check 1 passed: four tables, counts unchanged, every bounty_id resolves, every shim agrees';
END $$;


-- =============================================================================
-- CHECK 2 — the shape is what the migration says it is
-- =============================================================================
DO $$
DECLARE
  _tbl    TEXT;
  _target TEXT;
  _action "char";
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'bounty_discussion_comments',
    'bounty_comment_last_read',
    'bounty_deadline_extensions',
    'bounty_author_review'
  ]
  LOOP
    SELECT c.confrelid::regclass::TEXT, c.confdeltype INTO _target, _action
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid = ('public.' || _tbl)::regclass
      AND c.conkey = ARRAY[(
        SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = ('public.' || _tbl)::regclass AND a.attname = 'bounty_id'
      )]::SMALLINT[];

    IF _target IS DISTINCT FROM 'bounties' THEN
      RAISE EXCEPTION 'check 2: %.bounty_id targets %, not bounties', _tbl, COALESCE(_target, '<no foreign key>');
    END IF;
    IF _action <> 'c' THEN
      RAISE EXCEPTION 'check 2: %.bounty_id is ON DELETE %, not CASCADE', _tbl, _action;
    END IF;

    -- The shim column, its foreign key back to content_items, and its index.
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = ('public.' || _tbl)::regclass
        AND attname = 'legacy_bounty_item_id' AND NOT attisdropped
    ) THEN
      RAISE EXCEPTION 'check 2: %.legacy_bounty_item_id is missing', _tbl;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.conrelid = ('public.' || _tbl)::regclass
        AND c.confrelid = 'public.content_items'::regclass
        AND c.confdeltype = 'n'
        AND c.conkey = ARRAY[(
          SELECT a.attnum FROM pg_attribute a
          WHERE a.attrelid = ('public.' || _tbl)::regclass AND a.attname = 'legacy_bounty_item_id'
        )]::SMALLINT[]
    ) THEN
      RAISE EXCEPTION 'check 2: %.legacy_bounty_item_id does not key content_items ON DELETE SET NULL', _tbl;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
      WHERE i.indrelid = ('public.' || _tbl)::regclass
        AND a.attname = 'legacy_bounty_item_id'
        AND i.indpred IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'check 2: %.legacy_bounty_item_id has no leading partial index', _tbl;
    END IF;

    -- The derivation trigger, on insert and on a change of bounty_id only.
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = ('public.' || _tbl)::regclass
        AND p.proname = 'set_legacy_bounty_item_id'
        AND NOT t.tgisinternal
    ) THEN
      RAISE EXCEPTION 'check 2: % has no set_legacy_bounty_item_id trigger', _tbl;
    END IF;
  END LOOP;

  -- bounty_author_review's bounty_id was unindexed before NS-P47, so every
  -- cascade from bounties would have scanned it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
    WHERE i.indrelid = 'public.bounty_author_review'::regclass
      AND a.attname = 'bounty_id'
  ) THEN
    RAISE EXCEPTION 'check 2: bounty_author_review.bounty_id is not indexed';
  END IF;

  RAISE NOTICE 'check 2 passed: four foreign keys at bounties, all CASCADE, four shims indexed and derived';
END $$;


-- =============================================================================
-- CHECK 3 — bounty_comment_reactions is untouched and still indirect
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.bounty_comment_reactions'::regclass
      AND confrelid = 'public.content_items'::regclass
  ) THEN
    RAISE EXCEPTION 'check 3: bounty_comment_reactions has a direct foreign key to content_items';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.bounty_comment_reactions'::regclass
      AND confrelid = 'public.bounty_discussion_comments'::regclass
      AND confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'check 3: bounty_comment_reactions does not CASCADE from bounty_discussion_comments';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.bounty_comment_reactions'::regclass
      AND attname = 'legacy_bounty_item_id' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'check 3: bounty_comment_reactions grew a shim column it has no use for';
  END IF;

  RAISE NOTICE 'check 3 passed: reactions reach a bounty only through a comment, and were not repointed';
END $$;


-- =============================================================================
-- CHECK 4 — bounty_me_too was NOT repointed (docs/retired-surfaces.md)
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.bounty_me_too') IS NULL THEN
    RAISE NOTICE 'check 4 skipped: public.bounty_me_too does not exist (generation 1, never deployed) — nothing could have been repointed';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.bounty_me_too'::regclass
      AND confrelid = 'public.content_items'::regclass
  ) THEN
    RAISE EXCEPTION 'check 4: bounty_me_too.content_id no longer keys content_items — NS-P45-P49 must not repoint a generation-1 table';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.bounty_me_too'::regclass
      AND confrelid = 'public.bounties'::regclass
  ) THEN
    RAISE EXCEPTION 'check 4: bounty_me_too has a foreign key to bounties — docs/retired-surfaces.md forbids it';
  END IF;

  RAISE NOTICE 'check 4 passed: bounty_me_too still keys content_items and has no foreign key to bounties';
END $$;


-- =============================================================================
-- CHECK 5 — the shims are derived, and CHECK 6 — the live acceptance under RLS
-- =============================================================================
-- One fixture serves both: an approved legacy bounty with a header, and a
-- pending one, so the read policy has something it must hide as well as
-- something it must show.
-- validate_bounty_publish() requires a reward, acceptance criteria of at least
-- fifty characters, and at least one stage or block marked missing, so the
-- fixture supplies all three rather than working around the trigger.
INSERT INTO public.content_items
  (id, creator_id, title, content_type, difficulty, status, post_type,
   bounty_reward_type, bounty_reward_currency, bounty_reward_amount,
   bounty_acceptance_criteria, stage_grids)
VALUES
  ('47000000-0000-4000-a000-000000000001', current_setting('ns_p47.creator_id')::UUID,
   'NS-P47 fixture: approved', 'prompt', 'beginner', 'approved', 'bounty',
   'cash', 'GBP', 100,
   'The solution must run end to end and show its output, with enough detail to reproduce it.',
   '{"stages":{"s1":{"is_missing":true}},"blocks":{}}'::JSONB),
  ('47000000-0000-4000-a000-000000000002', current_setting('ns_p47.creator_id')::UUID,
   'NS-P47 fixture: pending',  'prompt', 'beginner', 'pending',  'bounty',
   'cash', 'GBP', 100,
   'The solution must run end to end and show its output, with enough detail to reproduce it.',
   '{"stages":{"s1":{"is_missing":true}},"blocks":{}}'::JSONB);

INSERT INTO public.bounties (id, legacy_item_id, author_id, status)
VALUES
  ('47000000-0000-4000-b000-000000000001', '47000000-0000-4000-a000-000000000001',
   current_setting('ns_p47.creator_id')::UUID, 'open'),
  ('47000000-0000-4000-b000-000000000002', '47000000-0000-4000-a000-000000000002',
   current_setting('ns_p47.creator_id')::UUID, 'open');

-- CHECK 5: the client sends the WRONG legacy id and the database overrules it.
INSERT INTO public.bounty_discussion_comments
  (id, bounty_id, author_id, body, legacy_bounty_item_id)
VALUES
  ('47000000-0000-4000-c000-000000000001', '47000000-0000-4000-b000-000000000001',
   current_setting('ns_p47.other_id')::UUID, 'derived, not authored',
   '47000000-0000-4000-a000-000000000002');

-- A comment on the PENDING bounty, which check 6 must not be able to read.
INSERT INTO public.bounty_discussion_comments (id, bounty_id, author_id, body)
VALUES
  ('47000000-0000-4000-c000-000000000002', '47000000-0000-4000-b000-000000000002',
   current_setting('ns_p47.other_id')::UUID, 'must stay hidden');

DO $$
DECLARE _stored UUID;
BEGIN
  SELECT legacy_bounty_item_id INTO _stored
  FROM public.bounty_discussion_comments
  WHERE id = '47000000-0000-4000-c000-000000000001';

  IF _stored IS DISTINCT FROM '47000000-0000-4000-a000-000000000001'::UUID THEN
    RAISE EXCEPTION
      'check 5: the shim was authored, not derived — stored %, expected the bounty''s own legacy_item_id', _stored;
  END IF;
  RAISE NOTICE 'check 5 passed: a client-supplied legacy_bounty_item_id is overwritten from the mapping';
END $$;


-- --- CHECK 6a: anon reads the approved thread and not the pending one -------
SET LOCAL ROLE anon;
DO $$
DECLARE _visible INTEGER; _hidden INTEGER;
BEGIN
  SELECT count(*) INTO _visible FROM public.bounty_discussion_comments
  WHERE legacy_bounty_item_id = '47000000-0000-4000-a000-000000000001';
  SELECT count(*) INTO _hidden FROM public.bounty_discussion_comments
  WHERE legacy_bounty_item_id = '47000000-0000-4000-a000-000000000002';

  IF _visible <> 1 THEN
    RAISE EXCEPTION 'check 6a: anon sees % comments on the approved bounty through the shim, expected 1', _visible;
  END IF;
  IF _hidden <> 0 THEN
    RAISE EXCEPTION 'check 6a: anon sees % comments on an UNAPPROVED bounty, expected 0', _hidden;
  END IF;
  RAISE NOTICE 'check 6a passed: anon reads the legacy thread through the shim, and only the published one';
END $$;
RESET ROLE;


-- --- CHECK 6b: a third party comments, reacts and marks read ----------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p47.other_id'), true);

INSERT INTO public.bounty_discussion_comments (bounty_id, author_id, body)
VALUES ('47000000-0000-4000-b000-000000000001', current_setting('ns_p47.other_id')::UUID, 'posted under RLS');

INSERT INTO public.bounty_comment_reactions (comment_id, reactor_id, reaction)
VALUES ('47000000-0000-4000-c000-000000000001', current_setting('ns_p47.other_id')::UUID, 'rocket');

INSERT INTO public.bounty_comment_last_read (bounty_id, user_id, last_read_at)
VALUES ('47000000-0000-4000-b000-000000000001', current_setting('ns_p47.other_id')::UUID, now())
ON CONFLICT (bounty_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bounty_discussion_comments
    WHERE body = 'posted under RLS'
      AND legacy_bounty_item_id = '47000000-0000-4000-a000-000000000001'
  ) THEN
    RAISE EXCEPTION 'check 6b: the comment posted under RLS did not land with its shim derived';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bounty_comment_reactions
    WHERE comment_id = '47000000-0000-4000-c000-000000000001' AND reaction = 'rocket'
  ) THEN
    RAISE EXCEPTION 'check 6b: the reaction did not post';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bounty_comment_last_read
    WHERE user_id = current_setting('ns_p47.other_id')::UUID
      AND legacy_bounty_item_id = '47000000-0000-4000-a000-000000000001'
  ) THEN
    RAISE EXCEPTION 'check 6b: the read mark did not land with its shim derived';
  END IF;
  RAISE NOTICE 'check 6b passed: comment, reaction and read mark all land, shims derived';
END $$;

-- --- CHECK 6c: a third party may NOT extend the deadline or triage ----------
DO $$
BEGIN
  BEGIN
    INSERT INTO public.bounty_deadline_extensions (bounty_id, extended_by, new_deadline)
    VALUES ('47000000-0000-4000-b000-000000000001',
            current_setting('ns_p47.other_id')::UUID, now() + interval '30 days');
    RAISE EXCEPTION 'check 6c: a non-author extended the deadline';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.bounty_author_review (bounty_id, solution_id, author_id, state)
    VALUES ('47000000-0000-4000-b000-000000000001', gen_random_uuid(),
            current_setting('ns_p47.other_id')::UUID, 'noted');
    RAISE EXCEPTION 'check 6c: a non-author triaged a solution on someone else''s bounty';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RAISE NOTICE 'check 6c passed: a third party is refused both author-only writes';
END $$;
RESET ROLE;


-- --- CHECK 6d: the author may do both --------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ns_p47.creator_id'), true);

INSERT INTO public.bounty_deadline_extensions (bounty_id, extended_by, new_deadline)
VALUES ('47000000-0000-4000-b000-000000000001',
        current_setting('ns_p47.creator_id')::UUID, now() + interval '30 days');

INSERT INTO public.bounty_author_review (bounty_id, solution_id, author_id, state)
VALUES ('47000000-0000-4000-b000-000000000001', '47000000-0000-4000-d000-000000000001',
        current_setting('ns_p47.creator_id')::UUID, 'shortlisted');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bounty_deadline_extensions
    WHERE legacy_bounty_item_id = '47000000-0000-4000-a000-000000000001'
      AND extended_by = current_setting('ns_p47.creator_id')::UUID
  ) THEN
    RAISE EXCEPTION 'check 6d: the author could not extend the deadline, or the shim was not derived';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bounty_author_review
    WHERE legacy_bounty_item_id = '47000000-0000-4000-a000-000000000001'
      AND author_id = current_setting('ns_p47.creator_id')::UUID
  ) THEN
    RAISE EXCEPTION 'check 6d: the author could not triage a solution, or the shim was not derived';
  END IF;
  RAISE NOTICE 'check 6d passed: the bounty author extends the deadline and triages, both shims derived';
END $$;
RESET ROLE;


-- =============================================================================
-- CHECK 7 — deleting the content item still empties the whole satellite set
-- =============================================================================
-- The path is longer than it was — content_items -> bounties -> here — and the
-- outcome has to be identical.
DELETE FROM public.content_items WHERE id = '47000000-0000-4000-a000-000000000001';

DO $$
DECLARE _left INTEGER;
BEGIN
  SELECT
    (SELECT count(*) FROM public.bounty_discussion_comments WHERE legacy_bounty_item_id = '47000000-0000-4000-a000-000000000001')
  + (SELECT count(*) FROM public.bounty_comment_last_read   WHERE legacy_bounty_item_id = '47000000-0000-4000-a000-000000000001')
  + (SELECT count(*) FROM public.bounty_deadline_extensions WHERE legacy_bounty_item_id = '47000000-0000-4000-a000-000000000001')
  + (SELECT count(*) FROM public.bounty_author_review       WHERE legacy_bounty_item_id = '47000000-0000-4000-a000-000000000001')
  + (SELECT count(*) FROM public.bounties                   WHERE legacy_item_id        = '47000000-0000-4000-a000-000000000001')
  INTO _left;

  IF _left <> 0 THEN
    RAISE EXCEPTION 'check 7: % rows survived the delete of their content item', _left;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bounty_comment_reactions
    WHERE comment_id = '47000000-0000-4000-c000-000000000001'
  ) THEN
    RAISE EXCEPTION 'check 7: a reaction survived the deletion of its comment';
  END IF;

  RAISE NOTICE 'check 7 passed: the delete cascades content_items -> bounties -> every satellite, reactions included';
END $$;


-- =============================================================================
-- CHECK 8 — the me-too counter dual-writes, where generation 1 exists
-- =============================================================================
DO $$
DECLARE
  _legacy INTEGER;
  _new    INTEGER;
BEGIN
  IF to_regclass('public.bounty_me_too') IS NULL THEN
    RAISE NOTICE 'check 8 skipped: public.bounty_me_too does not exist (generation 1, never deployed) — there is no counter to dual-write';
    RETURN;
  END IF;

  IF NOT (
    SELECT proconfig::TEXT LIKE '%search_path%'
    FROM pg_proc WHERE proname = 'update_bounty_me_too_count'
  ) THEN
    RAISE EXCEPTION 'check 8: update_bounty_me_too_count() is SECURITY DEFINER with a mutable search_path';
  END IF;

  INSERT INTO public.bounty_me_too (content_id, user_id)
  VALUES ('47000000-0000-4000-a000-000000000002', current_setting('ns_p47.other_id')::UUID);

  SELECT ci.bounty_me_too_count, b.me_too_count INTO _legacy, _new
  FROM public.content_items ci
  JOIN public.bounties b ON b.legacy_item_id = ci.id
  WHERE ci.id = '47000000-0000-4000-a000-000000000002';

  IF _legacy <> 1 OR _new <> 1 THEN
    RAISE EXCEPTION
      'check 8: a me-too did not move both counters — content_items.bounty_me_too_count %, bounties.me_too_count %',
      _legacy, _new;
  END IF;

  DELETE FROM public.bounty_me_too
  WHERE content_id = '47000000-0000-4000-a000-000000000002'
    AND user_id = current_setting('ns_p47.other_id')::UUID;

  SELECT ci.bounty_me_too_count, b.me_too_count INTO _legacy, _new
  FROM public.content_items ci
  JOIN public.bounties b ON b.legacy_item_id = ci.id
  WHERE ci.id = '47000000-0000-4000-a000-000000000002';

  IF _legacy <> 0 OR _new <> 0 THEN
    RAISE EXCEPTION
      'check 8: removing a me-too did not move both counters back — content_items %, bounties %',
      _legacy, _new;
  END IF;

  RAISE NOTICE 'check 8 passed: a me-too write moves content_items.bounty_me_too_count AND bounties.me_too_count together';
END $$;


DO $$ BEGIN RAISE NOTICE 'NS-P47: ALL CHECKS PASSED'; END $$;

ROLLBACK;
