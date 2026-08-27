-- =============================================================================
-- NeoScale — rebuild counter acceptance checks (NS-P36)
-- =============================================================================
-- Proves the acceptances that are facts about Postgres rather than about
-- TypeScript:
--
--   1. publishing a draft child increments the SOURCE's rebuild_count
--   2. reverting that child to draft decrements it back to 0
--   3. deleting a published child decrements it
--   4. a child of a child touches only ITS parent's count
--
-- and, because they are the design claims the trigger rests on:
--
--   5. the increment happens across owners — the rebuilder is not the source's
--      creator, so a counter without SECURITY DEFINER would sit at zero here
--   6. published -> gallery is not a second rebuild
--   7. a decrement against a source already at 0 floors at 0
--   8. publishing a build with no parent writes nothing
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v source_creator_id=<a profiles.id uuid> \
--     -v rebuilder_id=<a DIFFERENT profiles.id uuid> \
--     -f supabase/tests/ns-p36-rebuild-count.sql
--
-- Both ids must be existing public.profiles rows, and they must not be the
-- same person — check 5 is meaningless otherwise.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind, and it is safe to run against a database with real rows in
-- it. It must be run as a role that can SET ROLE authenticated: the writes are
-- meant to be subject to row level security, not exempt from it.
--
-- Every check raises on failure, so a run that reaches "ALL CHECKS PASSED" has
-- passed all of them.
-- =============================================================================

\if :{?source_creator_id}
\else
  \echo 'ERROR: pass -v source_creator_id=<uuid> and -v rebuilder_id=<uuid>'
  \quit
\endif

\if :{?rebuilder_id}
\else
  \echo 'ERROR: pass -v rebuilder_id=<uuid>'
  \quit
\endif

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF current_setting('server_version_num')::int < 110000 THEN
    RAISE EXCEPTION 'these checks assume Postgres 11 or newer';
  END IF;
END;
$$;

SELECT
  set_config('ns_p36.source_creator_id', :'source_creator_id', true),
  set_config('ns_p36.rebuilder_id',      :'rebuilder_id',      true);

DO $$
BEGIN
  IF current_setting('ns_p36.source_creator_id') = current_setting('ns_p36.rebuilder_id') THEN
    RAISE EXCEPTION
      'the source creator and the rebuilder must be two different profiles — check 5 exists to prove the counter crosses that line';
  END IF;
END;
$$;


-- =============================================================================
-- Setup — a published source, owned by one person
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'source_creator_id', 'role', 'authenticated')::text,
  true
);

INSERT INTO public.builds (creator_id, slug, title, outcome, shape, status, published_at)
VALUES (
  :'source_creator_id'::uuid,
  'ns-p36-source',
  'NS-P36 source build',
  'Exists for the length of one transaction.',
  'app',
  'published',
  now()
);

RESET ROLE;

DO $$
DECLARE
  b public.builds%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.builds WHERE slug = 'ns-p36-source';

  IF b.id IS NULL THEN
    RAISE EXCEPTION 'setup failed: the source build was not inserted';
  END IF;
  IF b.rebuild_count <> 0 THEN
    RAISE EXCEPTION 'setup failed: a fresh build starts at rebuild_count %, expected 0', b.rebuild_count;
  END IF;
END;
$$;


-- =============================================================================
-- 1 & 5. Publishing a draft child increments the source, across owners
-- =============================================================================
-- The fork is written as a DRAFT, which is what src/lib/build/fork.ts produces,
-- and the draft alone must move nothing: an unpublished fork of your build is
-- the forker's business, not yours.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'rebuilder_id', 'role', 'authenticated')::text,
  true
);

INSERT INTO public.builds (
  creator_id, slug, title, outcome, shape, status,
  parent_build_id, root_build_id,
  rebuild_note, source_title_at_fork, source_handle_at_fork
)
SELECT
  :'rebuilder_id'::uuid,
  'ns-p36-rebuild',
  'NS-P36 rebuild of the source',
  'Exists for the length of one transaction.',
  'app',
  'draft',
  s.id,
  s.id,
  'Swapped the model and cut the retry loop.',
  s.title,
  p.username
FROM public.builds s
JOIN public.profiles p ON p.id = s.creator_id
WHERE s.slug = 'ns-p36-source';

RESET ROLE;

DO $$
DECLARE
  _count integer;
