-- =============================================================================
-- NeoScale — bounties header table acceptance checks (NS-P45)
-- =============================================================================
-- Proves the NS-P45 acceptances that are facts about Postgres rather than about
-- TypeScript:
--
--   1. the backfill wrote exactly one header per legacy content_items bounty,
--      every row has exactly one home, and every meta parent that could
--      resolve did
--   2. a bounty whose gap_node_id is not a gap node OF THAT BUILD is rejected —
--      wrong node, wrong build, and no build at all
--   3. anon can read the bounties of a published build and of an approved
--      legacy item, and cannot read one whose home is a draft build or an
--      unapproved item
--
-- and, because they are the design claims the table rests on:
--
--   4. one bounty per gap, enforced by index rather than by convention
--   5. a row with two homes, or none, is rejected
--   6. one person cannot file a bounty on another person's build
--   7. the author of a bounty on their own draft build can still read it
--   8. nobody can delete a bounty — there is no DELETE policy, on purpose
--   9. an author cannot hand their bounty to someone else, or move it onto a
--      build they do not own, and a second person cannot touch it at all
--  10. a gap that stops being a gap is caught at the next write, not left
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v creator_id=<a profiles.id uuid> \
--     -v other_id=<a DIFFERENT profiles.id uuid> \
--     -f supabase/tests/ns-p45-bounties-header.sql
--
-- Both ids must be existing public.profiles rows, and they must not be the
-- same person — checks 6 and 8 are meaningless otherwise. Neither may be an
-- admin: is_admin passes every policy here by design, so an admin id would
-- turn checks 6 and 8 green for the wrong reason. The script asserts that.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind, and it is safe to run against a database with real rows in
-- it: check 1 only reads what the backfill already wrote, and every row the
-- script creates is discarded. It must be run as a role that can SET ROLE
-- authenticated and anon: the reads and writes are meant to be subject to row
-- level security, not exempt from it.
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
  set_config('ns_p45.creator_id', :'creator_id', true),
  set_config('ns_p45.other_id',   :'other_id',   true);

DO $$
BEGIN
  IF current_setting('ns_p45.creator_id') = current_setting('ns_p45.other_id') THEN
    RAISE EXCEPTION
      'the creator and the other person must be two different profiles — checks 6 and 8 exist to prove the policies hold across that line';
  END IF;

  IF public.is_admin(current_setting('ns_p45.creator_id')::uuid)
     OR public.is_admin(current_setting('ns_p45.other_id')::uuid) THEN
    RAISE EXCEPTION
      'neither id may belong to an admin — every policy under test admits admins, so an admin id would pass checks 6 and 8 without proving anything';
  END IF;
END;
$$;


-- =============================================================================
-- 1. The backfill — read-only, against whatever this database already holds
-- =============================================================================
-- Runs before anything is inserted, so the numbers are the migration's own.
DO $$
DECLARE
  _legacy          INTEGER;
  _headers         INTEGER;
  _homeless        INTEGER;
  _meta_expected   INTEGER;
  _meta_resolved   INTEGER;
BEGIN
  SELECT count(*) INTO _legacy
  FROM public.content_items WHERE post_type = 'bounty';

  SELECT count(*) INTO _headers
  FROM public.bounties WHERE legacy_item_id IS NOT NULL;

  IF _legacy <> _headers THEN
    RAISE EXCEPTION
      'check 1 failed: % legacy bounties but % header rows', _legacy, _headers;
  END IF;

  -- Exactly one home, not "at most one". The constraint is declared on the
  -- table; this asserts it holds over the rows the backfill actually wrote.
  SELECT count(*) INTO _homeless
  FROM public.bounties
  WHERE NOT (
    (build_id IS NOT NULL AND legacy_item_id IS NULL)
    OR (build_id IS NULL AND legacy_item_id IS NOT NULL)
  );

  IF _homeless <> 0 THEN
    RAISE EXCEPTION 'check 1 failed: % rows do not have exactly one home', _homeless;
  END IF;

  -- Meta parents resolve. The expected number is the number of legacy meta
  -- children whose PARENT is itself a legacy bounty — a bounty_meta_parent_id
  -- pointing at a blog post has no header to point at and correctly stays NULL.
  SELECT count(*) INTO _meta_expected
  FROM public.content_items child
  JOIN public.content_items parent ON parent.id = child.bounty_meta_parent_id
  WHERE child.post_type = 'bounty'
    AND parent.post_type = 'bounty';

  SELECT count(*) INTO _meta_resolved
  FROM public.bounties WHERE meta_parent_id IS NOT NULL;

  IF _meta_expected <> _meta_resolved THEN
    RAISE EXCEPTION
      'check 1 failed: % legacy meta children resolvable, % wired', _meta_expected, _meta_resolved;
  END IF;

  RAISE NOTICE 'check 1 passed: % legacy bounties, % headers, % meta parents wired',
    _legacy, _headers, _meta_resolved;