BEGIN
  SELECT rebuild_count INTO _count FROM public.builds WHERE slug = 'ns-p36-source';
  IF _count <> 0 THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: a DRAFT fork moved the count to %, expected 0', _count;
  END IF;
  RAISE NOTICE 'check 1 passed so far: a draft fork counts for nothing';
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'rebuilder_id', 'role', 'authenticated')::text,
  true
);

UPDATE public.builds
SET status = 'published', published_at = now()
WHERE slug = 'ns-p36-rebuild';

RESET ROLE;

DO $$
DECLARE
  _count integer;
BEGIN
  SELECT rebuild_count INTO _count FROM public.builds WHERE slug = 'ns-p36-source';
  IF _count <> 1 THEN
    RAISE EXCEPTION
      'ACCEPTANCE 1 FAILED: publishing the child left the source at %, expected 1', _count;
  END IF;
  RAISE NOTICE 'acceptance 1 and check 5 passed: a published rebuild of ANOTHER PERSON''S build counted';
END;
$$;


-- =============================================================================
-- 2. Reverting the child to draft decrements to 0
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'rebuilder_id', 'role', 'authenticated')::text,
  true
);

UPDATE public.builds SET status = 'draft' WHERE slug = 'ns-p36-rebuild';

RESET ROLE;

DO $$
DECLARE
  _count integer;
BEGIN
  SELECT rebuild_count INTO _count FROM public.builds WHERE slug = 'ns-p36-source';
  IF _count <> 0 THEN
    RAISE EXCEPTION
      'ACCEPTANCE 2 FAILED: unpublishing the child left the source at %, expected 0', _count;
  END IF;
  RAISE NOTICE 'acceptance 2 passed: withdrawing a rebuild withdraws the point';
END;
$$;


-- =============================================================================
-- 6. published -> gallery is not a second rebuild
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'rebuilder_id', 'role', 'authenticated')::text,
  true
);

UPDATE public.builds SET status = 'published', published_at = now() WHERE slug = 'ns-p36-rebuild';
UPDATE public.builds SET status = 'gallery' WHERE slug = 'ns-p36-rebuild';

RESET ROLE;

DO $$
DECLARE
  _count integer;
BEGIN
  SELECT rebuild_count INTO _count FROM public.builds WHERE slug = 'ns-p36-source';
  IF _count <> 1 THEN
    RAISE EXCEPTION
      'CHECK 6 FAILED: promoting the child to gallery left the source at %, expected 1', _count;
  END IF;
  RAISE NOTICE 'check 6 passed: a curated rebuild is still one rebuild';
END;
$$;


-- =============================================================================
-- 4. A child of a child touches only ITS parent's count
-- =============================================================================
-- The grandchild names the REBUILD as its parent and the source as its root.
-- The source must not move: rebuild_count is the count of direct children, and
-- a lineage does not accumulate upwards.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'source_creator_id', 'role', 'authenticated')::text,
  true
);

INSERT INTO public.builds (
  creator_id, slug, title, outcome, shape, status,
  parent_build_id, root_build_id, source_title_at_fork
)
SELECT
  :'source_creator_id'::uuid,
  'ns-p36-rebuild-of-rebuild',
  'NS-P36 rebuild of the rebuild',
  'Exists for the length of one transaction.',
  'app',
  'draft',
  r.id,
  r.root_build_id,
  r.title
FROM public.builds r
WHERE r.slug = 'ns-p36-rebuild';

UPDATE public.builds
SET status = 'published', published_at = now()
WHERE slug = 'ns-p36-rebuild-of-rebuild';

RESET ROLE;

DO $$
DECLARE
  _source integer;
  _middle integer;
BEGIN
  SELECT rebuild_count INTO _source FROM public.builds WHERE slug = 'ns-p36-source';
  SELECT rebuild_count INTO _middle FROM public.builds WHERE slug = 'ns-p36-rebuild';

  IF _middle <> 1 THEN
    RAISE EXCEPTION
      'ACCEPTANCE 4 FAILED: the middle build is at %, expected 1', _middle;
  END IF;
  IF _source <> 1 THEN
    RAISE EXCEPTION
      'ACCEPTANCE 4 FAILED: a grandchild moved the source to %, expected it to stay at 1', _source;
  END IF;
  RAISE NOTICE 'acceptance 4 passed: the count is direct children, not descendants';