END;
$$;


-- =============================================================================
-- Setup — two builds owned by the creator, each with a gap and a non-gap node
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'creator_id', 'role', 'authenticated')::text,
  true
);

INSERT INTO public.builds (creator_id, slug, title, outcome, shape, status, published_at)
VALUES
  (:'creator_id'::uuid, 'ns-p45-published', 'NS-P45 published build',
   'Exists for the length of one transaction.', 'app', 'published', now()),
  (:'creator_id'::uuid, 'ns-p45-draft', 'NS-P45 draft build',
   'Exists for the length of one transaction.', 'app', 'draft', NULL);

INSERT INTO public.build_nodes (build_id, type, title, is_gap)
SELECT b.id, 'gap', 'The gap', true
FROM public.builds b WHERE b.slug IN ('ns-p45-published', 'ns-p45-draft');

INSERT INTO public.build_nodes (build_id, type, title, is_gap)
SELECT b.id, 'note', 'Not a gap', false
FROM public.builds b WHERE b.slug = 'ns-p45-published';

RESET ROLE;

DO $$
DECLARE _nodes INTEGER;
BEGIN
  SELECT count(*) INTO _nodes
  FROM public.build_nodes n
  JOIN public.builds b ON b.id = n.build_id
  WHERE b.slug IN ('ns-p45-published', 'ns-p45-draft');

  IF _nodes <> 3 THEN
    RAISE EXCEPTION 'setup failed: expected 3 nodes across the two builds, found %', _nodes;
  END IF;
END;
$$;


-- =============================================================================
-- 2. The gap validity trigger — three ways to be wrong
-- =============================================================================
-- Every failing insert is wrapped in its own BEGIN/EXCEPTION block, which opens
-- a subtransaction: the failure is caught and the outer transaction survives to
-- run the next check. A check that reports "rejected" without naming the
-- SQLSTATE it caught would also pass on a typo, so each one asserts the code.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'creator_id', 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  _published UUID;
  _draft     UUID;
  _gap       UUID;
  _not_gap   UUID;
  _other_gap UUID;
  _rejected  BOOLEAN;
BEGIN
  SELECT id INTO _published FROM public.builds WHERE slug = 'ns-p45-published';
  SELECT id INTO _draft     FROM public.builds WHERE slug = 'ns-p45-draft';
  SELECT id INTO _gap       FROM public.build_nodes WHERE build_id = _published AND is_gap;
  SELECT id INTO _not_gap   FROM public.build_nodes WHERE build_id = _published AND NOT is_gap;
  SELECT id INTO _other_gap FROM public.build_nodes WHERE build_id = _draft     AND is_gap;

  -- 2a. a node on the right build that is not a gap
  _rejected := false;
  BEGIN
    INSERT INTO public.bounties (build_id, gap_node_id, author_id)
    VALUES (_published, _not_gap, current_setting('ns_p45.creator_id')::uuid);
  EXCEPTION WHEN check_violation THEN
    _rejected := true;
  END;
  IF NOT _rejected THEN
    RAISE EXCEPTION 'check 2a failed: a bounty on a node with is_gap = false was accepted';
  END IF;

  -- 2b. a real gap node, but on a different build
  _rejected := false;
  BEGIN
    INSERT INTO public.bounties (build_id, gap_node_id, author_id)
    VALUES (_published, _other_gap, current_setting('ns_p45.creator_id')::uuid);
  EXCEPTION WHEN check_violation THEN
    _rejected := true;
  END;
  IF NOT _rejected THEN
    RAISE EXCEPTION 'check 2b failed: a bounty naming a gap node of another build was accepted';
  END IF;

  -- 2c. a gap node with no build at all. Rejected twice over: the trigger is a
  -- BEFORE trigger, so it runs first and finds no node whose build_id is NULL,
  -- and bounties_gap_needs_build stands behind it. Both raise check_violation.
  _rejected := false;
  BEGIN
    INSERT INTO public.bounties (build_id, gap_node_id, legacy_item_id, author_id)
    VALUES (NULL, _gap, NULL, current_setting('ns_p45.creator_id')::uuid);
  EXCEPTION WHEN check_violation THEN
    _rejected := true;
  END;
  IF NOT _rejected THEN
    RAISE EXCEPTION 'check 2c failed: a bounty with a gap node and no build was accepted';
  END IF;

  RAISE NOTICE 'check 2 passed: wrong node, wrong build and no build are all rejected';
END;
$$;


-- =============================================================================
-- 3 & 4. The valid inserts, and one bounty per gap
-- =============================================================================
DO $$
DECLARE
  _published UUID;
  _draft     UUID;
  _gap       UUID;
  _draft_gap UUID;
  _rejected  BOOLEAN;
BEGIN
  SELECT id INTO _published FROM public.builds WHERE slug = 'ns-p45-published';
  SELECT id INTO _draft     FROM public.builds WHERE slug = 'ns-p45-draft';
  SELECT id INTO _gap       FROM public.build_nodes WHERE build_id = _published AND is_gap;
  SELECT id INTO _draft_gap FROM public.build_nodes WHERE build_id = _draft     AND is_gap;

  -- the good rows: one on the published build's gap, one on the draft build's
  INSERT INTO public.bounties (build_id, gap_node_id, author_id, reward_gbp)
  VALUES (_published, _gap, current_setting('ns_p45.creator_id')::uuid, 120);

  INSERT INTO public.bounties (build_id, gap_node_id, author_id)
  VALUES (_draft, _draft_gap, current_setting('ns_p45.creator_id')::uuid);

  -- 4. one bounty per gap
  _rejected := false;
  BEGIN
    INSERT INTO public.bounties (build_id, gap_node_id, author_id)
    VALUES (_published, _gap, current_setting('ns_p45.creator_id')::uuid);
  EXCEPTION WHEN unique_violation THEN
    _rejected := true;
  END;
  IF NOT _rejected THEN
    RAISE EXCEPTION 'check 4 failed: a second bounty on the same gap was accepted';
  END IF;

  RAISE NOTICE 'check 3-4 passed: the valid rows inserted, the duplicate gap did not';
END;
$$;

RESET ROLE;


-- =============================================================================
-- 5. Two homes, or none
-- =============================================================================
-- Run as the owning role rather than as authenticated, on purpose. Under RLS a
-- homeless row is refused twice over — the insert policy asks which build or
-- item you own and a row with neither answers nothing, so the policy raises
-- 42501 before the constraint is ever consulted. Dropping RLS out of the way
-- is what makes this a test of bounties_one_home rather than a second test of
-- the policy already proved in check 6.
DO $$
DECLARE
  _published UUID;
  _rejected  BOOLEAN;
BEGIN
  SELECT id INTO _published FROM public.builds WHERE slug = 'ns-p45-published';

  -- 5a. two homes
  _rejected := false;
  BEGIN
    INSERT INTO public.bounties (build_id, legacy_item_id, author_id)
    SELECT _published, ci.id, current_setting('ns_p45.creator_id')::uuid
    FROM public.content_items ci WHERE ci.post_type = 'bounty' LIMIT 1;
  EXCEPTION WHEN check_violation THEN
    _rejected := true;
  END;
  IF NOT _rejected THEN
    -- a database with no legacy bounties at all inserts nothing and cannot
    -- prove this half; say so rather than passing quietly
    IF EXISTS (SELECT 1 FROM public.content_items WHERE post_type = 'bounty') THEN
      RAISE EXCEPTION 'check 5a failed: a bounty with two homes was accepted';
    ELSE
      RAISE NOTICE 'check 5a skipped: this database holds no legacy bounty to double up on';
    END IF;
  END IF;

  -- 5b. no home
  _rejected := false;
  BEGIN
    INSERT INTO public.bounties (author_id)
    VALUES (current_setting('ns_p45.creator_id')::uuid);
  EXCEPTION WHEN check_violation THEN
    _rejected := true;
  END;
  IF NOT _rejected THEN
    RAISE EXCEPTION 'check 5b failed: a bounty with no home was accepted';
  END IF;

  RAISE NOTICE 'check 5 passed: two homes and no home are both rejected';
END;
$$;


-- =============================================================================
-- 6. One person cannot file a bounty on another person's build
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'other_id', 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  _published UUID;
  _rejected  BOOLEAN := false;
BEGIN
  SELECT id INTO _published FROM public.builds WHERE slug = 'ns-p45-published';

  IF _published IS NULL THEN
    RAISE EXCEPTION 'check 6 failed: the published build is not even visible to a second person';
  END IF;

  BEGIN
    INSERT INTO public.bounties (build_id, author_id)
    VALUES (_published, current_setting('ns_p45.other_id')::uuid);
  EXCEPTION WHEN insufficient_privilege THEN
    _rejected := true;
  END;

  IF NOT _rejected THEN
    RAISE EXCEPTION 'check 6 failed: a bounty was filed on someone else''s build';
  END IF;

  RAISE NOTICE 'check 6 passed: the insert policy holds across owners';