END;
$$;


-- =============================================================================
-- 3. Deleting a published child decrements
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'source_creator_id', 'role', 'authenticated')::text,
  true
);

DELETE FROM public.builds WHERE slug = 'ns-p36-rebuild-of-rebuild';

RESET ROLE;

DO $$
DECLARE
  _middle integer;
BEGIN
  SELECT rebuild_count INTO _middle FROM public.builds WHERE slug = 'ns-p36-rebuild';
  IF _middle <> 0 THEN
    RAISE EXCEPTION
      'ACCEPTANCE 3 FAILED: deleting the published child left its parent at %, expected 0', _middle;
  END IF;
  RAISE NOTICE 'acceptance 3 passed: a deleted rebuild takes its point with it';
END;
$$;


-- =============================================================================
-- 7. A decrement against a source already at 0 floors at 0
-- =============================================================================
-- Drift is forced by hand here — nothing in the application writes
-- rebuild_count directly — because the floor exists precisely for the state no
-- legitimate path produces.
UPDATE public.builds SET rebuild_count = 0 WHERE slug = 'ns-p36-source';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'rebuilder_id', 'role', 'authenticated')::text,
  true
);

UPDATE public.builds SET status = 'draft' WHERE slug = 'ns-p36-rebuild';

RESET ROLE;

DO $$
DECLARE
  _count integer;
BEGIN
  SELECT rebuild_count INTO _count FROM public.builds WHERE slug = 'ns-p36-source';
  IF _count <> 0 THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: the counter went to %, expected it to floor at 0', _count;
  END IF;
  RAISE NOTICE 'check 7 passed: the counter floors at 0 rather than going negative';
END;
$$;


-- =============================================================================
-- 8. Publishing a build with no parent writes nothing
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'rebuilder_id', 'role', 'authenticated')::text,
  true
);

INSERT INTO public.builds (creator_id, slug, title, outcome, shape, status)
VALUES (
  :'rebuilder_id'::uuid,
  'ns-p36-orphan',
  'NS-P36 build that is nobody''s child',
  'Exists for the length of one transaction.',
  'app',
  'draft'
);

UPDATE public.builds
SET status = 'published', published_at = now()
WHERE slug = 'ns-p36-orphan';

RESET ROLE;

DO $$
DECLARE
  _count integer;
  _source integer;
BEGIN
  SELECT rebuild_count INTO _count  FROM public.builds WHERE slug = 'ns-p36-orphan';
  SELECT rebuild_count INTO _source FROM public.builds WHERE slug = 'ns-p36-source';

  IF _count <> 0 OR _source <> 0 THEN
    RAISE EXCEPTION
      'CHECK 8 FAILED: publishing a parentless build moved something — orphan %, source %',
      _count, _source;
  END IF;
  RAISE NOTICE 'check 8 passed: an ordinary publish is not a rebuild';
END;
$$;


-- =============================================================================
-- The backfill agrees with the trigger
-- =============================================================================
-- Section 2 of the migration is the repair for a drifted counter, so it must
-- produce exactly what the trigger has been maintaining. Re-run it here and
-- prove it changes nothing.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'rebuilder_id', 'role', 'authenticated')::text,
  true
);
UPDATE public.builds SET status = 'published', published_at = now() WHERE slug = 'ns-p36-rebuild';
RESET ROLE;

DO $$
DECLARE
  _drifted integer;
BEGIN
  SELECT count(*) INTO _drifted
  FROM public.builds p
  LEFT JOIN (
    SELECT b.parent_build_id, count(*)::INTEGER AS published_children
    FROM public.builds b
    WHERE b.parent_build_id IS NOT NULL
      AND b.status IN ('published', 'gallery')
    GROUP BY b.parent_build_id
  ) c ON c.parent_build_id = p.id
  WHERE p.rebuild_count IS DISTINCT FROM COALESCE(c.published_children, 0)
    AND p.slug LIKE 'ns-p36-%';

  IF _drifted <> 0 THEN
    RAISE EXCEPTION
      'CHECK FAILED: % of this run''s rows disagree with a fresh recount', _drifted;
  END IF;
  RAISE NOTICE 'check passed: the trigger and the backfill agree';
END;
$$;

\echo 'ALL CHECKS PASSED'

ROLLBACK;