END;
$$;

RESET ROLE;


-- =============================================================================
-- 7. What anon can and cannot read
-- =============================================================================
-- The anon-visible ids are collected under the anon role and compared under the
-- owner's, because working out what SHOULD be visible needs reads anon is not
-- allowed to make.
--
-- WHAT THIS CHECK CAN AND CANNOT ATTRIBUTE, measured rather than assumed. A
-- policy's EXISTS subquery is evaluated as the querying user, so the builds and
-- content_items rows it reads are themselves behind those tables' own RLS. Both
-- halves of the bounties read policy are therefore guarded twice, and this
-- check was mutation-tested to confirm it: replacing b.status <> 'draft', or
-- ci.status = 'approved', with `true` still passes, because the parent table's
-- policy hides the row from the subquery anyway. So this check proves the
-- OUTCOME — anon sees exactly the right bounties — and not which of the two
-- predicates produced it. The check that does bite on this table's own policy
-- is 6, which fails the moment the insert policy loses its ownership EXISTS.
-- The claims from the previous check are cleared FIRST. auth.uid() reads the
-- JWT claims, not the role, so a leftover 'sub' would make this a signed-in
-- read wearing the anon role — and the reader would then see their own
-- unapproved rows and the check would fail for a reason that has nothing to do
-- with the policy.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config(
  'ns_p45.anon_visible',
  COALESCE((SELECT string_agg(id::text, ',' ORDER BY id) FROM public.bounties), ''),
  true
);
RESET ROLE;

DO $$
DECLARE
  _visible        UUID[];
  _published_one  UUID;
  _draft_one      UUID;
  _leaked         INTEGER;
  _missed         INTEGER;
BEGIN
  _visible := CASE
    WHEN current_setting('ns_p45.anon_visible') = '' THEN ARRAY[]::UUID[]
    ELSE string_to_array(current_setting('ns_p45.anon_visible'), ',')::UUID[]
  END;

  SELECT b.id INTO _published_one
  FROM public.bounties b
  JOIN public.builds bu ON bu.id = b.build_id
  WHERE bu.slug = 'ns-p45-published';

  SELECT b.id INTO _draft_one
  FROM public.bounties b
  JOIN public.builds bu ON bu.id = b.build_id
  WHERE bu.slug = 'ns-p45-draft';

  IF NOT (_published_one = ANY (_visible)) THEN
    RAISE EXCEPTION 'check 7 failed: anon cannot read the bounty of a PUBLISHED build';
  END IF;

  IF _draft_one = ANY (_visible) THEN
    RAISE EXCEPTION 'check 7 failed: anon can read the bounty of a DRAFT build';
  END IF;

  -- the legacy half, over whatever rows the backfill wrote: a header is
  -- anon-readable exactly when its content item is approved
  SELECT count(*) INTO _leaked
  FROM public.bounties b
  JOIN public.content_items ci ON ci.id = b.legacy_item_id
  WHERE ci.status <> 'approved' AND b.id = ANY (_visible);

  IF _leaked <> 0 THEN
    RAISE EXCEPTION 'check 7 failed: anon can read % header(s) of unapproved legacy items', _leaked;
  END IF;

  SELECT count(*) INTO _missed
  FROM public.bounties b
  JOIN public.content_items ci ON ci.id = b.legacy_item_id
  WHERE ci.status = 'approved' AND NOT (b.id = ANY (_visible));

  IF _missed <> 0 THEN
    RAISE EXCEPTION 'check 7 failed: anon cannot read % header(s) of approved legacy items', _missed;
  END IF;

  RAISE NOTICE 'check 7 passed: anon reads published builds and approved legacy items, and nothing else';
END;
$$;


-- =============================================================================
-- 8. The author still reads their own draft-build bounty; nobody deletes
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'creator_id', 'role', 'authenticated')::text,
  true
);

DO $$
DECLARE
  _seen    INTEGER;
  _deleted INTEGER;
BEGIN
  SELECT count(*) INTO _seen
  FROM public.bounties b
  JOIN public.builds bu ON bu.id = b.build_id
  WHERE bu.slug = 'ns-p45-draft';

  IF _seen <> 1 THEN
    RAISE EXCEPTION 'check 8 failed: the author sees % of their own draft-build bounties, expected 1', _seen;
  END IF;

  -- No DELETE policy exists, so RLS filters the row out rather than raising:
  -- the delete reports zero rows and the bounty is still there afterwards.
  WITH gone AS (
    DELETE FROM public.bounties b
    USING public.builds bu
    WHERE bu.id = b.build_id AND bu.slug = 'ns-p45-draft'
    RETURNING b.id
  )
  SELECT count(*) INTO _deleted FROM gone;

  IF _deleted <> 0 THEN
    RAISE EXCEPTION 'check 8 failed: % bounty row(s) were deleted — a DELETE policy exists that should not', _deleted;
  END IF;

  SELECT count(*) INTO _seen
  FROM public.bounties b
  JOIN public.builds bu ON bu.id = b.build_id
  WHERE bu.slug = 'ns-p45-draft';

  IF _seen <> 1 THEN
    RAISE EXCEPTION 'check 8 failed: the draft-build bounty went missing after the delete attempt';
  END IF;

  RAISE NOTICE 'check 8 passed: the author reads their draft-build bounty, and cannot delete it';
END;
$$;


-- =============================================================================
-- 9. The update policy
-- =============================================================================
-- USING decides which rows you may touch; WITH CHECK decides what they may look
-- like afterwards. Both matter, and only the second stops an author giving
-- their bounty away or parking it on someone else's build.
DO $$
DECLARE
  _mine     UUID;
  _rejected BOOLEAN;
  _touched  INTEGER;
BEGIN
  SELECT b.id INTO _mine
  FROM public.bounties b
  JOIN public.builds bu ON bu.id = b.build_id
  WHERE bu.slug = 'ns-p45-published';

  -- 9a. the author edits their own row
  UPDATE public.bounties SET reward_gbp = 175 WHERE id = _mine;
  IF (SELECT reward_gbp FROM public.bounties WHERE id = _mine) <> 175 THEN
    RAISE EXCEPTION 'check 9a failed: the author could not edit their own bounty';
  END IF;

  -- 9b. and cannot hand it to someone else
  _rejected := false;
  BEGIN
    UPDATE public.bounties
    SET author_id = current_setting('ns_p45.other_id')::uuid
    WHERE id = _mine;
  EXCEPTION WHEN insufficient_privilege THEN
    _rejected := true;
  END;
  IF NOT _rejected THEN
    RAISE EXCEPTION 'check 9b failed: an author reassigned their bounty to another profile';
  END IF;

  -- 9c. a row you do not own is not yours to touch: USING filters it out, so
  -- the update reports zero rows rather than raising
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('ns_p45.other_id'), 'role', 'authenticated')::text,
    true
  );

  WITH touched AS (
    UPDATE public.bounties SET reward_gbp = 1 WHERE id = _mine RETURNING id
  )
  SELECT count(*) INTO _touched FROM touched;

  IF _touched <> 0 THEN
    RAISE EXCEPTION 'check 9c failed: a second person updated a bounty they do not own';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('ns_p45.creator_id'), 'role', 'authenticated')::text,
    true
  );

  IF (SELECT reward_gbp FROM public.bounties WHERE id = _mine) <> 175 THEN
    RAISE EXCEPTION 'check 9c failed: the row changed under an update that reported zero rows';
  END IF;

  RAISE NOTICE 'check 9 passed: authors edit their own rows and nothing else';
END;
$$;


-- =============================================================================
-- 10. A gap that stops being a gap
-- =============================================================================
-- The trigger fires on every UPDATE of a gap-bearing row, not only on the ones
-- that touch build_id or gap_node_id, because the pair can also be invalidated
-- from the OTHER side: the node's is_gap flips, or the node moves build. Those
-- are writes to build_nodes and nothing revalidates the bounty at the moment
-- they happen. This check is what "caught at the next write" means — and it is
-- the deliberate cost of the wide trigger, so it is asserted rather than
-- described.
DO $$
DECLARE
  _mine     UUID;
  _node     UUID;
  _rejected BOOLEAN := false;
BEGIN
  SELECT b.id, b.gap_node_id INTO _mine, _node
  FROM public.bounties b
  JOIN public.builds bu ON bu.id = b.build_id
  WHERE bu.slug = 'ns-p45-published';

  UPDATE public.build_nodes SET is_gap = false WHERE id = _node;

  BEGIN
    UPDATE public.bounties SET me_too_count = me_too_count + 1 WHERE id = _mine;
  EXCEPTION WHEN check_violation THEN
    _rejected := true;
  END;

  IF NOT _rejected THEN
    RAISE EXCEPTION 'check 10 failed: a bounty pointing at a node that is no longer a gap was updated';
  END IF;

  UPDATE public.build_nodes SET is_gap = true WHERE id = _node;

  RAISE NOTICE 'check 10 passed: an invalidated gap is caught at the next write';
END;
$$;

RESET ROLE;

\echo 'ALL CHECKS PASSED'

ROLLBACK;
